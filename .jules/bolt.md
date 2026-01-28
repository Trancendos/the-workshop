## 2024-05-22 - Workspace Dependencies in Isolation
**Learning:** `workspace:*` dependencies in `package.json` cause installation failures in isolated environments (like this sandbox) where the workspace root is missing.
**Action:** Temporarily remove these dependencies from `package.json` to allow `pnpm install` for local testing, then restore them before committing.
