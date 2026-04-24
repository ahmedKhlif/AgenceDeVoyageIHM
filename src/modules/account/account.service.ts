import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
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
      where: { accountId }
    });
  }

  async updateProfile(accountId: number, data: any) {
    return this.prisma.profile.update({
      where: { accountId },
      data
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
}
