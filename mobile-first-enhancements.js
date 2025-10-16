/**
 * Mobile-First Enhancements for ZEventbook Verification
 * Add these methods to DeploymentVerifier class
 */

// Add to CONFIG object
const MOBILE_CONFIG = {
  MIN_TOUCH_TARGET_PX: 44,  // WCAG 2.1 AA standard
  MAX_INITIAL_JS_KB: 50,
  MAX_CSS_KB: 30,
  REQUIRED_VIEWPORT_META: 'width=device-width, initial-scale=1'
};

/**
 * Phase 7: Mobile-First Validation
 * Call this in verify() after Phase 6
 */
checkMobileFirst() {
  console.log(`\n${colors.blue}[Phase 7] Validating Mobile-First Design...${colors.reset}`);
  this.checkViewportMeta();
  this.checkTouchTargets();
  this.checkResponsiveCSS();
  this.checkMobilePerformance();
}

/**
 * Validate viewport meta tag exists in all HTML pages
 */
checkViewportMeta() {
  let htmlFiles;
  try {
    htmlFiles = fs.readdirSync(this.projectDir)
      .filter(f => f.endsWith('.html') && f !== 'NUSDK.html' && f !== 'Styles.html');
  } catch (err) {
    return;
  }
  
  htmlFiles.forEach(file => {
    const filepath = path.join(this.projectDir, file);
    const content = this.safeReadFile(filepath);
    if (!content) return;
    
    const hasViewport = content.includes('<meta name="viewport"');
    const hasCorrectViewport = content.includes('width=device-width') && 
                               content.includes('initial-scale=1');
    
    if (!hasViewport) {
      this.errors.push(`${file}: Missing viewport meta tag - CRITICAL for mobile`);
      this.fixes.push(`${file}: Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>`);
    } else if (!hasCorrectViewport) {
      this.warnings.push(`${file}: Viewport meta tag exists but may be incorrect`);
      this.fixes.push(`${file}: Ensure viewport includes width=device-width and initial-scale=1`);
    } else {
      this.passes.push(`✓ ${file} has correct viewport meta tag`);
    }
  });
}

/**
 * Check for minimum touch target sizes (44x44px WCAG 2.1 AA)
 */
checkTouchTargets() {
  const stylesFile = path.join(this.projectDir, 'Styles.html');
  if (!fs.existsSync(stylesFile)) return;
  
  const content = this.safeReadFile(stylesFile);
  if (!content) return;
  
  // Check for button/interactive element sizing
  const hasMinButtonSize = content.includes('min-width') || 
                          content.includes('min-height') ||
                          content.match(/padding:\s*\d+px/);
  
  if (!hasMinButtonSize) {
    this.warnings.push('Styles.html: No explicit min-width/min-height for interactive elements');
    this.fixes.push('Styles.html: Add min-width: 44px; min-height: 44px; to buttons and clickable elements');
  }
  
  // Check for touch-action CSS
  if (!content.includes('touch-action')) {
    this.warnings.push('Styles.html: Consider adding touch-action CSS for better mobile UX');
  } else {
    this.passes.push('✓ Styles.html defines touch-action for mobile');
  }
}

/**
 * Validate responsive CSS with media queries
 */
checkResponsiveCSS() {
  const stylesFile = path.join(this.projectDir, 'Styles.html');
  if (!fs.existsSync(stylesFile)) return;
  
  const content = this.safeReadFile(stylesFile);
  if (!content) return;
  
  const mediaQueryRegex = /@media\s*\([^)]*\)/g;
  const mediaQueries = content.match(mediaQueryRegex) || [];
  
  if (mediaQueries.length === 0) {
    this.errors.push('Styles.html: No @media queries found - NOT mobile responsive');
    this.fixes.push('Styles.html: Add responsive breakpoints (e.g., @media (max-width: 768px))');
  } else {
    this.passes.push(`✓ Styles.html has ${mediaQueries.length} responsive @media queries`);
    
    // Check for mobile-first approach (min-width vs max-width)
    const minWidthQueries = content.match(/@media\s*\([^)]*min-width[^)]*\)/g) || [];
    const maxWidthQueries = content.match(/@media\s*\([^)]*max-width[^)]*\)/g) || [];
    
    if (minWidthQueries.length > maxWidthQueries.length) {
      this.passes.push('✓ Styles.html uses mobile-first approach (min-width)');
    } else {
      this.warnings.push('Styles.html: Consider mobile-first approach using min-width media queries');
    }
  }
}

/**
 * Check mobile performance budgets
 */
checkMobilePerformance() {
  let files;
  try {
    files = fs.readdirSync(this.projectDir)
      .filter(f => f.endsWith('.html') || f.endsWith('.gs'));
  } catch (err) {
    return;
  }
  
  let totalJsSize = 0;
  let totalCssSize = 0;
  
  files.forEach(file => {
    const filepath = path.join(this.projectDir, file);
    try {
      const stats = fs.statSync(filepath);
      const content = this.safeReadFile(filepath);
      if (!content) return;
      
      // Estimate JS size (rough approximation)
      const jsMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      if (jsMatch) {
        const jsContent = jsMatch.join('');
        totalJsSize += Buffer.byteLength(jsContent, 'utf8');
      }
      
      // Estimate CSS size
      const cssMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      if (cssMatch) {
        const cssContent = cssMatch.join('');
        totalCssSize += Buffer.byteLength(cssContent, 'utf8');
      }
    } catch (err) {
      // Skip files we can't read
    }
  });
  
  const totalJsKB = (totalJsSize / 1024).toFixed(1);
  const totalCssKB = (totalCssSize / 1024).toFixed(1);
  
  if (totalJsSize > MOBILE_CONFIG.MAX_INITIAL_JS_KB * 1024) {
    this.warnings.push(`Total inline JS: ${totalJsKB}KB exceeds mobile budget (${MOBILE_CONFIG.MAX_INITIAL_JS_KB}KB)`);
    this.fixes.push('Consider code splitting or moving JS to external files with async loading');
  } else {
    this.passes.push(`✓ Total inline JS: ${totalJsKB}KB (within mobile budget)`);
  }
  
  if (totalCssSize > MOBILE_CONFIG.MAX_CSS_KB * 1024) {
    this.warnings.push(`Total inline CSS: ${totalCssKB}KB exceeds mobile budget (${MOBILE_CONFIG.MAX_CSS_KB}KB)`);
    this.fixes.push('Consider extracting CSS to external file or removing unused styles');
  } else {
    this.passes.push(`✓ Total inline CSS: ${totalCssKB}KB (within mobile budget)`);
  }
}
