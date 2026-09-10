import { Injectable } from '@nestjs/common';

import { AuthService } from '../../auth/auth.service';
import { UserRole } from '../../auth/contracts/user-role.enum';

import { DeliveryRepository } from '../delivery.repository';
import type { Delivery } from '../domain/delivery.interface';

import { DeliveryNotFoundError } from '../errors/delivery-not-found.error';
import { DriverNotFoundError } from '../errors/driver-not-found.error';
import { InvalidDriverRoleError } from '../errors/invalid-driver-role.error';

@Injectable()
export class AssignDriverUseCase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly authService: AuthService
  ) {}

  async execute(deliveryId: string, driverId: string): Promise<Delivery> {
    const delivery = await this.deliveryRepository.findById(deliveryId);

    if (!delivery) {
      throw new DeliveryNotFoundError(deliveryId);
    }

    const driver = await this.authService.getUserIdentity(driverId);

    if (!driver) {
      throw new DriverNotFoundError(driverId);
    }

    if (driver.role !== UserRole.DRIVER) {
      throw new InvalidDriverRoleError(driverId);
    }

    return this.deliveryRepository.assignDriver(deliveryId, driver.id);
  }
}
