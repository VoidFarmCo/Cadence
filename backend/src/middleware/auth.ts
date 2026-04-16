import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthRequest, JwtPayload } from '../types';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  // Accept token from httpOnly cookie or Bearer header
  const cookieToken = (req as any).cookies?.accessToken;
  const header = req.headers.authorization;
  const token = cookieToken || (header?.startsWith('Bearer ') ? header.slice(7) : null);

  if (!token) {
    res.status(401).json({ error: 'Missing or invalid authorization' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
