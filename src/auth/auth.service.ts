import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { CreateUserData } from './contracts/create-user-data.interface';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
import { InvalidCredentialsError } from './errors/invalid-credentials.error';
import { InvalidRefreshTokenError } from './errors/invalid-refresh-token.error';
import { UserRepository } from './user.repository';
import { TokenService } from './token.service';
import { RefreshSessionRepository } from './repositories/refresh-session.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    private readonly refreshSessionRepository: RefreshSessionRepository,
  ) {}

  async register(dto: RegisterUserDto): Promise<UserResponseDto> {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await argon2.hash(dto.password);
    const userData: CreateUserData = { email: dto.email, passwordHash };

    try {
      const user = await this.userRepository.createUser(userData);
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      };
    } catch (error: unknown) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) throw new InvalidCredentialsError();

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) throw new InvalidCredentialsError();

    const accessToken = await this.tokenService.generateAccessToken(user.id, user.role);
    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshSessionRepository.create(user.id, refreshTokenHash, expiresAt);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const session = await this.refreshSessionRepository.findByTokenHash(tokenHash);

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new InvalidRefreshTokenError();
    }

    const newAccessToken = await this.tokenService.generateAccessToken(
      session.user.id,
      session.user.role,
    );

    const newRefreshToken = this.tokenService.generateRefreshToken();
    const newRefreshTokenHash = this.tokenService.hashRefreshToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const rotated = await this.refreshSessionRepository.rotate(
      session.id,
      session.user.id,
      newRefreshTokenHash,
      newExpiresAt,
    );

    if (!rotated) throw new InvalidRefreshTokenError();

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }
}
