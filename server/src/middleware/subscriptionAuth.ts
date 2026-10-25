import { Request, Response, NextFunction } from 'express';
import { Subscription } from '../models/Subscription.js';
import { logger } from '../utils/logger.js';

export interface SubscriptionRequest extends Request {
  subscription?: any;
}

/**
 * Middleware that strictly enforces active, verified subscription access
 * for domain-based learning, practice, coding workspaces, and assessments.
 *
 * Rejects unsubscribed users with a standard 403 SUBSCRIPTION_REQUIRED response.
 */
export function requireDomainSubscription(targetDomainSlug?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user || !user._id) {
        res.status(401).json({
          success: false,
          message: 'Authentication required.',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      // Admins and faculty have preview access for management
      if (['platform_admin', 'college_admin'].includes(user.role)) {
        return next();
      }

      const domainSlug = (
        targetDomainSlug ||
        req.params.slug ||
        req.params.domainSlug ||
        req.body.domainSlug ||
        ''
      )
        .toString()
        .toLowerCase()
        .trim();

      // Query active subscription with non-expired date
      const activeSub = await Subscription.findOne({
        userId: user._id,
        status: 'active',
        expiresAt: { $gt: new Date() }
      }).sort({ expiresAt: -1 });

      if (!activeSub) {
        logger.warn('DOMAIN_ACCESS_DENIED_NO_SUBSCRIPTION', {
          userId: user._id.toString(),
          details: {
            domainSlug,
            role: user.role
          }
        });

        res.status(403).json({
          success: false,
          message:
            'An active premium subscription is required to access domain preparation.',
          code: 'SUBSCRIPTION_REQUIRED',
          requiresSubscription: true,
          domainSlug
        });
        return;
      }

      // Check domain-specific entitlement if specified
      if (domainSlug && !activeSub.hasDomainAccess(domainSlug)) {
        logger.warn('DOMAIN_ACCESS_DENIED_SPECIFIC_DOMAIN', {
          userId: user._id.toString(),
          details: {
            domainSlug,
            allowedDomains: activeSub.entitlements?.allowedDomains
          }
        });

        res.status(403).json({
          success: false,
          message: `Your current subscription does not include access to the "${domainSlug}" domain.`,
          code: 'DOMAIN_NOT_ENTITLED',
          requiresUpgrade: true,
          domainSlug
        });
        return;
      }

      // Attach active subscription to request object for downstream controllers
      (req as SubscriptionRequest).subscription = activeSub;
      next();
    } catch (error: any) {
      logger.error('SUBSCRIPTION_CHECK_ERROR', {
        details: { message: error.message }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error while verifying subscription access.',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware that strictly enforces subscription entitlement for Code Visualization.
 * Free users or plans without codeVisualization entitlement are rejected with 403.
 */
export function requireCodeVisualizationEntitlement() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user || !user._id) {
        res.status(401).json({
          success: false,
          message: 'Authentication required.',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      // Admins and faculty have preview access for management
      if (['platform_admin', 'college_admin'].includes(user.role)) {
        return next();
      }

      // Query active subscription with non-expired date
      const activeSub = await Subscription.findOne({
        userId: user._id,
        status: 'active',
        expiresAt: { $gt: new Date() }
      }).sort({ expiresAt: -1 });

      if (!activeSub) {
        logger.warn('CODE_VISUALIZATION_DENIED_NO_SUBSCRIPTION', {
          userId: user._id.toString(),
          details: { role: user.role }
        });

        res.status(403).json({
          success: false,
          message: 'An active subscription with Code Visualization is required.',
          code: 'CODE_VISUALIZATION_SUBSCRIPTION_REQUIRED',
          requiresSubscription: true
        });
        return;
      }

      if (!activeSub.hasCodeVisualizationAccess()) {
        logger.warn('CODE_VISUALIZATION_DENIED_NOT_ENTITLED', {
          userId: user._id.toString(),
          details: { planId: activeSub.planId }
        });

        res.status(403).json({
          success: false,
          message: `Your current plan (${activeSub.planName}) does not include Code Visualization. Please upgrade to Pro or Master.`,
          code: 'FEATURE_NOT_ENTITLED',
          requiresUpgrade: true,
          currentPlan: activeSub.planId
        });
        return;
      }

      (req as SubscriptionRequest).subscription = activeSub;
      next();
    } catch (error: any) {
      logger.error('CODE_VISUALIZATION_CHECK_ERROR', {
        details: { message: error.message }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error while verifying visualization entitlement.',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

