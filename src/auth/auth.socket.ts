import { Socket } from 'socket.io';
import { AuthService, JwtPayload } from './auth.service';
import { ExtendedError } from 'socket.io/dist/namespace';

export interface AugmentedSocket extends Socket {
  userId?: string;
  roles?: string[];
  dbSessionId?: string;
}

const authService = new AuthService();

export const authSocketMiddleware = async (
  socket: AugmentedSocket,
  next: (err?: ExtendedError) => void
) => {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    return next(new Error('Authentication error: Missing token'));
  }

  const user = authService.validateToken(token.replace('Bearer ', '').trim());

  if (!user) {
    return next(new Error('Authentication error: Invalid token'));
  }

  socket.userId = user.sub;
  socket.roles = user.roles;
  next();
};
