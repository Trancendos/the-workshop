/**
 * The Workshop — Code Quality Analyzer
 *
 * Rule-based code quality analysis replacing LLM calls from workshopAI.ts.
 * Analyzes TypeScript/JavaScript code for security, performance, and best practices.
 *
 * Migrated from: server/services/workshopAI.ts (521 lines)
 * Zero-cost: All analysis is rule-based, no LLM API calls.
 *
 * Architecture: Trancendos Industry 6.0 / 2060 Standard
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export type IssueSeverity = 'info' | 'warning' | 'error' | 'critical';
export type IssueCategory = 'security' | 'performance' | 'maintainability' | 'reliability' | 'style' | 'typescript';

export interface QualityRule {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  pattern: RegExp;
  recommendation: string;
  autoFixable: boolean;
}

export interface QualityIssue {
  ruleId: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  line?: number;
  column?: number;
  snippet?: string;
  recommendation: string;
  autoFixable: boolean;
}

export interface QualityReport {
  id: string;
  filename: string;
  language: string;
  score: number;           // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: QualityIssue[];
  issuesByCategory: Record<IssueCategory, number>;
  issuesBySeverity: Record<IssueSeverity, number>;
  recommendations: string[];
  autoFixCount: number;
  analyzedAt: Date;
}

export interface GitAnalysis {
  branch: string;
  hasConventionalCommits: boolean;
  hasProtectedBranch: boolean;
  recommendations: string[];
  score: number;
}

export interface DeploymentAnalysis {
  hasDockerfile: boolean;
  hasCI: boolean;
  hasHealthCheck: boolean;
  hasEnvExample: boolean;
  recommendations: string[];
  score: number;
}

// ============================================================================
// QUALITY RULES
// ============================================================================

const QUALITY_RULES: QualityRule[] = [
  // Security
  {
    id: 'SEC001', category: 'security', severity: 'critical',
    title: 'Hardcoded Secret',
    description: 'Potential hardcoded secret or API key detected',
    pattern: /(password|secret|api_key|apikey|token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    recommendation: 'Move secrets to environment variables. Use process.env.SECRET_NAME',
    autoFixable: false,
  },
  {
    id: 'SEC002', category: 'security', severity: 'error',
    title: 'SQL Injection Risk',
    description: 'String concatenation in SQL query detected',
    pattern: /query\s*\(\s*[`'"]\s*SELECT.*\$\{/i,
    recommendation: 'Use parameterised queries or an ORM to prevent SQL injection',
    autoFixable: false,
  },
  {
    id: 'SEC003', category: 'security', severity: 'error',
    title: 'eval() Usage',
    description: 'eval() is a security risk and should be avoided',
    pattern: /\beval\s*\(/,
    recommendation: 'Replace eval() with safer alternatives like JSON.parse() or Function constructors',
    autoFixable: false,
  },
  {
    id: 'SEC004', category: 'security', severity: 'warning',
    title: 'console.log in Production Code',
    description: 'console.log may leak sensitive information in production',
    pattern: /console\.(log|debug|info)\s*\(/,
    recommendation: 'Replace console.log with a structured logger (e.g. pino)',
    autoFixable: true,
  },
  {
    id: 'SEC005', category: 'security', severity: 'error',
    title: 'Prototype Pollution Risk',
    description: 'Direct prototype assignment detected',
    pattern: /\.__proto__\s*=/,
    recommendation: 'Avoid modifying __proto__. Use Object.create() or class inheritance',
    autoFixable: false,
  },
  // Performance
  {
    id: 'PERF001', category: 'performance', severity: 'warning',
    title: 'Synchronous File I/O',
    description: 'Synchronous file operations block the event loop',
    pattern: /fs\.(readFileSync|writeFileSync|existsSync|mkdirSync)\s*\(/,
    recommendation: 'Use async fs operations: fs.promises.readFile(), fs.promises.writeFile()',
    autoFixable: true,
  },
  {
    id: 'PERF002', category: 'performance', severity: 'warning',
    title: 'Missing await in async function',
    description: 'Promise returned without await may cause unhandled rejections',
    pattern: /async\s+function[^{]*\{[^}]*return\s+[a-zA-Z]+\s*\(/,
    recommendation: 'Ensure all async operations are properly awaited',
    autoFixable: false,
  },
  {
    id: 'PERF003', category: 'performance', severity: 'info',
    title: 'Array.forEach instead of for...of',
    description: 'for...of is generally faster than forEach for large arrays',
    pattern: /\.forEach\s*\(\s*(async\s*)?\(/,
    recommendation: 'Consider using for...of for better performance and async support',
    autoFixable: true,
  },
  // Reliability
  {
    id: 'REL001', category: 'reliability', severity: 'error',
    title: 'Empty catch block',
    description: 'Empty catch blocks silently swallow errors',
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
    recommendation: 'Always handle errors in catch blocks. At minimum, log the error',
    autoFixable: false,
  },
  {
    id: 'REL002', category: 'reliability', severity: 'warning',
    title: 'Floating Promise',
    description: 'Promise not awaited or caught may cause unhandled rejections',
    pattern: /^\s+[a-zA-Z]+\.[a-zA-Z]+\(.*\);\s*$/m,
    recommendation: 'Await promises or attach .catch() handlers',
    autoFixable: false,
  },
  {
    id: 'REL003', category: 'reliability', severity: 'warning',
    title: 'TODO/FIXME comment',
    description: 'Unresolved TODO or FIXME comment found',
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX):/i,
    recommendation: 'Resolve or track TODO/FIXME items in your issue tracker',
    autoFixable: false,
  },
  // TypeScript
  {
    id: 'TS001', category: 'typescript', severity: 'warning',
    title: 'any type usage',
    description: 'Using "any" type defeats TypeScript\'s type safety',
    pattern: /:\s*any\b/,
    recommendation: 'Replace "any" with specific types or "unknown" for safer type handling',
    autoFixable: false,
  },
  {
    id: 'TS002', category: 'typescript', severity: 'info',
    title: 'Non-null assertion',
    description: 'Non-null assertion (!) may cause runtime errors if value is null',
    pattern: /[a-zA-Z0-9_\])\s]!\./,
    recommendation: 'Use optional chaining (?.) or explicit null checks instead of !',
    autoFixable: true,
  },
  // Maintainability
  {
    id: 'MAINT001', category: 'maintainability', severity: 'info',
    title: 'Long function',
    description: 'Function exceeds 50 lines — consider breaking it up',
    pattern: /function[^{]*\{[\s\S]{2000,}\}/,
    recommendation: 'Break large functions into smaller, focused functions',
    autoFixable: false,
  },
  {
    id: 'MAINT002', category: 'maintainability', severity: 'info',
    title: 'Magic number',
    description: 'Magic number used directly in code',
    pattern: /[^a-zA-Z_$]\b([2-9]\d{2,}|[1-9]\d{3,})\b[^a-zA-Z_$]/,
    recommendation: 'Extract magic numbers into named constants for clarity',
    autoFixable: false,
  },
];

// ============================================================================
// CODE QUALITY ANALYZER
// ============================================================================

export class CodeQualityAnalyzer {
  private reports: Map<string, QualityReport> = new Map();

  analyzeCode(content: string, filename: string): QualityReport {
    const lines = content.split('\n');
    const issues: QualityIssue[] = [];
    const language = this.detectLanguage(filename);

    for (const rule of QUALITY_RULES) {
      // Check full content
      if (rule.pattern.test(content)) {
        // Find line number
        let lineNum: number | undefined;
        for (let i = 0; i < lines.length; i++) {
          if (rule.pattern.test(lines[i])) {
            lineNum = i + 1;
            break;
          }
        }
        issues.push({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          title: rule.title,
          description: rule.description,
          line: lineNum,
          snippet: lineNum ? lines[lineNum - 1]?.trim().slice(0, 100) : undefined,
          recommendation: rule.recommendation,
          autoFixable: rule.autoFixable,
        });
      }
    }

    const score = this.calculateScore(issues);
    const report: QualityReport = {
      id: uuidv4(),
      filename,
      language,
      score,
      grade: this.scoreToGrade(score),
      issues,
      issuesByCategory: this.groupByCategory(issues),
      issuesBySeverity: this.groupBySeverity(issues),
      recommendations: this.buildRecommendations(issues),
      autoFixCount: issues.filter(i => i.autoFixable).length,
      analyzedAt: new Date(),
    };

    this.reports.set(report.id, report);
    logger.info({ reportId: report.id, filename, score, grade: report.grade, issues: issues.length }, 'Code quality analysis complete');
    return report;
  }

  analyzeGit(branch: string, commitMessage?: string): GitAnalysis {
    const hasConventionalCommits = commitMessage
      ? /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .+/.test(commitMessage)
      : false;

    const recommendations: string[] = [];
    let score = 70;

    if (!hasConventionalCommits && commitMessage) {
      recommendations.push('Use conventional commits format: feat|fix|docs|style|refactor|test|chore: description');
      score -= 10;
    }
    if (branch === 'main' || branch === 'master') {
      recommendations.push('Avoid committing directly to main/master. Use feature branches');
      score -= 15;
    }
    if (!branch.match(/^(feat|fix|hotfix|release|chore)\//)) {
      recommendations.push('Use branch naming convention: feat/|fix/|hotfix/|release/|chore/');
      score -= 5;
    }

    return { branch, hasConventionalCommits, hasProtectedBranch: branch !== 'main', recommendations, score: Math.max(0, score) };
  }

  analyzeDeployment(files: string[]): DeploymentAnalysis {
    const hasDockerfile = files.some(f => f.includes('Dockerfile'));
    const hasCI = files.some(f => f.includes('.github/workflows') || f.includes('.gitlab-ci'));
    const hasHealthCheck = files.some(f => f.includes('health') || f.includes('healthcheck'));
    const hasEnvExample = files.some(f => f.includes('.env.example') || f.includes('.env.sample'));

    const recommendations: string[] = [];
    let score = 60;

    if (hasDockerfile) score += 10; else recommendations.push('Add a Dockerfile for containerised deployment');
    if (hasCI) score += 15; else recommendations.push('Add CI/CD pipeline (GitHub Actions, GitLab CI)');
    if (hasHealthCheck) score += 10; else recommendations.push('Add a /health endpoint for deployment health checks');
    if (hasEnvExample) score += 5; else recommendations.push('Add .env.example to document required environment variables');

    return { hasDockerfile, hasCI, hasHealthCheck, hasEnvExample, recommendations, score: Math.min(100, score) };
  }

  getReport(id: string): QualityReport | undefined { return this.reports.get(id); }
  getReports(): QualityReport[] { return Array.from(this.reports.values()); }

  private detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = { ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', py: 'python', go: 'go', rs: 'rust', java: 'java', md: 'markdown', yaml: 'yaml', yml: 'yaml', json: 'json' };
    return map[ext || ''] || 'unknown';
  }

  private calculateScore(issues: QualityIssue[]): number {
    const weights: Record<IssueSeverity, number> = { critical: 25, error: 15, warning: 7, info: 2 };
    const deduction = issues.reduce((sum, i) => sum + (weights[i.severity] || 0), 0);
    return Math.max(0, 100 - deduction);
  }

  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private groupByCategory(issues: QualityIssue[]): Record<IssueCategory, number> {
    const cats: IssueCategory[] = ['security', 'performance', 'maintainability', 'reliability', 'style', 'typescript'];
    return Object.fromEntries(cats.map(c => [c, issues.filter(i => i.category === c).length])) as Record<IssueCategory, number>;
  }

  private groupBySeverity(issues: QualityIssue[]): Record<IssueSeverity, number> {
    const sevs: IssueSeverity[] = ['info', 'warning', 'error', 'critical'];
    return Object.fromEntries(sevs.map(s => [s, issues.filter(i => i.severity === s).length])) as Record<IssueSeverity, number>;
  }

  private buildRecommendations(issues: QualityIssue[]): string[] {
    const critical = issues.filter(i => i.severity === 'critical');
    const errors = issues.filter(i => i.severity === 'error');
    const recs: string[] = [];
    if (critical.length > 0) recs.push(`Fix ${critical.length} critical issue(s) immediately: ${critical.map(i => i.title).join(', ')}`);
    if (errors.length > 0) recs.push(`Resolve ${errors.length} error(s): ${errors.map(i => i.title).join(', ')}`);
    const autoFix = issues.filter(i => i.autoFixable);
    if (autoFix.length > 0) recs.push(`${autoFix.length} issue(s) can be auto-fixed`);
    return recs;
  }
}

export const codeQualityAnalyzer = new CodeQualityAnalyzer();