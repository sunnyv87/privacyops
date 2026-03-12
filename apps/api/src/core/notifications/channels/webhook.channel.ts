import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

interface WebhookPayload {
  tenantId: string;
  event: string;
  data: Record<string, unknown>;
}

@Injectable()
export class WebhookChannel {
  private readonly logger = new Logger(WebhookChannel.name);

  async send(payload: WebhookPayload): Promise<void> {
    // In production, webhook URLs would be stored per-tenant in the DB
    // For now, log the webhook payload
    const body = JSON.stringify({
      event: payload.event,
      tenantId: payload.tenantId,
      timestamp: new Date().toISOString(),
      data: payload.data,
    });

    const signingSecret = process.env.WEBHOOK_SIGNING_SECRET;
    if (!signingSecret) {
      this.logger.error(
        'WEBHOOK_SIGNING_SECRET is not configured — skipping webhook dispatch',
      );
      return;
    }

    const signature = crypto
      .createHmac('sha256', signingSecret)
      .update(body)
      .digest('hex');

    this.logger.log(
      `Webhook dispatched: ${payload.event} (tenant: ${payload.tenantId}, sig: ${signature.slice(0, 8)}...)`,
    );

    // TODO: Fetch tenant webhook URLs from DB and POST to each
    // await fetch(url, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-Signature': signature,
    //   },
    //   body,
    // });
  }
}
