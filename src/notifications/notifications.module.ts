import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

import { NotificationsController } from './notifications.controller';
import { DeliveryCompletedListener } from './delivery-completed.listener';
import { NotificationsService } from './notifications.service';
import { NotificationRepository } from './notification.repository';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [NotificationsController],
  providers: [
    DeliveryCompletedListener,
    NotificationsService,
    NotificationRepository,
  ],
})
export class NotificationsModule {}
