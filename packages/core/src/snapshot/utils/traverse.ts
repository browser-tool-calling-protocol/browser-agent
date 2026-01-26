/**
 * @btcp/core - Snapshot Traverse Utilities
 *
 * DOM traversal utilities using generators for memory-efficient iteration.
 */

import { isVisible } from './inspect.js';

// ============================================================================
// Traversal Options
// ============================================================================

export interface TraverseOptions {
  /** Maximum depth to traverse (default: 50) */
  maxDepth?: number;
  /** Include hidden elements (default: false) */
  includeHidden?: boolean;
  /** Check ancestor visibility in addition to element visibility (default: false) */
  checkAncestors?: boolean;
}

// ============================================================================
// Generator-Based Traversal
// ============================================================================

/**
 * Traverse all elements in a DOM subtree using a generator
 *
 * @param root - Root element to start traversal
 * @param options - Traversal options
 * @yields Elements in depth-first order
 */
export function* traverseElements(
  root: Element,
  options: TraverseOptions = {}
): Generator<{ element: Element; depth: number }> {
  const { maxDepth = 50, includeHidden = false, checkAncestors = false } = options;

  function* traverse(element: Element, depth: number): Generator<{ element: Element; depth: number }> {
    if (depth > maxDepth) return;
    if (!includeHidden && !isVisible(element, checkAncestors)) return;

    yield { element, depth };

    for (const child of element.children) {
      yield* traverse(child, depth + 1);
    }
  }

  yield* traverse(root, 0);
}

/**
 * Traverse elements in breadth-first order
 *
 * @param root - Root element to start traversal
 * @param options - Traversal options
 * @yields Elements in breadth-first order with depth info
 */
export function* traverseBreadthFirst(
  root: Element,
  options: TraverseOptions = {}
): Generator<{ element: Element; depth: number }> {
  const { maxDepth = 50, includeHidden = false, checkAncestors = false } = options;

  interface QueueItem {
    element: Element;
    depth: number;
  }

  const queue: QueueItem[] = [{ element: root, depth: 0 }];

  while (queue.length > 0) {
    const { element, depth } = queue.shift()!;

    if (depth > maxDepth) continue;
    if (!includeHidden && !isVisible(element, checkAncestors)) continue;

    yield { element, depth };

    // Add children to queue
    for (const child of element.children) {
      queue.push({ element: child, depth: depth + 1 });
    }
  }
}

// ============================================================================
// Filtered Traversal
// ============================================================================

/**
 * Traverse only interactive elements
 *
 * @param root - Root element to start traversal
 * @param predicate - Function to check if element is interactive
 * @param options - Traversal options
 * @yields Interactive elements with depth info
 */
export function* traverseInteractive(
  root: Element,
  predicate: (element: Element) => boolean,
  options: TraverseOptions = {}
): Generator<{ element: Element; depth: number }> {
  for (const item of traverseElements(root, options)) {
    if (predicate(item.element)) {
      yield item;
    }
  }
}

/**
 * Traverse landmark elements (main, nav, header, footer, etc.)
 *
 * @param root - Root element to start traversal
 * @param landmarkRoles - Set of landmark role names
 * @param getRole - Function to get element role
 * @param options - Traversal options
 * @yields Landmark elements with depth info
 */
export function* traverseLandmarks(
  root: Element,
  landmarkRoles: Set<string>,
  getRole: (element: Element) => string | null,
  options: TraverseOptions = {}
): Generator<{ element: Element; depth: number; role: string }> {
  for (const item of traverseElements(root, options)) {
    const role = getRole(item.element);
    if (role && landmarkRoles.has(role)) {
      yield { ...item, role };
    }
  }
}

/**
 * Traverse heading elements
 *
 * @param root - Root element to start traversal
 * @param options - Traversal options
 * @yields Heading elements with level info
 */
export function* traverseHeadings(
  root: Element,
  options: TraverseOptions = {}
): Generator<{ element: Element; depth: number; level: number }> {
  for (const item of traverseElements(root, options)) {
    const match = item.element.tagName.match(/^H([1-6])$/);
    if (match) {
      yield { ...item, level: parseInt(match[1]) };
    }
  }
}

// ============================================================================
// Collect Utilities
// ============================================================================

/**
 * Collect all elements from a traversal into an array
 *
 * @param root - Root element to start traversal
 * @param options - Traversal options
 * @returns Array of elements
 */
export function collectElements(root: Element, options: TraverseOptions = {}): Element[] {
  const elements: Element[] = [];
  for (const { element } of traverseElements(root, options)) {
    elements.push(element);
  }
  return elements;
}

/**
 * Collect elements matching a predicate
 *
 * @param root - Root element to start traversal
 * @param predicate - Function that returns true for elements to collect
 * @param options - Traversal options
 * @returns Array of matching elements
 */
export function collectMatching(
  root: Element,
  predicate: (element: Element) => boolean,
  options: TraverseOptions = {}
): Element[] {
  const elements: Element[] = [];
  for (const { element } of traverseElements(root, options)) {
    if (predicate(element)) {
      elements.push(element);
    }
  }
  return elements;
}

// ============================================================================
// Statistics Collection
// ============================================================================

/**
 * Count interactive descendants of an element
 *
 * @param element - Element to count descendants for
 * @param isInteractive - Function to check if element is interactive
 * @param getRole - Function to get element role
 * @returns Counts by category
 */
export function countInteractiveDescendants(
  element: Element,
  isInteractive: (el: Element) => boolean,
  getRole: (el: Element) => string | null
): { buttons: number; links: number; inputs: number; other: number } {
  const counts = { buttons: 0, links: 0, inputs: 0, other: 0 };
  const stack = [element];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (isVisible(current, false) && isInteractive(current)) {
      const role = getRole(current);
      const tag = current.tagName.toLowerCase();

      if (role === 'button' || tag === 'button') counts.buttons++;
      else if (role === 'link' || tag === 'a') counts.links++;
      else if (role === 'textbox' || role === 'searchbox' || role === 'combobox' || tag === 'input' || tag === 'textarea' || tag === 'select') counts.inputs++;
      else counts.other++;
    }

    // Add children to stack for traversal
    for (let i = current.children.length - 1; i >= 0; i--) {
      stack.push(current.children[i]);
    }
  }

  return counts;
}

/**
 * Count all elements in a subtree
 *
 * @param root - Root element to count from
 * @returns Total count of elements
 */
export function countElements(root: Element): number {
  let count = 0;
  for (const _ of traverseElements(root, { maxDepth: 1000, includeHidden: true })) {
    count++;
  }
  return count;
}
