#!/usr/bin/env python3

with open('Code.gs', 'r') as f:
    lines = f.readlines()

# Find where CONFIG starts and ends
config_start = None
config_end = None

for i, line in enumerate(lines):
    if line.strip().startswith('const CONFIG = {'):
        config_start = i
    if config_start is not None and config_end is None:
        if line.strip() == '};' and i > config_start:
            config_end = i
            break

if config_start and config_end:
    print(f"Found CONFIG definition: lines {config_start+1} to {config_end+1}")
    
    # Remove those lines
    new_lines = lines[:config_start] + lines[config_end+1:]
    
    with open('Code.gs', 'w') as f:
        f.writelines(new_lines)
    
    print(f"✓ Removed {config_end - config_start + 1} lines")
    print("✓ Code.gs now uses CONFIG from Config.gs")
else:
    print("Could not find CONFIG boundaries")
