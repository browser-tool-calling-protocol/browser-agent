# Snapshot Content Extraction API Design

## Overview

This document describes the design for AI-driven content extraction from web pages. The system enables AI agents to reactively explore and extract page content through a two-phase approach:

1. **Outline Phase**: Get structural overview with semantic xpaths
2. **Extract Phase**: Extract content using xpath pattern matching

This design follows the principle of **reactive summarization** - letting the AI agent decide what to extract based on the page structure, rather than using a fixed extraction strategy.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       AI Agent                                   │
│  "I need to understand this page and extract relevant info"     │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────┐         ┌──────────────────────┐
│  snapshot            │         │  extract             │
│  mode: 'outline'     │ ──────▶ │  xpathGrep: pattern  │
│                      │         │                      │
│  Returns:            │         │  Returns:            │
│  - Page structure    │         │  - Markdown content  │
│  - Semantic xpaths   │         │  - From matched      │
│  - Section metadata  │         │    xpath patterns    │
└──────────────────────┘         └──────────────────────┘
              │                               │
              ▼                               ▼
        AI analyzes                    Structured pieces
        decides what                   ready for
        to extract                     summarization
```

## Phase 1: Snapshot Outline Mode

### Purpose

Provide AI agents with a structural overview of the page content, including:
- Landmark regions (header, main, footer, nav)
- Content sections with semantic identifiers
- Headings hierarchy
- Word counts and content indicators
- Semantic xpaths for targeting extraction

### Usage

```typescript
const outline = await client.snapshot({ mode: 'outline' });
```

### Output Format

```
PAGE: https://example.com/article | Article Title | viewport=1920x1080
OUTLINE: landmarks=4 sections=6 headings=8 words=2450

BANNER [45 words, 8 links] /header
  NAVIGATION "Main menu" /header/nav
MAIN [2200 words] /main
  HEADING level=1 "Understanding AI Agents" /main/article/h1
  REGION "intro" [320 words] /main/article/section.intro
    PARAGRAPH [2 paragraphs] /main/article/section.intro/p
  REGION "content" [1400 words] /main/article/section.content
    HEADING level=2 "What are AI Agents?" /main/article/section.content/h2
    PARAGRAPH [4 paragraphs] /main/article/section.content/p
    LIST [5 items] /main/article/section.content/ul
    HEADING level=2 "How They Work" /main/article/section.content/h2[2]
    PARAGRAPH [3 paragraphs] /main/article/section.content/p
    CODE [45 lines] /main/article/section.content/pre
  REGION "reviews" [480 words] /main/article/section.reviews
    HEADING level=2 "Reader Comments" /main/article/section.reviews/h2
    ARTICLE "Comment 1..." [preview] /main/article/section.reviews/article[1]
    ARTICLE "Comment 2..." [preview] /main/article/section.reviews/article[2]
    TEXT "+15 more comments"
ASIDE [200 words] /aside
  HEADING level=3 "Related Articles" /aside/h3
  LIST [4 items] /aside/ul
CONTENTINFO [85 words] /footer
```

### Output Components

#### Header Line
```
PAGE: {url} | {title} | viewport={width}x{height}
OUTLINE: landmarks={n} sections={n} headings={n} words={n}
```

#### Element Lines
```
{ROLE} ["name"] [{metadata}] {xpath}
```

| Component | Description |
|-----------|-------------|
| `ROLE` | Landmark or element role (MAIN, HEADING, PARAGRAPH, LIST, etc.) |
| `"name"` | Optional label or preview text |
| `[metadata]` | Word count, item count, link count, etc. |
| `xpath` | Semantic xpath for extraction targeting |

#### Metadata Indicators

| Indicator | Meaning |
|-----------|---------|
| `[N words]` | Approximate word count in section |
| `[N items]` | Number of list items |
| `[N links]` | Number of links in section |
| `[N paragraphs]` | Number of paragraph elements |
| `[preview]` | Content is truncated, more available |
| `[truncated]` | Section exceeds display limit |

### Semantic XPath Format

XPaths use semantic HTML tags and meaningful identifiers:

```
/main/article/section.content/h2[2]
│     │       │              │
│     │       │              └─ Index if multiple siblings
│     │       └─ Semantic class or id
│     └─ Semantic tag
└─ Landmark
```

**Included in xpath:**
- Semantic HTML5 tags: `main`, `article`, `section`, `nav`, `header`, `footer`, `aside`
- Content tags: `h1`-`h6`, `p`, `ul`, `ol`, `li`, `pre`, `code`, `blockquote`
- IDs: `#identifier`
- Semantic classes: `.content`, `.intro`, `.reviews` (filtered for meaningful names)
- Sibling index: `[n]` when multiple same-tag siblings exist

**Excluded from xpath:**
- Generic `div`/`span` without semantic meaning
- Utility CSS classes (Tailwind, Bootstrap utilities)
- Auto-generated or hash-based identifiers

## Phase 2: Extract Action

### Purpose

Extract actual text content from the page using xpath pattern matching. The AI agent uses patterns derived from the outline to target specific content areas.

