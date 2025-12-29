import { NextFunction, Request, Response } from 'express';
import { Role } from '../auth/types';

export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.authContext;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }

    return next();
  };
};
