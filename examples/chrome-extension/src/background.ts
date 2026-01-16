/**
 * Background Script - routes messages between popup and content scripts
 *
 * This single call sets up:
 * - BackgroundAgent for browser operations (tabs, navigation, screenshots)
 * - Message routing to ContentAgent in tabs
 */
import { setupMessageListener } from 'btcp-browser-agent/extension';

setupMessageListener();

console.log('[BTCP] Background ready');
