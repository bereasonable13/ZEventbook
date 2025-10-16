# MVP CI/CD & SRE Readiness Plan

## 1. Objective
Deliver a mobile-first MVP in 4–6 weeks with the minimum viable CI/CD surface area that still gives engineers fast feedback, protects production, and creates headroom for the next two build-out phases. The plan below reverse-engineers the current GitHub Actions configuration and identifies a lean path forward.

## 2. Current Workflow Audit
- **CI Pipeline (`ci.yml`)** — Seven separate jobs (quality, unit, integration, e2e, build, security, summary) all run npm install independently and include heavyweight steps like Postgres-backed integration tests and Playwright suites on every push.【F:.github/workflows/ci.yml†L1-L120】【F:.github/workflows/ci.yml†L120-L206】
- **PR Checks (`pr-checks.yml`)** — Duplicates lint/test/build work already present in CI while adding blocking title/description gates that could slow iteration during MVP crunch.【F:.github/workflows/pr-checks.yml†L1-L120】【F:.github/workflows/pr-checks.yml†L120-L200】
- **Dependency Maintenance (`dependencies.yml`)** — Runs `npm update` weekly and opens PRs even if the codebase is idle, creating churn before MVP features land.【F:.github/workflows/dependencies.yml†L1-L80】
- **Deployments (`deploy.yml` & `static.yml`)** — Production deploy job recompiles from scratch instead of reusing build artifacts and immediately creates a GitHub release; GitHub Pages workflow ships the entire repo rather than a purpose-built artifact.【F:.github/workflows/deploy.yml†L1-L200】【F:.github/workflows/static.yml†L1-L48】

## 3. MVP Pipeline Blueprint (Weeks 0–6)
| Week | Focus | GitHub Actions Changes | SRE/Quality Notes |
| --- | --- | --- | --- |
| 0–1 | **Stability baseline** | Replace existing CI with a single `mvp-ci.yml` job that installs once, caches `~/.npm`, and runs `npm run lint`, `npm run typecheck`, `npm run test:unit`. Fail fast; optional `console.log` check becomes a lint rule instead of shell grep. | Enforce branch protection on `develop`/`main` for the single job. Require feature flags for unstable work. |
| 2–3 | **Confidence boosters** | Introduce a second job `mvp-smoke` triggered only on `main` merges to run `npm run build` + Playwright `@smoke` tags against a deployed preview (or local Next.js). Keep integration DB tests manual until needed. | Stand up lightweight logging (Vercel Analytics / Logflare) and uptime ping for staging. |
| 4–6 | **Deployment discipline** | Add staged deploy workflow: build once, upload artifact, deploy to staging with manual approval, then promote to production. Gate `npm run test:e2e` behind manual dispatch or scheduled nightly until coverage grows. | Define rollback runbook, configure Vercel preview links on PRs, add on-call rotation for release window. |

## 4. Actionable GitHub Actions Refactor
1. **Archive current workflows** – Move `ci.yml`, `pr-checks.yml`, `deploy.yml`, and `static.yml` into a `legacy/` folder (or disable) to prevent accidental runs while iterating on MVP automation.
2. **Create `mvp-ci.yml`**
   ```yaml
   name: MVP CI
   on:
     pull_request:
     push:
       branches: [main, develop]
   jobs:
     verify:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: npm
         - run: npm ci
         - run: npm run lint
         - run: npm run typecheck
         - run: npm run test:unit -- --coverage --watchAll=false
           env:
             CI: true
   ```
   *Rationale*: One job, cached installs, and the three highest-signal checks keep cycle time under ~5 minutes while protecting TypeScript typing, lint hygiene, and unit behavior.
3. **Create `mvp-deploy.yml`** (enable once staging is healthy)
   - Trigger: `workflow_dispatch` + `push` to `main`.
   - Jobs: `build` → `deploy-staging` (manual approval) → `deploy-production` (reuses artifact via `actions/download-artifact`).
   - Add Playwright smoke step post-deploy, but mark `continue-on-error: true` until coverage hardens.
4. **Retire auto dependency bumping** until after MVP or scope it to security advisories only (use `github/dependency-review-action` on PRs, already configured).【F:.github/workflows/pr-checks.yml†L120-L200】

## 5. Supporting Quality System
- **Branch Strategy**: `main` (prod), `develop` (integration), short-lived feature branches. Enable required reviews and squash merges for both protected branches.
- **Testing Pyramid for MVP**: prioritize unit tests alongside component-level Playwright smoke tags. Hold off on integration DB containers until real persistence is introduced.
- **Mobile-first Validation**: Configure Playwright projects for `iPhone 14` viewport in smoke suite; add Lighthouse CI later in Phase 2.
- **Telemetry Lite**: Use Vercel preview analytics and Pingdom-style HTTP check; log to simple hosted solution before introducing full observability stack.

## 6. Phase 2 & 3 Preview (Post-MVP)
- **Phase 2 (Weeks 7–10)**: Reintroduce integration job with Dockerized Postgres once API contracts stabilize; expand Playwright coverage, enable dependency bot with CODEOWNERS auto-assign.
- **Phase 3 (Weeks 11–16)**: Add performance budgets (Lighthouse/Calibre), chaos/rollback drills, blue-green deployments with feature flag-driven canarying, and automated release notes from commit history.

---
**Next Steps**
1. Draft the `mvp-ci.yml` workflow and validate runtime locally via `act`.
2. Disable legacy workflows in repository settings to avoid double-runs.
3. Socialize this plan with engineering & product leadership; confirm timeline alignment and ownership.
