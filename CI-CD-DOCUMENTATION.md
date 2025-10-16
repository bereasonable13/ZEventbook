# CI/CD Pipeline Documentation

## Overview

This project uses **GitHub Actions** for continuous integration and continuous deployment. The pipeline is designed to showcase professional software engineering practices including automated testing, code quality checks, and deployment automation.

## 🏗️ Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Code Push / PR                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              CI Pipeline (ci.yml)                           │
├─────────────────────────────────────────────────────────────┤
│  1. Code Quality    → ESLint, Prettier, Console checks      │
│  2. Unit Tests      → Fast, isolated component tests        │
│  3. Integration     → API/Database tests                    │
│  4. E2E Tests       → Full user flow testing (Playwright)   │
│  5. Build           → Production build verification         │
│  6. Security Scan   → npm audit, Snyk scanning             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼ (main branch only)
┌─────────────────────────────────────────────────────────────┐
│           CD Pipeline (deploy.yml)                          │
├─────────────────────────────────────────────────────────────┤
│  1. Deploy Staging  → Staging environment                   │
│  2. Smoke Tests     → Quick validation                      │
│  3. Deploy Prod     → Production deployment                 │
│  4. Health Check    → Verify deployment                     │
│  5. Create Release  → Tag and document release              │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Workflows

### 1. CI Pipeline (`ci.yml`)

**Triggers:**
- Push to `main`, `develop`, or `feature/**` branches
- Pull requests to `main` or `develop`

**Jobs:**

#### Quality Check
- Runs ESLint with zero warnings policy
- Checks Prettier formatting
- Scans for console/debug statements and debugger usage

#### Type Check
- Runs strict TypeScript type checking
- Blocks pipeline on type errors
- Shares npm cache with subsequent jobs for faster execution

#### Unit Tests
- Runs isolated component tests
- Generates coverage report
- Uploads to Codecov
- **Requirement:** 80%+ code coverage

#### Integration Tests
- Tests API endpoints
- Database integration testing
- Uses PostgreSQL service container

#### E2E Tests
- Full user flow testing with Playwright
- Tests critical user journeys
- Uploads test reports as artifacts

#### Build Verification
- Ensures production build succeeds
- Uploads build artifacts

#### Mobile Experience Audit
- Launches production build in CI
- Executes Lighthouse in mobile emulation mode
- Requires 90+ scores for performance, accessibility, best practices, and SEO
- Enforces fast initial load (FCP < 2s, TTI < 4s) and responsive images

#### Security Scan
- Runs `npm audit` for vulnerabilities
- Snyk security scanning (optional)

---

### 2. CD Pipeline (`deploy.yml`)

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**Environments:**

#### Staging
- Automatic deployment
- URL: `https://staging.yourdomain.com`
- Runs smoke tests before production

#### Production
- Requires staging success
- URL: `https://yourdomain.com`
- Creates GitHub release with version tag
- Post-deployment health check

---

### 3. PR Checks (`pr-checks.yml`)

**Triggers:**
- Pull request opened/updated

**Validations:**

1. **PR Title Format**
   - Must follow conventional commits
   - Example: `feat: add user login` or `fix(api): resolve timeout`

2. **PR Description**
   - Must not be empty
   - Should explain changes

3. **Branch Naming**
   - Format: `feature/*`, `bugfix/*`, `hotfix/*`, `release/*`

4. **Size Check**
   - Warns if PR > 50 files changed
   - Encourages smaller PRs

5. **Coverage Check**
   - Fails if coverage < 80%

6. **Auto Labeling**
   - Assigns labels based on files changed
   - Size labels: `small`, `medium`, `large`

---

### 4. Dependency Updates (`dependencies.yml`)

**Schedule:** Every Monday at 9am UTC

**Actions:**
1. Checks for outdated packages
2. Updates patch versions
3. Runs tests
4. Creates PR if updates available
5. Security audit
6. Creates issue if vulnerabilities found

---

## 🔧 Setup Instructions

### Step 1: Add Workflow Files

Copy all `.github/workflows/*.yml` files to your repository:

```bash
mkdir -p .github/workflows
cp ci.yml .github/workflows/
cp deploy.yml .github/workflows/
cp pr-checks.yml .github/workflows/
cp dependencies.yml .github/workflows/
cp lighthouserc-mobile.json .
```

### Step 2: Required Secrets

Add these secrets in GitHub Settings → Secrets and variables → Actions:

