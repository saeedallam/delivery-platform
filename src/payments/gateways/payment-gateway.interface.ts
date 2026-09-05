import { Currency } from '../../catalog/contracts/currency.enum';

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
}
