import { Currency } from './currency.enum';

export interface CreateProductData {
  name: string;
  priceInMinorUnits: number;
  currency: Currency;
}
