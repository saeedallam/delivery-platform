import type { Currency } from '../../catalog/contracts/currency.enum';
import type { Payment } from '../domain/payment.interface';

export interface MarkPaymentExpiredData {
  paymentId: string;
  providerSessionId: string;
  amountInMinorUnits: number;
  currency: Currency;
}

export interface MarkPaymentExpiredResult {
  payment: Payment;
  transitioned: boolean;
}
