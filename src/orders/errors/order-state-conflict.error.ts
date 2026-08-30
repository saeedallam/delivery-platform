export class OrderStateConflictError extends Error {
  constructor(
    public readonly orderId: string,
    public readonly expectedStatus: string
  ) {
    super(
      `Order ${orderId} state changed before the update. Expected status: ${expectedStatus}`
    );

    this.name = 'OrderStateConflictError';
  }
}
