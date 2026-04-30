import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailTemplateChannel } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import { defaultMailTemplates } from './mail.defaults';
import { SendTestEmailDto } from './dto/send-test-email.dto';
import { UpdateMailTemplateDto } from './dto/update-mail-template.dto';

type MailTokens = Record<string, string | number | null | undefined>;

type SendMailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

type SendTemplateOptions = {
  to: string;
  templateSlug: string;
  tokens?: MailTokens;
  actionLabel?: string;
  actionUrl?: string;
  fallbackSubject?: string;
  fallbackBody?: string;
  replyTo?: string;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly host: string;
  private readonly port: number;
  private readonly secure: boolean;
  private readonly user: string;
  private readonly pass: string;
  private readonly fromEmail: string;
  private mailTemplateStoreAvailable: boolean | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.host = this.config.get<string>('SMTP_HOST') || '127.0.0.1';
    this.port = Number(this.config.get<string>('SMTP_PORT') || 1025);
    this.secure =
      String(this.config.get<string>('SMTP_SECURE') || 'false') === 'true';
    this.user = this.config.get<string>('SMTP_USER') || '';
    this.pass = this.config.get<string>('SMTP_PASS') || '';
    this.fromEmail =
      this.config.get<string>('SMTP_FROM') || 'hello@voyagehub.local';

    this.transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
      family: 4, // Force IPv4
      ...(this.user && this.pass
        ? { auth: { user: this.user, pass: this.pass } }
        : {}),
    });
  }

  async onModuleInit() {
    try {
      await this.ensureDefaultTemplates();
    } catch (error: any) {
      if (this.isMailTemplateStoreMissing(error)) {
        this.mailTemplateStoreAvailable = false;
        this.logger.warn(
          'Mail template store is unavailable (table missing). Continuing without template persistence.',
        );
        return;
      }
      throw error;
    }
  }

  async listTemplates() {
    await this.ensureDefaultTemplates();
    if (this.mailTemplateStoreAvailable === false) {
      return [];
    }
    return this.prisma.mailTemplate.findMany({
      orderBy: [{ channel: 'asc' }, { name: 'asc' }],
    });
  }

  async updateTemplate(id: number, dto: UpdateMailTemplateDto) {
    if (this.mailTemplateStoreAvailable === false) {
      throw new Error(
        'Mail templates are not available. Please run database migrations.',
      );
    }
    return this.prisma.mailTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.trigger !== undefined ? { trigger: dto.trigger } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.recipients !== undefined ? { recipients: dto.recipients } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.channel !== undefined
          ? { channel: dto.channel as MailTemplateChannel }
          : {}),
      },
    });
  }

  async getConfigStatus() {
    const supportEmail = await this.getSupportEmail();
    const replyTo = await this.getReplyTo();

    let verified = false;
    let errorMessage = '';

    try {
      verified = await this.transporter.verify();
    } catch (error: any) {
      errorMessage = error?.message || String(error);
    }

    return {
      provider: this.user.toLowerCase().includes('gmail') ? 'Gmail' : this.host,
      host: this.host,
      port: this.port,
      secure: this.secure,
      user: this.user,
      fromEmail: this.fromEmail,
      replyTo,
      supportEmail,
      appWebUrl: this.getAppWebUrl(),
      connected: verified,
      errorMessage,
    };
  }

  async sendTestEmail(dto: SendTestEmailDto) {
    const to = dto.to || this.fromEmail;
    const appWebUrl = this.getAppWebUrl();

    await this.sendTemplate({
      to,
      templateSlug: dto.templateSlug || 'auth.welcome',
      tokens: {
        user_name: 'VoyageHub Admin',
        login_url: `${appWebUrl}/login`,
        support_email: await this.getSupportEmail(),
      },
      fallbackSubject: 'VoyageHub mail test',
      fallbackBody:
        'This is a test email from your VoyageHub SMTP configuration.',
      actionLabel: 'Open VoyageHub',
      actionUrl: appWebUrl,
    });

    return {
      success: true,
      to,
    };
  }

  async send(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `${await this.getSenderName()} <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo || (await this.getReplyTo()) || undefined,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error?.message || error}`,
      );
      throw error;
    }
  }

  async sendTemplate(options: SendTemplateOptions): Promise<void> {
    const template = await this.resolveTemplate(options.templateSlug);
    const supportEmail = await this.getSupportEmail();
    const tokens = {
      support_email: supportEmail,
      app_web_url: this.getAppWebUrl(),
      ...options.tokens,
    };

    const subject = this.renderTokens(
      template?.subject || options.fallbackSubject || 'VoyageHub notification',
      tokens,
    );
    const text = this.renderTokens(
      template?.body || options.fallbackBody || '',
      tokens,
    );

    await this.send({
      to: options.to,
      subject,
      text,
      html: this.renderEmailHtml(
        subject,
        text,
        options.actionLabel,
        options.actionUrl,
      ),
      replyTo: options.replyTo,
    });
  }

  async getSupportEmail() {
    return (
      (await this.getSystemConfigValue('support_email')) ||
      this.config.get<string>('SMTP_REPLY_TO') ||
      this.fromEmail
    );
  }

  async getReplyTo() {
    return (
      (await this.getSystemConfigValue('mail_reply_to')) ||
      this.config.get<string>('SMTP_REPLY_TO') ||
      this.fromEmail
    );
  }

  async getSenderName() {
    return (await this.getSystemConfigValue('mail_sender_name')) || 'VoyageHub';
  }

  getAppWebUrl() {
    return this.config.get<string>('APP_WEB_URL') || 'https://agence-bay.vercel.app';
  }

  async ensureDefaultTemplates() {
    if (this.mailTemplateStoreAvailable === false) {
      return;
    }

    await Promise.all(
      defaultMailTemplates.map((template) =>
        this.prisma.mailTemplate.upsert({
          where: { slug: template.slug },
          create: template,
          update: {
            name: template.name,
            description: template.description,
            trigger: template.trigger,
            channel: template.channel,
            recipients: template.recipients,
            type: template.type,
          },
        }),
      ),
    );
    this.mailTemplateStoreAvailable = true;
  }

  private async resolveTemplate(slug: string) {
    await this.ensureDefaultTemplates();
    if (this.mailTemplateStoreAvailable === false) {
      return null;
    }
    return this.prisma.mailTemplate.findUnique({
      where: { slug },
    });
  }

  private isMailTemplateStoreMissing(error: any) {
    const code = error?.code;
    const text = String(error?.message || '').toLowerCase();
    return (
      code === 'P2021' ||
      code === 'P2022' ||
      text.includes('mail_templates') ||
      text.includes('tabledoesnotexist')
    );
  }

  private renderTokens(value: string, tokens: MailTokens) {
    return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
      const token = tokens[key];
      return token == null ? '' : String(token);
    });
  }

  private renderEmailHtml(
    subject: string,
    text: string,
    actionLabel?: string,
    actionUrl?: string,
  ) {
    const paragraphs = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(
        (line) =>
          `<p style="margin:0 0 14px;line-height:1.65;color:#475569;">${this.escapeHtml(line)}</p>`,
      )
      .join('');

    const actionBlock =
      actionLabel && actionUrl
        ? `<p style="margin:24px 0 0;"><a href="${this.escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#006768;color:#ffffff;text-decoration:none;font-weight:700;">${this.escapeHtml(actionLabel)}</a></p>`
        : '';

    return `
      <div style="background:#f4f7fb;padding:24px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe4ee;border-radius:18px;overflow:hidden;">
          <div style="padding:24px 24px 18px;background:linear-gradient(135deg,#015081 0%,#006768 100%);color:#ffffff;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;opacity:0.85;">VoyageHub</div>
            <h1 style="margin:12px 0 0;font-size:24px;line-height:1.25;">${this.escapeHtml(subject)}</h1>
          </div>
          <div style="padding:24px;">
            ${paragraphs}
            ${actionBlock}
          </div>
        </div>
      </div>
    `;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async getSystemConfigValue(key: string) {
    const config = await this.prisma.systemConfig.findUnique({
      where: { cle: key },
      select: { valeur: true },
    });
    return config?.valeur?.trim() || '';
  }
}
