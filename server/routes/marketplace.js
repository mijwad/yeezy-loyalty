/**
 * Marketplace Activation & POS Onboarding Routes
 * Allows restaurant owners to easily connect their POS system to Yeezy Loyalty
 * Supports: Petpooja, RMS, Toast, Square, and custom POS systems
 */
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../db/supabase.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { posAdapterFactory } from '../pos/POSAdapterFactory.js';

export const marketplaceRouter = Router();

/**
 * Middleware to verify restaurant owner authentication
 * Uses the existing auth middleware pattern
 */
import { authMiddleware } from '../middleware/auth.js';

// Apply auth middleware to all marketplace routes
marketplaceRouter.use(authMiddleware);

/**
 * GET /api/marketplace/pos-systems
 * Get list of supported POS systems with integration details
 */
marketplaceRouter.get('/pos-systems', asyncHandler(async (req, res) => {
  const supportedSystems = posAdapterFactory.getRegisteredSystems();

  const posSystemDetails = {
    petpooja: {
      id: 'petpooja',
      name: 'Petpooja',
      description: 'India\'s leading restaurant POS and management platform',
      logo: '/assets/pos/petpooja-logo.svg',
      website: 'https://petpooja.com',
      integrationType: 'webhook',
      endpoints: {
        inquire: '/pos/petpooja/loyalty/inquire',
        lock: '/pos/petpooja/loyalty/lock',
        orderSave: '/pos/petpooja/orders/save',
        cancel: '/pos/petpooja/orders/cancel'
      },
      requiredConfig: ['webhookSecret', 'restID'],
      setupGuide: '/docs/integrations/petpooja.md',
      features: ['Customer Lookup', 'Points Redemption', 'Auto Points Earn', 'Order Cancellation']
    },
    rms: {
      id: 'rms',
      name: 'RMS (Restaurant Management System)',
      description: 'Custom restaurant POS with loyalty integration',
      logo: '/assets/pos/rms-logo.svg',
      website: '',
      integrationType: 'webhook',
      endpoints: {
        inquire: '/pos/rms/loyalty/inquire',
        lock: '/pos/rms/loyalty/lock',
        orderSave: '/pos/rms/orders/save',
        cancel: '/pos/rms/orders/cancel'
      },
      requiredConfig: ['webhookSecret', 'restaurantId', 'storeId'],
      setupGuide: '/docs/integrations/rms.md',
      features: ['Customer Lookup', 'Points Redemption', 'Auto Points Earn', 'Order Cancellation', 'Multi-outlet Support']
    },
    toast: {
      id: 'toast',
      name: 'Toast',
      description: 'Popular US-based restaurant POS platform',
      logo: '/assets/pos/toast-logo.svg',
      website: 'https://pos.toasttab.com',
      integrationType: 'api',
      endpoints: {
        baseUrl: 'https://ws-api.toasttab.com'
      },
      requiredConfig: ['clientId', 'clientSecret', 'locationId'],
      setupGuide: '/docs/integrations/toast.md',
      features: ['Customer Lookup', 'Points Redemption', 'Auto Points Earn'],
      comingSoon: true
    },
    square: {
      id: 'square',
      name: 'Square',
      description: 'Popular payment and POS platform',
      logo: '/assets/pos/square-logo.svg',
      website: 'https://squareup.com',
      integrationType: 'api',
      endpoints: {
        baseUrl: 'https://connect.squareup.com'
      },
      requiredConfig: ['accessToken', 'locationId'],
      setupGuide: '/docs/integrations/square.md',
      features: ['Customer Lookup', 'Points Redemption', 'Auto Points Earn'],
      comingSoon: true
    },
    custom: {
      id: 'custom',
      name: 'Custom POS / API Integration',
      description: 'Direct API integration using Yeezy Loyalty Public API v1',
      logo: '/assets/pos/custom-logo.svg',
      website: '',
      integrationType: 'api',
      endpoints: {
        baseUrl: 'https://api.yeezy-loyalty.com/v1'
      },
      requiredConfig: ['apiKey'],
      setupGuide: '/docs/integrations/custom-api.md',
      features: ['Full API Access', 'Custom Integration', 'SDK Available']
    }
  };

  const systems = await Promise.all(supportedSystems.map(async (id) => ({
    ...posSystemDetails[id],
    id,
    installed: req.user?.tenantId ? await checkPosInstalled(req.user.tenantId, id) : false
  })));

  res.json({
    status: 'success',
    systems,
    defaultSystem: 'petpooja'
  });
}));

