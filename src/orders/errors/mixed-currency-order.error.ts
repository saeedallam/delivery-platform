export class MixedCurrencyOrderError extends Error {
  constructor() {
    super('All products in an order must use the same currency');
    this.name = 'MixedCurrencyOrderError';
  }
}
