import { UserRole } from '../contracts/user-role.enum';

export class UserResponseDto {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}
