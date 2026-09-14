export type OutboxJsonValue =
  | string
  | number
  | boolean
  | null
  | OutboxJsonValue[]
  | { [key: string]: OutboxJsonValue };

export interface CreateOutboxEventData {
  id: string;
  type: string;
  payload: { [key: string]: OutboxJsonValue };
  occurredAt: Date;
}
