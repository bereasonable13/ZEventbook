# 🚀 Quick Setup Guide - CI/CD Pipeline

Get your professional CI/CD pipeline running in 15 minutes!

## ⚡ Quick Start (3 Steps)

### Step 1: Add Workflow Files (2 minutes)

```bash
# In your repository root
mkdir -p .github/workflows

# Copy all workflow files to .github/workflows/
# Files: ci.yml, deploy.yml, pr-checks.yml, dependencies.yml
```

### Step 2: Update package.json (5 minutes)

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx --max-warnings 0",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "test": "jest --passWithNoTests",
    "test:unit": "jest --testPathPattern=tests/unit --passWithNoTests",
    "test:integration": "jest --testPathPattern=tests/integration --passWithNoTests",
    "test:e2e": "playwright test",
    "test:smoke": "playwright test --grep @smoke",
    "validate": "npm run lint && npm run typecheck && npm run test"
  }
}
```

### Step 3: Push and Watch! (1 minute)

```bash
git add .github/
git commit -m "feat: add CI/CD pipeline"
git push origin main
```

**Done!** 🎉 Go to GitHub Actions tab to see your pipeline running.

---

## 📋 Checklist

Use this checklist to ensure everything is set up:

### Files to Add
- [ ] `.github/workflows/ci.yml`
- [ ] `.github/workflows/deploy.yml`
- [ ] `.github/workflows/pr-checks.yml`
- [ ] `.github/workflows/dependencies.yml`
- [ ] `package.json` (updated with scripts)
- [ ] `README.md` (with badges)
- [ ] `CI-CD-DOCUMENTATION.md`

### Configuration
- [ ] Install dependencies: `npm install`
- [ ] Add scripts to package.json
- [ ] Update repository name in workflow files
- [ ] Create test directories: `tests/unit`, `tests/integration`, `tests/e2e`

### Optional Setup
- [ ] Add GitHub secrets for deployment (if deploying)
- [ ] Setup branch protection rules
- [ ] Configure Codecov account
- [ ] Setup Snyk security scanning

---

## 🔧 Minimal Setup (Just CI, No Deployment)

If you just want CI without deployment:

1. **Add only these files:**
   - `.github/workflows/ci.yml`
   - `.github/workflows/pr-checks.yml`

2. **Remove deployment steps:**
   - Delete `deploy.yml`
   - No secrets needed

3. **Update package.json scripts** (see Step 2 above)

---

## 📝 Customization Points

### Update Repository Name

In all workflow files, replace:
```yaml
# Find and replace:
bereasonable13/ZEventbook
# With:
YOUR_USERNAME/YOUR_REPO
```

### Update URLs

In `deploy.yml`, replace:
```yaml
url: https://staging.yourdomain.com  # Change to your staging URL
url: https://yourdomain.com          # Change to your production URL
```

### Adjust Test Timeouts

If tests are slow, in `ci.yml`:
```yaml
- name: Run E2E tests
  run: npm run test:e2e
  timeout-minutes: 15  # Increase if needed
```

### Change Node Version

In all workflow files:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'  # Change to 18, 19, 20, etc.
```

---

## 🎯 What Each Workflow Does

### `ci.yml` - Continuous Integration
**Runs on:** Every push and PR
**Does:**
- ✅ Code quality checks (ESLint, Prettier)
- ✅ Unit tests with coverage
- ✅ Integration tests
- ✅ E2E tests
- ✅ Build verification
- ✅ Security scanning

### `deploy.yml` - Continuous Deployment
**Runs on:** Push to `main` branch
**Does:**
- 🚀 Deploy to staging
- 🧪 Run smoke tests
- 🚀 Deploy to production
- 🏥 Health check
- 🏷️ Create release tag

### `pr-checks.yml` - PR Validation
**Runs on:** PR opened/updated
**Does:**
- 📝 Validate PR title format
- 📏 Check PR size
- 📊 Verify code coverage
- 🏷️ Auto-assign labels
- 🔍 Review dependencies

### `dependencies.yml` - Dependency Management
**Runs on:** Weekly schedule (Mondays)
**Does:**
- 📦 Check for outdated packages
- 🔄 Update patch versions
- 🔒 Security audit
- 🐛 Create PR if updates available

---

## 🐛 Troubleshooting

### "Workflow not running"
- Check if workflows are in `.github/workflows/`
- Ensure YAML syntax is correct
- Check Actions tab for error messages

### "Tests failing in CI but pass locally"
- Check Node version matches between local and CI
- Verify environment variables
- Look for missing dependencies

### "Build taking too long"
- Enable npm caching (already in workflows)
- Use `npm ci` instead of `npm install`
- Reduce test parallelization if memory constrained

### "Deployment failing"
- Verify secrets are set correctly
- Check environment variables
- Ensure deployment service is configured

---

## 📊 Adding Status Badges

Add to your README.md:

```markdown
![CI Pipeline](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml/badge.svg)
![Deploy Status](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/deploy.yml/badge.svg)
```

---

## ✅ Verification Steps

After setup, verify everything works:

1. **Push to main:**
   ```bash
   git push origin main
   ```
   - Go to Actions tab
   - Should see CI Pipeline running
   - All jobs should be green ✅

2. **Create a PR:**
   ```bash
   git checkout -b feature/test
   git commit --allow-empty -m "feat: test PR"
   git push origin feature/test
   ```
   - Create PR on GitHub
   - Should see PR checks running
   - Auto-labels should be applied

3. **Check weekly jobs:**
   - Dependency updates will run next Monday
   - Or manually trigger from Actions tab

---

## 🎓 Next Steps

Once your pipeline is running:

1. **Add Branch Protection Rules**
   - Settings → Branches → Add rule for `main`
   - Require status checks to pass

2. **Setup Coverage Tracking**
   - Create Codecov account
   - Add `CODECOV_TOKEN` secret

3. **Configure Deployment**
   - Add deployment secrets
   - Update URLs in `deploy.yml`

4. **Write Tests**
   - Start with critical path E2E tests
   - Add integration tests for APIs
   - Fill out unit test coverage

5. **Monitor and Improve**
   - Check failed runs promptly
   - Optimize slow tests
   - Keep dependencies updated

---

## 💡 Pro Tips

- **Start simple**: Get basic CI working first, then add deployment
- **Test locally**: Run `npm run validate` before pushing
- **Small PRs**: Keep changes focused and reviewable
- **Document changes**: Update docs when changing workflows
- **Monitor costs**: GitHub Actions has free tier, but monitor usage

---

## 📚 Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)

---

## 🆘 Need Help?

- Review [CI-CD-DOCUMENTATION.md](./CI-CD-DOCUMENTATION.md) for detailed info
- Check [GitHub Discussions](https://github.com/YOUR_USERNAME/YOUR_REPO/discussions)
- Open an [Issue](https://github.com/YOUR_USERNAME/YOUR_REPO/issues)

---

**Ready to impress on LinkedIn?** 🚀

Your professional CI/CD pipeline is now ready to showcase!
