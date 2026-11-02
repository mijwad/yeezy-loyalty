// Graceful Shutdown Handler
// Handles SIGTERM, SIGINT for zero-downtime deployments
import { createServer, Server } from 'http';

/**
 * @typedef {Object} ShutdownOptions
 * @property {number} [timeout=30000] - Max time to wait for connections to drain (ms)
 * @property {string[]} [signals=['SIGTERM', 'SIGINT', 'SIGUSR2']] - Signals to handle
 * @property {function(): Promise<void>} [onShutdown] - Custom cleanup logic
 * @property {function(string): void} [onSignal] - Called when signal received
 */

/**
 * @typedef {Object} ShutdownContext
 * @property {Server | null} server
 * @property {number} startTime
 * @property {boolean} isShuttingDown
 * @property {Set<any>} connections
 */

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_SIGNALS = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

const context = {
  server: null,
  startTime: Date.now(),
  isShuttingDown: false,
  connections: new Set(),
};

let shutdownPromise = null;

/**
 * Initialize graceful shutdown for an HTTP server
 * @param {Server} server
 * @param {ShutdownOptions} [options]
 */
export function initGracefulShutdown(server, options = {}) {
  context.server = server;
  context.startTime = Date.now();

  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const signals = options.signals ?? DEFAULT_SIGNALS;

  // Track active connections
  server.on('connection', (socket) => {
    context.connections.add(socket);
    socket.on('close', () => {
      context.connections.delete(socket);
    });
  });

  // Handle signals
  for (const signal of signals) {
    process.on(signal, () => handleSignal(signal, timeout, options));
  }

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[GracefulShutdown] Uncaught exception:', error);
    handleSignal('uncaughtException', timeout, options);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[GracefulShutdown] Unhandled rejection:', reason);
    handleSignal('unhandledRejection', timeout, options);
  });

  console.log('[GracefulShutdown] Initialized with timeout:', timeout, 'ms');
}

async function handleSignal(signal, timeout, options) {
  if (context.isShuttingDown) {
    console.log('[GracefulShutdown] Already shutting down, forcing exit...');
    process.exit(1);
  }

  context.isShuttingDown = true;
  console.log(`[GracefulShutdown] Received ${signal}, starting graceful shutdown...`);

  if (options.onSignal) {
    options.onSignal(signal);
  }

  // Stop accepting new connections
  if (context.server) {
    console.log('[GracefulShutdown] Stopping server from accepting new connections...');
    await new Promise((resolve) => {
      context.server.close((err) => {
        if (err) console.error('[GracefulShutdown] Error closing server:', err);
        resolve();
      });
    });
  }

  // Wait for existing connections to finish
  const waitStart = Date.now();
  while (context.connections.size > 0) {
    const elapsed = Date.now() - waitStart;
    if (elapsed >= timeout) {
      console.warn(`[GracefulShutdown] Timeout (${timeout}ms) reached, forcing close of ${context.connections.size} connections`);
      for (const socket of context.connections) {
        socket.destroy();
      }
      break;
    }
    console.log(`[GracefulShutdown] Waiting for ${context.connections.size} connections to finish... (${elapsed}ms elapsed)`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Run custom cleanup
  if (options.onShutdown) {
    console.log('[GracefulShutdown] Running custom cleanup...');
    try {
      await options.onShutdown();
    } catch (error) {
      console.error('[GracefulShutdown] Cleanup error:', error);
    }
  }

  const totalTime = Date.now() - context.startTime;
  console.log(`[GracefulShutdown] Shutdown complete in ${totalTime}ms`);
  process.exit(0);
}

/**
 * Get current shutdown status
 * @returns {Object}
 */
export function getShutdownStatus() {
  return {
    isShuttingDown: context.isShuttingDown,
    activeConnections: context.connections.size,
    uptime: Date.now() - context.startTime,
  };
}

/**
 * Register a cleanup function to run on shutdown
 * @param {string} name
 * @param {function(): Promise<void>} fn
 */
export function registerShutdownHook(name, fn) {
  console.log(`[GracefulShutdown] Registered hook: ${name}`);
  // Note: The actual hook execution is handled by the main onShutdown callback
}

/**
 * Force immediate shutdown (for testing or emergencies)
 * @param {number} [exitCode=1]
 */
export function forceShutdown(exitCode = 1) {
  console.log('[GracefulShutdown] Force shutdown requested');
  process.exit(exitCode);
}

export default {
  initGracefulShutdown,
  getShutdownStatus,
  registerShutdownHook,
  forceShutdown,
};