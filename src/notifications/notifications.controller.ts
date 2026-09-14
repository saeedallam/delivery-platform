import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getMyNotifications(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.getMyNotifications(request.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':notificationId/read')
  async markAsRead(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.notificationsService.markAsRead(
      notificationId,
      request.user.userId
    );
  }
}
