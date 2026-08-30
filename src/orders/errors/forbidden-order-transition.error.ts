export class ForbiddenOrderTransitionError extends Error {
  constructor(
    public readonly currentStatus: string,
    public readonly nextStatus: string,
    public readonly actorRole: string,
  ) {
    super(
      `Role ${actorRole} cannot perform ${currentStatus} -> ${nextStatus}`,
    );

    this.name = 'ForbiddenOrderTransitionError';
  }
}