### Usage

```typescript
const content = await client.extract({
  xpathGrep: 'article|section.content|/main'
});
```

### Command Interface

```typescript
interface ExtractCommand extends BaseCommand {
  action: 'extract';

  // Primary: xpath pattern matching (pipe-separated patterns)
  xpathGrep?: string;

  // Alternative: specific refs from snapshot
  refs?: string[];

  // Alternative: CSS selector
  selector?: string;

  // Output options
  format?: 'markdown' | 'text' | 'json';
  maxLength?: number;      // Max chars per section (default: 2000)
  includeLinks?: boolean;  // Include [text](url) in markdown (default: true)
  includeImages?: boolean; // Include ![alt](src) in markdown (default: false)
}
```

### XPath Grep Pattern Matching

The `xpathGrep` parameter accepts pipe-separated patterns that match against semantic xpaths from the outline.

#### Pattern Syntax

```
pattern1|pattern2|pattern3
```

Each pattern is matched against the xpath of each element. Matching uses substring/regex matching.

#### Pattern Examples

| Pattern | Matches |
|---------|---------|
| `article` | Any xpath containing "article" |
| `section.content` | Sections with class "content" |
| `/main/` | Direct children of main |
| `h[1-3]` | Headings h1, h2, h3 (regex) |
| `section\|article` | Sections or articles |
| `reviews\|comments` | Review or comment sections |

#### Matching Rules

1. Patterns are case-insensitive by default
2. Each pattern is tested as a substring match
3. Patterns starting with `^` match from xpath start
4. Patterns ending with `$` match xpath end
5. Regex special chars work: `h[1-3]`, `section.*content`

### Output Format: Markdown

Default output format optimized for AI consumption.

```markdown
# Understanding AI Agents

> Extracted from: /main/article

## Introduction

AI agents are autonomous software entities that can perceive their environment,
make decisions, and take actions to achieve specific goals. Unlike traditional
programs that follow predetermined scripts, AI agents adapt their behavior
based on the situations they encounter.

## What are AI Agents?

An AI agent consists of several key components:

- **Perception**: Ability to observe and interpret the environment
- **Reasoning**: Processing observations to make decisions
- **Action**: Executing decisions to affect the environment
- **Learning**: Improving performance over time

The fundamental difference between an AI agent and a simple program is
autonomy. While a script executes a fixed sequence of operations, an agent
chooses its actions based on its current understanding of the world.

## How They Work

AI agents operate in a continuous loop:

1. Observe the current state
2. Evaluate possible actions
3. Select the best action
4. Execute the action
5. Learn from the outcome

```python
class Agent:
    def run(self):
        while not self.done:
            state = self.observe()
            action = self.decide(state)
            result = self.execute(action)
            self.learn(state, action, result)
```

---

*Extracted 1,847 words from 3 sections*
```

### Output Format: JSON

Structured output for programmatic processing.

```json
{
  "sections": [
    {
      "xpath": "/main/article/section.intro",
      "heading": "Introduction",
      "content": "AI agents are autonomous software entities...",
      "wordCount": 320,
      "links": [
        { "text": "AI overview", "href": "/docs/ai" }
      ]
    },
    {
      "xpath": "/main/article/section.content",
      "heading": "What are AI Agents?",
      "content": "An AI agent consists of several key components...",
      "wordCount": 1400,
      "lists": [
        {
          "type": "unordered",
          "items": ["Perception: Ability to observe...", "..."]
        }
      ],
      "code": [
        { "language": "python", "content": "class Agent:..." }
      ]
    }
  ],
  "metadata": {
    "url": "https://example.com/article",
    "title": "Understanding AI Agents",
    "totalWords": 2200,
    "sectionsExtracted": 3,
    "patternsMatched": ["article", "section.content"]
  }
}
```

### Output Format: Text

Plain text without formatting, useful for simple extraction.

```
Understanding AI Agents

Introduction

AI agents are autonomous software entities that can perceive their environment,
make decisions, and take actions to achieve specific goals.

What are AI Agents?

An AI agent consists of several key components:
- Perception: Ability to observe and interpret the environment
- Reasoning: Processing observations to make decisions
- Action: Executing decisions to affect the environment
- Learning: Improving performance over time

...
```

## AI Agent Workflow

### System Prompt Template

```
You are a content extraction agent. Your task is to extract relevant
information from web pages for downstream summarization.

Available actions:
- snapshot({ mode: 'outline' }) - Get page structure with xpaths
- extract({ xpathGrep: 'pattern' }) - Extract content matching xpath patterns

Workflow:
1. Call snapshot({ mode: 'outline' }) to understand page structure
2. Analyze the outline to identify relevant content sections
3. Construct xpathGrep patterns to target those sections
4. Call extract({ xpathGrep: 'your|patterns' }) to get content
5. Return extracted markdown for summarization

Pattern tips:
- Use 'article|main' for main content
- Use 'section.reviews|comments' for user content
- Use 'h[1-2]' for top-level headings only
- Combine patterns with | for multiple targets

You extract content. You do NOT summarize. Return the markdown as-is.
```

