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


// ============================================================================
// IAM MIDDLEWARE — Trancendos 2060 Standard (TRN-PROD-001)
// ============================================================================
import { createHash, createHmac } from 'crypto';

const IAM_JWT_SECRET = process.env.IAM_JWT_SECRET || process.env.JWT_SECRET || '';
const IAM_ALGORITHM = process.env.JWT_ALGORITHM || 'HS512';
const SERVICE_ID = 'workshop';
const MESH_ADDRESS = process.env.MESH_ADDRESS || 'workshop.agent.local';

function sha512Audit(data: string): string {
  return createHash('sha512').update(data).digest('hex');
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64').toString('utf8');
}

interface JWTClaims {
  sub: string; email?: string; role?: string;
  active_role_level?: number; permissions?: string[];
  exp?: number; jti?: string;
}

function verifyIAMToken(token: string): JWTClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, sig] = parts;
    const header = JSON.parse(b64urlDecode(h));
    const alg = header.alg === 'HS512' ? 'sha512' : 'sha256';
    const expected = createHmac(alg, IAM_JWT_SECRET)
      .update(`${h}.${p}`).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    if (expected !== sig) return null;
    const claims = JSON.parse(b64urlDecode(p)) as JWTClaims;
    if (claims.exp && Date.now() / 1000 > claims.exp) return null;
    return claims;
  } catch { return null; }
}

function requireIAMLevel(maxLevel: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) { res.status(401).json({ error: 'Authentication required', service: SERVICE_ID }); return; }
    const claims = verifyIAMToken(token);
    if (!claims) { res.status(401).json({ error: 'Invalid or expired token', service: SERVICE_ID }); return; }
    const level = claims.active_role_level ?? 6;
    if (level > maxLevel) {
      console.log(JSON.stringify({ level: 'audit', decision: 'DENY', service: SERVICE_ID,
        principal: claims.sub, requiredLevel: maxLevel, actualLevel: level, path: req.path,
        integrityHash: sha512Audit(`DENY:${claims.sub}:${req.path}:${Date.now()}`),
        timestamp: new Date().toISOString() }));
      res.status(403).json({ error: 'Insufficient privilege level', required: maxLevel, actual: level });
      return;
    }
    (req as any).principal = claims;
    next();
  };
}

function iamRequestMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Service-Id', SERVICE_ID);
  res.setHeader('X-Mesh-Address', MESH_ADDRESS);
  res.setHeader('X-IAM-Version', '1.0');
  next();
}

function iamHealthStatus() {
  return {
    iam: {
      version: '1.0', algorithm: IAM_ALGORITHM,
      status: IAM_JWT_SECRET ? 'configured' : 'unconfigured',
      meshAddress: MESH_ADDRESS,
      routingProtocol: process.env.MESH_ROUTING_PROTOCOL || 'static_port',
      cryptoMigrationPath: 'hmac_sha512 → ml_kem (2030) → hybrid_pqc (2040) → slh_dsa (2060)',
    },
  };
}
// ============================================================================
// END IAM MIDDLEWARE
// ============================================================================

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