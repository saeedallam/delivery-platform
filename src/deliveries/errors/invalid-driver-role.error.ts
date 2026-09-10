export class InvalidDriverRoleError extends Error {
  constructor(driverId: string) {
    super(
      `User ${driverId} cannot be assigned because their role is not DRIVER`
    );
    this.name = 'InvalidDriverRoleError';
  }
}
