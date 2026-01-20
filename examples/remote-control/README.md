# BTCP Remote Control Example

This example demonstrates remote browser control using the BTCP (Browser Tool Calling Protocol). A Node.js server sends commands to a Chrome extension, which executes them in the browser.

## Architecture

```
┌──────────────────┐     SSE Events      ┌─────────────────────┐
│                  │ ──────────────────> │                     │
│  Node.js Server  │                     │  Chrome Extension   │
│  (btcp-server)   │ <────────────────── │  (RemoteAgent)      │
│                  │   HTTP Responses    │                     │
└──────────────────┘                     └─────────────────────┘
        │                                         │
        │                                         │
        ▼                                         ▼
   Demo Scenario                           BackgroundAgent
   - Navigate                              ContentAgent
   - Snapshot                              DOMActions
   - Click
   - Type
```

## Quick Start

### 1. Build the Extension

```bash
# From the repository root
npm run build:packages

# Build this example
cd examples/remote-control
npm install
npm run build
```

### 2. Load the Extension in Chrome

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `examples/remote-control/dist` directory

### 3. Start the Server

```bash
# Basic server - waits for you to send commands
npm run server

# Demo mode - runs Google→GitHub scenario automatically on connect
npm run server:demo
```

### 4. Connect the Extension

1. Click the extension icon in Chrome
2. Enter the server URL (default: `http://localhost:8080`)
3. Click "Connect"

The extension will register its 26 browser tools with the server and wait for commands.

## Demo Scenario

When running with `npm run server:demo`, the server will automatically execute:

1. Navigate to Google
2. Search for "btcp-cowork"
3. Click on the GitHub result
4. Find and click the Star button (if not already starred)

## Server API

The server implements the BTCP protocol endpoints:

### POST /register
Register browser tools with the server.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/register",
  "params": {
    "sessionId": "browser-123",
    "tools": [{ "name": "browser_navigate", ... }]
  }
}
```

### GET /events?sessionId=xxx
SSE endpoint for receiving tool call requests.

Events:
- `connected` - Initial connection acknowledgment
- `request` - Tool call request from server
- `ping` - Keepalive ping

### POST /response
Send tool execution results back to the server.

```json
{
  "jsonrpc": "2.0",
  "id": "req_1",
  "result": {
    "content": [{ "type": "text", "text": "..." }]
  }
}
```

## Available Browser Tools

The extension exposes 26 tools via BTCP:

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `browser_back` | Go back in history |
| `browser_forward` | Go forward in history |
| `browser_reload` | Reload the page |
| `browser_snapshot` | Get accessibility tree |
| `browser_click` | Click an element |
| `browser_type` | Type text into input |
| `browser_fill` | Fill input value |
| `browser_select` | Select dropdown option |
| `browser_check` | Check checkbox |
| `browser_uncheck` | Uncheck checkbox |
| `browser_hover` | Hover over element |
| `browser_scroll` | Scroll page/element |
| `browser_getText` | Get element text |
| `browser_getAttribute` | Get element attribute |
| `browser_isVisible` | Check element visibility |
| `browser_screenshot` | Capture screenshot |
| `browser_tab_new` | Open new tab |
| `browser_tab_close` | Close tab |
| `browser_tab_switch` | Switch to tab |
| `browser_tab_list` | List all tabs |
| `browser_press` | Press keyboard key |
| `browser_script_inject` | Inject JavaScript |
| `browser_script_send` | Send to injected script |
| `browser_wait` | Wait for time/condition |
| `browser_evaluate` | Evaluate JavaScript |

## Calling Tools from Node.js

```typescript
import { callTool } from './server/index.js';

// Navigate to a page
await callTool(sessionId, 'browser_navigate', { url: 'https://example.com' });

// Take a snapshot
const tree = await callTool(sessionId, 'browser_snapshot', {});

// Click an element (using ref from snapshot)
await callTool(sessionId, 'browser_click', { selector: '@ref:5' });

// Type text
await callTool(sessionId, 'browser_type', {
  selector: '@ref:3',
  text: 'Hello World'
});

// Take a screenshot
const screenshot = await callTool(sessionId, 'browser_screenshot', {});
```

## Development

```bash
# Watch mode for extension
npm run watch

# In another terminal, run the server
npm run server
```

## Troubleshooting

**Extension not connecting:**
- Check that the server is running on the correct port
- Ensure no firewall is blocking the connection
- Check the browser console for errors

**Tools not executing:**
- Make sure you're on a regular web page (not chrome:// URLs)
- Check that content scripts are loaded (refresh the page)

**Demo fails at Google:**
- Google's page structure may have changed
- The search input detection may need updating
