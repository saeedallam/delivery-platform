export class ForbiddenOrderAccessError extends Error {
  constructor(orderId: string) {
    super(`You are not allowed to access order ${orderId}`);

    this.name = 'ForbiddenOrderAccessError';
  }
}
