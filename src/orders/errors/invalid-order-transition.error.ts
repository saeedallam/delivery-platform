export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly currentStatus: string,
    public readonly nextStatus: string,
  ) {
    super(
      `Invalid order transition: ${currentStatus} -> ${nextStatus}`,
    );

    this.name = 'InvalidOrderTransitionError';
  }
}
