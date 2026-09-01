import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';

@Module({
  imports: [PrismaModule],
  providers: [InventoryRepository, InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
