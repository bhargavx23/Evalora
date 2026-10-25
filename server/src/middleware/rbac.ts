import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User.js';

export function requireRoles(...allowedRoles: (UserRole | 'admin')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const userRole = req.user.role;
    const isSuperAdmin = userRole === 'admin' || userRole === 'platform_admin';
    const matchesSuperAdmin = allowedRoles.includes('admin') || allowedRoles.includes('platform_admin');

    if (allowedRoles.includes(userRole) || (isSuperAdmin && matchesSuperAdmin)) {
      return next();
    }

    res.status(403).json({
      success: false,
      message: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`
    });
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'admin' && req.user.role !== 'platform_admin') {
    res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
    return;
  }
  next();
}
