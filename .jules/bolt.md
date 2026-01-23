## 2024-05-23 - Broken Workspace Dependency
**Learning:** The repository contains a workspace dependency (`@trancendos/shared-core`) but the workspace root is missing, causing `pnpm install` to fail.
**Action:** When working on isolated packages from a monorepo, check for and remove/mock workspace dependencies if the full monorepo is not available.

## 2024-05-23 - node_modules Tracked in Git
**Learning:** `node_modules` was tracked in the repository, causing huge diffs and bloating the repo.
**Action:** Always check `git ls-files node_modules` or similar to verify dependencies are not tracked, and use `git rm -r --cached` to fix it if they are.
