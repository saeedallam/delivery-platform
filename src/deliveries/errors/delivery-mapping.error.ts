export class DeliveryMappingError extends Error {
  constructor(status: string) {
    super(`Unsupported delivery status: ${status}`);
    this.name = 'DeliveryMappingError';
  }
}
