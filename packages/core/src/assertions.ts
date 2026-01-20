/**
 * @btcp/core - Assertions Module
 *
 * Provides verification utilities for DOM actions with async waiting support.
 * Returns structured results for consistent error handling.
 */

/**
 * Base interface for all action results
 * Provides unified success/error pattern across all DOM operations
 *
 * Use intersection types to add action-specific data:
 * @example
 * ```typescript
 * type ClickResult = ActionResult & { connected: boolean };
 * type GetTextResult = ActionResult & { text: string | null };
 * ```
 */
export interface ActionResult {
  /** Whether the action succeeded */
  success: boolean;
  /** Error message if action failed, null otherwise */
  error: string | null;
}

/**
 * Result of a single assertion check
 */
export interface AssertionResult {
  /** Whether the assertion succeeded */
  success: boolean;
  /** Error message if assertion failed, null otherwise */
  error: string | null;
  /** Human-readable description of what was checked */
  description: string;
  /** The expected value */
  expected: unknown;
  /** The actual value found */
  actual: unknown;
  /** Additional context information */
  context?: Record<string, unknown>;
}

/**
 * Options for waiting on an assertion
 */
export interface WaitForAssertionOptions {
  /** Maximum time to wait in milliseconds (default: 1000) */
  timeout?: number;
  /** Interval between checks in milliseconds (default: 50) */
  interval?: number;
}

/**
 * Result of waiting for an assertion
 */
export interface WaitResult {
  /** Whether the assertion passed within the timeout */
  success: boolean;
  /** Total time elapsed in milliseconds */
  elapsed: number;
  /** Number of attempts made */
  attempts: number;
  /** The final assertion result */
  result: AssertionResult;
}

// ============================================================================
// CORE ASSERTIONS
// ============================================================================

/**
 * Assert that an element is still connected to the DOM
 */
export function assertConnected(element: Element): AssertionResult {
  const connected = element.isConnected;
  return {
    success: connected,
    error: connected ? null : 'Element is not connected to DOM',
    description: 'Element should be connected to DOM',
    expected: true,
    actual: connected,
    context: {
      tagName: element.tagName,
    },
  };
}

/**
 * Assert that an input/textarea value contains the expected text
 */
export function assertValueContains(
  element: HTMLInputElement | HTMLTextAreaElement,
  text: string
): AssertionResult {
  const value = element.value;
  const contains = value.includes(text);
  return {
    success: contains,
    error: contains ? null : `Value "${value}" does not contain "${text}"`,
    description: 'Value should contain expected text',
    expected: text,
    actual: value,
    context: {
      tagName: element.tagName,
      inputType: element instanceof HTMLInputElement ? element.type : 'textarea',
    },
  };
}

/**
 * Assert that an input/textarea value equals the expected value exactly
 */
export function assertValueEquals(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): AssertionResult {
  const actualValue = element.value;
  const equals = actualValue === value;
  return {
    success: equals,
    error: equals ? null : `Value "${actualValue}" does not equal "${value}"`,
    description: 'Value should equal expected value',
    expected: value,
    actual: actualValue,
    context: {
      tagName: element.tagName,
      inputType: element instanceof HTMLInputElement ? element.type : 'textarea',
    },
  };
}

/**
 * Assert that a checkbox/radio is in the expected checked state
 */
export function assertChecked(
  element: HTMLInputElement,
  expected: boolean
): AssertionResult {
  const checked = element.checked;
  const matches = checked === expected;
  return {
    success: matches,
    error: matches ? null : `Element is ${checked ? 'checked' : 'unchecked'}, expected ${expected ? 'checked' : 'unchecked'}`,
    description: expected ? 'Element should be checked' : 'Element should be unchecked',
    expected,
    actual: checked,
    context: {
      tagName: element.tagName,
      inputType: element.type,
    },
  };
}

/**
 * Assert that a select element has the expected values selected
 */
