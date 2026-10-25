import { Request, Response } from 'express';
import { codeVisualizerService } from '../services/codeVisualizerService.js';
import { logger } from '../utils/logger.js';

export async function handleVisualizeCode(req: Request, res: Response): Promise<void> {
  try {
    const { code, language } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Valid code string is required for visualization.'
      });
      return;
    }

    const cleanLang = (language || 'javascript').toString().toLowerCase().trim();

    logger.info('CODE_VISUALIZATION_REQUEST', {
      userId: req.user?._id?.toString(),
      details: { language: cleanLang, codeLength: code.length }
    });

    const result = await codeVisualizerService.visualize({
      code,
      language: cleanLang
    });

    res.json(result);
  } catch (error: any) {
    logger.error('CODE_VISUALIZATION_CONTROLLER_ERROR', {
      details: { message: error.message }
    });
    res.status(500).json({
      success: false,
      message: 'Failed to generate code execution visualization.',
      error: error.message
    });
  }
}
