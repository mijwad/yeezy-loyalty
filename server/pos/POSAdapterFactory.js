/**
 * POS Adapter Factory
 * Manages registration and instantiation of POS adapters
 */
import { PetpoojaAdapter } from './PetpoojaAdapter.js';
import { RMSAdapter } from './RMSAdapter.js';

class POSAdapterFactory {
  constructor() {
    this.adapters = new Map();
    this.defaultConfig = {};
  }

  /**
   * Register a POS adapter class
   * @param {string} posSystem - POS system identifier (e.g., 'petpooja', 'toast', 'square')
   * @param {class} AdapterClass - Adapter class extending POSAdapter
   * @param {Object} config - Configuration for this adapter
   */
  register(posSystem, AdapterClass, config = {}) {
    this.adapters.set(posSystem.toLowerCase(), { AdapterClass, config });
  }

  /**
   * Get adapter instance for a POS system
   * @param {string} posSystem - POS system identifier
   * @returns {POSAdapter} Adapter instance
   */
  getAdapter(posSystem) {
    const key = posSystem.toLowerCase();
    const entry = this.adapters.get(key);

    if (!entry) {
      throw new Error(`No adapter registered for POS system: ${posSystem}`);
    }

    // Create new instance each time to avoid state issues
    return new entry.AdapterClass({ ...this.defaultConfig, ...entry.config });
  }

  /**
   * Get all registered POS systems
   * @returns {string[]}
   */
  getRegisteredSystems() {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a POS system is registered
   * @param {string} posSystem
   * @returns {boolean}
   */
  hasAdapter(posSystem) {
    return this.adapters.has(posSystem.toLowerCase());
  }

  /**
   * Set default configuration for all adapters
   * @param {Object} config
   */
  setDefaultConfig(config) {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }
}

// Singleton instance
export const posAdapterFactory = new POSAdapterFactory();

// Register built-in adapters
posAdapterFactory.register('petpooja', PetpoojaAdapter, {
  webhookSecret: process.env.PETPOOJA_WEBHOOK_SECRET,
  apiKey: process.env.PETPOOJA_API_KEY
});

posAdapterFactory.register('rms', RMSAdapter, {
  webhookSecret: process.env.RMS_WEBHOOK_SECRET,
  apiKey: process.env.RMS_API_KEY
});

// Export registration function for future POS systems
export function registerPOSAdapter(posSystem, AdapterClass, config) {
  posAdapterFactory.register(posSystem, AdapterClass, config);
}

export default posAdapterFactory;