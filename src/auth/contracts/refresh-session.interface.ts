import { UserRole } from './user-role.enum';

export interface RefreshSession {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: {
    id: string;
    role: UserRole;
  };
}