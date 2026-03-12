import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(this.config.get<string>('SMTP_PORT', '587'), 10),
        secure: parseInt(this.config.get<string>('SMTP_PORT', '587'), 10) === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    }
  }

  async send(payload: EmailPayload): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`Email not configured. Would send to ${payload.to}: ${payload.subject}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM', 'noreply@privacyops.techd.com'),
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
      html: payload.html,
    });

    this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`);
  }
}
