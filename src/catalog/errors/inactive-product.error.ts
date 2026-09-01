export class InactiveProductError extends Error {
  constructor(productId: string) {
    super(`Product with id ${productId} is inactive`);
    this.name = 'InactiveProductError';
  }
}
