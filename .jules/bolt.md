## 2024-05-22 - Workspace Dependency Isolation
**Learning:** Isolated packages from a monorepo with `workspace:*` dependencies cannot install dependencies locally without the workspace root.
**Action:** Temporarily remove `workspace:*` dependencies in `package.json` to allow `pnpm install` and local testing, then restore them before committing.
