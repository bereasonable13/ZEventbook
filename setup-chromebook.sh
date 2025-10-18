#!/bin/bash

# NextUp Quality Tools Setup Script
# For Chromebook/Linux environments

echo "🔧 Setting up NextUp Quality Tools..."
echo ""

# Silence cros-motd
echo 5 > ~/.local/share/cros-motd

# Create directory structure
mkdir -p ~/nextup-quality-tools
cd ~/nextup-quality-tools

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js not found. Installing..."
    
    # Install Node.js via nvm (recommended for Chromebook)
    if ! command -v nvm &> /dev/null; then
        echo "📦 Installing nvm (Node Version Manager)..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        
        # Load nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    
    # Install Node.js LTS
    nvm install --lts
    nvm use --lts
    
    echo "✅ Node.js installed"
else
    NODE_VERSION=$(node --version)
    echo "✅ Node.js already installed: $NODE_VERSION"
fi

echo ""
echo "📁 Current directory: $(pwd)"
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy your Apps Script files to: ~/nextup-quality-tools/src/"
echo "2. Run: cd ~/nextup-quality-tools && node verify-deployment.js src/"
echo ""
