import type { Currency } from '../../catalog/contracts/currency.enum';

export interface MarkPaymentSucceededData {
  paymentId: string;
  providerSessionId: string;
  providerPaymentId: string;
  amountInMinorUnits: number;
  currency: Currency;
  paidAt: Date;
}
