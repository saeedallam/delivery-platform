import { Currency } from '../../catalog/contracts/currency.enum';
import { PaymentStatus } from '../contracts/payment-status.enum';

export interface Payment {
  id: string;
  orderId: string;
  userId: string;
  amountInMinorUnits: number;
  currency: Currency;
  status: PaymentStatus;
  providerSessionId: string | null;
  providerPaymentId: string | null;
  failureReason: string | null;
  expiresAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
