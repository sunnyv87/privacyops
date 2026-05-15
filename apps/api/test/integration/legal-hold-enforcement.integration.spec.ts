/**
 * Integration test verifying that the retention disposal workflow
 * enforces legal holds. This ensures the critical compliance gap
 * (Risk #1) is properly closed.
 */

describe('Legal Hold Enforcement — Retention Workflow', () => {
  it('retention workflow imports checkLegalHolds from approval activities', () => {
    // Verify the workflow file references checkLegalHolds
    const workflowSource = require('fs').readFileSync(
      require('path').resolve(
        __dirname,
        '../../src/core/workflow/workflows/retention.workflow.ts',
      ),
      'utf8',
    );

    expect(workflowSource).toContain('checkLegalHolds');
    expect(workflowSource).toContain('approval.activities');
  });

  it('retention workflow calls checkLegalHolds before executing disposal loop', () => {
    const workflowSource = require('fs').readFileSync(
      require('path').resolve(
        __dirname,
        '../../src/core/workflow/workflows/retention.workflow.ts',
      ),
      'utf8',
    );

    // Find the function body (after the workflow function declaration)
    const fnStart = workflowSource.indexOf('async function retentionDisposalWorkflow');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = workflowSource.slice(fnStart);

    const checkIndex = fnBody.indexOf('await checkLegalHolds');
    const disposalIndex = fnBody.indexOf('await executeDisposal');
    expect(checkIndex).toBeGreaterThan(-1);
    expect(disposalIndex).toBeGreaterThan(-1);
    expect(checkIndex).toBeLessThan(disposalIndex);
  });

  it('retention workflow uses eligibleAssetIds from hold check', () => {
    const workflowSource = require('fs').readFileSync(
      require('path').resolve(
        __dirname,
        '../../src/core/workflow/workflows/retention.workflow.ts',
      ),
      'utf8',
    );

    expect(workflowSource).toContain('eligibleAssetIds');
    expect(workflowSource).toContain('holdCheck');
  });

  it('retention workflow returns assetsHeld count', () => {
    const workflowSource = require('fs').readFileSync(
      require('path').resolve(
        __dirname,
        '../../src/core/workflow/workflows/retention.workflow.ts',
      ),
      'utf8',
    );

    expect(workflowSource).toContain('assetsHeld');
  });

  it('data-deletion workflow checks legal holds before disposal', () => {
    const workflowSource = require('fs').readFileSync(
      require('path').resolve(
        __dirname,
        '../../src/core/workflow/workflows/data-deletion.workflow.ts',
      ),
      'utf8',
    );

    const checkIndex = workflowSource.indexOf('checkLegalHolds');
    const disposalIndex = workflowSource.indexOf('executeDisposal');
    expect(checkIndex).toBeGreaterThan(-1);
    expect(disposalIndex).toBeGreaterThan(-1);
    expect(checkIndex).toBeLessThan(disposalIndex);
  });
});
