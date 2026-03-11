import { Injectable, Logger } from '@nestjs/common';
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

  constructor() {
    const host = process.env.SMTP_HOST;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
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
      from: process.env.SMTP_FROM || 'noreply@privacyops.techd.com',
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
      html: payload.html,
    });

    this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`);
  }
}
