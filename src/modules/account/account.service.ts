import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateProfileDto } from '../profile/dto/update-profile.dto';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import * as bcrypt from 'bcrypt';
import Stripe from 'stripe';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  private readonly stripe: any | null;
  private readonly setupSuccessUrl: string;
  private readonly setupCancelUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.setupSuccessUrl =
      this.configService.get<string>('STRIPE_SETUP_SUCCESS_URL') ||
      'http://localhost:3000/profile?tab=Billing&setup=success';
    this.setupCancelUrl =
      this.configService.get<string>('STRIPE_SETUP_CANCEL_URL') ||
      'http://localhost:3000/profile?tab=Billing&setup=cancel';
    this.stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
  }

  async create(dto: CreateAccountDto) {
    const hashedPassword = await bcrypt.hash(dto.motDePasse, 10);
    return this.prisma.account.create({
      data: {
        ...dto,
        motDePasse: hashedPassword,
      },
      include: { profile: true },
    });
  }

  findAll() {
    return this.prisma.account.findMany({ include: { profile: true } });
  }

  findOne(id: number) {
    return this.prisma.account.findUnique({ where: { id }, include: { profile: true } });
  }

  update(id: number, dto: UpdateAccountDto) {
    return this.prisma.account.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.account.delete({ where: { id } });
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const account = await this.prisma.account.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    });
    if (account) {
      const accountPasswordValid = await bcrypt.compare(password, account.motDePasse);
      if (!accountPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const { motDePasse, ...result } = account;
      return {
        ...result,
        role: result.email.toLowerCase().includes('admin') ? 'admin' : 'client',
      };
    }

    const agency = await this.prisma.agenceVoyage.findUnique({
      where: { email: normalizedEmail },
    });

    if (!agency || !agency.actif) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let agencyPasswordValid = false;
    if (agency.motDePasse.startsWith('$2a$') || agency.motDePasse.startsWith('$2b$')) {
      agencyPasswordValid = await bcrypt.compare(password, agency.motDePasse);
    } else if (password === agency.motDePasse) {
      agencyPasswordValid = true;
      const migratedHash = await bcrypt.hash(password, 10);
      await this.prisma.agenceVoyage.update({
        where: { id: agency.id },
        data: { motDePasse: migratedHash },
      });
    }

    if (!agencyPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      id: -agency.id,
      email: agency.email,
      dateInscription: new Date().toISOString(),
      actif: agency.actif,
      role: 'admin',
      profile: null,
    };
  }

  async googleLogin(data: { email: string; firstName: string; lastName: string; uid: string }) {
    let account = await this.prisma.account.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (!account) {
      // Create new account with dummy password
      const dummyPassword = await bcrypt.hash(data.uid + Math.random().toString(), 10);
      account = await this.prisma.account.create({
        data: {
          email: data.email,
          motDePasse: dummyPassword,
          profile: {
            create: {
              nom: data.lastName || '',
              prenom: data.firstName || 'Google User',
            }
          }
        },
        include: { profile: true },
      });
    }

    const { motDePasse, ...result } = account;
    return result;
  }

  async getProfile(accountId: number) {
    return this.prisma.profile.findUnique({
      where: { accountId },
      include: {
        account: {
          select: {
            paymentMethods: {
              orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            },
          },
        },
      },
    });
  }

  async updateProfile(accountId: number, data: UpdateProfileDto) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const { accountId: _ignored, ...profileData } = this.normalizeProfileData(data);

    return this.prisma.profile.upsert({
      where: { accountId },
      update: profileData,
      create: {
        accountId,
        ...profileData,
        nom: profileData.nom?.trim() || 'User',
        prenom: profileData.prenom?.trim() || 'Guest',
      },
      include: {
        account: {
          select: {
            paymentMethods: {
              orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            },
          },
        },
      },
    });
  }

  async listPaymentMethods(accountId: number) {
    return this.prisma.paymentMethod.findMany({
      where: { accountId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createPaymentMethodSetupSession(accountId: number, dto: CreatePaymentMethodDto) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: {
        paymentMethods: {
          select: { id: true },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const stripeCustomerId = await this.ensureStripeCustomer(accountId);
    const shouldBeDefault = dto.isDefault ?? account.paymentMethods.length === 0;

    let session: any;
    try {
      session = await this.stripe.checkout.sessions.create({
        mode: 'setup',
        payment_method_types: ['card'],
        customer: stripeCustomerId,
        success_url: this.appendQueryParams(this.setupSuccessUrl, {
          session_id: '{CHECKOUT_SESSION_ID}',
          tab: 'Billing',
        }),
        cancel_url: this.appendQueryParams(this.setupCancelUrl, {
          tab: 'Billing',
        }),
        metadata: {
          accountId: accountId.toString(),
          shouldBeDefault: shouldBeDefault ? 'true' : 'false',
        },
        customer_update: {
          name: 'auto',
        },
      });
    } catch (error) {
      this.rethrowStripeError(error, 'Unable to initialize Stripe setup session');
    }

    if (!session.url) {
      throw new InternalServerErrorException('Stripe setup URL is missing');
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async confirmPaymentMethodSetupSession(accountId: number, sessionId: string) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured');
    }

    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    let session: any;
    try {
      session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['setup_intent'],
      });
    } catch (error) {
      this.rethrowStripeError(error, 'Unable to fetch Stripe setup session');
    }

    if (session.mode !== 'setup' || session.status !== 'complete') {
      throw new BadRequestException('Stripe setup session is not completed');
    }

    const metadataAccountId = Number.parseInt(session.metadata?.accountId || '', 10);
    if (metadataAccountId !== accountId) {
      throw new BadRequestException('Setup session does not belong to this account');
    }

    const stripeCustomerId = await this.ensureStripeCustomer(accountId);
    const setupIntent =
      typeof session.setup_intent === 'string'
        ? await this.stripe.setupIntents.retrieve(session.setup_intent)
        : session.setup_intent;
    const stripePaymentMethodId = this.extractSetupPaymentMethodId(setupIntent);
    if (!stripePaymentMethodId) {
      throw new BadRequestException('Setup session is missing a payment method');
    }

    let stripePaymentMethod: any;
    try {
      stripePaymentMethod = await this.stripe.paymentMethods.retrieve(stripePaymentMethodId);
    } catch (error) {
      this.rethrowStripeError(error, 'Unable to fetch Stripe payment method');
    }

    if (!stripePaymentMethod.card) {
      throw new BadRequestException('Only card payment methods are supported');
    }
    const paymentMethodCustomerId =
      typeof stripePaymentMethod.customer === 'string'
        ? stripePaymentMethod.customer
        : stripePaymentMethod.customer?.id || null;
    if (paymentMethodCustomerId && paymentMethodCustomerId !== stripeCustomerId) {
      throw new BadRequestException('Payment method customer mismatch');
    }
    if (!paymentMethodCustomerId) {
      try {
        await this.stripe.paymentMethods.attach(stripePaymentMethodId, {
          customer: stripeCustomerId,
        });
      } catch (error) {
        this.rethrowStripeError(error, 'Unable to attach payment method to customer');
      }
    }

    const shouldBeDefault = session.metadata?.shouldBeDefault === 'true';

    const saved = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentMethod.findFirst({
        where: { accountId, stripePaymentMethodId },
      });
      const existingAny = existing || (await tx.paymentMethod.findFirst({ where: { accountId } }));
      const shouldSetDefault = shouldBeDefault || !existingAny;

      if (shouldBeDefault) {
        await tx.paymentMethod.updateMany({
          where: { accountId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const payload = {
        accountId,
        stripePaymentMethodId,
        stripeCustomerId,
        stripeSetupIntentId: setupIntent?.id || null,
        cardholderName: null,
        brand: this.normalizeCardBrand(stripePaymentMethod.card.brand),
        last4: stripePaymentMethod.card.last4,
        expiryMonth: stripePaymentMethod.card.exp_month,
        expiryYear: stripePaymentMethod.card.exp_year,
        isDefault: shouldSetDefault ? true : (existing?.isDefault ?? false),
      };

      return existing
        ? await tx.paymentMethod.update({
            where: { id: existing.id },
            data: payload,
          })
        : await tx.paymentMethod.create({
            data: payload,
          });
    });

    if (saved.isDefault) {
      await this.syncStripeDefaultPaymentMethod(accountId, stripePaymentMethodId);
    }

    return saved;
  }

  async updatePaymentMethod(
    accountId: number,
    paymentMethodId: number,
    dto: UpdatePaymentMethodDto,
  ) {
    const existing = await this.ensurePaymentMethodOwnership(accountId, paymentMethodId);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault !== true) {
        return existing;
      }

      await tx.paymentMethod.updateMany({
        where: { accountId, isDefault: true, NOT: { id: paymentMethodId } },
        data: { isDefault: false },
      });

      return tx.paymentMethod.update({
        where: { id: paymentMethodId },
        data: {
          isDefault: true,
        },
      });
    });

    if (dto.isDefault === true) {
      await this.syncStripeDefaultPaymentMethod(accountId, updated.stripePaymentMethodId);
    }

    return updated;
  }

  async removePaymentMethod(accountId: number, paymentMethodId: number) {
    const existing = await this.ensurePaymentMethodOwnership(accountId, paymentMethodId);

    const nextDefault = await this.prisma.$transaction(async (tx) => {
      await tx.paymentMethod.delete({ where: { id: paymentMethodId } });

      if (existing.isDefault) {
        const fallback = await tx.paymentMethod.findFirst({
          where: { accountId },
          orderBy: { createdAt: 'asc' },
        });

        if (fallback) {
          await tx.paymentMethod.update({
            where: { id: fallback.id },
            data: { isDefault: true },
          });
          return fallback.stripePaymentMethodId;
        }
      }
      return existing.isDefault ? null : undefined;
    });

    if (nextDefault !== undefined) {
      await this.syncStripeDefaultPaymentMethod(accountId, nextDefault);
    }

    if (this.stripe && existing.stripePaymentMethodId) {
      try {
        await this.stripe.paymentMethods.detach(existing.stripePaymentMethodId);
      } catch (error) {
        this.logger.warn(
          `Failed to detach Stripe payment method ${existing.stripePaymentMethodId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  async changePassword(accountId: number, oldPassword: string, newPassword: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // Verify old password
    const isValid = await bcrypt.compare(oldPassword, account.motDePasse);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    return this.prisma.account.update({
      where: { id: accountId },
      data: { motDePasse: hashedPassword }
    });
  }

  private async ensureStripeCustomer(accountId: number) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { profile: true },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.stripeCustomerId) {
      return account.stripeCustomerId;
    }

    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured');
    }

    let customer: any;
    try {
      customer = await this.stripe.customers.create({
        email: account.email,
        name: `${account.profile?.prenom || ''} ${account.profile?.nom || ''}`.trim() || undefined,
        metadata: {
          accountId: account.id.toString(),
        },
      });
    } catch (error) {
      this.rethrowStripeError(error, 'Unable to create Stripe customer');
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  private async syncStripeDefaultPaymentMethod(
    accountId: number,
    stripePaymentMethodId: string | null,
  ) {
    if (!this.stripe) {
      return;
    }

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { stripeCustomerId: true },
    });

    if (!account?.stripeCustomerId) {
      return;
    }

    try {
      await this.stripe.customers.update(account.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: stripePaymentMethodId,
        },
      });
    } catch (error) {
      this.rethrowStripeError(error, 'Unable to set Stripe default payment method');
    }
  }

  private async ensurePaymentMethodOwnership(accountId: number, paymentMethodId: number) {
    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, accountId },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    return paymentMethod;
  }

  private extractSetupPaymentMethodId(setupIntent: any): string | null {
    if (!setupIntent?.payment_method) {
      return null;
    }

    return typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method.id || null;
  }

  private normalizeCardBrand(value: string): string {
    const brand = (value || '').toLowerCase();
    if (brand === 'visa' || brand === 'mastercard' || brand === 'amex' || brand === 'discover') {
      return brand;
    }
    return 'other';
  }

  private appendQueryParams(url: string, query: Record<string, string>) {
    const serialized = Object.entries(query)
      .map(([key, value]) => {
        const serializedValue = value.includes('{') ? value : encodeURIComponent(value);
        return `${encodeURIComponent(key)}=${serializedValue}`;
      })
      .join('&');

    return url.includes('?') ? `${url}&${serialized}` : `${url}?${serialized}`;
  }

  private rethrowStripeError(error: any, fallbackMessage: string): never {
    if (error && typeof error === 'object') {
      const stripeError = error as any;
      if (stripeError.type === 'StripeAuthenticationError') {
        this.logger.error('Stripe authentication failed. Check STRIPE_SECRET_KEY.');
        throw new ServiceUnavailableException('Payment provider is temporarily unavailable');
      }
      if (stripeError.type === 'StripeInvalidRequestError') {
        throw new BadRequestException(stripeError.message || fallbackMessage);
      }
      if (stripeError.type === 'StripeConnectionError') {
        throw new ServiceUnavailableException('Payment provider connection failed');
      }
    }

    this.logger.error(`${fallbackMessage}: ${error?.message || error}`);
    throw new InternalServerErrorException(fallbackMessage);
  }

  private normalizeProfileData<
    T extends { dateNaissance?: string | Date | null; numeroPasseport?: string | null },
  >(data: T): T {
    const normalizedDate =
      data.dateNaissance &&
      typeof data.dateNaissance === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.dateNaissance)
        ? new Date(`${data.dateNaissance}T00:00:00.000Z`)
        : data.dateNaissance;

    const normalizedPassport =
      typeof data.numeroPasseport === 'string'
        ? data.numeroPasseport.trim().toUpperCase()
        : data.numeroPasseport;

    return {
      ...data,
      dateNaissance: normalizedDate,
      numeroPasseport: normalizedPassport,
    };
  }
}
