#!/usr/bin/env python3
import re

with open('Config.gs', 'r') as f:
    content = f.read()

# Add entities to ABC after useCases
entities_abc = '''
    
    entities: [
      { id: 'ABC-Leagues', name: 'ABC Leagues', description: 'Recreational and competitive bocce leagues' },
      { id: 'ABC-Tournaments', name: 'ABC Tournaments', description: 'Tournament series and special events' },
      { id: 'ABC-ChicagoBocceClub', name: 'Chicago Bocce Club', description: 'CBC partnership events' },
      { id: 'ABC-ChicagoBocceLeague', name: 'Chicago Bocce League', description: 'CBL partnership events' },
      { id: 'ABC-Other', name: 'Other', description: 'Other ABC-affiliated events' }
    ]'''

# Find ABC section and add entities before closing
pattern = r"(useCases: \['leagues', 'tournaments', 'events', 'partnerships'\])"
content = re.sub(pattern, r"\1,\n" + entities_abc, content)

with open('Config.gs', 'w') as f:
    f.write(content)

print("✓ Added entities to Config.gs")
