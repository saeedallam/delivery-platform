export class DriverNotFoundError extends Error {
  constructor(driverId: string) {
    super(`Driver ${driverId} not found`);
    this.name = 'DriverNotFoundError';
  }
}