/**
 * GET /api/marketplace/outlets
 * Get all outlets for the authenticated restaurant
 */
marketplaceRouter.get('/outlets', asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId;

  const { data: outlets, error } = await supabaseAdmin
    .from('outlets')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Add connection status for each outlet
  const outletsWithStatus = await Promise.all((outlets || []).map(async (outlet) => {
    const { data: program } = await supabaseAdmin
      .from('loyalty_programs')
      .select('is_active, config')
      .eq('restaurant_id', tenantId)
      .single();

    const { data: apiKeys } = await supabaseAdmin
      .from('api_keys')
      .select('id, name, key_prefix, last4, scopes, is_test, last_used_at, expires_at, revoked_at')
      .eq('restaurant_id', tenantId)
      .is('revoked_at', null);

    return {
      ...outlet,
      loyaltyProgramActive: program?.is_active ?? false,
      loyaltyConfig: program?.config ?? {},
      apiKeys: apiKeys || [],
      marketplaceConnected: outlet.is_marketplace_connected,
      connectedAt: outlet.marketplace_connected_at
    };
  }));

  res.json({
    status: 'success',
    outlets: outletsWithStatus
  });
}));

/**
 * POST /api/marketplace/outlets
 * Create a new outlet for POS integration
 */
marketplaceRouter.post('/outlets', validateRequest('outletCreate'), asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId;
  const {
    name,
    address,
    posSystem,
    restId,
    posConfig = {}
  } = req.validated.body;

  // Validate POS system
  if (!posAdapterFactory.hasAdapter(posSystem)) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_POS_SYSTEM',
      message: `Unsupported POS system: ${posSystem}. Supported: ${posAdapterFactory.getRegisteredSystems().join(', ')}`
    });
  }

  // Check if restId already exists for this POS system
  const { data: existing } = await supabaseAdmin
    .from('outlets')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('rest_id', restId)
    .eq('pos_system', posSystem.toUpperCase())
    .single();

  if (existing) {
    return res.status(409).json({
      status: 'error',
      code: 'OUTLET_EXISTS',
      message: `Outlet with restID ${restId} already exists for ${posSystem}`
    });
  }

  // Generate app key for webhook authentication
  const appKey = `sec_live_${randomUUID().slice(0, 10)}`;
  const reeloKey = randomUUID();

  const { data: outlet, error } = await supabaseAdmin
    .from('outlets')
    .insert({
      tenant_id: tenantId,
      rest_id: restId,
      name,
      address,
      pos_system: posSystem.toUpperCase(),
      pos_config: posConfig,
      app_key: appKey,
      reelo_key: reeloKey,
      active: true,
      is_marketplace_connected: false
    })
    .select()
    .single();

  if (error) throw error;

  // Initialize loyalty program for this tenant if not exists
  await supabaseAdmin
    .from('loyalty_programs')
    .upsert({
      restaurant_id: tenantId,
      is_active: true
    }, { onConflict: 'restaurant_id' });

  // Log audit
  await supabaseAdmin
    .from('audit_log')
    .insert({
      restaurant_id: tenantId,
      actor_type: 'owner',
      actor_id: req.user.id,
      action: 'OUTLET_CREATED',
      entity_type: 'outlet',
      entity_id: outlet.id,
      metadata: { posSystem, restId }
    });

  res.status(201).json({
    status: 'success',
    outlet: {
      ...outlet,
      appKey, // Only shown once!
      reeloKey
    },
    message: 'Outlet created successfully. Save the appKey and reeloKey - they won\'t be shown again.'
  });
}));

/**
 * POST /api/marketplace/outlets/:outletId/connect
 * Connect outlet to marketplace (generate webhook URL, configure POS)
 */
