import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { UserRole as PrismaUserRole } from '../../../generated/prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';

import { RefreshSession } from '../contracts/refresh-session.interface';
import { UserRole } from '../contracts/user-role.enum';

@Injectable()
export class RefreshSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<RefreshSession | null> {
    const session = await this.prisma.refreshSession.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      user: {
        id: session.user.id,
        role: this.mapRole(session.user.role),
      },
    };
  }

  async revoke(id: string) {
    return this.prisma.refreshSession.update({
      where: {
        id,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async rotate(
    id: string,
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: {
          id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      if (revoked.count !== 1) {
        return null;
      }

      return tx.refreshSession.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });
    });
  }

  private mapRole(role: PrismaUserRole): UserRole {
    switch (role) {
      case PrismaUserRole.CUSTOMER:
        return UserRole.CUSTOMER;

      case PrismaUserRole.MERCHANT:
        return UserRole.MERCHANT;

      case PrismaUserRole.DRIVER:
        return UserRole.DRIVER;

      default:
        throw new Error(`Unknown user role: ${role}`);
    }
  }
}