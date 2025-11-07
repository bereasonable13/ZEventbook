#!/usr/bin/env python3
import re

print("Removing duplicate entities from Code.gs...")

with open('Code.gs', 'r') as f:
    lines = f.readlines()

# Find and remove lines 32-37 (the duplicate entities array)
# But first, let's see what's around it to be safe
print("\nContext around line 32:")
for i in range(25, 45):
    if i < len(lines):
        print(f"{i+1}: {lines[i][:60]}...")

print("\n⚠️  Cannot safely auto-remove without seeing full context")
print("Please show lines 25-45 to understand what to remove")
