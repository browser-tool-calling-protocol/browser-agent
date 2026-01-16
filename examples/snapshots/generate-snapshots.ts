/**
 * Generate snapshots from saved HTML files
 *
 * Processes each HTML file in examples/snapshots/ and generates:
 * - {filename}.snapshot.txt - The snapshot output
 * - metadata.json - Statistics and metadata for all files
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createSnapshot } from '../../packages/core/src/snapshot.js';
import { createSimpleRefMap } from '../../packages/core/src/ref-map.js';

interface SnapshotMetadata {
  filename: string;
  htmlFile: string;
  snapshotFile: string;
  generatedAt: string;
  stats: {
    elementCount: number;
    refCount: number;
    outputSize: number;
    generationTime: number;
  };
  url?: string;
  title?: string;
}

const SNAPSHOTS_DIR = join(process.cwd(), 'examples', 'snapshots');

function generateSnapshot(htmlPath: string): SnapshotMetadata {
  const filename = basename(htmlPath, '.html');
  const htmlFile = basename(htmlPath);
  const snapshotFile = `${filename}.snapshot.txt`;

  console.log(`\n📄 Processing: ${htmlFile}`);

  // Load HTML
  const html = readFileSync(htmlPath, 'utf-8');

  // Create virtual console that suppresses CSS warnings
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', () => {}); // Suppress all console errors
  virtualConsole.on('warn', () => {}); // Suppress all console warnings

  const dom = new JSDOM(html, {
    url: 'http://localhost',
    contentType: 'text/html',
    pretendToBeVisual: true,
    virtualConsole,
  });

  const { document } = dom.window;
  const refMap = createSimpleRefMap();

  // Generate snapshot with timing
  const startTime = performance.now();
  const snapshot = createSnapshot(document, refMap, {
    interactive: true,
    compact: true,
    maxDepth: 10,
    includeHidden: false,
  });
  const endTime = performance.now();

  // Calculate stats
  const stats = {
    elementCount: snapshot.tree.split('\n').filter(line => line.trim()).length,
    refCount: Object.keys(snapshot.refs).length,
    outputSize: snapshot.tree.length,
    generationTime: Math.round(endTime - startTime),
  };

  // Save snapshot
  const snapshotPath = join(SNAPSHOTS_DIR, snapshotFile);
  writeFileSync(snapshotPath, snapshot.tree, 'utf-8');

  console.log(`  ✅ Generated: ${snapshotFile}`);
  console.log(`     Elements: ${stats.elementCount}`);
  console.log(`     Refs: ${stats.refCount}`);
  console.log(`     Size: ${(stats.outputSize / 1024).toFixed(1)} KB`);
  console.log(`     Time: ${stats.generationTime}ms`);

  return {
    filename,
    htmlFile,
    snapshotFile,
    generatedAt: new Date().toISOString(),
    stats,
    url: document.location?.href,
    title: document.title,
  };
}

function main() {
  console.log('🚀 Starting snapshot generation...');
  console.log(`📁 Directory: ${SNAPSHOTS_DIR}`);

  // Find all HTML files
  const files = readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => join(SNAPSHOTS_DIR, f));

  console.log(`\n📋 Found ${files.length} HTML files`);

  // Generate snapshots
  const metadata: SnapshotMetadata[] = [];
  for (const file of files) {
    try {
      const meta = generateSnapshot(file);
      metadata.push(meta);
    } catch (error) {
      console.error(`  ❌ Error processing ${basename(file)}:`, error);
    }
  }

  // Save metadata
  const metadataPath = join(SNAPSHOTS_DIR, 'metadata.json');
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total files processed: ${metadata.length}`);
  console.log(`Total elements: ${metadata.reduce((sum, m) => sum + m.stats.elementCount, 0)}`);
  console.log(`Total refs: ${metadata.reduce((sum, m) => sum + m.stats.refCount, 0)}`);
  console.log(`Average generation time: ${Math.round(metadata.reduce((sum, m) => sum + m.stats.generationTime, 0) / metadata.length)}ms`);
  console.log(`Total output size: ${(metadata.reduce((sum, m) => sum + m.stats.outputSize, 0) / 1024).toFixed(1)} KB`);
  console.log('\n✨ Done! Check examples/snapshots/ for output files');
}

main();
