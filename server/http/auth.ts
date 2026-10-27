import type { NextFunction, Request, Response } from 'express';
import type { AuthContext, Permission, User } from '../../src/domain/types';
import { permissionsForRole, hasPermission } from '../../src/domain/permissions';
import type { JsonStore } from '../repositories/jsonStore';
import { ApiError } from './errors';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function authFromUser(user: User): AuthContext {
  return {
    user,
    role: user.role,
    permissions: permissionsForRole(user.role),
    farmerId: user.farmerId,
    scopeCommunes: user.scopeCommunes,
  };
}

export function attachAuth(store: JsonStore) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.header('x-user-id')?.trim();
      if (!userId) {
        throw new ApiError(401, 'AUTH_REQUIRED', 'A demo user must be selected.');
      }
      const user = await store.read((db) => db.users.find((item) => item.id === userId));
      if (!user) {
        throw new ApiError(401, 'AUTH_UNKNOWN', 'The selected demo user does not exist.');
      }
      if (user.status === 'SUSPENDED') {
        throw new ApiError(403, 'USER_SUSPENDED', 'This demo account is suspended.');
      }
      const providedRole = req.header('x-user-role');
      if (providedRole && providedRole !== user.role) {
        throw new ApiError(403, 'ROLE_MISMATCH', 'The supplied role does not match the selected demo user.');
      }
      req.auth = authFromUser(user);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new ApiError(401, 'AUTH_REQUIRED', 'Authentication context is missing.'));
      return;
    }
    const allowed = required.some((permission) => hasPermission(req.auth!.role, permission));
    if (!allowed) {
      next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
      return;
    }
    next();
  };
}

export function originGuard(req: Request, _res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  const origin = req.header('origin');
  if (origin && !isAllowedOrigin(origin)) {
    next(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'This browser origin is not allowed.'));
    return;
  }
  next();
}

function isAllowedOrigin(origin: string): boolean {
  const allowed = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
  ];
  return allowed.includes(origin);
}
