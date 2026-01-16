/**
 * Generate side-by-side HTML and snapshot viewer
 *
 * Creates an HTML page showing the original HTML source alongside
 * the generated snapshot for easy comparison and review
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createSnapshot } from '../../packages/core/src/snapshot.js';
import { createSimpleRefMap } from '../../packages/core/src/ref-map.js';

const SNAPSHOTS_DIR = join(process.cwd(), 'examples', 'snapshots');

interface SideBySideData {
  filename: string;
  htmlFile: string;
  snapshotFile: string;
  htmlContent: string;
  snapshotContent: string;
  stats: {
    htmlSize: number;
    snapshotSize: number;
    elementCount: number;
    refCount: number;
    generationTime: number;
  };
}

function generateSideBySide(htmlPath: string): SideBySideData | null {
  const filename = basename(htmlPath, '.html');
  const htmlFile = basename(htmlPath);
  const snapshotFile = `${filename}.snapshot.txt`;

  console.log(`\n📄 Processing: ${htmlFile}`);

  try {
    // Read HTML
    const htmlContent = readFileSync(htmlPath, 'utf-8');

    // Generate snapshot
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('error', () => {});
    virtualConsole.on('warn', () => {});

    const dom = new JSDOM(htmlContent, {
      url: 'http://localhost',
      contentType: 'text/html',
      pretendToBeVisual: true,
      virtualConsole,
    });

    const { document } = dom.window;
    const refMap = createSimpleRefMap();

    const startTime = performance.now();
    const snapshot = createSnapshot(document, refMap, {
      interactive: true,
      compact: true,
      maxDepth: 999, // No depth limit - show everything
      includeHidden: false,
    });
    const duration = performance.now() - startTime;

    const snapshotContent = snapshot.tree;

    console.log(`  ✅ Generated`);
    console.log(`     HTML: ${(htmlContent.length / 1024).toFixed(1)} KB`);
    console.log(`     Snapshot: ${(snapshotContent.length / 1024).toFixed(1)} KB`);
    console.log(`     Reduction: ${(100 - (snapshotContent.length / htmlContent.length) * 100).toFixed(1)}%`);

    return {
      filename,
      htmlFile,
      snapshotFile,
      htmlContent,
      snapshotContent,
      stats: {
        htmlSize: htmlContent.length,
        snapshotSize: snapshotContent.length,
        elementCount: snapshotContent.split('\n').filter(l => l.trim()).length,
        refCount: Object.keys(snapshot.refs).length,
        generationTime: Math.round(duration),
      },
    };
  } catch (error) {
    console.log(`  ❌ Error: ${(error as Error).message}`);
    return null;
  }
}

function generateViewerHTML(data: SideBySideData[]): string {
  const validData = data.filter(d => d !== null);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BTCP Snapshot Comparison - Real World Sites</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      background: #f5f5f5;
      padding: 20px;
    }

    .header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 2em;
    }

    .subtitle {
      color: #666;
      font-size: 1.1em;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }

    .stat-card {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #007bff;
    }

    .stat-label {
      color: #666;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-value {
      color: #333;
      font-size: 1.8em;
      font-weight: bold;
      margin-top: 5px;
    }

    .file-section {
      background: white;
      border-radius: 8px;
      margin-bottom: 30px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .file-header {
      background: #007bff;
      color: white;
      padding: 20px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .file-title {
      font-size: 1.3em;
      font-weight: 600;
    }

    .file-stats {
      display: flex;
      gap: 20px;
      font-size: 0.9em;
      opacity: 0.95;
    }

    .comparison-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      background: #ddd;
      border-top: 1px solid #ddd;
    }

    .panel {
      background: white;
      display: flex;
      flex-direction: column;
    }

    .panel-header {
      background: #f8f9fa;
      padding: 15px 20px;
      border-bottom: 1px solid #ddd;
      font-weight: 600;
      color: #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-size {
      font-size: 0.9em;
      color: #666;
      font-weight: normal;
    }

    .panel-content {
      padding: 20px;
      overflow-x: auto;
      max-height: 600px;
      overflow-y: auto;
    }

    pre {
      margin: 0;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre;
      color: #333;
    }

    .snapshot-line {
      margin: 2px 0;
    }

    .snapshot-header {
      color: #0066cc;
      font-weight: bold;
    }

    .snapshot-ref {
      color: #cc0066;
    }

    .snapshot-role {
      color: #009900;
      font-weight: 600;
    }

    .snapshot-children {
      color: #666;
      font-style: italic;
    }

    .html-tag {
      color: #cc0066;
    }

    .html-attr {
      color: #0066cc;
    }

    .html-text {
      color: #333;
    }

    .reduction-badge {
      background: #28a745;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
    }

    @media (max-width: 1024px) {
      .comparison-container {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 BTCP Snapshot Comparison</h1>
    <p class="subtitle">Real-world HTML snapshots side-by-side</p>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Files</div>
        <div class="stat-value">${validData.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Size Reduction</div>
        <div class="stat-value">${
          validData.length > 0
            ? (
                validData.reduce((sum, d) => sum + (100 - (d.stats.snapshotSize / d.stats.htmlSize) * 100), 0) /
                validData.length
              ).toFixed(1)
            : 0
        }%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Elements</div>
        <div class="stat-value">${validData.reduce((sum, d) => sum + d.stats.elementCount, 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Refs</div>
        <div class="stat-value">${validData.reduce((sum, d) => sum + d.stats.refCount, 0)}</div>
      </div>
    </div>
  </div>

  ${validData
    .map((item) => {
      const reduction = (100 - (item.stats.snapshotSize / item.stats.htmlSize) * 100).toFixed(1);

      return `
  <div class="file-section">
    <div class="file-header">
      <div class="file-title">${item.htmlFile}</div>
      <div class="file-stats">
        <span>Elements: ${item.stats.elementCount}</span>
        <span>Refs: ${item.stats.refCount}</span>
        <span>Time: ${item.stats.generationTime}ms</span>
      </div>
    </div>

    <div class="comparison-container">
      <div class="panel">
        <div class="panel-header">
          Original HTML
          <span class="panel-size">${(item.stats.htmlSize / 1024).toFixed(1)} KB</span>
        </div>
        <div class="panel-content">
          <pre>${escapeHtml(item.htmlContent.slice(0, 10000))}${
        item.htmlContent.length > 10000 ? '\n\n... (truncated for display, showing first 10KB)' : ''
      }</pre>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          Generated Snapshot
          <span class="reduction-badge">-${reduction}%</span>
          <span class="panel-size">${(item.stats.snapshotSize / 1024).toFixed(1)} KB</span>
        </div>
        <div class="panel-content">
          <pre>${formatSnapshot(item.snapshotContent)}</pre>
        </div>
      </div>
    </div>
  </div>`;
    })
    .join('\n')}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatSnapshot(snapshot: string): string {
  return snapshot
    .split('\n')
    .map((line) => {
      let formatted = escapeHtml(line);

      // Highlight PAGE and SNAPSHOT headers
      if (line.startsWith('PAGE:') || line.startsWith('SNAPSHOT:')) {
        formatted = `<span class="snapshot-header">${formatted}</span>`;
      }
      // Highlight refs
      else if (line.includes('@ref:')) {
        formatted = formatted.replace(/(@ref:\d+)/g, '<span class="snapshot-ref">$1</span>');
      }
      // Highlight roles
      formatted = formatted.replace(
        /\b(BUTTON|LINK|TEXTBOX|HEADING|FORM|CHECKBOX|RADIO|SELECT|TEXTAREA|IMAGE)\b/g,
        '<span class="snapshot-role">$1</span>'
      );
      // Highlight children indicators
      formatted = formatted.replace(
        /(\(\d+ (?:children|non-interactive children filtered|shown|hidden)[^)]*\))/g,
        '<span class="snapshot-children">$1</span>'
      );

      return `<div class="snapshot-line">${formatted}</div>`;
    })
    .join('\n');
}

function main() {
  console.log('🚀 Generating side-by-side comparison...');
  console.log(`📁 Directory: ${SNAPSHOTS_DIR}`);

  // Find all HTML files
  const htmlFiles = readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => join(SNAPSHOTS_DIR, f));

  console.log(`\n📋 Found ${htmlFiles.length} HTML files`);

  // Generate side-by-side data
  const data: (SideBySideData | null)[] = [];
  for (const file of htmlFiles) {
    const result = generateSideBySide(file);
    data.push(result);
  }

  const validData = data.filter((d): d is SideBySideData => d !== null);

  // Generate HTML viewer
  const html = generateViewerHTML(validData);
  const outputPath = join(SNAPSHOTS_DIR, 'comparison.html');
  writeFileSync(outputPath, html, 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log('✨ Side-by-side comparison generated!');
  console.log('='.repeat(60));
  console.log(`📄 Open in browser: ${outputPath}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Files processed: ${validData.length}/${htmlFiles.length}`);
  console.log(`   Total elements: ${validData.reduce((sum, d) => sum + d.stats.elementCount, 0)}`);
  console.log(`   Total refs: ${validData.reduce((sum, d) => sum + d.stats.refCount, 0)}`);
  console.log(`   Avg size reduction: ${(
    validData.reduce((sum, d) => sum + (100 - (d.stats.snapshotSize / d.stats.htmlSize) * 100), 0) /
    validData.length
  ).toFixed(1)}%`);
}

main();
