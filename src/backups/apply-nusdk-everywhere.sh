#!/bin/bash

echo "======================================"
echo "APPLYING NUSDK HOLISTICALLY"
echo "======================================"
echo ""

# Track what we're changing
FILES_TO_UPDATE=(
  "Admin.html"
  "Header.html"
  "Public.html"
  "Display.html"
  "Poster.html"
  "ConfigAdmin.html"
)

echo "Files to update: ${#FILES_TO_UPDATE[@]}"
for file in "${FILES_TO_UPDATE[@]}"; do
  echo "  - $file"
done

echo ""
echo "Changes per file:"
echo "  1. Remove duplicate functions (callBackend, showToast, getBrandFromRequest)"
echo "  2. Replace with NU.* calls"
echo "  3. Ensure <?!= include('NUSDK'); ?> is present"
echo "  4. Remove duplicate CSS (toast, loading)"
echo ""

read -p "Proceed with holistic update? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted"
  exit 1
fi

# Create backups
echo "Creating backups..."
for file in "${FILES_TO_UPDATE[@]}"; do
  cp "$file" "$file.pre-nusdk-backup"
done
echo "✅ Backups created"

echo ""
echo "Starting updates..."