export function assertSelected(
  element: HTMLSelectElement,
  values: string[]
): AssertionResult {
  const selectedValues = Array.from(element.selectedOptions).map(opt => opt.value);
  const missingValues = values.filter(v => !selectedValues.includes(v));
  const success = missingValues.length === 0;

  return {
    success,
    error: success ? null : `Options not selected: ${missingValues.join(', ')}`,
    description: 'Select should have expected options selected',
    expected: values,
    actual: selectedValues,
    context: {
      tagName: element.tagName,
      multiple: element.multiple,
      missingValues: missingValues.length > 0 ? missingValues : undefined,
    },
  };
}

/**
 * Assert that a URL matches the expected origin
 */
export function assertUrlOrigin(actualUrl: string, expectedUrl: string): AssertionResult {
  try {
    const actual = new URL(actualUrl);
    const expected = new URL(expectedUrl);
    const success = actual.origin === expected.origin;

    return {
      success,
      error: success ? null : `Origin mismatch: expected ${expected.origin}, got ${actual.origin}`,
      description: 'URL origin should match expected',
      expected: expected.origin,
      actual: actual.origin,
      context: {
        actualUrl,
        expectedUrl,
      },
    };
  } catch (error) {
    // URL parsing failed
    return {
      success: false,
      error: `URL parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      description: 'URL origin should match expected',
      expected: expectedUrl,
      actual: actualUrl,
      context: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Assert that an element is visible (or hidden)
 */
export function assertVisible(
  element: HTMLElement,
  win: Window,
  expected: boolean = true
): AssertionResult {
  const style = win.getComputedStyle(element);
  const visible =
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0';
  const success = visible === expected;

  return {
    success,
    error: success ? null : `Element is ${visible ? 'visible' : 'hidden'}, expected ${expected ? 'visible' : 'hidden'}`,
    description: expected ? 'Element should be visible' : 'Element should be hidden',
    expected,
    actual: visible,
    context: {
      tagName: element.tagName,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
    },
  };
}

/**
 * Assert that an element is enabled (or disabled)
 */
export function assertEnabled(
  element: HTMLElement,
  expected: boolean = true
): AssertionResult {
  const disabled = (element as HTMLInputElement).disabled ?? false;
  const enabled = !disabled;
  const success = enabled === expected;

  return {
    success,
    error: success ? null : `Element is ${enabled ? 'enabled' : 'disabled'}, expected ${expected ? 'enabled' : 'disabled'}`,
    description: expected ? 'Element should be enabled' : 'Element should be disabled',
    expected,
    actual: enabled,
    context: {
      tagName: element.tagName,
      disabled,
    },
  };
}

// ============================================================================
// ASYNC WAITING
// ============================================================================

/**
 * Wait for an assertion to pass within a timeout period
 *
 * Polls the assertion function at regular intervals until it passes
 * or the timeout is reached.
 *
 * @param assertFn - Function that returns an AssertionResult
 * @param options - Timeout and interval options
 * @returns WaitResult with success status and timing information
 *
 * @example
 * ```typescript
 * const result = await waitForAssertion(
 *   () => assertValueEquals(input, 'hello'),
 *   { timeout: 1000, interval: 50 }
 * );
 *
 * if (!result.success) {
 *   throw createVerificationError('fill', result, selector);
 * }
 * ```
 */
export async function waitForAssertion(
  assertFn: () => AssertionResult,
  options: WaitForAssertionOptions = {}
): Promise<WaitResult> {
  const { timeout = 1000, interval = 50 } = options;
  const startTime = Date.now();
  let attempts = 0;
  let lastResult: AssertionResult;

  while (Date.now() - startTime < timeout) {
    attempts++;
    lastResult = assertFn();

    if (lastResult.success) {
      return {
        success: true,
        elapsed: Date.now() - startTime,
        attempts,
        result: lastResult,
      };
    }

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  // Final attempt after timeout
  attempts++;
  lastResult = assertFn();

  return {
    success: lastResult.success,
    elapsed: Date.now() - startTime,
    attempts,
    result: lastResult,
  };
}
