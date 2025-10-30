import { Request, Response, NextFunction } from 'express';
import { AuthService, JwtPayload } from './auth.service';
import { UserRole } from './enums/user-role.enum';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const authService = new AuthService();

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const user = authService.validateToken(token);

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }

  req.user = user;
  next();
};

export const rolesMiddleware = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(403).json({ message: 'Forbidden: User not authenticated' });
    }
    if (!allowedRoles.some(role => req.user?.roles.includes(role))) {
      return res.status(403).json({ message: 'Forbidden: Insufficient roles' });
    }
    next();
  };
};
