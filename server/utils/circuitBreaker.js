// Circuit Breaker for External API Calls
// Implements the Circuit Breaker pattern to prevent cascade failures

/** @enum {string} */
const CircuitState = {
  CLOSED: 'closed',     // Normal operation, requests go through
  OPEN: 'open',         // Failing, requests blocked
  HALF_OPEN: 'half_open' // Testing if service recovered
};

/**
 * @typedef {Object} CircuitBreakerOptions
 * @property {string} name
 * @property {number} [failureThreshold=5] - Failures before opening
 * @property {number} [successThreshold=2] - Successes in half-open before closing
 * @property {number} [timeout=30000] - Time in ms before half-open
 * @property {number} [rollingWindow=60000] - Time window for failure counting
 * @property {number} [minRequests=10] - Min requests in window before evaluating
 * @property {function(string, string): void} [onStateChange] - Called on state change
 * @property {function(Error): boolean} [isRetryableError] - Determines if error is retryable
 */

/**
 * @typedef {Object} FailureRecord
 * @property {number} timestamp
 * @property {Error} error
 */

export class CircuitBreaker {
  /**
   * @param {CircuitBreakerOptions} options
   */
  constructor(options) {
    /** @type {string} */
    this.state = CircuitState.CLOSED;
    /** @type {FailureRecord[]} */
    this.failures = [];
    /** @type {number} */
    this.successes = 0;
    /** @type {number} */
    this.lastStateChange = Date.now();
    /** @type {Required<CircuitBreakerOptions>} */
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 2,
      timeout: options.timeout ?? 30000,
      rollingWindow: options.rollingWindow ?? 60000,
      minRequests: options.minRequests ?? 10,
      onStateChange: options.onStateChange ?? (() => {}),
      isRetryableError: options.isRetryableError ?? (() => true),
      name: options.name,
    };
  }

  /**
   * @returns {string}
   */
  getState() {
    this.maybeTransitionToHalfOpen();
    return this.state;
  }

  /**
   * @returns {Object}
   */
  getStats() {
    this.cleanOldFailures();
    const totalRequests = this.failures.length + this.successes;
    const failureRate = totalRequests > 0 ? this.failures.length / totalRequests : 0;
    return {
      name: this.options.name,
      state: this.state,
      totalRequests,
      failures: this.failures.length,
      successes: this.successes,
      failureRate: Math.round(failureRate * 10000) / 100,
      lastStateChange: this.lastStateChange,
    };
  }

  /**
   * @template T
   * @param {() => Promise<T>} operation
   * @returns {Promise<T>}
   */
  async execute(operation) {
    const state = this.getState();

    if (state === CircuitState.OPEN) {
      throw new CircuitOpenError(
        `Circuit breaker ${this.options.name} is OPEN`,
        this.options.name,
        this.lastStateChange + this.options.timeout
      );
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  onSuccess() {
    this.successes++;
    this.cleanOldFailures();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  /**
   * @param {Error} error
   */
  onFailure(error) {
    // Only count retryable errors toward circuit breaker
    if (!this.options.isRetryableError(error)) {
      return;
    }

    this.failures.push({
      timestamp: Date.now(),
      error,
    });

    this.cleanOldFailures();

    const totalRequests = this.failures.length + this.successes;
    if (totalRequests >= this.options.minRequests) {
      const failureRate = this.failures.length / totalRequests;
      if (failureRate >= 0.5) { // 50% failure rate
        this.transitionTo(CircuitState.OPEN);
      }
    } else if (this.failures.length >= this.options.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  cleanOldFailures() {
    const cutoff = Date.now() - this.options.rollingWindow;
    this.failures = this.failures.filter(f => f.timestamp > cutoff);
  }

  maybeTransitionToHalfOpen() {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastStateChange >= this.options.timeout) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }
  }

  /**
   * @param {string} newState
   */
  transitionTo(newState) {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    this.successes = 0;
    if (newState === CircuitState.CLOSED) {
      this.failures = [];
    }
    console.log(`[CircuitBreaker] ${this.options.name}: ${oldState} -> ${newState}`);
    this.options.onStateChange(newState, this.options.name);
  }

  reset() {
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.successes = 0;
    this.lastStateChange = Date.now();
  }

  forceOpen() {
    this.transitionTo(CircuitState.OPEN);
  }

  forceClose() {
    this.transitionTo(CircuitState.CLOSED);
  }
}

export class CircuitOpenError extends Error {
  /**
   * @param {string} message
   * @param {string} circuitName
   * @param {number} retryAfter
   */
  constructor(message, circuitName, retryAfter) {
    super(message);
    this.name = 'CircuitOpenError';
    /** @type {string} */
    this.circuitName = circuitName;
    /** @type {number} */
    this.retryAfter = retryAfter;
  }
}

// ============================================================================
// CIRCUIT BREAKER REGISTRY
// ============================================================================

class CircuitBreakerRegistry {
  constructor() {
    /** @type {Map<string, CircuitBreaker>} */
    this.breakers = new Map();
  }

  /**
   * @param {string} name
   * @param {Partial<CircuitBreakerOptions>} [options]
   * @returns {CircuitBreaker}
   */
  getOrCreate(name, options) {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker({ name, ...options });
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  /**
   * @param {string} name
   * @returns {CircuitBreaker | undefined}
   */
  get(name) {
    return this.breakers.get(name);
  }

  /**
   * @returns {Object.<string, Object>}
   */
  getAllStats() {
    const stats = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// ============================================================================
// PRE-CONFIGURED BREAKERS FOR COMMON SERVICES
// ============================================================================

/**
 * @returns {CircuitBreaker}
 */
export function createSupabaseBreaker() {
  return circuitBreakerRegistry.getOrCreate('supabase', {
    failureThreshold: 10,
    timeout: 30000,
    isRetryableError: (error) => {
      // Don't retry auth errors, validation errors
      if (error.message?.includes('JWT') || error.message?.includes('auth')) return false;
      if (error.message?.includes('PGRST') && error.message?.includes('400')) return false;
      return true;
    },
  });
}

/**
 * @returns {CircuitBreaker}
 */
export function createWhatsAppBreaker() {
  return circuitBreakerRegistry.getOrCreate('whatsapp', {
    failureThreshold: 5,
    timeout: 60000,
    isRetryableError: (error) => {
      // Retry on network errors, 429, 5xx
      if (error.message?.includes('429')) return true;
      if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) return true;
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') return true;
      return false;
    },
  });
}

/**
 * @returns {CircuitBreaker}
 */
export function createPetpoojaBreaker() {
  return circuitBreakerRegistry.getOrCreate('petpooja', {
    failureThreshold: 5,
    timeout: 60000,
    isRetryableError: (error) => {
      if (error.message?.includes('429')) return true;
      if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) return true;
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') return true;
      return false;
    },
  });
}

/**
 * @returns {CircuitBreaker}
 */
export function createReeloBreaker() {
  return circuitBreakerRegistry.getOrCreate('reelo', {
    failureThreshold: 5,
    timeout: 60000,
    isRetryableError: (error) => {
      if (error.message?.includes('429')) return true;
      if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) return true;
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') return true;
      return false;
    },
  });
}

export default {
  CircuitBreaker,
  CircuitState,
  CircuitOpenError,
  circuitBreakerRegistry,
  createSupabaseBreaker,
  createWhatsAppBreaker,
  createPetpoojaBreaker,
  createReeloBreaker,
};