## 2024-05-23 - Monorepo Workspace Dependency Workaround
**Learning:** Isolated packages with `workspace:*` dependencies prevent `pnpm install` from working, blocking verification.
**Action:** Temporarily remove `workspace:*` dependencies from `package.json` to enable dependency installation and testing, then restore them before submission.

## 2024-05-23 - Lazy Initialization for Safer Optimization
**Learning:** Class field initializers run in definition order, which can be brittle if dependencies are reordered. Lazy initialization in the accessor method is safer and avoids initialization order risks.
**Action:** Prefer lazy initialization (`if (!this.cached) ...`) over immediate field initialization for caching dependent values.
