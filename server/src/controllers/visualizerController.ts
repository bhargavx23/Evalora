import { Request, Response } from 'express';
import { VisualizerSample } from '../models/VisualizerSample.js';
import { Subscription } from '../models/Subscription.js';
import { codeVisualizerService } from '../services/codeVisualizerService.js';
import { logger } from '../utils/logger.js';

/**
 * Controller for Dedicated Code Visualization Feature
 */
export const visualizerController = {
  /**
   * GET /api/visualizer/samples
   * Returns beginner-friendly samples stored in MongoDB.
   */
  async getSamples(req: Request, res: Response): Promise<void> {
    try {
      const language = req.query.language as string | undefined;
      const query: any = {};
      if (language) {
        query.language = language.toLowerCase();
      }

      const samples = await VisualizerSample.find(query).sort({ sortOrder: 1 }).lean();
      res.json({
        success: true,
        count: samples.length,
        samples
      });
    } catch (err: any) {
      logger.error('GET_VISUALIZER_SAMPLES_ERROR', { details: { message: err.message } });
      res.status(500).json({ success: false, message: 'Failed to retrieve code visualizer samples.' });
    }
  },

  /**
   * GET /api/visualizer/samples/:sampleId
   * Returns a specific sample by sampleId.
   */
  async getSampleById(req: Request, res: Response): Promise<void> {
    try {
      const { sampleId } = req.params;
      const sample = await VisualizerSample.findOne({ sampleId }).lean();
      if (!sample) {
        res.status(404).json({ success: false, message: `Sample with ID '${sampleId}' not found.` });
        return;
      }
      res.json({ success: true, sample });
    } catch (err: any) {
      logger.error('GET_VISUALIZER_SAMPLE_BY_ID_ERROR', { details: { message: err.message } });
      res.status(500).json({ success: false, message: 'Failed to retrieve code sample.' });
    }
  },

  /**
   * GET /api/visualizer/status
   * Checks whether the current user is entitled to Code Visualization.
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required.' });
        return;
      }

      const activeSub = await Subscription.findOne({
        userId,
        status: 'active',
        expiresAt: { $gt: new Date() }
      }).lean();

      const isEntitled = Boolean(activeSub?.entitlements?.codeVisualization);

      res.json({
        success: true,
        entitled: isEntitled,
        planId: activeSub?.planId || 'free',
        planName: activeSub?.planName || 'Free Tier',
        allowedLanguages: ['javascript', 'python'],
        maxSteps: 250
      });
    } catch (err: any) {
      logger.error('GET_VISUALIZER_STATUS_ERROR', { details: { message: err.message } });
      res.status(500).json({ success: false, message: 'Failed to determine visualizer status.' });
    }
  },

  /**
   * POST /api/visualizer/trace
   * Generates step-by-step genuine execution trace for custom code or sample code.
   * Gated strictly by requireCodeVisualizationEntitlement middleware.
   */
  async generateTrace(req: Request, res: Response): Promise<void> {
    try {
      const { code, language } = req.body;

      if (!code || typeof code !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Code parameter is required and must be a valid string.'
        });
        return;
      }

      if (!language || typeof language !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Language parameter is required (e.g. javascript, python).'
        });
        return;
      }

      const result = await codeVisualizerService.visualize({ code, language });
      res.json(result);
    } catch (err: any) {
      logger.error('GENERATE_VISUALIZER_TRACE_ERROR', { details: { message: err.message } });
      res.status(500).json({
        success: false,
        message: 'Internal error generating execution visualization trace.'
      });
    }
  }
};
