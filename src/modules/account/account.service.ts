import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateProfileDto } from '../profile/dto/update-profile.dto';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

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
    const account = await this.prisma.account.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!account || !(await bcrypt.compare(password, account.motDePasse))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Return account without password
    const { motDePasse, ...result } = account;
    return result;
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

  async createPaymentMethod(accountId: number, dto: CreatePaymentMethodDto) {
    await this.ensureAccountExists(accountId);

    return this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.paymentMethod.count({ where: { accountId } });
      const shouldBeDefault = dto.isDefault ?? existingCount === 0;

      if (shouldBeDefault) {
        await tx.paymentMethod.updateMany({
          where: { accountId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.paymentMethod.create({
        data: {
          accountId,
          cardholderName: dto.cardholderName.trim(),
          brand: dto.brand,
          last4: dto.cardNumber.slice(-4),
          expiryMonth: dto.expiryMonth,
          expiryYear: dto.expiryYear,
          isDefault: shouldBeDefault,
        },
      });
    });
  }

  async updatePaymentMethod(
    accountId: number,
    paymentMethodId: number,
    dto: UpdatePaymentMethodDto,
  ) {
    await this.ensurePaymentMethodOwnership(accountId, paymentMethodId);

    return this.prisma.$transaction(async (tx) => {
      const shouldBeDefault = dto.isDefault === true;

      if (shouldBeDefault) {
        await tx.paymentMethod.updateMany({
          where: { accountId, isDefault: true, NOT: { id: paymentMethodId } },
          data: { isDefault: false },
        });
      }

      return tx.paymentMethod.update({
        where: { id: paymentMethodId },
        data: {
          ...(dto.cardholderName !== undefined && {
            cardholderName: dto.cardholderName.trim(),
          }),
          ...(dto.brand !== undefined && { brand: dto.brand }),
          ...(dto.cardNumber !== undefined && { last4: dto.cardNumber.slice(-4) }),
          ...(dto.expiryMonth !== undefined && { expiryMonth: dto.expiryMonth }),
          ...(dto.expiryYear !== undefined && { expiryYear: dto.expiryYear }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        },
      });
    });
  }

  async removePaymentMethod(accountId: number, paymentMethodId: number) {
    const existing = await this.ensurePaymentMethodOwnership(accountId, paymentMethodId);

    await this.prisma.$transaction(async (tx) => {
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
        }
      }
    });
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

  private async ensureAccountExists(accountId: number) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });

    if (!account) {
      throw new NotFoundException('Account not found');
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

  private normalizeProfileData<T extends { dateNaissance?: string | Date | null }>(data: T): T {
    if (!data.dateNaissance) {
      return data;
    }

    const normalizedDate =
      typeof data.dateNaissance === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.dateNaissance)
        ? new Date(`${data.dateNaissance}T00:00:00.000Z`)
        : data.dateNaissance;

    return {
      ...data,
      dateNaissance: normalizedDate,
    };
  }
}
