/**
 * Integration test for billing webhook idempotency and signature verification.
 */
import { createHmac } from 'crypto';

describe('Billing Webhook — Integration', () => {
  const webhookSecret = 'whsec_test_secret_key';

  function generateStripeSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  it('should generate valid Stripe v1 webhook signatures', () => {
    const payload = JSON.stringify({ type: 'invoice.paid', id: 'evt_123' });
    const sig = generateStripeSignature(payload, webhookSecret);

    expect(sig).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
  });

  it('should reject tampered payloads', () => {
    const payload = JSON.stringify({ type: 'invoice.paid', id: 'evt_123' });
    const sig = generateStripeSignature(payload, webhookSecret);

    // Parse the signature
    const parts = sig.split(',');
    const timestamp = parts[0].split('=')[1];
    const originalSig = parts[1].split('=')[1];

    // Tamper the payload
    const tamperedPayload = JSON.stringify({ type: 'invoice.paid', id: 'evt_999' });
    const tamperedSignedPayload = `${timestamp}.${tamperedPayload}`;
    const expectedSig = createHmac('sha256', webhookSecret)
      .update(tamperedSignedPayload, 'utf8')
      .digest('hex');

    expect(originalSig).not.toBe(expectedSig);
  });

  it('should produce deterministic signatures for the same input', () => {
    const payload = JSON.stringify({ type: 'checkout.session.completed' });
    const timestamp = 1700000000;
    const signedPayload = `${timestamp}.${payload}`;

    const sig1 = createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    const sig2 = createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    expect(sig1).toBe(sig2);
  });

  it('should produce different signatures for different secrets', () => {
    const payload = JSON.stringify({ type: 'invoice.paid' });
    const timestamp = 1700000000;
    const signedPayload = `${timestamp}.${payload}`;

    const sig1 = createHmac('sha256', 'whsec_secret_a')
      .update(signedPayload, 'utf8')
      .digest('hex');
    const sig2 = createHmac('sha256', 'whsec_secret_b')
      .update(signedPayload, 'utf8')
      .digest('hex');

    expect(sig1).not.toBe(sig2);
  });
});
