## 2026-02-01 - Boundary Violation on Package Cleanup
**Learning:** Removing unused dependencies from `package.json` constitutes a boundary violation of "Never modify package.json without instruction", even if it improves install performance.
**Action:** Only optimize code within source files unless explicitly instructed to modify configuration or dependencies.
