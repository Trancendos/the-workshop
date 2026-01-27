## 2024-05-22 - [Monorepo Workspace Dependency Isolation]
**Learning:** This repository uses `workspace:*` dependencies (e.g., `@trancendos/shared-core`) which fail to resolve when the package is isolated from the monorepo root.
**Action:** For local verification (install/test), temporarily remove or mock these dependencies in `package.json`, then restore them before committing.

## 2024-05-22 - [Safe Caching of Class Properties]
**Learning:** Using field initializers for caching (e.g., `private status = { name: this.name }`) is risky because `this.name` might not be initialized yet depending on compilation settings and order.
**Action:** Prefer lazy initialization (memoization) inside the getter method to guarantee all dependencies are available and avoid initialization order hazards.

## 2024-05-22 - [Immutability in Caching]
**Learning:** When moving from returning new objects to returning a cached shared reference, callers might accidentally mutate the shared state.
**Action:** Always usage `Object.freeze()` on cached objects to enforce immutability and prevent side effects.
