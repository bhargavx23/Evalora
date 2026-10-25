import { Request, Response, NextFunction } from 'express';

export function enforceTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  // Platform admin and Admin can cross tenants
  if (req.user.role === 'platform_admin' || req.user.role === 'admin') {
    return next();
  }

  if (!req.user.collegeId) {
    res.status(403).json({ success: false, message: 'Tenant context missing. User is not assigned to a college.' });
    return;
  }

  // Check if explicit collegeId in params or body matches user's collegeId
  const targetCollegeId = req.params.collegeId || req.body?.collegeId || req.query?.collegeId;
  if (targetCollegeId && targetCollegeId.toString() !== req.user.collegeId.toString()) {
    res.status(403).json({
      success: false,
      message: 'Cross-tenant access forbidden. You cannot access or modify data belonging to another college.'
    });
    return;
  }

  next();
}
