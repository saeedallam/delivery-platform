export interface OutboxEventRecord {
  id: string;
  type: string;
  payload: unknown;
  occurredAt: Date;
  attempts: number;
}
