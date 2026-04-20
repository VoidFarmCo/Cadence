import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthRequest } from '../types';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 4,
  payroll_admin: 3,
  manager: 2,
  worker: 1,
};

export function isSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.user.platform_role !== 'superadmin') {
    res.status(403).json({ error: 'Forbidden — superadmin access required' });
    return;
  }

  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export function requireMinRole(minRole: UserRole) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (ROLE_HIERARCHY[req.user.role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export function requireSelfOrRole(emailParam: string, ...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const targetEmail = req.params[emailParam] || req.body?.[emailParam] || req.query?.[emailParam];

    if (req.user.email === targetEmail || allowedRoles.includes(req.user.role)) {
      next();
      return;
    }

    res.status(403).json({ error: 'Insufficient permissions' });
  };
}
