# Workflow-Aware Code Review

## Context
This repository hosts a Google Apps Script based event management solution (for example, `Code.js` and the HTML bundles under `src/`) while the GitHub Actions workflows are configured for a Node/Next.js web application. I reviewed the source with a focus on how it interacts with the automated workflows.

## Key Findings

### 1. Build pipeline assumes a Next.js project
- `npm run build` calls `next build`, yet the project does not include a Next.js `app/` or `pages/` entry point. The primary runtime is Google Apps Script (`Code.js`) with HTML templates under `src/`, so the build job in `.github/workflows/ci.yml` will consistently fail when it reaches the `Build application` step.
- **Evidence:** Next.js build script in `package.json`; Apps Script sources in `Code.js` and `src/appsscript.json`.
- **Impact:** The CI build job blocks merges even though there is no Next app to compile. Every push/PR will fail at the build stage.
- **Recommendation:** Replace the build step with a bundling/linting process that matches Apps Script (e.g., clasp push dry-run, HTML/CSS linting) or introduce a real Next.js frontend before keeping this pipeline.

### 2. Jest setup references missing infrastructure
- `jest.config.js` expects a `jest.setup.js` file, but none exists in the repository. Any Jest invocation in the workflows (`npm run test:unit`, `npm run test:integration`) will crash before executing tests.
- **Evidence:** `jest.config.js` references `jest.setup.js`, but `jest.setup.js` is absent.
- **Impact:** Unit and integration test jobs cannot run, preventing the quality gate from passing.
- **Recommendation:** Either add the missing setup file (typically importing `@testing-library/jest-dom` and configuring environment mocks) or remove the reference until such a file is introduced.

### 3. Test commands do not align with repository layout
- The workflows execute `npm run test:unit -- --coverage`, which narrows execution to `tests/unit`. The repo’s existing Jest tests (`EventCard.test.js`, `events-api.test.js`, etc.) live at the project root, so no tests run and coverage files are not produced for the Codecov upload step. The same mismatch exists for `npm run test:integration` (`tests/integration` does not exist).
- **Evidence:** `test:unit` script definition in `package.json`; representative test files located at the repository root.
- **Impact:** The unit-test and integration-test jobs succeed without executing any assertions, and the Codecov upload step fails because `coverage/lcov.info` is missing.
- **Recommendation:** Align the Jest scripts with the actual test locations (or move the tests into `tests/unit` and `tests/integration`). Ensure coverage artifacts are generated before attempting to upload them.

### 4. Integration test environment mismatch
- The integration workflow provisions a PostgreSQL service and injects `DATABASE_URL`, but the application logic depends on Google Sheets and Apps Script services, not a relational database.
- **Evidence:** Database service configuration in `.github/workflows/ci.yml`; Spreadsheet-based data model in `Code.js`.
- **Impact:** The integration tests will either fail because they cannot connect to real dependencies, or they will be meaningless because no code uses the provided database.
- **Recommendation:** Replace the PostgreSQL service with mocks/stubs that reflect the Google Workspace dependencies or refactor the application to use the provided service.

## Next Steps
1. Decide whether to pivot the application to Next.js (as the workflows assume) or refactor the workflows to match the Apps Script stack.
2. Restore the missing Jest setup infrastructure and align test directories so that automated coverage is meaningful.
3. Update CI/CD documentation to describe the adjusted pipeline once the workflow and codebase are in sync.

Bringing the workflows into alignment with the actual runtime will stabilize CI and give meaningful feedback on each change.
