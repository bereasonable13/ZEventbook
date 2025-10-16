const path = require('path');
const { runVerification } = require('../../verify-deployment');

describe('Deployment verifier integration', () => {
  const fixtureRoot = path.resolve(__dirname, '../fixtures/sample-project');
  const brokenRoot = path.resolve(__dirname, '../fixtures/broken-project');

  it('passes for a well-formed Apps Script bundle', async () => {
    const result = await runVerification({ projectDir: fixtureRoot, useColor: false });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    expect(result.passes.length).toBeGreaterThan(0);
  });

  it('reports missing required files as errors', async () => {
    const result = await runVerification({ projectDir: brokenRoot, useColor: false });

    expect(result.success).toBe(false);
    expect(result.errors.some((msg) => msg.includes('Missing required file'))).toBe(true);
  });
});
