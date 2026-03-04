# The Workshop v2.0

> Repository management, Git operations, and deployment platform for the Trancendos Ecosystem.

## Features

### Real Git Integration
- **GitHub API**: Create repos, branches, PRs, push files, list commits
- **GitLab API**: Create projects, branches, merge requests
- **BitBucket API**: Create repos, list repos
- **Local Git**: init, status, log, add, commit, branch, checkout, merge, diff, push

### Repository Management
- Create and manage repositories
- Branch management with create/switch/merge
- Pull request workflow (create, review, merge)
- Commit history and diff viewing

### Deployment Pipeline
- Workshop → Cloudflare Manager deploy pipeline
- Import repos from GitHub/GitLab/BitBucket
- Deploy to Cloudflare Pages/Workers

### Dashboard
- Repository sidebar with create/select
- Git connections management (GitHub/GitLab/BitBucket)
- Pull requests page with status tracking
- Deployments page with history
- Branch and commit visualization

## Architecture

```
src/
├── index.ts          # TypeScript class definition
├── index.test.ts     # Tests
└── runtime/
    └── the-workshop-service.js  # Node.js runtime service (port 3024)
```

## Part of the Trancendos Ecosystem
- Port: 3024
- Event Bus: Observatory (port 3010)
- Pipeline: The Lab → Workshop → Cloudflare Manager
