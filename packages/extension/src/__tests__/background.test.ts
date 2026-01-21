/**
 * @btcp/extension - BackgroundAgent tests
 *
 * Tests for the BackgroundAgent class that orchestrates browser-level
 * operations in the extension's background script.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExtensionResponse } from '../types.js';

// Mock Chrome API
const mockChrome = {
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    sendMessage: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    reload: vi.fn(),
    captureVisibleTab: vi.fn(),
    group: vi.fn(),
  },
  tabGroups: {
    get: vi.fn(),
    update: vi.fn(),
    query: vi.fn().mockResolvedValue([]),
  },
  windows: {
    get: vi.fn(),
  },
  storage: {
    session: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
  runtime: {
    lastError: null as chrome.runtime.LastError | null,
    onMessage: {
      addListener: vi.fn(),
    },
  },
  scripting: {
    executeScript: vi.fn(),
  },
};

// Expose mock as global chrome
(globalThis as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;

// Now import the module (after chrome is mocked)
import { BackgroundAgent, getBackgroundAgent } from '../background.js';

describe('BackgroundAgent', () => {
  let agent: BackgroundAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;

    // Default mock implementations
    mockChrome.tabs.query.mockImplementation((_query, callback?) => {
      const tabs = [{ id: 1, url: 'https://example.com', title: 'Example', active: true, groupId: 100, windowId: 1 }];
      if (callback) {
        callback(tabs);
      }
      return Promise.resolve(tabs);
    });

    mockChrome.tabs.get.mockImplementation((tabId, callback) => {
      const tab = { id: tabId, url: 'https://example.com', status: 'complete', groupId: 100, windowId: 1 };
      if (callback) {
        callback(tab);
      }
      return Promise.resolve(tab);
    });

    mockChrome.tabs.create.mockImplementation((options, callback?) => {
      const tab = { id: 2, url: options?.url || 'about:blank', active: options?.active ?? true, windowId: 1 };
      if (callback) {
        callback(tab);
      }
      return Promise.resolve(tab);
    });

    mockChrome.tabs.update.mockImplementation((_tabId, _updateProps, callback) => {
      if (callback) callback();
    });

    mockChrome.tabs.remove.mockImplementation((_tabIds, callback) => {
      if (callback) callback();
    });

    mockChrome.tabs.goBack.mockImplementation((_tabId, callback) => {
      if (callback) callback();
    });

    mockChrome.tabs.goForward.mockImplementation((_tabId, callback) => {
      if (callback) callback();
    });

    mockChrome.tabs.reload.mockImplementation((_tabId, _options, callback) => {
      if (callback) callback();
    });

    mockChrome.tabs.group.mockImplementation((_options, callback?) => {
      if (callback) callback(100);
      return Promise.resolve(100);
    });

    mockChrome.tabGroups.get.mockResolvedValue({
      id: 100,
      title: 'BTCP Session 1',
      color: 'blue',
      collapsed: false,
      windowId: 1,
    });

    mockChrome.tabGroups.update.mockResolvedValue({});

    // Default: return empty array for tab groups query
    mockChrome.tabGroups.query.mockResolvedValue([]);

    mockChrome.windows.get.mockResolvedValue({ type: 'normal', id: 1 });

    mockChrome.storage.session.get.mockResolvedValue({});
    mockChrome.storage.session.set.mockResolvedValue(undefined);
    mockChrome.storage.session.remove.mockResolvedValue(undefined);

    mockChrome.scripting.executeScript.mockResolvedValue([{ result: true }]);

    agent = new BackgroundAgent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(agent).toBeDefined();
      expect(agent.getActiveTabId).toBeDefined();
      expect(agent.execute).toBeDefined();
    });
  });

  describe('getActiveTabId / setActiveTabId', () => {
    it('should get and set active tab ID', () => {
      agent.setActiveTabId(123);
      expect(agent.getActiveTabId()).toBe(123);
    });
  });

  describe('tab()', () => {
    it('should return a TabHandle for the specified tab', () => {
      const handle = agent.tab(456);
      expect(handle).toBeDefined();
      expect(handle.tabId).toBe(456);
      expect(handle.execute).toBeInstanceOf(Function);
      expect(handle.snapshot).toBeInstanceOf(Function);
      expect(handle.click).toBeInstanceOf(Function);
      expect(handle.fill).toBeInstanceOf(Function);
      expect(handle.type).toBeInstanceOf(Function);
      expect(handle.getText).toBeInstanceOf(Function);
      expect(handle.isVisible).toBeInstanceOf(Function);
    });
  });

  describe('listTabs', () => {
    it('should auto-create session when no active session exists', async () => {
      // Simulate no active session
      mockChrome.storage.session.get.mockResolvedValue({});
      mockChrome.tabGroups.query.mockResolvedValue([]);

      // Mock successful session creation
      mockChrome.tabs.create.mockImplementation((options, callback?) => {
        const tab = { id: 1, url: options?.url || 'about:blank', active: true, windowId: 1 };
        if (callback) callback(tab);
        return Promise.resolve(tab);
      });
      mockChrome.tabs.group.mockResolvedValue(100);
      mockChrome.tabs.query.mockImplementation((_query, callback?) => {
        const tabs = [{ id: 1, url: 'about:blank', title: 'New Tab', active: true, index: 0, groupId: 100, windowId: 1 }];
        if (callback) callback(tabs);
        return Promise.resolve(tabs);
      });

      const newAgent = new BackgroundAgent();

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 50));

      // listTabs should work now because session is auto-created
      const tabs = await newAgent.listTabs();
      expect(Array.isArray(tabs)).toBe(true);
    });
  });

  describe('closeTab', () => {
    it('should close tab in session', async () => {
      agent.setActiveTabId(1);
      await agent.closeTab();
      expect(mockChrome.tabs.remove).toHaveBeenCalledWith(1, expect.any(Function));
    });

    it('should throw error when no explicit tab ID and no activeTabId set', async () => {
      // Create agent without setting activeTabId
      const newAgent = new BackgroundAgent();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Clear the active tab ID
      newAgent.setActiveTabId(null as unknown as number);

      await expect(newAgent.closeTab()).rejects.toThrow('No tab to close');
    });
  });

  describe('back', () => {
    it('should call chrome.tabs.goBack', async () => {
      agent.setActiveTabId(1);
      await agent.back();
      expect(mockChrome.tabs.goBack).toHaveBeenCalledWith(1, expect.any(Function));
    });

    it('should auto-create session when no active tab', async () => {
      // Mock session auto-creation
      mockChrome.storage.session.get.mockResolvedValue({});
      mockChrome.tabGroups.query.mockResolvedValue([]);
      mockChrome.tabs.create.mockImplementation((options, callback?) => {
        const tab = { id: 1, url: options?.url || 'about:blank', active: true, windowId: 1 };
        if (callback) callback(tab);
        return Promise.resolve(tab);
      });
      mockChrome.tabs.group.mockResolvedValue(100);
      mockChrome.tabs.query.mockImplementation((_query, callback?) => {
        const tabs = [{ id: 1, url: 'about:blank', active: true, groupId: 100, windowId: 1 }];
        if (callback) callback(tabs);
        return Promise.resolve(tabs);
      });

      const newAgent = new BackgroundAgent();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Back should now work because session is auto-created
      await newAgent.back();
      expect(mockChrome.tabs.goBack).toHaveBeenCalled();
    });
  });

  describe('forward', () => {
    it('should call chrome.tabs.goForward', async () => {
      agent.setActiveTabId(1);
      await agent.forward();
      expect(mockChrome.tabs.goForward).toHaveBeenCalledWith(1, expect.any(Function));
    });
  });

  describe('reload', () => {
    it('should call chrome.tabs.reload', async () => {
      agent.setActiveTabId(1);
      await agent.reload();
      expect(mockChrome.tabs.reload).toHaveBeenCalled();
    });

    it('should pass bypassCache option', async () => {
      agent.setActiveTabId(1);
      await agent.reload({ bypassCache: true });
      expect(mockChrome.tabs.reload).toHaveBeenCalledWith(1, { bypassCache: true }, expect.any(Function));
    });
  });

  describe('screenshot', () => {
    it('should capture visible tab', async () => {
      mockChrome.tabs.captureVisibleTab.mockImplementation((_options, callback) => {
        callback('data:image/png;base64,ABC123');
      });

      const result = await agent.screenshot();
      expect(result).toBe('ABC123');
    });

    it('should support jpeg format', async () => {
      mockChrome.tabs.captureVisibleTab.mockImplementation((options, callback) => {
        expect(options.format).toBe('jpeg');
        callback('data:image/jpeg;base64,XYZ789');
      });

      const result = await agent.screenshot({ format: 'jpeg', quality: 80 });
      expect(result).toBe('XYZ789');
    });

    it('should handle capture errors', async () => {
      mockChrome.tabs.captureVisibleTab.mockImplementation((_options, callback) => {
        mockChrome.runtime.lastError = { message: 'Capture failed' };
        callback('');
        mockChrome.runtime.lastError = null;
      });

      await expect(agent.screenshot()).rejects.toThrow('Capture failed');
    });
  });

  describe('execute', () => {
    it('should handle navigate command - calls chrome.tabs.update', async () => {
      // Test that navigate calls chrome.tabs.update with the correct URL
      // The full navigation flow (waiting for load/idle) is tested separately
      agent.setActiveTabId(1);

      // Start navigate but don't await it fully - just verify tabs.update is called
      void agent.navigate('https://example.com');

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify tabs.update was called with the URL
      expect(mockChrome.tabs.update).toHaveBeenCalledWith(
        1,
        { url: 'https://example.com' },
        expect.any(Function)
      );

      // Clean up - don't wait for full completion since mocks aren't complete
      // The test passes if update was called correctly
    });

    it('should handle back command', async () => {
      agent.setActiveTabId(1);
      const response = await agent.execute({ action: 'back' });
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toEqual({ navigated: 'back' });
      }
    });

    it('should handle forward command', async () => {
      agent.setActiveTabId(1);
      const response = await agent.execute({ action: 'forward' });
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toEqual({ navigated: 'forward' });
      }
    });

    it('should handle reload command', async () => {
      agent.setActiveTabId(1);
      const response = await agent.execute({ action: 'reload' });
      expect(response.success).toBe(true);
    });

    it('should handle getUrl command', async () => {
      // Set up mock for the session/tab
      agent.setActiveTabId(1);
      mockChrome.tabGroups.query.mockResolvedValue([{ id: 100, title: 'BTCP Session 1' }]);
      mockChrome.tabs.query.mockImplementation((_query, callback?) => {
        const tabs = [{ id: 1, url: 'https://example.com', active: true, groupId: 100, windowId: 1 }];
        if (callback) callback(tabs);
        return Promise.resolve(tabs);
      });

      const response = await agent.execute({ action: 'getUrl' });
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toHaveProperty('url');
      }
    });

    it('should handle getTitle command', async () => {
      // Set up mock for the session/tab
      agent.setActiveTabId(1);
      mockChrome.tabGroups.query.mockResolvedValue([{ id: 100, title: 'BTCP Session 1' }]);
      mockChrome.tabs.query.mockImplementation((_query, callback?) => {
        const tabs = [{ id: 1, title: 'Example', active: true, groupId: 100, windowId: 1 }];
        if (callback) callback(tabs);
        return Promise.resolve(tabs);
      });

      const response = await agent.execute({ action: 'getTitle' });
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toHaveProperty('title');
      }
    });

    it('should handle screenshot command', async () => {
      mockChrome.tabs.captureVisibleTab.mockImplementation((_options, callback) => {
        callback('data:image/png;base64,ABC123');
      });

      const response = await agent.execute({ action: 'screenshot' });
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toHaveProperty('screenshot');
      }
    });

    it('should handle tabList command', async () => {
      // Need active session for tabList
      mockChrome.storage.session.get.mockResolvedValue({ btcp_active_session: { groupId: 100 } });
      mockChrome.tabs.query.mockImplementation((_options, callback?) => {
        const tabs = [
          { id: 1, url: 'https://example.com', title: 'Example', active: true, index: 0, groupId: 100, windowId: 1 },
        ];
        if (callback) callback(tabs);
        return Promise.resolve(tabs);
      });

      const newAgent = new BackgroundAgent();
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await newAgent.execute({ action: 'tabList' });
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toHaveProperty('tabs');
      }
    });

    it('should forward DOM commands to content agent', async () => {
      agent.setActiveTabId(1);

      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _msg, _options, callback) => {
        const response: ExtensionResponse = {
          type: 'btcp:response',
          response: { id: '1', success: true, data: 'snapshot tree' },
        };
        callback(response);
      });

      const response = await agent.execute({ action: 'snapshot' });
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
      expect(response.success).toBe(true);
    });

    it('should auto-create session for DOM commands when no session exists', async () => {
      // Mock session auto-creation
      mockChrome.storage.session.get.mockResolvedValue({});
      mockChrome.tabGroups.query.mockResolvedValue([]);
      mockChrome.tabs.create.mockImplementation((options, callback?) => {
        const tab = { id: 1, url: options?.url || 'about:blank', active: true, windowId: 1 };
        if (callback) callback(tab);
        return Promise.resolve(tab);
      });
      mockChrome.tabs.group.mockResolvedValue(100);
      mockChrome.tabs.query.mockImplementation((_query, callback?) => {
        const tabs = [{ id: 1, url: 'about:blank', active: true, groupId: 100, windowId: 1 }];
        if (callback) callback(tabs);
        return Promise.resolve(tabs);
      });
      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _msg, _options, callback) => {
        callback({
          type: 'btcp:response',
          response: { id: 'test', success: true, data: 'snapshot tree' },
        });
      });

      const newAgent = new BackgroundAgent();
      await new Promise(resolve => setTimeout(resolve, 50));

      // DOM commands should now work because session is auto-created
      const response = await newAgent.execute({ action: 'snapshot' });
      expect(response.success).toBe(true);
    });
  });

  describe('sendToContentAgent', () => {
    it('should send message to content script', async () => {
      agent.setActiveTabId(1);

      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _msg, _options, callback) => {
        const response: ExtensionResponse = {
          type: 'btcp:response',
          response: { id: 'test', success: true, data: { clicked: true } },
        };
        callback(response);
      });

      const response = await agent.sendToContentAgent({ id: 'test', action: 'click', selector: '#btn' });
      expect(response.success).toBe(true);
    });

    it('should handle message send failure with retry', async () => {
      agent.setActiveTabId(1);

      let callCount = 0;
      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _msg, _options, callback) => {
        callCount++;
        if (callCount === 1) {
          // First call fails
          mockChrome.runtime.lastError = { message: 'Could not establish connection' };
          callback(undefined);
          mockChrome.runtime.lastError = null;
        } else {
          // Second call succeeds
          callback({
            type: 'btcp:response',
            response: { id: 'test', success: true },
          });
        }
      });

      await agent.sendToContentAgent({ id: 'test', action: 'snapshot' });
      // Should have tried to re-inject content script
      expect(mockChrome.scripting.executeScript).toHaveBeenCalled();
    });

    it('should handle no response from content script', async () => {
      agent.setActiveTabId(1);

      mockChrome.tabs.sendMessage.mockImplementation((_tabId, _msg, _options, callback) => {
        callback(undefined); // No response, but no error
      });

      const response = await agent.sendToContentAgent({ id: 'test', action: 'snapshot' });
      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toHaveProperty('message');
      }
    });
  });
});

describe('getBackgroundAgent', () => {
  it('should return a singleton instance', () => {
    const agent1 = getBackgroundAgent();
    const agent2 = getBackgroundAgent();
    expect(agent1).toBe(agent2);
  });
});
