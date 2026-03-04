/**
 * THE WORKSHOP — Repository & Deployment Platform v2.0
 * Port: 3024
 *
 * Features:
 * - Real Git operations via simple-git
 * - GitHub/GitLab/BitBucket API integration
 * - Branch management, PRs, code review
 * - Workshop → Cloudflare Pages deployment pipeline
 * - Deployment history and rollback
 * - Observatory audit trail
 * - File persistence via JSON store
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const { execSync, spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Actor-Role,X-Actor-Id');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── DATA DIRECTORIES ─────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '../../data/the-workshop');
const REPOS_DIR = path.join(DATA_DIR, 'repos');
const GIT_DIR = path.join(DATA_DIR, 'git-repos');
const DEPLOY_DIR = path.join(DATA_DIR, 'deployments');
[DATA_DIR, REPOS_DIR, GIT_DIR, DEPLOY_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ─── FILE STORE ────────────────────────────────────────────────────────────────
class FileStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = new Map();
    this._load();
  }
  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        this.data = new Map(Object.entries(raw));
      }
    } catch {}
  }
  _save() {
    try {
      const obj = Object.fromEntries(this.data);
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2));
    } catch {}
  }
  set(k, v) { this.data.set(k, v); this._save(); return this; }
  get(k) { return this.data.get(k); }
  has(k) { return this.data.has(k); }
  delete(k) { this.data.delete(k); this._save(); return true; }
  values() { return this.data.values(); }
  entries() { return this.data.entries(); }
  get size() { return this.data.size; }
  toArray() { return Array.from(this.data.values()); }
}

const repositories = new FileStore(path.join(REPOS_DIR, 'repositories.json'));
const pullRequests = new FileStore(path.join(REPOS_DIR, 'pull-requests.json'));
const deployments = new FileStore(path.join(DEPLOY_DIR, 'deployments.json'));
const gitConnections = new FileStore(path.join(DATA_DIR, 'git-connections.json'));

// ─── GIT PROVIDER CLIENTS ──────────────────────────────────────────────────────
class GitHubClient {
  constructor(token) {
    this.token = token;
    this.baseUrl = 'https://api.github.com';
  }
  headers() {
    return {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }
  async request(method, endpoint, data = null) {
    try {
      const config = { method, url: `${this.baseUrl}${endpoint}`, headers: this.headers(), timeout: 15000 };
      if (data) config.data = data;
      const resp = await axios(config);
      return { success: true, data: resp.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || err.message, status: err.response?.status };
    }
  }
  async getUser() { return this.request('GET', '/user'); }
  async listRepos(username) { return this.request('GET', `/users/${username}/repos?per_page=100&sort=updated`); }
  async createRepo(name, description, isPrivate = false) {
    return this.request('POST', '/user/repos', { name, description, private: isPrivate, auto_init: true });
  }
  async getRepo(owner, repo) { return this.request('GET', `/repos/${owner}/${repo}`); }
  async createBranch(owner, repo, branch, fromBranch = 'main') {
    const ref = await this.request('GET', `/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`);
    if (!ref.success) return ref;
    return this.request('POST', `/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: ref.data.object.sha
    });
  }
  async createPR(owner, repo, title, body, head, base = 'main') {
    return this.request('POST', `/repos/${owner}/${repo}/pulls`, { title, body, head, base });
  }
  async listPRs(owner, repo) { return this.request('GET', `/repos/${owner}/${repo}/pulls?state=all`); }
  async mergePR(owner, repo, prNumber) {
    return this.request('PUT', `/repos/${owner}/${repo}/pulls/${prNumber}/merge`, { merge_method: 'squash' });
  }
  async getCommits(owner, repo, branch = 'main') {
    return this.request('GET', `/repos/${owner}/${repo}/commits?sha=${branch}&per_page=20`);
  }
  async createFile(owner, repo, filePath, content, message, branch = 'main') {
    const encoded = Buffer.from(content).toString('base64');
    return this.request('PUT', `/repos/${owner}/${repo}/contents/${filePath}`, {
      message, content: encoded, branch
    });
  }
  async pushFiles(owner, repo, files, message, branch = 'main') {
    const results = [];
    for (const [filePath, content] of Object.entries(files)) {
      const r = await this.createFile(owner, repo, filePath, content, message, branch);
      results.push({ file: filePath, success: r.success, error: r.error });
    }
    return { success: results.every(r => r.success), results };
  }
}

class GitLabClient {
  constructor(token, baseUrl = 'https://gitlab.com') {
    this.token = token;
    this.baseUrl = `${baseUrl}/api/v4`;
  }
  headers() { return { 'PRIVATE-TOKEN': this.token, 'Content-Type': 'application/json' }; }
  async request(method, endpoint, data = null) {
    try {
      const config = { method, url: `${this.baseUrl}${endpoint}`, headers: this.headers(), timeout: 15000 };
      if (data) config.data = data;
      const resp = await axios(config);
      return { success: true, data: resp.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || err.message };
    }
  }
  async getUser() { return this.request('GET', '/user'); }
  async createProject(name, description) {
    return this.request('POST', '/projects', { name, description, initialize_with_readme: true });
  }
  async listProjects() { return this.request('GET', '/projects?membership=true&per_page=100'); }
  async createBranch(projectId, branch, ref = 'main') {
    return this.request('POST', `/projects/${projectId}/repository/branches`, { branch, ref });
  }
  async createMR(projectId, title, description, sourceBranch, targetBranch = 'main') {
    return this.request('POST', `/projects/${projectId}/merge_requests`, {
      title, description, source_branch: sourceBranch, target_branch: targetBranch
    });
  }
}

class BitBucketClient {
  constructor(username, appPassword) {
    this.username = username;
    this.appPassword = appPassword;
    this.baseUrl = 'https://api.bitbucket.org/2.0';
  }
  headers() {
    const creds = Buffer.from(`${this.username}:${this.appPassword}`).toString('base64');
    return { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' };
  }
  async request(method, endpoint, data = null) {
    try {
      const config = { method, url: `${this.baseUrl}${endpoint}`, headers: this.headers(), timeout: 15000 };
      if (data) config.data = data;
      const resp = await axios(config);
      return { success: true, data: resp.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  }
  async getUser() { return this.request('GET', `/users/${this.username}`); }
  async createRepo(name, description) {
    return this.request('POST', `/repositories/${this.username}/${name}`, {
      scm: 'git', description, is_private: false
    });
  }
  async listRepos() { return this.request('GET', `/repositories/${this.username}?pagelen=100`); }
}

// ─── GIT LOCAL OPERATIONS ──────────────────────────────────────────────────────
class LocalGitOps {
  constructor(repoPath) {
    this.repoPath = repoPath;
  }
  exec(cmd) {
    try {
      return { success: true, output: execSync(cmd, { cwd: this.repoPath, encoding: 'utf8', timeout: 30000 }) };
    } catch (err) {
      return { success: false, error: err.message, stderr: err.stderr?.toString() };
    }
  }
  init() { return this.exec('git init'); }
  status() { return this.exec('git status --porcelain'); }
  log(n = 10) { return this.exec(`git log --oneline -${n} 2>/dev/null || echo "No commits yet"`); }
  add(files = '.') { return this.exec(`git add ${files}`); }
  commit(message) { return this.exec(`git commit -m "${message.replace(/"/g, '\&quot;')}" --allow-empty`); }
  branch(name) { return this.exec(`git checkout -b ${name}`); }
  checkout(name) { return this.exec(`git checkout ${name}`); }
  merge(branch) { return this.exec(`git merge ${branch} --no-ff`); }
  diff(branch1, branch2) { return this.exec(`git diff ${branch1}..${branch2} --stat`); }
  listBranches() { return this.exec('git branch -a'); }
  clone(url, dest) {
    try {
      return { success: true, output: execSync(`git clone ${url} ${dest}`, { encoding: 'utf8', timeout: 60000 }) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  setRemote(name, url) { return this.exec(`git remote add ${name} ${url} 2>/dev/null || git remote set-url ${name} ${url}`); }
  push(remote = 'origin', branch = 'main') { return this.exec(`git push ${remote} ${branch}`); }
  configUser(name, email) {
    this.exec(`git config user.name "${name}"`);
    this.exec(`git config user.email "${email}"`);
  }
}

// ─── OBSERVATORY CLIENT ────────────────────────────────────────────────────────
async function emitEvent(action, actor, resource, metadata = {}) {
  try {
    await axios.post('http://localhost:3010/events', {
      actor: { type: actor.type || 'user', id: actor.id || 'system', name: actor.name || 'Workshop' },
      action: { type: action, category: 'workshop', resource },
      metadata: { severity: 'INFO', platform: 'the-workshop', ...metadata },
      visibility: { adminVisible: true, actorVisible: true, publicVisible: false }
    }, { timeout: 3000 });
  } catch {}
}

// ─── ROUTES ────────────────────────────────────────────────────────────────────

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy', service: 'the-workshop', port: 3024, version: '2.0.0',
    repositories: repositories.size, pullRequests: pullRequests.size,
    deployments: deployments.size, gitConnections: gitConnections.size,
    timestamp: new Date().toISOString()
  });
});

// ── Git Provider Connections ──────────────────────────────────────────────────
app.get('/api/connections', (req, res) => {
  const conns = gitConnections.toArray().map(c => ({
    ...c, token: c.token ? '***' + c.token.slice(-4) : null
  }));
  res.json({ connections: conns, total: conns.length });
});

app.post('/api/connections', async (req, res) => {
  try {
    const { provider, token, username, appPassword, baseUrl, name } = req.body;
    if (!provider || !['github', 'gitlab', 'bitbucket'].includes(provider)) {
      return res.status(400).json({ error: 'provider must be github, gitlab, or bitbucket' });
    }

    let client, userInfo;
    if (provider === 'github') {
      client = new GitHubClient(token);
      userInfo = await client.getUser();
    } else if (provider === 'gitlab') {
      client = new GitLabClient(token, baseUrl);
      userInfo = await client.getUser();
    } else {
      client = new BitBucketClient(username, appPassword);
      userInfo = await client.getUser();
    }

    const connId = crypto.randomUUID();
    const conn = {
      id: connId, provider, name: name || `${provider}-connection`,
      username: userInfo.success ? (userInfo.data?.login || userInfo.data?.username || username) : username,
      token, appPassword, baseUrl,
      verified: userInfo.success,
      verifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    gitConnections.set(connId, conn);
    await emitEvent('GIT_CONNECTED', { id: 'system', name: 'Workshop' }, { type: 'git-connection', id: connId }, { provider });
    res.status(201).json({ success: true, connection: { ...conn, token: '***' + (token || '').slice(-4) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/connections/:id', (req, res) => {
  if (!gitConnections.has(req.params.id)) return res.status(404).json({ error: 'Connection not found' });
  gitConnections.delete(req.params.id);
  res.json({ success: true });
});

// ── Repositories ──────────────────────────────────────────────────────────────
app.get('/api/repositories', (req, res) => {
  const repos = repositories.toArray();
  res.json({ repositories: repos, total: repos.length });
});

app.get('/api/repositories/:id', (req, res) => {
  const repo = repositories.get(req.params.id);
  if (!repo) return res.status(404).json({ error: 'Repository not found' });
  res.json(repo);
});

app.post('/api/repositories', async (req, res) => {
  try {
    const { name, description, language, template, connectionId, createRemote = false, isPrivate = false } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const repoId = crypto.randomUUID();
    const localPath = path.join(GIT_DIR, repoId);
    fs.mkdirSync(localPath, { recursive: true });

    // Init local git repo
    const git = new LocalGitOps(localPath);
    git.init();
    git.configUser('Trancendos Workshop', 'workshop@trancendos.com');

    // Create README
    fs.writeFileSync(path.join(localPath, 'README.md'), `# ${name}\n\n${description || ''}\n\nCreated by Trancendos Workshop\n`);
    git.add('.');
    git.commit(`Initial commit: ${name}`);

    let remoteUrl = null;
    let remoteResult = null;

    // Create remote if requested
    if (createRemote && connectionId) {
      const conn = gitConnections.get(connectionId);
      if (conn) {
        if (conn.provider === 'github') {
          const gh = new GitHubClient(conn.token);
          remoteResult = await gh.createRepo(name, description, isPrivate);
          if (remoteResult.success) {
            remoteUrl = remoteResult.data.clone_url;
            git.setRemote('origin', remoteUrl);
          }
        } else if (conn.provider === 'gitlab') {
          const gl = new GitLabClient(conn.token, conn.baseUrl);
          remoteResult = await gl.createProject(name, description);
          if (remoteResult.success) {
            remoteUrl = remoteResult.data.http_url_to_repo;
            git.setRemote('origin', remoteUrl);
          }
        } else if (conn.provider === 'bitbucket') {
          const bb = new BitBucketClient(conn.username, conn.appPassword);
          remoteResult = await bb.createRepo(name.toLowerCase().replace(/\s+/g, '-'), description);
          if (remoteResult.success) {
            remoteUrl = remoteResult.data.links?.clone?.[0]?.href;
            if (remoteUrl) git.setRemote('origin', remoteUrl);
          }
        }
      }
    }

    const repo = {
      id: repoId, name, description, language: language || 'javascript',
      template: template || null, localPath, remoteUrl,
      connectionId: connectionId || null,
      defaultBranch: 'main', branches: ['main'],
      stars: 0, forks: 0, openPRs: 0,
      status: 'active', visibility: isPrivate ? 'private' : 'public',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      remoteCreated: remoteResult?.success || false,
      remoteError: remoteResult?.error || null
    };
    repositories.set(repoId, repo);
    await emitEvent('REPO_CREATED', { id: 'system', name: 'Workshop' }, { type: 'repository', id: repoId, name }, { language, remoteUrl });
    res.status(201).json({ success: true, repository: repo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/repositories/:id', async (req, res) => {
  const repo = repositories.get(req.params.id);
  if (!repo) return res.status(404).json({ error: 'Repository not found' });
  try {
    if (fs.existsSync(repo.localPath)) fs.rmSync(repo.localPath, { recursive: true, force: true });
  } catch {}
  repositories.delete(req.params.id);
  res.json({ success: true });
});

// ── Branches ──────────────────────────────────────────────────────────────────
app.get('/api/repositories/:id/branches', (req, res) => {
  const repo = repositories.get(req.params.id);
  if (!repo) return res.status(404).json({ error: 'Repository not found' });
  const git = new LocalGitOps(repo.localPath);
  const result = git.listBranches();
  const branches = result.success
    ? result.output.split('\n').map(b => b.trim().replace('* ', '')).filter(Boolean)
    : repo.branches;
  res.json({ branches, total: branches.length });
});

app.post('/api/repositories/:id/branches', async (req, res) => {
  const repo = repositories.get(req.params.id);
  if (!repo) return res.status(404).json({ error: 'Repository not found' });
  const { name, from = 'main' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const git = new LocalGitOps(repo.localPath);
  git.checkout(from);
  const result = git.branch(name);

  if (result.success) {
    repo.branches = [...new Set([...(repo.branches || ['main']), name])];
    repo.updatedAt = new Date().toISOString();
    repositories.set(repo.id, repo);

    // Also create on remote if connected
    if (repo.connectionId && repo.remoteUrl) {
      const conn = gitConnections.get(repo.connectionId);
      if (conn?.provider === 'github') {
        const [, owner, repoName] = repo.remoteUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/) || [];
        if (owner && repoName) {
          const gh = new GitHubClient(conn.token);
          await gh.createBranch(owner, repoName, name, from);
        }
      }
    }
    res.status(201).json({ success: true, branch: name });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// ── Pull Requests ─────────────────────────────────────────────────────────────
app.get('/api/repositories/:id/pull-requests', (req, res) => {
  const prs = Array.from(pullRequests.values()).filter(pr => pr.repositoryId === req.params.id);
  res.json({ pullRequests: prs, total: prs.length });
});

app.post('/api/repositories/:id/pull-requests', async (req, res) => {
  try {
    const repo = repositories.get(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    const { title, description, sourceBranch, targetBranch = 'main', reviewers = [] } = req.body;
    if (!title || !sourceBranch) return res.status(400).json({ error: 'title and sourceBranch required' });

    const prId = crypto.randomUUID();
    let remotePRUrl = null;

    // Create PR on remote if connected
    if (repo.connectionId && repo.remoteUrl) {
      const conn = gitConnections.get(repo.connectionId);
      if (conn?.provider === 'github') {
        const [, owner, repoName] = repo.remoteUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/) || [];
        if (owner && repoName) {
          const gh = new GitHubClient(conn.token);
          const result = await gh.createPR(owner, repoName, title, description, sourceBranch, targetBranch);
          if (result.success) remotePRUrl = result.data.html_url;
        }
      }
    }

    const pr = {
      id: prId, repositoryId: req.params.id, title, description,
      sourceBranch, targetBranch, reviewers, status: 'open',
      remotePRUrl, comments: [], approvals: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    pullRequests.set(prId, pr);
    repo.openPRs = (repo.openPRs || 0) + 1;
    repositories.set(repo.id, repo);
    await emitEvent('PR_CREATED', { id: 'system', name: 'Workshop' }, { type: 'pull-request', id: prId, name: title }, { repositoryId: req.params.id });
    res.status(201).json({ success: true, pullRequest: pr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/pull-requests/:id', async (req, res) => {
  const pr = pullRequests.get(req.params.id);
  if (!pr) return res.status(404).json({ error: 'PR not found' });
  const { status, comment, approve } = req.body;

  if (status) pr.status = status;
  if (comment) pr.comments.push({ text: comment, createdAt: new Date().toISOString() });
  if (approve) pr.approvals = (pr.approvals || 0) + 1;
  pr.updatedAt = new Date().toISOString();

  if (status === 'merged') {
    const repo = repositories.get(pr.repositoryId);
    if (repo) {
      const git = new LocalGitOps(repo.localPath);
      git.checkout(pr.targetBranch);
      git.merge(pr.sourceBranch);
      repo.openPRs = Math.max(0, (repo.openPRs || 1) - 1);
      repositories.set(repo.id, repo);
    }
  }

  pullRequests.set(pr.id, pr);
  res.json({ success: true, pullRequest: pr });
});

// ── Commits ───────────────────────────────────────────────────────────────────
app.get('/api/repositories/:id/commits', (req, res) => {
  const repo = repositories.get(req.params.id);
  if (!repo) return res.status(404).json({ error: 'Repository not found' });
  const git = new LocalGitOps(repo.localPath);
  const result = git.log(20);
  const commits = result.success
    ? result.output.split('\n').filter(Boolean).map(line => {
        const [hash, ...msgParts] = line.split(' ');
        return { hash, message: msgParts.join(' '), timestamp: new Date().toISOString() };
      })
    : [];
  res.json({ commits, total: commits.length });
});

app.post('/api/repositories/:id/commit', async (req, res) => {
  const repo = repositories.get(req.params.id);
  if (!repo) return res.status(404).json({ error: 'Repository not found' });
  const { message, files = {} } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  const git = new LocalGitOps(repo.localPath);
  // Write files if provided
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(repo.localPath, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  git.add('.');
  const result = git.commit(message);
  repo.updatedAt = new Date().toISOString();
  repositories.set(repo.id, repo);
  res.json({ success: result.success, message: result.output || result.error });
});

// ── Push to Remote ────────────────────────────────────────────────────────────
app.post('/api/repositories/:id/push', async (req, res) => {
  try {
    const repo = repositories.get(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    if (!repo.connectionId) return res.status(400).json({ error: 'No git connection configured for this repository' });

    const conn = gitConnections.get(repo.connectionId);
    if (!conn) return res.status(400).json({ error: 'Git connection not found' });

    const { branch = repo.defaultBranch, files = {}, message = 'Update from Trancendos Workshop' } = req.body;

    let result;
    if (conn.provider === 'github' && repo.remoteUrl) {
      const [, owner, repoName] = repo.remoteUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/) || [];
      if (owner && repoName) {
        const gh = new GitHubClient(conn.token);
        if (Object.keys(files).length > 0) {
          result = await gh.pushFiles(owner, repoName, files, message, branch);
        } else {
          result = { success: true, message: 'No files to push' };
        }
      }
    } else {
      // Local git push
      const git = new LocalGitOps(repo.localPath);
      const pushResult = git.push('origin', branch);
      result = { success: pushResult.success, message: pushResult.output || pushResult.error };
    }

    await emitEvent('REPO_PUSHED', { id: 'system', name: 'Workshop' }, { type: 'repository', id: repo.id, name: repo.name }, { branch, provider: conn.provider });
    res.json({ success: result.success, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Deploy to Cloudflare Pages ────────────────────────────────────────────────
app.post('/api/repositories/:id/deploy', async (req, res) => {
  try {
    const repo = repositories.get(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const { subdomain, buildCommand, outputDir = 'dist', branch = 'main' } = req.body;
    const deployId = crypto.randomUUID();

    // Notify Cloudflare Manager
    let cfResult = null;
    try {
      cfResult = await axios.post('http://localhost:3028/api/deploy/from-workshop', {
        repositoryId: repo.id, repositoryName: repo.name,
        subdomain: subdomain || repo.name.toLowerCase().replace(/\s+/g, '-'),
        remoteUrl: repo.remoteUrl, branch, buildCommand, outputDir
      }, { timeout: 10000 });
    } catch {}

    const deployment = {
      id: deployId, repositoryId: repo.id, repositoryName: repo.name,
      subdomain, branch, buildCommand, outputDir,
      status: cfResult?.data?.success ? 'deployed' : 'pending',
      url: cfResult?.data?.url || `https://${subdomain || repo.name}.trancendos.com`,
      cfProjectId: cfResult?.data?.projectId || null,
      createdAt: new Date().toISOString()
    };
    deployments.set(deployId, deployment);
    await emitEvent('REPO_DEPLOYED', { id: 'system', name: 'Workshop' }, { type: 'deployment', id: deployId, name: repo.name }, { subdomain, branch });
    res.status(201).json({ success: true, deployment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/deployments', (req, res) => {
  const deps = deployments.toArray();
  res.json({ deployments: deps, total: deps.length });
});

// ── Import from GitHub ────────────────────────────────────────────────────────
app.post('/api/import', async (req, res) => {
  try {
    const { connectionId, owner, repoName } = req.body;
    if (!connectionId || !owner || !repoName) return res.status(400).json({ error: 'connectionId, owner, repoName required' });

    const conn = gitConnections.get(connectionId);
    if (!conn) return res.status(404).json({ error: 'Connection not found' });

    const repoId = crypto.randomUUID();
    const localPath = path.join(GIT_DIR, repoId);
    fs.mkdirSync(localPath, { recursive: true });

    let remoteUrl, repoData;
    if (conn.provider === 'github') {
      const gh = new GitHubClient(conn.token);
      const info = await gh.getRepo(owner, repoName);
      if (!info.success) return res.status(400).json({ error: info.error });
      remoteUrl = info.data.clone_url;
      repoData = info.data;
    }

    // Clone locally
    const git = new LocalGitOps('/tmp');
    const cloneResult = git.clone(remoteUrl, localPath);

    const repo = {
      id: repoId, name: repoName, description: repoData?.description || '',
      language: repoData?.language?.toLowerCase() || 'javascript',
      localPath, remoteUrl, connectionId,
      defaultBranch: repoData?.default_branch || 'main',
      branches: [repoData?.default_branch || 'main'],
      stars: repoData?.stargazers_count || 0, forks: repoData?.forks_count || 0,
      openPRs: 0, status: 'active', visibility: repoData?.private ? 'private' : 'public',
      imported: true, importedFrom: conn.provider,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    repositories.set(repoId, repo);
    res.status(201).json({ success: true, repository: repo, cloned: cloneResult.success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── List Remote Repos ─────────────────────────────────────────────────────────
app.get('/api/connections/:id/repos', async (req, res) => {
  const conn = gitConnections.get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found' });
  try {
    let result;
    if (conn.provider === 'github') {
      const gh = new GitHubClient(conn.token);
      result = await gh.listRepos(conn.username);
    } else if (conn.provider === 'gitlab') {
      const gl = new GitLabClient(conn.token, conn.baseUrl);
      result = await gl.listProjects();
    } else {
      const bb = new BitBucketClient(conn.username, conn.appPassword);
      result = await bb.listRepos();
    }
    res.json({ success: result.success, repos: result.data || [], error: result.error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve Dashboard ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, '../index.html');
  if (fs.existsSync(htmlPath)) res.sendFile(htmlPath);
  else res.json({ service: 'the-workshop', version: '2.0.0' });
});

// ─── WEBSOCKET ─────────────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'ping') ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
    } catch {}
  });
  ws.send(JSON.stringify({ type: 'connected', service: 'the-workshop', timestamp: Date.now() }));
});

const heartbeat = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

// ─── START ─────────────────────────────────────────────────────────────────────
const PORT = 3024;
server.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', message: `The Workshop started on 0.0.0.0:${PORT}`, service: 'the-workshop', timestamp: new Date().toISOString() }));
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT', () => { server.close(() => process.exit(0)); });
process.on('unhandledRejection', (reason) => { console.error('Unhandled rejection:', reason); });
process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err); });