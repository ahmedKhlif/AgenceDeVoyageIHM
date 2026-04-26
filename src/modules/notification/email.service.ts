import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST') || '127.0.0.1';
    const port = Number(this.config.get<string>('SMTP_PORT') || 1025);
    const secure = String(this.config.get<string>('SMTP_SECURE') || 'false') === 'true';
    const user = this.config.get<string>('SMTP_USER') || '';
    const pass = this.config.get<string>('SMTP_PASS') || '';

    this.fromEmail = this.config.get<string>('SMTP_FROM') || 'aminc571@gmail.com';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  async send(input: SendEmailInput): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html || undefined,
      });
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${input.to}: ${error?.message || error}`);
    }
  }
}
