import type { Currency } from '../../catalog/contracts/currency.enum';
import type { PaymentProviderEvent } from '../contracts/payment-provider-event.type';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface CreateCheckoutSessionData {
  paymentId: string;
  orderId: string;
  amountInMinorUnits: number;
  currency: Currency;
}

export interface CheckoutSessionResult {
  providerSessionId: string;
  checkoutUrl: string;
  expiresAt: Date | null;
}

export interface PaymentGateway {
  createCheckoutSession(
    data: CreateCheckoutSessionData
  ): Promise<CheckoutSessionResult>;

  verifyAndParseWebhookEvent(
    rawBody: Buffer,
    signature: string
  ): PaymentProviderEvent;
}
