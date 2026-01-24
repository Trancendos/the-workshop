## 2024-05-23 - Monorepo Workspace Dependency Issues
**Learning:** In isolated packages from a monorepo, `workspace:*` dependencies prevent `pnpm install` from working if the workspace root is missing. This blocks local verification (tests/linting).
**Action:** To verify changes in such environments, temporarily remove the workspace dependency from `package.json`, install, run tests, and then revert `package.json` before submitting.

## 2024-05-23 - Safety in Object Allocation Optimization
**Learning:** Optimizing object allocation by returning a cached object can break encapsulation if the object is mutable. Consumers might modify the shared instance.
**Action:** When caching an object to avoid allocation, always use `Object.freeze()` or `readonly` types (though runtime freezing is safer) to prevent side effects.
