import { Currency } from '../../catalog/contracts/currency.enum';

export interface CreatePaymentData {
  orderId: string;
  userId: string;
  amountInMinorUnits: number;
  currency: Currency;
}
