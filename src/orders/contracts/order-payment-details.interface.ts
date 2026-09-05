import { Currency } from '../../catalog/contracts/currency.enum';

export interface OrderPaymentDetails {
  id: string;
  userId: string;
  totalAmountInMinorUnits: number;
  currency: Currency;
}