#### For Deployment (Optional - only if deploying)
- `VERCEL_TOKEN` - Vercel deployment token
- `VERCEL_ORG_ID` - Your Vercel organization ID
- `VERCEL_PROJECT_ID` - Your Vercel project ID

#### For Security Scanning (Optional)
- `SNYK_TOKEN` - Snyk API token for security scanning

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Setup Pre-commit Hooks

```bash
npm run prepare
```

### Step 5: Configure Branch Protection

Go to GitHub Settings → Branches → Add rule for `main`:

✅ Require pull request reviews before merging
✅ Require status checks to pass before merging
  - CI Pipeline / quality
  - CI Pipeline / unit-tests
  - CI Pipeline / integration-tests
  - CI Pipeline / build
✅ Require branches to be up to date before merging
✅ Require conversation resolution before merging

---

## 🧪 Testing Pyramid

```
        /\
       /  \
      /E2E \          Slow, Expensive, High Value
     /______\
    /        \
   /  Integ.  \      Medium Speed, Medium Cost
  /___________\
 /             \
/   Unit Tests  \    Fast, Cheap, High Volume
/_________________\
```

### Test Distribution
- **Unit Tests:** 70% - Fast, isolated, high volume
- **Integration Tests:** 20% - API/DB interactions
- **E2E Tests:** 10% - Critical user flows only

---

## 📊 Status Badges

Add these to your README.md to show pipeline status:

```markdown
![CI Pipeline](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml/badge.svg)
![Deploy Status](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/deploy.yml/badge.svg)
![Coverage](https://codecov.io/gh/YOUR_USERNAME/YOUR_REPO/branch/main/graph/badge.svg)
```

---

## 🚀 Usage

### Running Locally

```bash
# Run all checks (what CI runs)
npm run validate

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Check code quality
npm run lint
npm run format:check

# Fix issues
npm run lint:fix
npm run format
```

### Creating a Pull Request

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -m "feat: add my feature"`
3. Push branch: `git push origin feature/my-feature`
4. Open PR - automated checks will run
5. Address any failures
6. Get review and merge

### Deploying

**Automatic:**
- Push to `main` branch triggers automatic deployment

**Manual:**
- Go to Actions → CD Pipeline - Deploy
- Click "Run workflow"
- Select branch and run

---

## 📈 Metrics and Monitoring

### Key Metrics Tracked

1. **Build Time**: Target < 5 minutes
2. **Test Coverage**: Maintain > 80%
3. **Deployment Frequency**: Tracked per release
4. **Failed Deployment Rate**: Target < 5%
5. **Pipeline Success Rate**: Target > 95%

### Viewing Reports

- **Test Results**: Actions → Workflow Run → Artifacts
- **Coverage Reports**: Codecov dashboard
- **Security Reports**: Security tab in GitHub
- **Build Logs**: Actions → Workflow Run → Job logs

---

## 🔍 Troubleshooting

### CI Pipeline Failing

**Linting Errors:**
```bash
npm run lint:fix
npm run format
```

**Test Failures:**
```bash
npm run test -- --verbose
```

**Build Errors:**
```bash
npm run build
# Check error logs
```

### Deployment Failing

1. Check environment variables
2. Verify secrets are set correctly
3. Check deployment logs in Actions
4. Verify service is running

### Common Issues

**"remote origin already exists"**
```bash
git remote remove origin
git remote add origin YOUR_URL
```

**"Tests not running"**
- Ensure test files are in correct directories
- Check jest configuration
- Verify test scripts in package.json

---

## 🎯 Best Practices

1. **Keep PRs Small**: Aim for < 400 lines changed
2. **Write Tests First**: TDD approach
3. **Meaningful Commits**: Use conventional commit format
4. **Update Documentation**: Keep docs in sync with code
5. **Review Coverage**: Don't just chase 100%, focus on critical paths
6. **Monitor Pipeline**: Check failed runs promptly
7. **Keep Dependencies Updated**: Review weekly update PRs

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/)

---

## 🤝 Contributing

Before submitting a PR:

1. ✅ Run `npm run validate`
2. ✅ Add tests for new features
3. ✅ Update documentation
4. ✅ Follow conventional commit format
5. ✅ Ensure all CI checks pass

---

## 📝 License

MIT

---

**Questions?** Open an issue or check the [GitHub Discussions](https://github.com/YOUR_USERNAME/YOUR_REPO/discussions)
