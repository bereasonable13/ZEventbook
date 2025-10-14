#!/bin/sh

# NextUp Pre-Commit Hook
# Automatically runs verification before allowing commit
# Install: cp pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

echo "🔍 Running pre-commit verification..."

# Run verification
node verify-deployment.js

# Check exit code
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Verification failed. Commit aborted."
    echo "Fix the errors above and try again."
    echo ""
    echo "To bypass (NOT RECOMMENDED): git commit --no-verify"
    exit 1
fi

echo "✅ Verification passed. Proceeding with commit..."
exit 0