### Example Session

```
Agent: I'll analyze the page structure first.

> snapshot({ mode: 'outline' })

PAGE: https://docs.example.com/api | API Reference | viewport=1920x1080
OUTLINE: landmarks=3 sections=12 headings=24 words=4500

MAIN [4200 words] /main
  HEADING level=1 "API Reference" /main/h1
  REGION "overview" [300 words] /main/section#overview
    HEADING level=2 "Overview" /main/section#overview/h2
    PARAGRAPH [2 paragraphs] /main/section#overview/p
  REGION "authentication" [450 words] /main/section#auth
    HEADING level=2 "Authentication" /main/section#auth/h2
    CODE [25 lines] /main/section#auth/pre
  REGION "endpoints" [2800 words] /main/section#endpoints
    HEADING level=2 "Endpoints" /main/section#endpoints/h2
    REGION "users-api" [800 words] /main/section#endpoints/section.users
      HEADING level=3 "Users API" /main/section#endpoints/section.users/h3
      ...
    REGION "orders-api" [1200 words] /main/section#endpoints/section.orders
      ...
ASIDE [300 words] /aside
  HEADING level=3 "Quick Links" /aside/h3
  LIST [8 items] /aside/ul

Agent: This is API documentation. The user asked about authentication,
so I'll extract the auth section and overview.

> extract({ xpathGrep: 'section#overview|section#auth', format: 'markdown' })

# API Reference

## Overview

The Example API provides programmatic access to all platform features.
This RESTful API uses JSON for request and response bodies.

Base URL: `https://api.example.com/v1`

## Authentication

All API requests require authentication using an API key.

Include your API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.example.com/v1/users
```

To generate an API key:
1. Go to Settings > API Keys
2. Click "Generate New Key"
3. Copy and store the key securely

---

*Extracted 750 words from 2 sections*

Agent: Here is the extracted content about API authentication and overview.
```

## Implementation Notes

### Outline Mode Implementation

Location: `packages/core/src/snapshot.ts`

Key additions:
1. New `mode: 'outline'` option in `SnapshotOptions`
2. Content role detection (headings, paragraphs, lists, etc.)
3. Word count calculation per section
4. Hierarchical output with indentation
5. Enhanced semantic xpath generation

### Extract Action Implementation

Location: `packages/core/src/extract.ts` (new file)

Key components:
1. XPath pattern parser and matcher
2. Content extraction from matched elements
3. Markdown formatter
4. Text content cleaner (whitespace normalization)
5. Link and image extraction

### Type Definitions

Location: `packages/core/src/types.ts`

```typescript
// Snapshot mode extension
type SnapshotMode = 'interactive' | 'outline';

interface SnapshotOptions {
  mode?: SnapshotMode;
  // ... existing options
}

// New extract action
interface ExtractCommand extends BaseCommand {
  action: 'extract';
  xpathGrep?: string;
  refs?: string[];
  selector?: string;
  format?: 'markdown' | 'text' | 'json';
  maxLength?: number;
  includeLinks?: boolean;
  includeImages?: boolean;
}

interface ExtractResult {
  content: string;  // Formatted content (markdown/text)
  sections: ExtractSection[];
  metadata: ExtractMetadata;
}

interface ExtractSection {
  xpath: string;
  heading?: string;
  content: string;
  wordCount: number;
  links?: Array<{ text: string; href: string }>;
  images?: Array<{ alt: string; src: string }>;
  lists?: Array<{ type: 'ordered' | 'unordered'; items: string[] }>;
  code?: Array<{ language?: string; content: string }>;
}

interface ExtractMetadata {
  url: string;
  title: string;
  totalWords: number;
  sectionsExtracted: number;
  patternsMatched: string[];
}
```

## Design Decisions

### Why Outline + Extract (not just enhanced snapshot)?

1. **Separation of concerns**: Outline is cheap (metadata only), extract is expensive (full text)
2. **AI agency**: Agent decides what to extract based on outline analysis
3. **Token efficiency**: Don't send full page content when only structure is needed
4. **Reactive pattern**: Matches how humans skim then read

### Why xpathGrep patterns (not CSS selectors)?

1. **Semantic meaning**: Xpaths from outline carry semantic context
2. **Pattern matching**: Easy to express "any section about reviews"
3. **AI-friendly**: Natural language maps well to xpath patterns
4. **Composable**: Pipe-separated patterns allow flexible targeting

### Why Markdown output (not just JSON)?

1. **AI consumption**: LLMs work well with markdown structure
2. **Readable**: Human-debuggable output
3. **Compact**: Less tokens than verbose JSON
4. **Structured enough**: Headers, lists, code blocks preserved

## Future Considerations

- **Streaming extraction**: For very large pages, stream sections
- **Caching**: Cache outline between extract calls
- **Smart truncation**: Summarize middle content, keep start/end
- **Content scoring**: Rank sections by relevance to query
- **Multi-page**: Extract across paginated content
