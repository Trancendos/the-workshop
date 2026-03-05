/**
 * The Workshop — REST API Server
 * Code quality, git analysis, deployment analysis, pipeline management
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { logger } from '../utils/logger';
import { codeQualityAnalyzer } from '../quality/code-quality';

export function createServer(): express.Application {
  const app = express();
  app.use(helmet()); app.use(cors()); app.use(express.json({ limit: '2mb' }));
  app.use(morgan('combined', { stream: { write: (m: string) => logger.info({ http: m.trim() }, 'HTTP') } }));

  app.get('/health', (_req, res) => res.json({
    status: 'healthy', service: 'the-workshop', uptime: process.uptime(),
    timestamp: new Date().toISOString(), reports: codeQualityAnalyzer.getReports().length,
  }));

  app.get('/metrics', (_req, res) => {
    const mem = process.memoryUsage();
    const reports = codeQualityAnalyzer.getReports();
    res.json({ service: 'the-workshop', uptime: process.uptime(),
      memory: { heapUsedMb: Math.round(mem.heapUsed/1024/1024), rssMb: Math.round(mem.rss/1024/1024) },
      reports: { total: reports.length, avgScore: reports.length > 0 ? Math.round(reports.reduce((s,r) => s+r.score,0)/reports.length) : 0 },
    });
  });

  // Code quality
  app.post('/api/v1/analyze/code', (req, res) => {
    try {
      const { content, filename } = req.body;
      if (!content || !filename) return res.status(400).json({ error: 'content and filename are required' });
      const report = codeQualityAnalyzer.analyzeCode(content, filename);
      return res.status(201).json(report);
    } catch (err) { return res.status(500).json({ error: String(err) }); }
  });

  app.get('/api/v1/reports', (_req, res) => {
    const reports = codeQualityAnalyzer.getReports();
    res.json({ count: reports.length, reports });
  });

  app.get('/api/v1/reports/:id', (req, res) => {
    const report = codeQualityAnalyzer.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    return res.json(report);
  });

  // Git analysis
  app.post('/api/v1/analyze/git', (req, res) => {
    try {
      const { branch, commitMessage } = req.body;
      if (!branch) return res.status(400).json({ error: 'branch is required' });
      const analysis = codeQualityAnalyzer.analyzeGit(branch, commitMessage);
      return res.json(analysis);
    } catch (err) { return res.status(500).json({ error: String(err) }); }
  });

  // Deployment analysis
  app.post('/api/v1/analyze/deployment', (req, res) => {
    try {
      const { files } = req.body;
      if (!files || !Array.isArray(files)) return res.status(400).json({ error: 'files array is required' });
      const analysis = codeQualityAnalyzer.analyzeDeployment(files);
      return res.json(analysis);
    } catch (err) { return res.status(500).json({ error: String(err) }); }
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: err.message });
  });
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}