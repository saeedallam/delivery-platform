export class DatabaseUnavailableError extends Error {
  constructor() {
    super('Database is currently unavailable');
    this.name = 'DatabaseUnavailableError';
  }
}
