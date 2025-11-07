#!/bin/bash
# Deploy to stable production URL

DEPLOYMENT_ID="AKfycbzxPOs9lqA-vQOYfw3iGYqEdGPQwrqCDvhkrEMk51m2JCZmRffhbbdNARGed-UpBeFK"
DESCRIPTION="${1:-Update}"

echo "🚀 Deploying to production..."
clasp push --force
clasp deploy -i "$DEPLOYMENT_ID" -d "$DESCRIPTION"

echo ""
echo "✅ DEPLOYED!"
echo "🧪 TEST: https://script.google.com/macros/s/$DEPLOYMENT_ID/exec?p=admin&brand=ABC"
