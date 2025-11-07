#!/usr/bin/env python3
import re

print("Making doGet() case-insensitive...")

with open('Code.gs', 'r') as f:
    content = f.read()

# Find and replace the doGet function
old_doget = r'''function doGet\(e\) \{
  try \{
    const brandSlug = e\.parameter\.brand \|\| e\.parameter\.b \|\| 'abc';
    const brand = getBrand\(brandSlug\);
    const page = e\.parameter\.p \|\| 'Admin';
    const template = HtmlService\.createTemplateFromFile\(page\);'''

new_doget = '''function doGet(e) {
  try {
    const brandSlug = e.parameter.brand || e.parameter.b || 'abc';
    const brand = getBrand(brandSlug);
    
    // Normalize page name (case-insensitive, capitalize first letter)
    let pageName = e.parameter.p || 'Admin';
    pageName = pageName.charAt(0).toUpperCase() + pageName.slice(1).toLowerCase();
    
    // Valid pages that exist
    const validPages = ['Admin', 'Configadmin', 'Display', 'Healthcheck', 'Poster', 'Public', 'Test'];
    
    // Map common variations
    const pageMap = {
      'Configadmin': 'ConfigAdmin',
      'Healthcheck': 'HealthCheck'
    };
    
    // Normalize and validate
    const page = pageMap[pageName] || pageName;
    if (!validPages.includes(page) && !validPages.includes(pageName)) {
      return createErrorPage('Invalid page: ' + pageName);
    }
    
    const template = HtmlService.createTemplateFromFile(page);'''

content = re.sub(old_doget, new_doget, content, flags=re.DOTALL)

with open('Code.gs', 'w') as f:
    f.write(content)

print("✅ doGet() now supports case-insensitive page names!")
print("")
print("Supported URL variations:")
print("  ?p=admin → Admin.html")
print("  ?p=Admin → Admin.html")
print("  ?p=ADMIN → Admin.html")
print("  ?p=public → Public.html")
print("  ?p=configadmin → ConfigAdmin.html")
print("  ?p=healthcheck → HealthCheck.html")
