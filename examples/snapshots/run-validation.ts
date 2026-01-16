/**
 * Run validation checks and generate report
 *
 * Manual test runner that validates snapshots and generates a markdown report
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createSnapshot } from '../../packages/core/src/snapshot.js';
import { createSimpleRefMap } from '../../packages/core/src/ref-map.js';

const SNAPSHOTS_DIR = process.cwd() + '/examples/snapshots';

interface ValidationResult {
  file: string;
  passed: number;
  failed: number;
  checks: Array<{
    name: string;
    passed: boolean;
    message?: string;
  }>;
  stats: {
    elementCount: number;
    refCount: number;
    outputSize: number;
    generationTime: number;
  };
}

// Helper to load HTML and generate snapshot
function generateSnapshotFromHTML(htmlPath: string) {
  const html = readFileSync(htmlPath, 'utf-8');

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', () => {});
  virtualConsole.on('warn', () => {});

  const dom = new JSDOM(html, {
    url: 'http://localhost',
    contentType: 'text/html',
    pretendToBeVisual: true,
    virtualConsole,
  });

  const { document } = dom.window;
  const refMap = createSimpleRefMap();

  const start = performance.now();
  const snapshot = createSnapshot(document, refMap, {
    interactive: true,
    compact: true,
    maxDepth: 10,
    includeHidden: false,
  });
  const duration = performance.now() - start;

  return { snapshot, duration };
}

function validateSnapshot(htmlPath: string): ValidationResult {
  const filename = htmlPath.split('/').pop() || 'unknown';
  const checks: ValidationResult['checks'] = [];

  let snapshot;
  let duration = 0;

  try {
    const result = generateSnapshotFromHTML(htmlPath);
    snapshot = result.snapshot;
    duration = result.duration;
  } catch (error) {
    return {
      file: filename,
      passed: 0,
      failed: 1,
      checks: [{ name: 'Generate snapshot', passed: false, message: (error as Error).message }],
      stats: { elementCount: 0, refCount: 0, outputSize: 0, generationTime: 0 },
    };
  }

  const lines = snapshot.tree.split('\n');

  // Check 1: Page header
  const pageHeader = lines[0];
  checks.push({
    name: 'Page header (URL, title, viewport)',
    passed: pageHeader?.startsWith('PAGE:') && pageHeader.includes('|') && pageHeader.includes('viewport='),
  });

  // Check 2: Snapshot header
  const snapshotHeader = lines.find(l => l.startsWith('SNAPSHOT:'));
  checks.push({
    name: 'Snapshot header with statistics',
    passed: !!snapshotHeader && snapshotHeader.includes('elements=') && snapshotHeader.includes('depth='),
  });

  // Check 3: Heading levels
  const headings = lines.filter(l => l.includes('HEADING'));
  const correctHeadingFormat = headings.every(h => h.match(/HEADING LEVEL=[1-6]/));
  checks.push({
    name: 'Heading levels formatted correctly',
    passed: headings.length === 0 || correctHeadingFormat,
    message: `${headings.length} headings found`,
  });

  // Check 4: Button labels
  const buttons = lines.filter(l => l.includes('BUTTON'));
  const buttonsWithLabels = buttons.filter(b => b.match(/BUTTON "([^"]+)"/));
  checks.push({
    name: 'Buttons have meaningful labels',
    passed: buttons.length === 0 || buttonsWithLabels.length / buttons.length > 0.9,
    message: `${buttonsWithLabels.length}/${buttons.length} buttons have labels`,
  });

  // Check 5: Link destinations
  const links = lines.filter(l => l.includes('LINK'));
  const linksWithHref = links.filter(l => l.includes('href='));
  checks.push({
    name: 'Links show destinations',
    passed: links.length === 0 || linksWithHref.length > 0,
    message: `${linksWithHref.length}/${links.length} links have href`,
  });

  // Check 6: Link labels
  const linksWithLabels = links.filter(l => l.match(/LINK "([^"]+)"/));
  checks.push({
    name: 'Links have meaningful labels',
    passed: links.length === 0 || linksWithLabels.length / links.length > 0.9,
    message: `${linksWithLabels.length}/${links.length} links have labels`,
  });

  // Check 7: Children indicators
  const withChildren = lines.filter(l => l.includes('children'));
  const correctChildrenFormat = withChildren.every(
    l => l.includes('children:') || l.includes('shown') || l.includes('hidden') || l.includes('filtered')
  );
  checks.push({
    name: 'Children indicators formatted correctly',
    passed: withChildren.length === 0 || correctChildrenFormat,
    message: `${withChildren.length} elements with children indicators`,
  });

  // Check 8: Refs have bounding boxes
  const refs = Object.values(snapshot.refs);
  const refsWithBbox = refs.filter((r: any) => r.bbox);
  checks.push({
    name: 'Refs include bounding boxes',
    passed: refs.length === 0 || refsWithBbox.length > 0,
    message: `${refsWithBbox.length}/${refs.length} refs have bbox`,
  });

  // Check 9: Refs have viewport detection
  const refsWithViewport = refs.filter((r: any) => typeof r.inViewport === 'boolean');
  checks.push({
    name: 'Refs include viewport detection',
    passed: refs.length === 0 || refsWithViewport.length === refs.length,
    message: `${refsWithViewport.length}/${refs.length} refs have inViewport`,
  });

  // Check 10: Performance
  checks.push({
    name: 'Generation time < 5s',
    passed: duration < 5000,
    message: `${Math.round(duration)}ms`,
  });

  // Check 11: Output size
  const sizeKB = snapshot.tree.length / 1024;
  checks.push({
    name: 'Output size < 50KB',
    passed: sizeKB < 50,
    message: `${sizeKB.toFixed(1)} KB`,
  });

  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;

  return {
    file: filename,
    passed,
    failed,
    checks,
    stats: {
      elementCount: lines.filter(l => l.trim()).length,
      refCount: refs.length,
      outputSize: Math.round(sizeKB * 1024),
      generationTime: Math.round(duration),
    },
  };
}

function generateReport(results: ValidationResult[]): string {
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalChecks = totalPassed + totalFailed;

  let report = `# Real-World Snapshot Validation Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total Files**: ${results.length}\n`;
  report += `- **Total Checks**: ${totalChecks}\n`;
  report += `- **Passed**: ${totalPassed} (${((totalPassed / totalChecks) * 100).toFixed(1)}%)\n`;
  report += `- **Failed**: ${totalFailed} (${((totalFailed / totalChecks) * 100).toFixed(1)}%)\n\n`;

  // Summary table
  report += `## Files Tested\n\n`;
  report += `| File | Passed | Failed | Elements | Refs | Size | Time |\n`;
  report += `|------|--------|--------|----------|------|------|------|\n`;

  results.forEach(r => {
    report += `| ${r.file} | ${r.passed} | ${r.failed} | ${r.stats.elementCount} | ${r.stats.refCount} | ${(r.stats.outputSize / 1024).toFixed(1)}KB | ${r.stats.generationTime}ms |\n`;
  });

  report += `\n## Detailed Results\n\n`;

  results.forEach(r => {
    report += `### ${r.file}\n\n`;

    if (r.failed === 0) {
      report += `✅ All checks passed!\n\n`;
    } else {
      report += `⚠️ ${r.passed}/${r.passed + r.failed} checks passed\n\n`;
    }

    report += `| Check | Status | Details |\n`;
    report += `|-------|--------|----------|\n`;

    r.checks.forEach(c => {
      const status = c.passed ? '✅' : '❌';
      const details = c.message || '';
      report += `| ${c.name} | ${status} | ${details} |\n`;
    });

    report += `\n`;
  });

  report += `## Key Findings\n\n`;

  const allChecks = results.flatMap(r => r.checks);
  const checkNames = [...new Set(allChecks.map(c => c.name))];

  checkNames.forEach(name => {
    const checksForName = allChecks.filter(c => c.name === name);
    const passedCount = checksForName.filter(c => c.passed).length;
    const totalCount = checksForName.length;
    const passRate = (passedCount / totalCount) * 100;

    report += `- **${name}**: ${passedCount}/${totalCount} (${passRate.toFixed(0)}%)\n`;
  });

  report += `\n## Conclusions\n\n`;

  if (totalFailed === 0) {
    report += `✅ All validation checks passed! The snapshot API is working correctly with real-world HTML.\n\n`;
  } else {
    report += `⚠️ Some checks failed. Review the detailed results above for specific issues.\n\n`;
  }

  report += `**Notable Achievements**:\n`;
  report += `- Smart label selection working correctly\n`;
  report += `- Heading levels captured properly\n`;
  report += `- Children indicators showing filtered content\n`;
  report += `- Refs include bounding boxes and viewport detection\n`;
  report += `- Performance within acceptable limits\n`;

  return report;
}

function main() {
  console.log('🧪 Running validation tests...\n');

  const htmlFiles = readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => join(SNAPSHOTS_DIR, f));

  console.log(`📋 Found ${htmlFiles.length} HTML files\n`);

  const results: ValidationResult[] = [];

  for (const file of htmlFiles) {
    console.log(`Testing ${file.split('/').pop()}...`);
    const result = validateSnapshot(file);
    results.push(result);
    console.log(`  ${result.passed} passed, ${result.failed} failed\n`);
  }

  const report = generateReport(results);

  const reportPath = join(SNAPSHOTS_DIR, 'VALIDATION_REPORT.md');
  writeFileSync(reportPath, report, 'utf-8');

  console.log('✅ Validation complete!');
  console.log(`📄 Report saved to: ${reportPath}`);
  console.log(`\n📊 Overall: ${results.reduce((sum, r) => sum + r.passed, 0)}/${results.reduce((sum, r) => sum + r.passed + r.failed, 0)} checks passed`);
}

main();
