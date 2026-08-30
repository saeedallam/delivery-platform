import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { UserRole as PrismaUserRole } from '../../generated/prisma/enums';

import { PrismaService } from '../prisma/prisma.service';

import { CreateUserData } from './contracts/create-user-data.interface';
import { User } from './contracts/user.interface';
import { UserRole } from './contracts/user-role.enum';

import { DatabaseUnavailableError } from './errors/database-unavailable.error';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return null;
      }

      return this.mapToUser(user);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P1001'
      ) {
        throw new DatabaseUnavailableError();
      }

      throw error;
    }
  }

  async createUser(userData: CreateUserData): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: userData.email,
          passwordHash: userData.passwordHash,
        },
      });

      return this.mapToUser(user);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new EmailAlreadyExistsError();
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P1001'
      ) {
        throw new DatabaseUnavailableError();
      }

      throw error;
    }
  }

  private mapToUser(user: {
    id: string;
    email: string;
    passwordHash: string;
    role: PrismaUserRole;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: this.mapRole(user.role),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
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