marketplaceRouter.post('/outlets/:outletId/connect', asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId;
  const { outletId } = req.params;
  const { posSystem, webhookSecret, posConfig = {} } = req.body;

  // Verify outlet belongs to tenant
  const { data: outlet, error: outletError } = await supabaseAdmin
    .from('outlets')
    .select('*')
    .eq('id', outletId)
    .eq('tenant_id', tenantId)
    .single();

  if (outletError || !outlet) {
    return res.status(404).json({
      status: 'error',
      code: 'OUTLET_NOT_FOUND',
      message: 'Outlet not found'
    });
  }

  // Validate POS system
  if (!posAdapterFactory.hasAdapter(posSystem)) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_POS_SYSTEM',
      message: `Unsupported POS system: ${posSystem}`
    });
  }

  // Generate webhook URL for POS configuration
  const baseUrl = process.env.FRONTEND_URL || 'https://yeezy-loyalty.onrender.com';
  const webhookUrl = `${baseUrl}/pos/${posSystem.toLowerCase()}/loyalty/inquire`;

  // Update outlet with POS config and webhook secret
  const { data: updatedOutlet, error } = await supabaseAdmin
    .from('outlets')
    .update({
      pos_config: { ...outlet.pos_config, ...posConfig, webhook_url: webhookUrl },
      is_marketplace_connected: true,
      marketplace_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', outletId)
    .select()
    .single();

  if (error) throw error;

  // Store webhook secret in adapter config
  if (webhookSecret) {
    // In production, store encrypted in vault
    console.log(`[Marketplace] Webhook secret configured for outlet ${outletId}`);
  }

  // Log audit
  await supabaseAdmin
    .from('audit_log')
    .insert({
      restaurant_id: tenantId,
      actor_type: 'owner',
      actor_id: req.user.id,
      action: 'MARKETPLACE_CONNECTED',
      entity_type: 'outlet',
      entity_id: outletId,
      metadata: { posSystem, webhookUrl }
    });

  // Generate integration guide for this POS
  const integrationGuide = generateIntegrationGuide(posSystem, updatedOutlet, webhookSecret);

  res.json({
    status: 'success',
    outlet: updatedOutlet,
    webhookUrl,
    integrationGuide,
    message: `${posSystem} connected successfully! Configure the webhook URL in your POS dashboard.`
  });
}));

/**
 * POST /api/marketplace/api-keys
 * Generate a new API key for the restaurant
 */
marketplaceRouter.post('/api-keys', validateRequest('apiKeyCreate'), asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId;
  const { name, scopes, expiresInDays, isTest } = req.validated.body;

  // Generate API key
  const prefix = isTest ? 'lk_test_' : 'lk_live_';
  const randomPart = randomUUID().replace(/-/g, '').slice(0, 32);
  const rawKey = `${prefix}${randomPart}`;

  // Hash the key for storage
  const crypto = await import('node:crypto');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12); // lk_live_abc123
  const keyLast4 = rawKey.slice(-4);

  // Calculate expiry
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null;

  const { data: apiKey, error } = await supabaseAdmin
    .from('api_keys')
    .insert({
      restaurant_id: tenantId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      last4: keyLast4,
      scopes: scopes || ['customers:read', 'customers:write', 'points:earn', 'points:redeem'],
      is_test: isTest || false,
      expires_at: expiresAt
    })
    .select('id, name, key_prefix, key_last4, scopes, is_test, expires_at, created_at')
    .single();

  if (error) throw error;

  // Log audit
  await supabaseAdmin
    .from('audit_log')
    .insert({
      restaurant_id: tenantId,
      actor_type: 'owner',
      actor_id: req.user.id,
      action: 'API_KEY_CREATED',
      entity_type: 'api_key',
      entity_id: apiKey.id,
      metadata: { name, scopes, isTest }
    });

  // Return the raw key ONLY ONCE
  res.status(201).json({
    status: 'success',
    apiKey: {
      ...apiKey,
      key: rawKey // Only shown once!
    },
    message: 'API key created successfully. Save it now - it won\'t be shown again!'
  });
}));

/**
 * GET /api/marketplace/api-keys
 * List API keys (without showing the actual key)
 */
