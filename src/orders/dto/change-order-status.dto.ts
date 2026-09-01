import { IsEnum } from 'class-validator';

import { OrderStatus } from '../../../generated/prisma/enums';

export class ChangeOrderStatusDto {
  @IsEnum(OrderStatus)
  nextStatus!: OrderStatus;
}
