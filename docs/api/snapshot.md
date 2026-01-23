# Snapshot API

The Snapshot API generates accessibility snapshots of the DOM for AI agents. It produces compact, AI-friendly representations of page content that can be used for navigation, interaction, and content extraction.

## API Reference

### `createSnapshot(document, refMap, options)`

Generates a snapshot of the DOM with configurable modes and formats.

```typescript
function createSnapshot(
  document: Document,
  refMap: RefMap,
  options?: SnapshotOptions
): SnapshotData
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `document` | `Document` | The DOM document to snapshot |
| `refMap` | `RefMap` | Element reference map for storing refs |
| `options` | `SnapshotOptions` | Configuration options (optional) |

#### Returns

`SnapshotData` - The snapshot result containing the tree representation, refs, and metadata.

---

## SnapshotOptions

Configuration options for snapshot generation.

```typescript
interface SnapshotOptions {
  root?: Element;
  maxDepth?: number;
  includeHidden?: boolean;
  mode?: SnapshotMode;
  format?: SnapshotFormat;
  grep?: string | GrepOptions;
  maxLength?: number;
  includeLinks?: boolean;
  includeImages?: boolean;
  maxLines?: number;
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `root` | `Element` | `document.body` | Root element to start traversal from |
| `maxDepth` | `number` | `50` | Maximum DOM traversal depth |
| `includeHidden` | `boolean` | `false` | Include hidden elements in output |
| `mode` | `SnapshotMode` | `'interactive'` | Snapshot mode (see below) |
| `format` | `SnapshotFormat` | `'tree'` | Output format (see below) |
| `grep` | `string \| GrepOptions` | - | Filter pattern for output |
| `maxLength` | `number` | `2000` | Max chars per section (content mode) |
| `includeLinks` | `boolean` | `true` | Include links in markdown output |
| `includeImages` | `boolean` | `false` | Include images in markdown output |
| `maxLines` | `number` | `100` | Line budget for structure mode |

---

## Snapshot Modes

The `mode` option controls what content is captured in the snapshot.

| Mode | Purpose |
|------|---------|
| `head` | Lightweight page overview (URL, title, counts, status) |
| `interactive` | Find clickable elements with `@ref` markers (default) |
| `structure` | High-level landmarks, headings, interaction summaries |
| `outline` | Structural overview with xpaths + metadata |
| `content` | Extract text content from sections |
| `all` | All elements (interactive + structural) |

### `head` Mode

Returns a lightweight HTTP HEAD-style overview without deep DOM traversal. Useful for quick page verification.

**Output:**
```
URL: https://example.com/page
TITLE: Example Page
VIEWPORT: 1920x1080
STATUS: ready
ELEMENTS: total=150 interactive=25
READY_STATE: complete
```

**Status values:**
- `loading` - Page is still loading or viewport not initialized
- `empty` - No interactive elements found
- `interactive` - Page has interactive elements but not fully loaded
- `ready` - Page is complete and has interactive elements

### `interactive` Mode (Default)

Captures all interactive elements (buttons, links, inputs, etc.) with `@ref` markers for subsequent interaction.

**Output:**
```
PAGE: https://example.com | Example Page | viewport=1920x1080
SNAPSHOT: elements=150 refs=25

BUTTON "Submit" @ref:0 /form/button
LINK "Home" @ref:1 /nav/a[1]
TEXTBOX "Email" @ref:2 [type=email required] /form/input[1]
CHECKBOX "Remember me" @ref:3 /form/input[2]
```

**Element attributes shown:**
- Input type and validation (`[type=email required]`)
- State flags (`(disabled, checked, expanded, selected)`)
- Semantic xpath path

### `structure` Mode

Shows high-level page structure: landmarks, headings, and interaction summaries. Uses a line budget for controlled output size.

**Options:**
- `maxLines` - Maximum output lines (default: 100)

**Output:**
```
PAGE: https://example.com | Example Page | viewport=1920x1080
STRUCTURE: elements=8 maxLines=100

BANNER "Site Header" [3 buttons, 5 links] /header
  HEADING level=1 "Welcome" /header/h1
NAVIGATION "Main Menu" [8 links] /nav
MAIN [2 buttons, 3 links, 2 inputs] /main
  HEADING level=2 "Products" /main/section[1]/h2
  REGION "Product List" [10 links] /main/section[1]
  HEADING level=2 "Contact" /main/section[2]/h2
  FORM [2 inputs, 1 button] /main/form
CONTENTINFO "Footer" [4 links] /footer
```

### `outline` Mode

Provides a hierarchical structural overview with metadata about content size, links, and code blocks.

**Output:**
```
PAGE: https://example.com | Example Page | viewport=1920x1080
OUTLINE: landmarks=4 sections=6 headings=8 words=1250

MAIN @ref:0 [1250 words, 15 links, 8 paragraphs] /main
  HEADING level=1 "Getting Started" /main/h1
  REGION "Introduction" @ref:1 [200 words, 3 links] /main/section#intro
    HEADING level=2 "Overview" /main/section#intro/h2
  ARTICLE @ref:2 [450 words, 5 links, 2 code] /main/article
    HEADING level=2 "Installation" /main/article/h2
    CODE [javascript, 15 lines] /main/article/pre
  LIST [8 items] /main/ul
```

**Metadata includes:**
- Word count
- Link count
- Paragraph count
- List item count
- Code block count with language detection

### `content` Mode

Extracts text content from semantic sections. Supports markdown output format.

**Options:**
- `maxLength` - Max characters per section (default: 2000)
- `format` - Use `'markdown'` for markdown output
- `includeLinks` - Include links as `[text](url)`
- `includeImages` - Include images as `![alt](src)`

**Tree format output:**
```
PAGE: https://example.com | Example Page
CONTENT: sections=3 words=850

SECTION /main/article [450 words]
  HEADING level=2 "Installation"
  TEXT "To install the package, run the following command..."
  CODE [bash, 3 lines]
    npm install @example/package
    npm run build
    npm start
  LIST [3 items]
    - "Configure your settings"
    - "Run the development server"
    - "Deploy to production"
```

**Markdown format output:**
```markdown
<!-- source: https://example.com -->
<!-- xpath: /main/article -->

## Installation

To install the package, run the following command...

```bash
npm install @example/package
npm run build
npm start
```

- Configure your settings
- Run the development server
- Deploy to production

<!-- end: 450 words extracted -->
```

### `all` Mode

Captures all elements with roles - both interactive and structural. Every element gets a `@ref` marker.

**Output:**
```
PAGE: https://example.com | Example Page | viewport=1920x1080
ALL: elements=85 refs=85

BANNER "Site Header" @ref:0 /header
NAVIGATION "Main Menu" @ref:1 /nav
LINK "Home" @ref:2 /nav/a[1]
LINK "Products" @ref:3 /nav/a[2]
MAIN @ref:4 /main
REGION "Hero" @ref:5 /main/section[1]
HEADING level=1 "Welcome" @ref:6 /main/section[1]/h1
BUTTON "Get Started" @ref:7 /main/section[1]/button
```

---

## Output Formats

The `format` option controls the output representation.

| Format | Description |
|--------|-------------|
| `tree` | Flat accessibility tree with roles and refs (default) |
| `html` | Raw HTML of the body element |
| `markdown` | Markdown formatted content (content mode only) |

### `tree` Format (Default)

Produces a flat, line-based accessibility tree optimized for AI consumption.

### `html` Format

Returns the raw `outerHTML` of the body element without processing. No refs are generated.

### `markdown` Format

Available in `content` mode. Converts page content to markdown with optional link and image inclusion.

---

## Grep Filtering

Filter snapshot output using grep-like patterns.

### Simple Pattern

```typescript
createSnapshot(document, refMap, {
  grep: 'button'
})
```

### GrepOptions Object

```typescript
interface GrepOptions {
  pattern: string;       // Pattern to search for
  ignoreCase?: boolean;  // Case-insensitive matching (grep -i)
  invert?: boolean;      // Invert match (grep -v)
  fixedStrings?: boolean; // Literal string, not regex (grep -F)
}
```

**Examples:**

```typescript
// Case-insensitive search
createSnapshot(document, refMap, {
  grep: { pattern: 'submit', ignoreCase: true }
})

// Exclude disabled elements
createSnapshot(document, refMap, {
  grep: { pattern: 'disabled', invert: true }
})

// Fixed string match (no regex interpretation)
createSnapshot(document, refMap, {
  grep: { pattern: 'user@example.com', fixedStrings: true }
})
```

---

## Return Type: SnapshotData

```typescript
interface SnapshotData {
  tree: string;
  refs: Record<string, RefInfo>;
  metadata?: SnapshotMetadata;
}

interface RefInfo {
  selector: string;      // CSS selector for the element
  role: string;          // ARIA role
  name?: string;         // Accessible name
  bbox?: BoundingBox;    // Bounding box coordinates
  inViewport?: boolean;  // Whether element is in viewport
}

interface SnapshotMetadata {
  totalInteractiveElements?: number;
  capturedElements?: number;
  quality?: 'high' | 'medium' | 'low';
  depthLimited?: boolean;
  warnings?: string[];
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

---

## Usage Examples

### Basic Interactive Snapshot

```typescript
import { createSnapshot } from '@btcp/browser-agent/core';

const refMap = createRefMap();
const snapshot = createSnapshot(document, refMap);

console.log(snapshot.tree);
// PAGE: https://example.com | Example | viewport=1920x1080
// SNAPSHOT: elements=50 refs=12
//
// BUTTON "Submit" @ref:0 /form/button
// ...
```

### Head Mode for Quick Page Check

```typescript
const snapshot = createSnapshot(document, refMap, {
  mode: 'head'
});

console.log(snapshot.tree);
// URL: https://example.com
// TITLE: Example Page
// VIEWPORT: 1920x1080
// STATUS: ready
// ELEMENTS: total=150 interactive=25
// READY_STATE: complete
```

### Structure Mode for Page Overview

```typescript
const snapshot = createSnapshot(document, refMap, {
  mode: 'structure',
  maxLines: 50
});

// Shows landmarks, headings, and interaction summaries
```

### Outline Mode for Content Structure

```typescript
const snapshot = createSnapshot(document, refMap, {
  mode: 'outline',
  grep: 'article'  // Filter to article sections
});

// Shows hierarchical structure with word counts
```

### Content Mode with Grep Filtering

```typescript
const snapshot = createSnapshot(document, refMap, {
  mode: 'content',
  grep: { pattern: 'main', ignoreCase: true },
  maxLength: 1000
});

// Extracts text from sections matching "main"
```

### Markdown Extraction

```typescript
const snapshot = createSnapshot(document, refMap, {
  mode: 'content',
  format: 'markdown',
  includeLinks: true,
  includeImages: true
});

// Returns markdown-formatted content
```

---

## Element Reference System

### How Refs Work

Element references (`@ref:N`) provide stable identifiers for interacting with elements:

1. **Generation**: When a snapshot is created, interactive elements receive sequential refs (`@ref:0`, `@ref:1`, etc.)

2. **Storage**: Refs are stored in the `RefMap` using `WeakRef` for automatic garbage collection

3. **Usage**: Pass refs as selectors to subsequent commands:
   ```typescript
   await agent.execute({ action: 'click', selector: '@ref:5' });
   ```

4. **Lifecycle**: Refs are cleared when:
   - A new snapshot is created (calls `refMap.clear()`)
   - The page navigates
   - The content script is reloaded

### RefMap Interface

```typescript
interface RefMap {
  get(ref: string): Element | null;  // Get element by ref
  set(ref: string, element: Element): void;  // Store element
  clear(): void;  // Clear all refs
  generateRef(element: Element): string;  // Generate new ref
}
```

### Ref Validation

Use the `validateRefs` action to check if refs are still valid:

```typescript
const result = await agent.execute({
  action: 'validateRefs',
  refs: ['@ref:0', '@ref:1', '@ref:2']
});

// result.data = {
//   valid: ['@ref:0', '@ref:1'],
//   invalid: ['@ref:2'],
//   reasons: { '@ref:2': 'Element no longer attached to DOM' }
// }
```

---

## Quality Indicators

The `metadata.quality` field indicates snapshot reliability:

| Quality | Meaning |
|---------|---------|
| `high` | Viewport initialized, elements captured successfully |
| `medium` | Less than 50% of interactive elements captured |
| `low` | Viewport not initialized (0x0) or no elements captured |

**Warnings** may include:
- `"Viewport not initialized (0x0) - page may be loading or redirecting"`
- `"Page appears to be empty or transitional - wait for content to load"`
- `"Detected intermediate/redirect page - snapshot may not contain meaningful content"`
