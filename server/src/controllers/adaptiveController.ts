import { Request, Response } from 'express';
import { adaptiveRecommendationService } from '../services/adaptiveRecommendationService.js';
import { adaptiveSchedulerService } from '../services/adaptiveSchedulerService.js';
import { logger } from '../utils/logger.js';

/**
 * GET /api/adaptive/recommendations
 * Returns personalized question recommendations, adaptive difficulty tier, and performance trend.
 */
export async function getAdaptiveRecommendations(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!._id.toString();
    const result = await adaptiveRecommendationService.getPersonalizedRecommendations(userId);

    res.json({
      success: true,
      ...result
    });
  } catch (err: any) {
    logger.error('GET_ADAPTIVE_RECOMMENDATIONS_ERROR', { details: { error: err?.message } });
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to fetch adaptive recommendations.',
      code: err.code || 'INTERNAL_ERROR'
    });
  }
}

/**
 * GET /api/adaptive/profile
 * Retrieves user's adaptive profile and mastery snapshot.
 */
export async function getAdaptiveProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!._id.toString();
    const profile = await adaptiveRecommendationService.getOrCreateProfile(userId);

    res.json({
      success: true,
      profile
    });
  } catch (err: any) {
    logger.error('GET_ADAPTIVE_PROFILE_ERROR', { details: { error: err?.message } });
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch adaptive profile.',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * PUT /api/adaptive/preferences
 * Updates user's domain and topic focus, preferred difficulty, or difficulty lock.
 */
export async function updateAdaptivePreferences(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!._id.toString();
    const { selectedDomains, selectedTopics, preferredDifficulty, strictDifficulty } = req.body;

    const profile = await adaptiveRecommendationService.updatePreferences(userId, {
      selectedDomains,
      selectedTopics,
      preferredDifficulty,
      strictDifficulty
    });

    res.json({
      success: true,
      message: 'Adaptive preferences updated successfully.',
      profile
    });
  } catch (err: any) {
    logger.error('UPDATE_ADAPTIVE_PREFERENCES_ERROR', { details: { error: err?.message } });
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to update preferences.',
      code: 'VALIDATION_ERROR'
    });
  }
}

/**
 * POST /api/adaptive/start-session
 * Atomically starts an adaptive practice session or resumes an existing active session.
 */
export async function startAdaptiveSession(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!._id.toString();
    const count = Number(req.body.count) || 5;

    const result = await adaptiveRecommendationService.startOrResumeAdaptiveSession(userId, count);

    res.status(result.resumed ? 200 : 201).json({
      success: true,
      message: result.resumed ? 'Resumed active practice session.' : 'Created new adaptive practice session.',
      ...result
    });
  } catch (err: any) {
    logger.error('START_ADAPTIVE_SESSION_ERROR', { details: { error: err?.message } });
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to start adaptive practice session.',
      code: err.code || 'INTERNAL_ERROR'
    });
  }
}

/**
 * GET /api/adaptive/jobs
 * Returns 48-hour automatic question generation job history (Admin/Diagnostic).
 */
export async function getSchedulerJobHistory(req: Request, res: Response): Promise<void> {
  try {
    const limit = Number(req.query.limit) || 20;
    const history = await adaptiveSchedulerService.getJobHistory(limit);
    const latestJob = await adaptiveSchedulerService.getLatestJob();

    res.json({
      success: true,
      latestJob,
      history
    });
  } catch (err: any) {
    logger.error('GET_SCHEDULER_HISTORY_ERROR', { details: { error: err?.message } });
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to retrieve scheduler job history.',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * POST /api/adaptive/trigger-job
 * Manually triggers the 48-hour question generation cycle.
 */
export async function triggerSchedulerJob(req: Request, res: Response): Promise<void> {
  try {
    const { force = true, domains } = req.body;
    const result = await adaptiveSchedulerService.execute48HourCycle({
      force,
      triggerType: 'manual_admin',
      domains
    });

    res.json(result);
  } catch (err: any) {
    logger.error('TRIGGER_SCHEDULER_JOB_ERROR', { details: { error: err?.message } });
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to trigger question generation cycle.',
      code: 'INTERNAL_ERROR'
    });
  }
}
