export class NotificationMappingError extends Error {
  constructor(type: string) {
    super(`Unsupported notification type: ${type}`);
    this.name = 'NotificationMappingError';
  }
}
