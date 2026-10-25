import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { User, IUser, UserRole } from '../models/User.js';

export interface AuthenticatedUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  collegeId?: string | null;
  departmentId?: string | null;
  studentId?: string;
  employeeId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
      return;
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string; tokenVersion?: number };
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found or session invalid.' });
      return;
    }

    if ((decoded.tokenVersion || 0) !== (user.authTokenVersion || 0)) {
      res.status(401).json({ success: false, message: 'Session has been revoked. Please log in again.' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ success: false, message: 'Account has been suspended. Contact administrator.' });
      return;
    }

    req.user = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      collegeId: user.collegeId ? user.collegeId.toString() : null,
      departmentId: user.departmentId ? user.departmentId.toString() : null,
      studentId: user.studentId,
      employeeId: user.employeeId
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

export function optionalAuthenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string; tokenVersion?: number };
    User.findById(decoded.userId)
      .select('-passwordHash')
      .then(user => {
        if (user && user.status === 'active' && (decoded.tokenVersion || 0) === (user.authTokenVersion || 0)) {
          req.user = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            collegeId: user.collegeId ? user.collegeId.toString() : null,
            departmentId: user.departmentId ? user.departmentId.toString() : null,
            studentId: user.studentId,
            employeeId: user.employeeId
          };
        }
        next();
      })
      .catch(() => next());
  } catch {
    next();
  }
}
