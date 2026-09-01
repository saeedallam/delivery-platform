import { Currency } from './currency.enum';

export interface ProductForOrder {
  productId: string;
  priceInMinorUnits: number;
  currency: Currency;
}
