import { BadRequestException } from '@nestjs/common';
import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;
  let prisma: any;
  let configService: any;
  let mailService: any;

  beforeEach(() => {
    prisma = {
      account: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      agenceVoyage: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      passwordResetToken: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    configService = {
      get: jest.fn(() => undefined),
    };

    mailService = {
      getAppWebUrl: jest.fn(() => 'https://agence-bay.vercel.app'),
      sendTemplate: jest.fn().mockResolvedValue(undefined),
    };

    service = new AccountService(prisma, configService, mailService);
  });

  it('returns a generic forgot-password response when the email is unknown', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    prisma.agenceVoyage.findUnique.mockResolvedValue(null);

    await expect(
      service.forgotPassword('missing@example.com'),
    ).resolves.toEqual({
      success: true,
      message:
        'If an account exists for this email, a reset link has been sent.',
    });

    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mailService.sendTemplate).not.toHaveBeenCalled();
  });

  it('creates a reset token and sends an email for a customer account', async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: 4,
      email: 'client@example.com',
      actif: true,
      profile: { prenom: 'Lina' },
    });
    prisma.agenceVoyage.findUnique.mockResolvedValue(null);
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetToken.create.mockResolvedValue({ id: 1 });

    await service.forgotPassword('client@example.com');

    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'client@example.com',
          accountId: 4,
          agenceVoyageId: undefined,
        }),
      }),
    );
    expect(mailService.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        templateSlug: 'auth.reset-password',
        actionUrl: expect.stringContaining('/reset-password?token='),
      }),
    );
  });

  it('rejects a used reset token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 8,
      email: 'client@example.com',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      accountId: 1,
      account: { profile: { prenom: 'Lina' } },
    });

    await expect(
      service.resetPassword('used-token', 'Password1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an expired reset token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 9,
      email: 'client@example.com',
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      accountId: 1,
      account: { profile: { prenom: 'Lina' } },
    });

    await expect(
      service.resetPassword('expired-token', 'Password1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resets the password for an agency admin and marks the token as used', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 12,
      email: 'agency@example.com',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      accountId: null,
      agenceVoyageId: 7,
      agenceVoyage: { nomAgence: 'Atlas Travel' },
    });
    prisma.agenceVoyage.update.mockResolvedValue({});
    prisma.passwordResetToken.update.mockResolvedValue({});

    await expect(
      service.resetPassword('fresh-token', 'Password1'),
    ).resolves.toEqual({
      success: true,
      message: 'Password updated successfully.',
    });

    expect(prisma.agenceVoyage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          motDePasse: expect.any(String),
        }),
      }),
    );
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { usedAt: expect.any(Date) },
    });
    expect(mailService.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'agency@example.com',
        templateSlug: 'auth.password-changed',
      }),
    );
  });
});
