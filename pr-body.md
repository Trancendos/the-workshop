## Wave 3 — The Workshop: Code Quality Analyzer Platform Module

Implements The Workshop as a standalone service — rule-based code quality analysis and development standards enforcement for the Trancendos mesh. All LLM calls replaced with deterministic rule-based logic.

### What's Included

**CodeQualityAnalyzer** (`src/quality/code-quality.ts`) — 15 quality rules

| Category | Rules |
|----------|-------|
| Security | SEC001 hardcoded secrets, SEC002 SQL injection, SEC003 eval usage, SEC004 weak crypto, SEC005 path traversal |
| Performance | PERF001 sync file ops, PERF002 nested loops, PERF003 memory leaks |
| Reliability | REL001 empty catch, REL002 unhandled promises, REL003 null checks |
| TypeScript | TS001 any type, TS002 non-null assertion |
| Maintainability | MAINT001 function length, MAINT002 file length |

- `analyzeCode(content, filename)` — returns QualityReport with score (0-100), grade (A-F), issues
- `analyzeGit(branch, commitMessage)` — validates conventional commits and branch naming
- `analyzeDeployment(files)` — checks Dockerfile, CI config, health checks, .env.example
- Score weights: critical=-25, error=-15, warning=-7, info=-2

**REST API** (`src/api/server.ts`)
- POST `/analyze/code` — analyze code content
- POST `/analyze/git` — analyze git metadata
- POST `/analyze/deployment` — analyze deployment files
- GET `/reports` — list analysis reports
- GET `/health`, GET `/metrics`

**Bootstrap** (`src/index.ts`)
- Port 3011
- Pino structured logging
- Graceful shutdown (SIGTERM/SIGINT)

### Architecture
- Zero-cost mandate compliant (no LLM API calls)
- Strict TypeScript ES2022
- Express + Helmet + CORS + Morgan
- Pino structured logging

### Part of Wave 3 — Platform Modules
Trancendos Industry 6.0 / 2060 Standard