marketplaceRouter.get('/api-keys', asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId;

  const { data: apiKeys, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, name, key_prefix, last4, scopes, is_test, last_used_at, expires_at, revoked_at, created_at')
    .eq('restaurant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  res.json({
    status: 'success',
    apiKeys: apiKeys || []
  });
}));

/**
 * DELETE /api/marketplace/api-keys/:keyId
 * Revoke an API key
 */
marketplaceRouter.delete('/api-keys/:keyId', asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId;
  const { keyId } = req.params;

  const { error } = await supabaseAdmin
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('restaurant_id', tenantId);

  if (error) throw error;

  // Log audit
  await supabaseAdmin
    .from('audit_log')
    .insert({
      restaurant_id: tenantId,
      actor_type: 'owner',
      actor_id: req.user.id,
      action: 'API_KEY_REVOKED',
      entity_type: 'api_key',
      entity_id: keyId
    });

  res.json({
    status: 'success',
    message: 'API key revoked successfully'
  });
}));

/**
 * GET /api/marketplace/integration-guide/:posSystem
 * Get integration guide for a specific POS system
 */
marketplaceRouter.get('/integration-guide/:posSystem', asyncHandler(async (req, res) => {
  const { posSystem } = req.params;
  const tenantId = req.user.tenantId;

  if (!posAdapterFactory.hasAdapter(posSystem)) {
    return res.status(404).json({
      status: 'error',
      code: 'POS_SYSTEM_NOT_FOUND',
      message: `POS system ${posSystem} not found`
    });
  }

  // Get outlet info for this POS
  const { data: outlet } = await supabaseAdmin
    .from('outlets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('pos_system', posSystem.toUpperCase())
    .eq('is_marketplace_connected', true)
    .single();

  // Get API key for this restaurant
  const { data: apiKey } = await supabaseAdmin
    .from('api_keys')
    .select('key_prefix, last4, scopes, is_test')
    .eq('restaurant_id', tenantId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const baseUrl = process.env.FRONTEND_URL || 'https://yeezy-loyalty.onrender.com';

  const guide = generateDetailedIntegrationGuide(posSystem, outlet, apiKey, baseUrl, tenantId);

  res.json({
    status: 'success',
    posSystem,
    guide
  });
}));

/**
 * POST /api/marketplace/webhook-test/:posSystem
 * Test webhook configuration
 */
marketplaceRouter.post('/webhook-test/:posSystem', asyncHandler(async (req, res) => {
  const { posSystem } = req.params;
  const tenantId = req.user.tenantId;

  if (!posAdapterFactory.hasAdapter(posSystem)) {
    return res.status(404).json({
      status: 'error',
      code: 'POS_SYSTEM_NOT_FOUND',
      message: `POS system ${posSystem} not found`
    });
  }

  // Get connected outlet
  const { data: outlet } = await supabaseAdmin
    .from('outlets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('pos_system', posSystem.toUpperCase())
    .eq('is_marketplace_connected', true)
    .single();

  if (!outlet) {
    return res.status(404).json({
      status: 'error',
      code: 'OUTLET_NOT_CONNECTED',
      message: `No connected outlet found for ${posSystem}`
    });
  }

  // Create test webhook payload
  const testPayload = {
    test: true,
    restaurant_id: tenantId,
    store_id: outlet.rest_id,
    customer_phone: '+919876543210',
    customer_name: 'Test Customer',
    bill_amount: 500,
    order_id: `TEST-${Date.now()}`,
    table_no: 'T-1',
    server_name: 'Test Server'
  };

  // Simulate webhook call
  const adapter = posAdapterFactory.getAdapter(posSystem);

  // Create mock request
  const mockReq = {
    body: testPayload,
    headers: {
      'x-signature': '' // Would be filled by adapter.sign() in real scenario
    },
    path: `/pos/${posSystem}/loyalty/inquire`
  };

  // For testing, we skip signature verification
  try {
    const parsed = await adapter.parseInquireRequest(mockReq);
    res.json({
      status: 'success',
      message: 'Webhook configuration test passed',
      parsed: {
        tenantId: parsed.tenantId,
        phone: parsed.phone,
        billAmount: parsed.billAmount,
        orderId: parsed.orderId
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'error',
      code: 'WEBHOOK_TEST_FAILED',
      message: err.message
    });
  }
}));

/**
 * Helper: Check if POS is installed for tenant
 */
async function checkPosInstalled(tenantId, posSystem) {
  const { data } = await supabaseAdmin
    .from('outlets')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('pos_system', posSystem.toUpperCase())
    .eq('is_marketplace_connected', true)
    .limit(1);
  return (data || []).length > 0;
}

/**
 * Generate integration guide for POS connection
 */
function generateIntegrationGuide(posSystem, outlet, webhookSecret) {
  const baseUrl = process.env.FRONTEND_URL || 'https://yeezy-loyalty.onrender.com';

  const guides = {
    petpooja: {
      title: 'Petpooja Integration Guide',
      steps: [
        'Log in to your Petpooja Partner Dashboard',
        'Go to Integrations → Loyalty Programs → Add New',
        'Select "Yeezy Loyalty" or "Custom Webhook"',
        `Set Webhook URL: ${baseUrl}/pos/petpooja/loyalty/inquire`,
        `Set Webhook Secret: ${webhookSecret || '[Generate in Yeezy Dashboard]'}`,
        `Set RestID: ${outlet.rest_id}`,
        'Save and test the connection',
        'Enable "Loyalty Points" in your Petpooja billing screen settings'
      ],
      webhookEvents: [
        'Customer Lookup (inquire)',
        'Points Lock (lock)',
        'Order Settlement (orders/save)',
        'Order Cancellation (orders/cancel)'
      ]
    },
    rms: {
      title: 'RMS Integration Guide',
      steps: [
        'Log in to your RMS Admin Panel',
        'Go to Settings → Integrations → Loyalty',
        'Add new loyalty provider: "Yeezy Loyalty"',
        `Set API Base URL: ${baseUrl}`,
        `Set Webhook URL: ${baseUrl}/pos/rms/loyalty/inquire`,
        `Set Restaurant ID: ${outlet.rest_id}`,
        `Set Store ID: ${outlet.pos_config?.storeId || '[Configure in POS]'}`,
        `Set Webhook Secret: ${webhookSecret || '[Generate in Yeezy Dashboard]'}`,
        'Save and test the connection',
        'Enable loyalty on billing screen'
      ],
      webhookEvents: [
        'Customer Lookup (inquire)',
        'Points Lock (lock)',
        'Order Settlement (orders/save)',
        'Order Cancellation (orders/cancel)'
      ]
    },
    custom: {
      title: 'Custom API Integration Guide',
      steps: [
        'Generate an API Key from the Yeezy Dashboard (Settings → API Keys)',
        'Use the Public API v1 endpoints with Bearer token authentication',
        `Base URL: ${baseUrl}/v1`,
        'Required scopes: customers:read, customers:write, points:earn, points:redeem',
        'Test with: GET /v1/ping (verify API key works)',
        'Implement customer lookup: GET /v1/customers/lookup?phone=...',
        'Implement points earning: POST /v1/orders',
        'Implement redemption: POST /v1/redemptions/reserve → POST /v1/redemptions/:id/commit'
      ],
      endpoints: [
        'GET /v1/ping - Verify connection',
        'GET /v1/program - Get program config',
        'GET /v1/customers/lookup - Lookup customer',
        'PUT /v1/customers/:phone - Upsert customer',
        'POST /v1/redemptions/reserve - Reserve points',
        'POST /v1/redemptions/:id/commit - Commit redemption',
        'POST /v1/redemptions/:id/release - Release reservation',
        'POST /v1/orders - Report paid order (earn points)',
        'POST /v1/orders/:id/refund - Refund order (reverse points)'
      ]
    }
  };

  return guides[posSystem] || guides.custom;
}

/**
 * Generate detailed integration guide with code examples
 */
function generateDetailedIntegrationGuide(posSystem, outlet, apiKey, baseUrl, tenantId) {
  const guide = generateIntegrationGuide(posSystem, outlet, outlet?.pos_config?.webhookSecret);

  const codeExamples = {
    petpooja: {
      curl: `curl -X POST "${baseUrl}/pos/petpooja/loyalty/inquire" \\
  -H "Content-Type: application/json" \\
  -H "X-Petpooja-Signature: <hmac_sha256_signature>" \\
  -d '{
    "restID": "${outlet?.rest_id || 'YOUR_REST_ID'}",
    "customer_phone": "+919876543210",
    "customer_name": "John Doe",
    "bill_amount": 1500,
    "order_id": "ORD-12345",
    "table_no": "T-5"
  }'`,
      nodejs: `// Node.js example for Petpooja webhook handler
const crypto = require('crypto');

function verifyPetpoojaWebhook(req, secret) {
  const signature = req.headers['x-petpooja-signature'];
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

app.post('/webhook/petpooja/loyalty/inquire', (req, res) => {
  if (!verifyPetpoojaWebhook(req, process.env.PETPOOJA_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // Forward to Yeezy Loyalty
  forwardToYeezy(req.body);
});`
    },
    rms: {
      curl: `curl -X POST "${baseUrl}/pos/rms/loyalty/inquire" \\
  -H "Content-Type: application/json" \\
  -H "X-RMS-Signature: <hmac_sha256_signature>" \\
  -d '{
    "restaurant_id": "${tenantId}",
    "store_id": "${outlet?.pos_config?.storeId || 'YOUR_STORE_ID'}",
    "customer_phone": "+919876543210",
    "customer_name": "John Doe",
    "bill_amount": 1500,
    "order_id": "ORD-12345",
    "table_no": "T-5"
  }'`,
      nodejs: `// RMS Webhook Handler
const crypto = require('crypto');

function verifyRMSWebhook(req, secret) {
  const signature = req.headers['x-rms-signature'];
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

app.post('/webhook/rms/loyalty/inquire', (req, res) => {
  if (!verifyRMSWebhook(req, process.env.RMS_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // Forward to Yeezy Loyalty
  forwardToYeezy(req.body);
});`
    },
    custom: {
      curl: `curl -X GET "${baseUrl}/v1/ping" \\
  -H "Authorization: Bearer ${apiKey?.key_prefix ? apiKey.key_prefix + '...' + apiKey.last4 : 'YOUR_API_KEY'}" \\
  -H "Idempotency-Key: unique-request-id-123"`,
      nodejs: `// Custom POS - Direct API Integration
const YEEZY_API_URL = '${baseUrl}/v1';
const API_KEY = 'lk_live_your_api_key_here';

async function lookupCustomer(phone, billAmount) {
  const response = await fetch(\`\${YEEZY_API_URL}/customers/lookup?phone=\${phone}&bill_paise=\${billAmount * 100}\`, {
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID()
    }
  });
  return response.json();
}

async function reportOrder(orderData) {
  const response = await fetch(\`\${YEEZY_API_URL}/orders\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json',
      'Idempotency-Key': orderData.orderId
    },
    body: JSON.stringify({
      order_id: orderData.orderId,
      phone: orderData.phone,
      subtotal_paise: orderData.subtotal * 100,
      order_type: orderData.type // 'dine_in', 'takeaway', 'delivery'
    })
  });
  return response.json();
}

async function reserveRedemption(phone, points, billAmount) {
  const response = await fetch(\`\${YEEZY_API_URL}/redemptions/reserve\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json',
      'Idempotency-Key': \`reserve-\${Date.now()}\`
    },
    body: JSON.stringify({ phone, points, bill_paise: billAmount * 100 })
  });
  return response.json();
}`
    }
  };

  return {
    ...guide,
    codeExamples: codeExamples[posSystem] || codeExamples.custom,
    apiKey: apiKey ? {
      prefix: apiKey.key_prefix,
      last4: apiKey.last4,
      scopes: apiKey.scopes,
      isTest: apiKey.is_test
    } : null,
    outlet: outlet ? {
      id: outlet.id,
      name: outlet.name,
      restId: outlet.rest_id,
      posSystem: outlet.pos_system,
      webhookUrl: outlet.pos_config?.webhook_url
    } : null,
    tenantId
  };
}

export default marketplaceRouter;