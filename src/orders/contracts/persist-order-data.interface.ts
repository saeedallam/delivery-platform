import { Currency } from 'src/catalog/contracts/currency.enum';
import { PersistOrderItemData } from './persist-order-item-data.interface';

export interface PersistOrderData {
  userId: string;
  currency: Currency;
  totalAmountInMinorUnits: number;
  items: PersistOrderItemData[];
}
