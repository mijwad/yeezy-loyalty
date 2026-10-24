/**
 * POS Adapter Interface - Base class for all POS integrations
 * Each POS system implements this interface for standardized integration
 */

export class POSAdapter {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name.replace('Adapter', '').toLowerCase();
  }

  /**
   * Verify incoming webhook authenticity
   * @param {Request} req - Express request object
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async verifyWebhook(req) {
    throw new Error('verifyWebhook() must be implemented by subclass');
  }

  /**
   * Parse inquire/balance check request
   * @param {Request} req - Express request object
   * @returns {Promise<InquireRequest>}
   */
  async parseInquireRequest(req) {
    throw new Error('parseInquireRequest() must be implemented by subclass');
  }

  /**
   * Parse lock/hold points request
   * @param {Request} req - Express request object
   * @returns {Promise<LockRequest>}
   */
  async parseLockRequest(req) {
    throw new Error('parseLockRequest() must be implemented by subclass');
  }

  /**
   * Parse order save/settlement request
   * @param {Request} req - Express request object
   * @returns {Promise<OrderSaveRequest>}
   */
  async parseOrderSaveRequest(req) {
    throw new Error('parseOrderSaveRequest() must be implemented by subclass');
  }

  /**
   * Parse cancel/void request
   * @param {Request} req - Express request object
   * @returns {Promise<CancelRequest>}
   */
  async parseCancelRequest(req) {
    throw new Error('parseCancelRequest() must be implemented by subclass');
  }

  /**
   * Format inquire response for POS
   * @param {Object} data - Internal response data
   * @returns {Object} POS-specific response
   */
  formatInquireResponse(data) {
    throw new Error('formatInquireResponse() must be implemented by subclass');
  }

  /**
   * Format lock response for POS
   * @param {Object} data - Internal response data
   * @returns {Object} POS-specific response
   */
  formatLockResponse(data) {
    throw new Error('formatLockResponse() must be implemented by subclass');
  }

  /**
   * Format order save response for POS
   * @param {Object} data - Internal response data
   * @returns {Object} POS-specific response
   */
  formatOrderSaveResponse(data) {
    throw new Error('formatOrderSaveResponse() must be implemented by subclass');
  }

  /**
   * Format cancel response for POS
   * @param {Object} data - Internal response data
   * @returns {Object} POS-specific response
   */
  formatCancelResponse(data) {
    throw new Error('formatCancelResponse() must be implemented by subclass');
  }

  /**
   * Get unique identifier for this POS system
   * @returns {string}
   */
  getIdentifier() {
    return this.name;
  }

  /**
   * Get supported webhook events
   * @returns {string[]}
   */
  getSupportedEvents() {
    return ['inquire', 'lock', 'order_save', 'cancel'];
  }
}

/**
 * Standardized internal request/response types
 */

/** @typedef {Object} InquireRequest
 * @property {string} restaurantId - POS restaurant identifier
 * @property {string} phone - Customer phone in E.164 format
 * @property {string} [name] - Customer name
 * @property {number} [billAmount] - Bill amount in paise
 * @property {string} [orderId] - Order identifier
 * @property {string} [tableNo] - Table number
 * @property {string} [serverName] - Server/waiter name
 * @property {Array} [items] - Order items
 */

/** @typedef {Object} LockRequest
 * @property {string} sessionToken - Redemption session token
 * @property {string} [optionId] - Selected redemption option ID
 * @property {number} [customPoints] - Custom points to redeem
 */

/** @typedef {Object} OrderSaveRequest
 * @property {string} restaurantId - POS restaurant identifier
 * @property {string} orderId - Order identifier
 * @property {string} billNo - Bill number
 * @property {string} [tableNo] - Table number
 * @property {string} [serverName] - Server name
 * @property {Object} customer - Customer info {phone, name}
 * @property {Object} financials - Financial details
 * @property {number} financials.subtotal - Subtotal in paise
 * @property {number} [financials.tax] - Tax in paise
 * @property {number} [financials.grossAmount] - Gross amount in paise
 * @property {number} [financials.loyaltyDiscount] - Loyalty discount in paise
 * @property {number} [financials.netPaid] - Net paid in paise
 * @property {string} [financials.paymentMode] - Payment mode
 * @property {string} [redemptionSessionToken] - Redemption session token
 * @property {Array} [items] - Order items
 */

/** @typedef {Object} CancelRequest
 * @property {string} restaurantId - POS restaurant identifier
 * @property {string} orderId - Order identifier
 * @property {string} [reason] - Cancellation reason
 */

export default POSAdapter;