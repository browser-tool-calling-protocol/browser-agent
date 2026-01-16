# Chrome Extension Example

This example demonstrates the clean BackgroundAgent/ContentAgent architecture for browser automation using BTCP Browser Agent.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Background Script (Service Worker)                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ BackgroundAgent                                              ││
│  │  - Tab management (newTab, closeTab, switchTab, listTabs)   ││
│  │  - Navigation (navigate, back, forward, reload)             ││
│  │  - Screenshots (screenshot)                                  ││
│  │  - Routes DOM commands → ContentAgent                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
            chrome.tabs.sendMessage
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Content Script (Per Tab)                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ContentAgent                                                 ││
│  │  - DOM snapshot (accessibility tree with refs)              ││
│  │  - Element interaction (click, type, fill, hover)           ││
│  │  - DOM queries (getText, getAttribute, isVisible)           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Key Concepts

| Agent | Location | Responsibilities |
|-------|----------|------------------|
| **BackgroundAgent** | Background script | Tabs, navigation, screenshots |
| **ContentAgent** | Content script | DOM operations |

**No script injection needed** - Content scripts have direct DOM access via Chrome's isolated world.

## Files

- `manifest.json` - Extension manifest (Manifest V3)
- `background.js` - BackgroundAgent implementation
- `content.js` - ContentAgent implementation
- `popup.html/js` - Extension popup UI

## Installation

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this directory

## Usage

### Single Tab (Default)

```javascript
// All commands target the active tab
await btcpAgent.navigate('https://example.com');
const snapshot = await btcpAgent.snapshot();
await btcpAgent.click('@ref:0');
await btcpAgent.fill('@ref:1', 'hello@example.com');
```

### Multi-Tab Operations

```javascript
// Open multiple tabs
const tab1 = await btcpAgent.tabNew({ url: 'https://google.com' });
const tab2 = await btcpAgent.tabNew({ url: 'https://github.com', active: false });

// Method 1: Use tab() handle for specific tab (no switching needed)
const tab2Handle = btcpAgent.tab(tab2.id);
await tab2Handle.snapshot();           // Get GitHub page structure
await tab2Handle.click('@ref:5');      // Click on GitHub

// Method 2: Specify tabId in execute options
await backgroundAgent.execute(
  { id: '1', action: 'getText', selector: 'h1' },
  { tabId: tab2.id }
);

// Active tab remains tab1 (Google) - no switching occurred
const googleSnapshot = await btcpAgent.snapshot();
```

### Production Usage (with bundler)

```javascript
// content.ts - registers DOM agent
import 'btcp-browser-agent/extension/content';

// background.ts - routes messages
import { setupMessageListener } from 'btcp-browser-agent/extension';
setupMessageListener();

// popup.ts - sends commands
import { createClient } from 'btcp-browser-agent/extension';
const client = createClient();
await client.navigate('https://example.com');
const { tree } = await client.snapshot();
await client.click('@ref:5');
```

## Command Routing

| Command Type | Handler | Examples |
|--------------|---------|----------|
| **Browser** | BackgroundAgent | `navigate`, `screenshot`, `tabNew` |
| **DOM** | ContentAgent | `snapshot`, `click`, `fill`, `getText` |

## Available Commands

### BackgroundAgent Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `navigate` | `url, waitUntil?` | Navigate to URL |
| `back` | - | Go back |
| `forward` | - | Go forward |
| `reload` | `bypassCache?` | Reload page |
| `screenshot` | `format?, quality?` | Capture visible tab |
| `tabNew` | `url?, active?` | Create new tab |
| `tabClose` | `tabId?` | Close tab |
| `tabSwitch` | `tabId` | Switch to tab |
| `tabList` | - | List all tabs |

### ContentAgent Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `snapshot` | `selector?, maxDepth?` | Get accessibility tree |
| `click` | `selector` | Click element |
| `fill` | `selector, value` | Set input value |
| `type` | `selector, text, clear?` | Type text |
| `check` | `selector` | Check checkbox |
| `uncheck` | `selector` | Uncheck checkbox |
| `select` | `selector, values` | Select option(s) |
| `hover` | `selector` | Hover over element |
| `scroll` | `selector?, x?, y?` | Scroll |
| `getText` | `selector` | Get element text |
| `isVisible` | `selector` | Check visibility |
| `wait` | `selector?, timeout?` | Wait for element |
| `evaluate` | `script` | Execute JavaScript |

## Selector Formats

- `@ref:0` - Element ref from snapshot (recommended)
- `#id` - CSS ID selector
- `.class` - CSS class selector
- `[data-testid="x"]` - Attribute selector

## AI Integration Example

```javascript
// background.js
async function runAgent(task) {
  // 1. Get page snapshot
  const { data } = await btcpAgent.snapshot();

  // 2. Send to AI with task
  const aiResponse = await askAI(task, data.tree);

  // 3. Execute AI's command
  const command = JSON.parse(aiResponse);
  return btcpAgent.execute(command);
}
```

## License

Apache-2.0
