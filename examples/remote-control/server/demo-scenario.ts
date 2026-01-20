/**
 * Demo Scenario - Google to GitHub Star
 *
 * This scenario demonstrates remote browser control:
 * 1. Navigate to Google
 * 2. Search for "btcp-cowork"
 * 3. Click on the GitHub result
 * 4. Find and click the Star button
 */

import { callTool, log, logSuccess, logError, logInfo } from './index.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Find an element ref in a snapshot tree
 */
function findElement(
  tree: string,
  criteria: {
    role?: string;
    name?: string;
    nameContains?: string;
  }
): string | null {
  const lines = tree.split('\n');

  for (const line of lines) {
    const refMatch = line.match(/@ref:(\d+)/);
    if (!refMatch) continue;

    const ref = `@ref:${refMatch[1]}`;
    let matches = true;

    if (criteria.role) {
      const roleUpper = criteria.role.toUpperCase();
      if (!line.includes(roleUpper)) matches = false;
    }

    if (criteria.name) {
      const namePattern = `"${criteria.name}"`;
      if (!line.includes(namePattern)) matches = false;
    }

    if (criteria.nameContains) {
      const quotedTextMatch = line.match(/"([^"]+)"/);
      if (
        !quotedTextMatch ||
        !quotedTextMatch[1].toLowerCase().includes(criteria.nameContains.toLowerCase())
      ) {
        matches = false;
      }
    }

    if (matches) return ref;
  }

  return null;
}

/**
 * Find a link containing a specific domain
 */
function findLinkByDomain(tree: string, domain: string): string | null {
  const lines = tree.split('\n');

  for (const line of lines) {
    if (!line.includes('LINK')) continue;

    const refMatch = line.match(/@ref:(\d+)/);
    if (!refMatch) continue;

    if (line.toLowerCase().includes(domain.toLowerCase())) {
      return `@ref:${refMatch[1]}`;
    }
  }

  return null;
}

/**
 * Run the Google -> GitHub Star demo scenario
 */
export async function runGoogleGithubDemo(sessionId: string): Promise<void> {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Starting Remote Browser Demo                     ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  Google -> GitHub -> Star Repository                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Step 1: Navigate to Google (session auto-created if needed)
    logInfo('[1/10] Navigating to Google...');
    await callTool(sessionId, 'browser_navigate', { url: 'https://www.google.com' });
    logSuccess('Loaded Google');
    await sleep(2000);

    // Step 2: Take snapshot
    logInfo('[2/10] Taking snapshot to analyze page...');
    const snapshot1 = (await callTool(sessionId, 'browser_snapshot', {})) as string;
    log(`Found ${snapshot1.split('\n').length} elements`);
    await sleep(500);

    // Step 3: Find search input
    logInfo('[3/10] Finding search box...');
    let searchInput = findElement(snapshot1, { role: 'combobox' });
    if (!searchInput) {
      searchInput = findElement(snapshot1, { role: 'searchbox' });
    }
    if (!searchInput) {
      searchInput = findElement(snapshot1, { role: 'textbox', nameContains: 'search' });
    }

    if (!searchInput) {
      throw new Error('Could not find search input');
    }
    logSuccess(`Found search box: ${searchInput}`);

    // Step 4: Type search query
    logInfo('[4/10] Typing "btcp-cowork"...');
    await callTool(sessionId, 'browser_type', {
      selector: searchInput,
      text: 'btcp-cowork',
    });
    logSuccess('Query typed');
    await sleep(500);

    // Step 5: Submit search
    logInfo('[5/10] Submitting search...');
    await callTool(sessionId, 'browser_press', { key: 'Enter' });
    logSuccess('Search submitted');
    await sleep(3000);

    // Step 6: Take snapshot of results
    logInfo('[6/10] Taking snapshot of search results...');
    const snapshot2 = (await callTool(sessionId, 'browser_snapshot', {})) as string;

    const linkLines = snapshot2
      .split('\n')
      .filter(line => line.includes('LINK') && line.includes('@ref:'));
    log(`Found ${linkLines.length} links`);
    await sleep(500);

    // Step 7: Find GitHub link
    logInfo('[7/10] Searching for GitHub repository link...');
    let githubLink = findLinkByDomain(snapshot2, 'browser-tool-calling-protocol');

    if (!githubLink) {
      githubLink = findLinkByDomain(snapshot2, 'github.com');
    }

    if (!githubLink) {
      // Try first search result
      const lines = snapshot2.split('\n');
      for (const line of lines) {
        if (
          line.includes('LINK') &&
          !line.includes('Images') &&
          !line.includes('Videos') &&
          !line.includes('News')
        ) {
          const refMatch = line.match(/@ref:(\d+)/);
          if (refMatch && parseInt(refMatch[1]) >= 18) {
            githubLink = `@ref:${refMatch[1]}`;
            break;
          }
        }
      }
    }

    if (!githubLink) {
      throw new Error('No GitHub links found in results');
    }
    logSuccess(`Found link: ${githubLink}`);

    // Step 8: Click GitHub link
    logInfo('[8/10] Navigating to GitHub...');
    await callTool(sessionId, 'browser_click', { selector: githubLink });
    logSuccess('Clicked link');
    await sleep(3000);

    // Step 9: Take snapshot with star filter
    logInfo('[9/10] Looking for Star button...');
    const snapshot3 = (await callTool(sessionId, 'browser_snapshot', {
      grep: { pattern: 'star', ignoreCase: true },
    })) as string;

    const filteredLines = snapshot3.split('\n').filter(line => line.includes('@ref:'));
    log(`Found ${filteredLines.length} elements containing "star"`);

    // Check if already starred
    const hasUnstar = snapshot3.toLowerCase().includes('"unstar"');
    let starButton = findElement(snapshot3, { role: 'button', nameContains: 'star' });

    if (hasUnstar) {
      logInfo('Repository already starred (Unstar button present)');
      starButton = findElement(snapshot3, { role: 'button', nameContains: 'unstar' });
    }

    if (!starButton) {
      logInfo('Star button not found (may need login)');
      logInfo('Demo completed up to GitHub navigation');
      return;
    }

    logSuccess(`Found star button: ${starButton}`);

    // Step 10: Click star button (if not already starred)
    if (!hasUnstar) {
      logInfo('[10/10] Clicking star button...');
      await callTool(sessionId, 'browser_click', { selector: starButton });
      logSuccess('Star button clicked!');
      await sleep(2000);

      // Verify
      const verifySnapshot = (await callTool(sessionId, 'browser_snapshot', {
        grep: { pattern: 'star', ignoreCase: true },
      })) as string;

      if (verifySnapshot.toLowerCase().includes('"unstar"')) {
        logSuccess('Repository successfully starred!');
      }
    } else {
      logInfo('[10/10] Skipping star (already starred)');
    }

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           Demo Complete!                                   ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  - Searched Google for "btcp-cowork"                       ║');
    console.log('║  - Found and clicked GitHub link                           ║');
    console.log('║  - Navigated to repository                                 ║');
    console.log('║  - Attempted to star repository                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
  } catch (error) {
    logError(`Demo failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
