import {
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountRole, AuthProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateProfileDto } from '../profile/dto/update-profile.dto';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import Stripe from 'stripe';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  private readonly stripe: any | null;
  private readonly setupSuccessUrl: string;
  private readonly setupCancelUrl: string;
  private readonly firebaseApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.setupSuccessUrl =
      this.configService.get<string>('STRIPE_SETUP_SUCCESS_URL') ||
      'https://agence-bay.vercel.app/profile?tab=Billing&setup=success';
    this.setupCancelUrl =
      this.configService.get<string>('STRIPE_SETUP_CANCEL_URL') ||
      'https://agence-bay.vercel.app/profile?tab=Billing&setup=cancel';
    this.stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
    this.firebaseApiKey =
      this.configService.get<string>('FIREBASE_API_KEY') || '';
  }

  async create(dto: CreateAccountDto) {
    const hashedPassword = await bcrypt.hash(dto.motDePasse, 10);
    const created = await this.prisma.account.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        motDePasse: hashedPassword,
        actif: dto.actif ?? true,
        emailVerified: false,
        authProvider: AuthProvider.LOCAL,
        role: dto.role ?? AccountRole.CLIENT,
      },
      include: { profile: true },
    });
    return this.sanitizeAccount(created);
  }

  async findAll() {
    const accounts = await this.prisma.account.findMany({
      include: { profile: true },
    });
    return accounts.map((account) => this.sanitizeAccount(account));
  }

  async findOne(id: number) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: { profile: true },
    });
    return account ? this.sanitizeAccount(account) : null;
  }

  async update(id: number, dto: UpdateAccountDto) {
    const account = await this.prisma.account.update({
      where: { id },
      data: {
        ...(dto.email !== undefined
          ? { email: dto.email.trim().toLowerCase() }
          : {}),
        ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.motDePasse !== undefined
          ? { motDePasse: await bcrypt.hash(dto.motDePasse, 10) }
          : {}),
      },
      include: { profile: true },
    });

    return this.sanitizeAccount(account);
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
      let accountPasswordValid = false;
      const storedPassword = account.motDePasse || '';
      const isBcryptHash =
        storedPassword.startsWith('$2a$') ||
        storedPassword.startsWith('$2b$') ||
        storedPassword.startsWith('$2y$');

      if (isBcryptHash) {
        // Some legacy datasets use $2y$; bcrypt expects $2b$ semantics.
        const normalizedHash = storedPassword.startsWith('$2y$')
          ? `$2b$${storedPassword.slice(4)}`
          : storedPassword;
        accountPasswordValid = await bcrypt.compare(password, normalizedHash);
      } else if (password === storedPassword) {
        // Legacy plain-text password migration path.
        accountPasswordValid = true;
        const migratedHash = await bcrypt.hash(password, 10);
        await this.prisma.account.update({
          where: { id: account.id },
          data: { motDePasse: migratedHash },
        });
      }

      if (!accountPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }
      return this.sanitizeAccount(account);
    }

    const agency = await this.prisma.agenceVoyage.findUnique({
      where: { email: normalizedEmail },
    });

    if (!agency || !agency.actif) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let agencyPasswordValid = false;
    if (
      agency.motDePasse.startsWith('$2a$') ||
      agency.motDePasse.startsWith('$2b$')
    ) {
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

  async googleLogin(data: {
    email: string;
    firstName: string;
    lastName: string;
    uid: string;
  }) {
    let account = await this.prisma.account.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (!account) {
      // Create new account with dummy password
      const dummyPassword = await bcrypt.hash(
        data.uid + Math.random().toString(),
        10,
      );
      account = await this.prisma.account.create({
        data: {
          email: data.email,
          motDePasse: dummyPassword,
          role: AccountRole.CLIENT,
          emailVerified: true,
          authProvider: AuthProvider.GOOGLE,
          profile: {
            create: {
              nom: data.lastName || '',
              prenom: data.firstName || 'Google User',
            },
          },
        },
        include: { profile: true },
      });

      await this.sendWelcomeEmail(account.email, data.firstName || 'Traveler');
    }

    return this.sanitizeAccount(account);
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
    await this.ensureAccountIsVerified(accountId);
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const { accountId: _ignored, ...profileData } =
      this.normalizeProfileData(data);

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
    await this.ensureAccountIsVerified(accountId);
    return this.prisma.paymentMethod.findMany({
      where: { accountId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getWishlist(accountId: number) {
    await this.ensureAccountIsVerified(accountId);
    await this.ensureAccountExists(accountId);

    const items = await this.prisma.wishlistHotel.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      select: {
        hotelId: true,
      },
    });

    return {
      accountId,
      hotelIds: items.map((item) => item.hotelId),
    };
  }

  async addWishlistHotel(accountId: number, hotelId: number) {
    await this.ensureAccountIsVerified(accountId);
    await this.ensureAccountExists(accountId);
    await this.ensureHotelExists(hotelId);

    await this.prisma.wishlistHotel.upsert({
      where: {
        accountId_hotelId: {
          accountId,
          hotelId,
        },
      },
      update: {},
      create: {
        accountId,
        hotelId,
      },
    });

    const list = await this.getWishlist(accountId);
    return {
      success: true,
      saved: true,
      accountId,
      hotelId,
      hotelIds: list.hotelIds,
    };
  }

  async removeWishlistHotel(accountId: number, hotelId: number) {
    await this.ensureAccountIsVerified(accountId);
    await this.ensureAccountExists(accountId);

    await this.prisma.wishlistHotel.deleteMany({
      where: {
        accountId,
        hotelId,
      },
    });

    const list = await this.getWishlist(accountId);
    return {
      success: true,
      removed: true,
      accountId,
      hotelId,
      hotelIds: list.hotelIds,
    };
  }

  async createPaymentMethodSetupSession(
    accountId: number,
    dto: CreatePaymentMethodDto,
  ) {
    await this.ensureAccountIsVerified(accountId);
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
    const shouldBeDefault =
      dto.isDefault ?? account.paymentMethods.length === 0;

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
      this.rethrowStripeError(
        error,
        'Unable to initialize Stripe setup session',
      );
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
    await this.ensureAccountIsVerified(accountId);
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
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

    const metadataAccountId = Number.parseInt(
      session.metadata?.accountId || '',
      10,
    );
    if (metadataAccountId !== accountId) {
      throw new BadRequestException(
        'Setup session does not belong to this account',
      );
    }

    const stripeCustomerId = await this.ensureStripeCustomer(accountId);
    const setupIntent =
      typeof session.setup_intent === 'string'
        ? await this.stripe.setupIntents.retrieve(session.setup_intent)
        : session.setup_intent;
    const stripePaymentMethodId = this.extractSetupPaymentMethodId(setupIntent);
    if (!stripePaymentMethodId) {
      throw new BadRequestException(
        'Setup session is missing a payment method',
      );
    }

    let stripePaymentMethod: any;
    try {
      stripePaymentMethod = await this.stripe.paymentMethods.retrieve(
        stripePaymentMethodId,
      );
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
    if (
      paymentMethodCustomerId &&
      paymentMethodCustomerId !== stripeCustomerId
    ) {
      throw new BadRequestException('Payment method customer mismatch');
    }
    if (!paymentMethodCustomerId) {
      try {
        await this.stripe.paymentMethods.attach(stripePaymentMethodId, {
          customer: stripeCustomerId,
        });
      } catch (error) {
        this.rethrowStripeError(
          error,
          'Unable to attach payment method to customer',
        );
      }
    }

    const shouldBeDefault = session.metadata?.shouldBeDefault === 'true';

    const saved = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentMethod.findFirst({
        where: { accountId, stripePaymentMethodId },
      });
      const existingAny =
        existing ||
        (await tx.paymentMethod.findFirst({ where: { accountId } }));
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
      await this.syncStripeDefaultPaymentMethod(
        accountId,
        stripePaymentMethodId,
      );
    }

    return saved;
  }

  async updatePaymentMethod(
    accountId: number,
    paymentMethodId: number,
    dto: UpdatePaymentMethodDto,
  ) {
    await this.ensureAccountIsVerified(accountId);
    const existing = await this.ensurePaymentMethodOwnership(
      accountId,
      paymentMethodId,
    );

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
      await this.syncStripeDefaultPaymentMethod(
        accountId,
        updated.stripePaymentMethodId,
      );
    }

    return updated;
  }

  async removePaymentMethod(accountId: number, paymentMethodId: number) {
    await this.ensureAccountIsVerified(accountId);
    const existing = await this.ensurePaymentMethodOwnership(
      accountId,
      paymentMethodId,
    );

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

  async changePassword(
    accountId: number,
    oldPassword: string,
    newPassword: string,
  ) {
    await this.ensureAccountIsVerified(accountId);
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { profile: true },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.authProvider === AuthProvider.GOOGLE) {
      throw new BadRequestException(
        'This account uses Google sign-in. Password updates are not available.',
      );
    }

    const currentStoredPassword = account.motDePasse || '';
    const isBcryptHash =
      currentStoredPassword.startsWith('$2a$') ||
      currentStoredPassword.startsWith('$2b$') ||
      currentStoredPassword.startsWith('$2y$');

    let isValid = false;
    if (isBcryptHash) {
      const normalizedHash = currentStoredPassword.startsWith('$2y$')
        ? `$2b$${currentStoredPassword.slice(4)}`
        : currentStoredPassword;
      isValid = await bcrypt.compare(oldPassword, normalizedHash);
    } else {
      isValid = oldPassword === currentStoredPassword;
    }

    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (!newPassword || newPassword.trim().length < 8) {
      throw new BadRequestException(
        'New password must contain at least 8 characters',
      );
    }

    if (oldPassword === newPassword) {
      throw new ConflictException(
        'New password must be different from current password',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.account.update({
      where: { id: accountId },
      data: { motDePasse: hashedPassword },
    });

    await this.sendPasswordChangedEmail(
      account.email,
      account.profile?.prenom || 'Traveler',
    );

    return { success: true };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const account = await this.prisma.account.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        actif: true,
        authProvider: true,
        profile: {
          select: {
            prenom: true,
          },
        },
      },
    });
    const agency = await this.prisma.agenceVoyage.findUnique({
      where: { email: normalizedEmail },
    });

    if ((!account || !account.actif) && (!agency || !agency.actif)) {
      return {
        success: true,
        message:
          'If an account exists for this email, a reset link has been sent.',
      };
    }
    if (account?.authProvider === AuthProvider.GOOGLE) {
      throw new BadRequestException(
        'This account uses Google sign-in. Password reset is not available.',
      );
    }

    await this.prisma.passwordResetToken.updateMany({
      where: {
        email: normalizedEmail,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        email: normalizedEmail,
        tokenHash,
        expiresAt,
        accountId: account?.id,
        agenceVoyageId: agency?.id,
      },
    });

    const resetUrl = `${this.mailService.getAppWebUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const userName =
      account?.profile?.prenom ||
      agency?.nomAgence ||
      normalizedEmail.split('@')[0] ||
      'Traveler';

    await this.mailService.sendTemplate({
      to: normalizedEmail,
      templateSlug: 'auth.reset-password',
      tokens: {
        user_name: userName,
        reset_url: resetUrl,
        expires_in: '60 minutes',
      },
      fallbackSubject: 'Reset your VoyageHub password',
      fallbackBody: `Use this secure link to reset your password: ${resetUrl}`,
      actionLabel: 'Reset Password',
      actionUrl: resetUrl,
    });

    return {
      success: true,
      message:
        'If an account exists for this email, a reset link has been sent.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      throw new BadRequestException('Reset token is required');
    }

    const tokenHash = this.hashResetToken(normalizedToken);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        account: {
          include: { profile: true },
        },
        agenceVoyage: true,
      },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException(
        'This reset link is invalid or has expired',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (resetToken.accountId) {
      await this.prisma.account.update({
        where: { id: resetToken.accountId },
        data: { motDePasse: hashedPassword },
      });

      await this.sendPasswordChangedEmail(
        resetToken.email,
        resetToken.account?.profile?.prenom || 'Traveler',
      );
    } else if (resetToken.agenceVoyageId) {
      await this.prisma.agenceVoyage.update({
        where: { id: resetToken.agenceVoyageId },
        data: { motDePasse: hashedPassword },
      });

      await this.sendPasswordChangedEmail(
        resetToken.email,
        resetToken.agenceVoyage?.nomAgence || 'VoyageHub Admin',
      );
    } else {
      throw new InternalServerErrorException(
        'Reset token is not linked to a valid account',
      );
    }

    await this.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    return {
      success: true,
      message: 'Password updated successfully.',
    };
  }

  async syncEmailVerification(payload: { accountId?: number; idToken: string }) {
    const accountId =
      payload.accountId != null
        ? Number.parseInt(String(payload.accountId), 10)
        : undefined;
    const idToken = String(payload.idToken || '').trim();
    if (!idToken) {
      throw new BadRequestException('Missing Firebase ID token');
    }

    const firebaseUser = await this.fetchFirebaseUser(idToken);
    if (!firebaseUser.emailVerified) {
      throw new BadRequestException('Email is not verified yet');
    }

    const account = accountId
      ? await this.prisma.account.findUnique({
          where: { id: accountId },
          select: {
            id: true,
            email: true,
            emailVerified: true,
            profile: {
              select: {
                prenom: true,
              },
            },
          },
        })
      : await this.prisma.account.findUnique({
          where: { email: firebaseUser.email },
          select: {
            id: true,
            email: true,
            emailVerified: true,
            profile: {
              select: {
                prenom: true,
              },
            },
          },
        });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.email.toLowerCase() !== firebaseUser.email.toLowerCase()) {
      throw new UnauthorizedException('Firebase user does not match account');
    }

    await this.prisma.account.update({
      where: { id: account.id },
      data: { emailVerified: true },
    });

    if (!account.emailVerified) {
      await this.sendWelcomeEmail(
        account.email,
        account.profile?.prenom || 'Traveler',
      );
    }

    return { verified: true };
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
        name:
          `${account.profile?.prenom || ''} ${account.profile?.nom || ''}`.trim() ||
          undefined,
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
      this.rethrowStripeError(
        error,
        'Unable to set Stripe default payment method',
      );
    }
  }

  private async ensurePaymentMethodOwnership(
    accountId: number,
    paymentMethodId: number,
  ) {
    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, accountId },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    return paymentMethod;
  }

  private async ensureAccountExists(accountId: number) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }
  }

  private async ensureAccountIsVerified(accountId: number) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, emailVerified: true, actif: true, role: true },
    });

    if (!account || !account.actif) {
      throw new NotFoundException('Account not found');
    }
    if (account.role !== AccountRole.ADMIN && !account.emailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before accessing your account.',
      );
    }
  }

  private async fetchFirebaseUser(idToken: string): Promise<{
    email: string;
    emailVerified: boolean;
  }> {
    if (!this.firebaseApiKey) {
      throw new InternalServerErrorException(
        'FIREBASE_API_KEY is missing on the backend',
      );
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(this.firebaseApiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as any;
    const user = payload?.users?.[0];
    const email = String(user?.email || '').trim().toLowerCase();
    const emailVerified = Boolean(user?.emailVerified);

    if (!response.ok || !email) {
      throw new UnauthorizedException('Invalid Firebase token');
    }

    return { email, emailVerified };
  }

  private async ensureHotelExists(hotelId: number) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { id: true, actif: true },
    });

    if (!hotel || !hotel.actif) {
      throw new NotFoundException('Hotel not found');
    }
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
    if (
      brand === 'visa' ||
      brand === 'mastercard' ||
      brand === 'amex' ||
      brand === 'discover'
    ) {
      return brand;
    }
    return 'other';
  }

  private appendQueryParams(url: string, query: Record<string, string>) {
    const serialized = Object.entries(query)
      .map(([key, value]) => {
        const serializedValue = value.includes('{')
          ? value
          : encodeURIComponent(value);
        return `${encodeURIComponent(key)}=${serializedValue}`;
      })
      .join('&');

    return url.includes('?') ? `${url}&${serialized}` : `${url}?${serialized}`;
  }

  private rethrowStripeError(error: any, fallbackMessage: string): never {
    if (error && typeof error === 'object') {
      const stripeError = error as any;
      if (stripeError.type === 'StripeAuthenticationError') {
        this.logger.error(
          'Stripe authentication failed. Check STRIPE_SECRET_KEY.',
        );
        throw new ServiceUnavailableException(
          'Payment provider is temporarily unavailable',
        );
      }
      if (stripeError.type === 'StripeInvalidRequestError') {
        throw new BadRequestException(stripeError.message || fallbackMessage);
      }
      if (stripeError.type === 'StripeConnectionError') {
        throw new ServiceUnavailableException(
          'Payment provider connection failed',
        );
      }
    }

    this.logger.error(`${fallbackMessage}: ${error?.message || error}`);
    throw new InternalServerErrorException(fallbackMessage);
  }

  private normalizeProfileData<
    T extends {
      dateNaissance?: string | Date | null;
      numeroPasseport?: string | null;
    },
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

  private mapRole(role?: AccountRole | string | null) {
    return String(role ?? '').toUpperCase() === 'ADMIN' ? 'admin' : 'client';
  }

  private sanitizeAccount<
    T extends {
      motDePasse: string;
      role?: AccountRole | string | null;
      stripeCustomerId?: string | null;
    },
  >(account: T) {
    const {
      motDePasse,
      stripeCustomerId: _stripeCustomerId,
      ...result
    } = account;
    return {
      ...result,
      role: this.mapRole(result.role),
    };
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async sendWelcomeEmail(email: string, userName: string) {
    try {
      await this.mailService.sendTemplate({
        to: email,
        templateSlug: 'auth.welcome',
        tokens: {
          user_name: userName,
          login_url: `${this.mailService.getAppWebUrl()}/login`,
        },
        fallbackSubject: `Welcome to VoyageHub, ${userName}`,
        fallbackBody: `Your account is ready. Sign in at ${this.mailService.getAppWebUrl()}/login`,
        actionLabel: 'Sign In',
        actionUrl: `${this.mailService.getAppWebUrl()}/login`,
      });
    } catch (error) {
      this.logger.warn(
        `Welcome email could not be sent to ${email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async sendPasswordChangedEmail(email: string, userName: string) {
    try {
      await this.mailService.sendTemplate({
        to: email,
        templateSlug: 'auth.password-changed',
        tokens: {
          user_name: userName,
          changed_at: new Date().toLocaleString('en-US'),
        },
        fallbackSubject: 'Your VoyageHub password was changed',
        fallbackBody: 'Your password was updated successfully.',
      });
    } catch (error) {
      this.logger.warn(
        `Password changed email could not be sent to ${email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
