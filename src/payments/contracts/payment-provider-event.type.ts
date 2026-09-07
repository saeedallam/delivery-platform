import type { Currency } from '../../catalog/contracts/currency.enum';

export type PaymentProviderEvent =
  | {
      type: 'PAYMENT_SUCCEEDED';
      providerEventId: string;
      paymentId: string;
      providerSessionId: string;
      providerPaymentId: string;
      amountInMinorUnits: number;
      currency: Currency;
      occurredAt: Date;
    }
  | {
      type: 'IGNORED';
      providerEventId: string;
      providerEventType: string;
    }
  | {
      type: 'PAYMENT_EXPIRED';
      providerEventId: string;
      paymentId: string;
      providerSessionId: string;
      amountInMinorUnits: number;
      currency: Currency;
      occurredAt: Date;
    };
