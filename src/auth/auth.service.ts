import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import { UserRole } from './enums/user-role.enum';

export interface JwtPayload {
  sub: string; // userId
  username: string;
  roles: UserRole[];
}

export class AuthService {
  validateToken(token: string): JwtPayload | null {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
      // Basic validation: ensure sub and roles exist
      if (payload && payload.sub && Array.isArray(payload.roles)) {
        return payload;
      }
      return null;
    } catch (error: any) {
            return null;
    }
  }
}
