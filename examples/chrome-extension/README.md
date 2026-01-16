# Chrome Extension Example

This example demonstrates the clean BrowserAgent/ContentAgent architecture for browser automation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Background Script (Service Worker)                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ BrowserAgent                                                 ││
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
| **BrowserAgent** | Background script | Tabs, navigation, screenshots |
| **ContentAgent** | Content script | DOM operations |

**No script injection needed** - Content scripts have direct DOM access via Chrome's isolated world.

## Files

- `manifest.json` - Extension manifest (Manifest V3)
- `background.js` - BrowserAgent implementation
- `content.js` - ContentAgent implementation
- `popup.html/js` - Extension popup UI

## Installation

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this directory

## Usage

### From Popup UI

```javascript
// BrowserAgent commands
await aspectAgent.navigate('https://example.com');
await aspectAgent.screenshot();
await aspectAgent.tabNew({ url: 'https://google.com' });

// DOM commands (routed to ContentAgent)
const snapshot = await aspectAgent.snapshot();
await aspectAgent.click('@ref:0');
await aspectAgent.fill('@ref:1', 'hello@example.com');
```

### Production Usage (with bundler)

**Background script:**
```javascript
import { BrowserAgent, setupMessageListener } from '@aspect/extension';

// Option 1: Auto message routing
setupMessageListener();

// Option 2: Programmatic control
const browser = new BrowserAgent();
await browser.navigate('https://example.com');
await browser.screenshot();
```

**Content script:**
```javascript
import { createContentAgent } from '@aspect/core';

const agent = createContentAgent();
await agent.execute({ id: '1', action: 'snapshot' });
await agent.execute({ id: '2', action: 'click', selector: '@ref:5' });
```

## Command Routing

| Command Type | Handler | Examples |
|--------------|---------|----------|
| **Browser** | BrowserAgent | `navigate`, `screenshot`, `tabNew` |
| **DOM** | ContentAgent | `snapshot`, `click`, `fill`, `getText` |

## Available Commands

### BrowserAgent Commands

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
  const { data } = await aspectAgent.snapshot();

  // 2. Send to AI with task
  const aiResponse = await askAI(task, data.tree);

  // 3. Execute AI's command
  const command = JSON.parse(aiResponse);
  return aspectAgent.execute(command);
}
```

## License

Apache-2.0
