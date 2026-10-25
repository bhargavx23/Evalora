import { adaptiveSchedulerService } from '../services/adaptiveSchedulerService.js';
import { logger } from '../utils/logger.js';

/**
 * 48-Hour Adaptive Practice Question Generation Job
 *
 * Runs automatically every 48 hours to generate, validate, and publish
 * fresh practice questions across all active technical domains without
 * requiring manual administrator approval.
 */
export const adaptiveSchedulerJob = {
  name: '48h_adaptive_question_generation',

  /**
   * Starts the autonomous 48-hour background timer loop.
   */
  start(): void {
    logger.info('ADAPTIVE_SCHEDULER_JOB_REGISTERED', {
      details: { interval: '48h' }
    });
    adaptiveSchedulerService.startBackgroundScheduler();
  },

  /**
   * Stops the background timer loop gracefully.
   */
  stop(): void {
    adaptiveSchedulerService.stop();
  },

  /**
   * Manually executes a cycle (used by admin trigger or CLI).
   */
  async execute(options?: { force?: boolean; domains?: string[] }) {
    return adaptiveSchedulerService.execute48HourCycle({
      force: options?.force ?? true,
      triggerType: 'manual_admin',
      domains: options?.domains
    });
  }
};
