export class NotificationNotFoundError extends Error {
  constructor(notificationId: string) {
    super(`Notification ${notificationId} was not found`);
    this.name = 'NotificationNotFoundError';
  }
}
