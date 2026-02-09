# Bolt Journal

## 2024-05-22 - [Monorepo Isolation]
**Learning:** This repo is an isolated workspace package. `workspace:*` dependencies fail to install.
**Action:** Temporarily remove `workspace:*` deps in `package.json` to allow local installation and testing, then restore them before submitting.
