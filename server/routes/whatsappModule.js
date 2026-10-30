/**
 * WhatsApp Campaign Module REST API Routes
 * Mount point: /api/whatsapp
 * Endpoints for Accounts, Segments, Templates, Campaigns, and Analytics
 */
import { Router } from 'express';
import { supabaseAdmin } from '../db/supabase.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import { SegmentEngine } from '../whatsapp/segmentEngine.js';
import { MetaWhatsAppClient } from '../whatsapp/metaClient.js';
import { CampaignSender } from '../whatsapp/campaignSender.js';
import { LoyaltyTemplateService, LOYALTY_EVENT_TYPES, LOYALTY_TEMPLATES, validateAllTemplates } from '../whatsapp/loyaltyTemplates.js';
import { posStore } from '../db/store.js';

export const whatsappRouter = Router();

// Apply auth middleware to protect all campaign manager routes
whatsappRouter.use(authMiddleware);

// Helper to resolve verified restaurant tenant ID from authenticated context
function getTenantId(req) {
  const tenantId = req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'] || 'ten_yeezy_01';
  return tenantId;
}

// ============================================================================
// 1. WHATSAPP ACCOUNT MANAGEMENT (Embedded Signup / Connection)
// ============================================================================

/**
 * GET /api/whatsapp/account
 * Get status of connected Meta WABA account for current restaurant
 */
whatsappRouter.get('/account', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);

  if (!supabaseAdmin) {
    return res.json({
      status: 'success',
      account: {
        restaurant_id: restaurantId,
        status: 'CONNECTED',
        phone_number_id: 'mock_phone_123',
        display_phone_number: '+91 98765 43210',
        quality_rating: 'GREEN',
        messaging_limit_tier: 'TIER_1K'
      }
    });
  }

  const { data: account, error } = await supabaseAdmin
    .from('wa_accounts')
    .select('id, restaurant_id, phone_number_id, waba_id, display_phone_number, verified_name, status, quality_rating, messaging_limit_tier, updated_at')
    .eq('restaurant_id', restaurantId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  res.json({
    status: 'success',
    account: account || { status: 'DISCONNECTED', restaurant_id: restaurantId }
  });
}));

/**
 * POST /api/whatsapp/account/connect
 * Save connected Meta WABA credentials
 */
whatsappRouter.post('/account/connect', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const { phoneNumberId, wabaId, accessToken, displayPhoneNumber, verifiedName } = req.body;

  if (!phoneNumberId || !wabaId || !accessToken) {
    return res.status(400).json({ error: 'phoneNumberId, wabaId, and accessToken are required' });
  }

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('wa_accounts')
      .upsert({
        restaurant_id: restaurantId,
        phone_number_id: phoneNumberId,
        waba_id: wabaId,
        access_token: accessToken,
        display_phone_number: displayPhoneNumber,
        verified_name: verifiedName,
        status: 'CONNECTED',
        quality_rating: 'GREEN',
        updated_at: new Date().toISOString()
      }, { onConflict: 'restaurant_id' })
      .select()
      .single();

    if (error) throw error;
    return res.json({ status: 'success', message: 'WhatsApp Business account connected', account: data });
  }

  res.json({ status: 'success', message: 'Mock account connected' });
}));

// ============================================================================
// 2. SEGMENTS & LIVE AUDIENCE PREVIEW
// ============================================================================

/**
 * GET /api/whatsapp/segments
 * List all preset and custom segments for restaurant
 */
whatsappRouter.get('/segments', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);

  // Return preset segments if database not populated yet
  const presets = [
    { id: 'seg_frequent', name: 'Frequent Guests', is_preset: true, preset_type: 'frequent', description: 'Visited 4+ times in the last 30 days' },
    { id: 'seg_lapsed', name: 'Lapsed Diners', is_preset: true, preset_type: 'lapsed', description: 'Last visit was between 30 and 90 days ago' },
    { id: 'seg_lost', name: 'Lost Diners', is_preset: true, preset_type: 'lost', description: 'No visit for over 90 days' },
    { id: 'seg_new', name: 'New Diners', is_preset: true, preset_type: 'new', description: 'Joined with exactly 1 visit in the last 30 days' },
    { id: 'seg_high_spenders', name: 'High Spenders', is_preset: true, preset_type: 'high_spenders', description: 'Top 10% highest spenders of all time' },
    { id: 'seg_celebration', name: 'Celebration This Week', is_preset: true, preset_type: 'birthday_week', description: 'Birthdays or anniversaries in next 7 days' }
  ];

  if (!supabaseAdmin) {
    return res.json({ status: 'success', segments: presets });
  }

  const { data: dbSegments, error } = await supabaseAdmin
    .from('segments')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('is_preset', { ascending: false });

  if (error) throw error;

  res.json({
    status: 'success',
    segments: (dbSegments && dbSegments.length > 0) ? dbSegments : presets
  });
}));

/**
 * POST /api/whatsapp/segments/preview
 * Compute live audience size, sample customers, opt-out and frequency-capped counts
 */
whatsappRouter.post('/segments/preview', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const { presetType, customRules, frequencyCapDays } = req.body;

  const audience = await SegmentEngine.evaluateAudience(restaurantId, {
    presetType,
    customRules,
    frequencyCapDays: frequencyCapDays || 7
  });

  res.json({
    status: 'success',
    audience
  });
}));

// ============================================================================
// 3. TEMPLATES (Meta Cloud API Management & Starters)
// ============================================================================

/**
 * GET /api/whatsapp/templates
 * List message templates (including starter templates)
 */
whatsappRouter.get('/templates', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);

  const starterTemplates = [
    {
      id: 'tmpl_bee_first_purchase',
      name: 'bee_first_purchase',
      language: 'en',
      category: 'UTILITY',
      body: 'Dear {{1}}, Your purchase has earned you loyalty points!',
      variables: [
        { index: 1, name: 'customer_name', sample: 'Rohan' }
      ],
      meta_status: 'APPROVED'
    },
    {
      id: 'tmpl_bee_subsequent_purc',
      name: 'bee_subsequent_purc',
      language: 'en',
      category: 'UTILITY',
      body: 'Dear Customer, Your purchase has earned you loyalty points.',
      variables: [],
      meta_status: 'APPROVED'
    },
    {
      id: 'tmpl_bee_points_reminder',
      name: 'bee_points_reminder',
      language: 'en',
      category: 'UTILITY',
      body: 'Dear Customer, This is a reminder of your loyalty points balance.',
      variables: [],
      meta_status: 'APPROVED'
    },
    {
      id: 'tmpl_bee_points_expiry',
      name: 'bee_points_expiry',
      language: 'en',
      category: 'UTILITY',
      body: 'Dear Customer, This is a notice that your points are scheduled to expire.',
      variables: [],
      meta_status: 'APPROVED'
    },
    {
      id: 'tmpl_hello_world',
      name: 'hello_world',
      language: 'en_US',
      category: 'UTILITY',
      body: 'Welcome and congratulations! This message demonstrates your ability to send a WhatsApp notification.',
      variables: [],
      meta_status: 'APPROVED'
    }
  ];

  if (!supabaseAdmin) {
    return res.json({ status: 'success', templates: starterTemplates });
  }

  const { data: dbTemplates, error } = await supabaseAdmin
    .from('wa_templates')
    .select('*')
    .eq('restaurant_id', restaurantId);

  if (error) throw error;

  res.json({
    status: 'success',
    templates: (dbTemplates && dbTemplates.length > 0) ? dbTemplates : starterTemplates
  });
}));

/**
 * POST /api/whatsapp/templates
 * Create template and submit to Meta Graph API for approval
 */
whatsappRouter.post('/templates', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const { name, category, language = 'en_US', body, headerText, footerText, variables, buttons } = req.body;

  if (!name || !body || !category) {
    return res.status(400).json({ error: 'name, category, and body are required' });
  }

  const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  // Submit to Meta via Graph API if account exists
  let metaStatus = 'PENDING';
  let metaTemplateId = null;

  try {
    const client = await MetaWhatsAppClient.forRestaurant(restaurantId);
    const submission = await client.submitTemplate({
      name: cleanName,
      category,
      language,
      body,
      headerText,
      footerText,
      buttons,
      exampleValues: (variables || []).map(v => v.sample || 'Sample')
    });
    metaStatus = submission.status;
    metaTemplateId = submission.metaTemplateId;
  } catch (err) {
    console.warn('[WhatsApp Template] Meta submission fallback:', err.message);
  }

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('wa_templates')
      .insert({
        restaurant_id: restaurantId,
        name: cleanName,
        language,
        category,
        body,
        header_text: headerText,
        footer_text: footerText,
        variables: variables || [],
        buttons: buttons || [],
        meta_status: metaStatus,
        meta_template_id: metaTemplateId
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ status: 'success', template: data });
  }

  res.status(201).json({
    status: 'success',
    template: {
      name: cleanName,
      category,
      meta_status: metaStatus,
      meta_template_id: metaTemplateId
    }
  });
}));

// ============================================================================
// 3B. LOYALTY SYSTEM TEMPLATES (Auto-provisioned per Restaurant)
// ============================================================================

/**
 * GET /api/whatsapp/templates/loyalty
 * Get all loyalty system template definitions with their current status
 */
whatsappRouter.get('/templates/loyalty', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);

  const service = new LoyaltyTemplateService(restaurantId);
  const statuses = await service.getAllTemplateStatuses();

  // Merge definitions with live statuses
  const templates = Object.values(LOYALTY_EVENT_TYPES).map(eventType => {
    const def = LOYALTY_TEMPLATES[eventType];
    const status = statuses.find(s => s.event_type === eventType) || {};
    return {
      ...def,
      meta_status: status.meta_status || 'DRAFT',
      meta_template_id: status.meta_template_id || null,
      meta_rejection_reason: status.meta_rejection_reason || null,
      last_synced_at: status.last_synced_at || null,
      is_system_template: true
    };
  });

  res.json({
    status: 'success',
    templates
  });
}));

/**
 * POST /api/whatsapp/templates/loyalty/provision
 * Provision all 6 loyalty system templates for this restaurant
 * Creates in database and submits to Meta for approval
 */
whatsappRouter.post('/templates/loyalty/provision', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);

  const service = new LoyaltyTemplateService(restaurantId);
  const results = await service.ensureAllSystemTemplates();

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  res.json({
    status: 'success',
    message: `Provisioned ${successful} templates, ${failed} failed`,
    results
  });
}));

/**
 * POST /api/whatsapp/templates/loyalty/:eventType/provision
 * Provision a single loyalty template by event type
 */
whatsappRouter.post('/templates/loyalty/:eventType/provision', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const { eventType } = req.params;

  if (!LOYALTY_EVENT_TYPES[eventType]) {
    return res.status(400).json({ error: `Invalid event type. Must be one of: ${Object.values(LOYALTY_EVENT_TYPES).join(', ')}` });
  }

  const service = new LoyaltyTemplateService(restaurantId);
  const result = await service.ensureSystemTemplate(LOYALTY_EVENT_TYPES[eventType]);

  res.status(201).json({
    status: 'success',
    message: `Template provisioned for ${eventType}`,
    template: result
  });
}));

/**
 * POST /api/whatsapp/templates/loyalty/sync
 * Sync status of all loyalty templates from Meta
 */
whatsappRouter.post('/templates/loyalty/sync', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);

  const service = new LoyaltyTemplateService(restaurantId);
  const results = await service.syncAllTemplateStatuses();

  res.json({
    status: 'success',
    message: 'Template statuses synced from Meta',
    results
  });
}));

/**
 * POST /api/whatsapp/templates/loyalty/:eventType/sync
 * Sync status of a single loyalty template from Meta
 */
whatsappRouter.post('/templates/loyalty/:eventType/sync', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const { eventType } = req.params;

  if (!LOYALTY_EVENT_TYPES[eventType]) {
    return res.status(400).json({ error: `Invalid event type` });
  }

  const service = new LoyaltyTemplateService(restaurantId);
  const templateName = LOYALTY_TEMPLATES[LOYALTY_EVENT_TYPES[eventType]].name;
  const status = await service.syncTemplateStatus(templateName);

  res.json({
    status: 'success',
    template: templateName,
    ...status
  });
}));

/**
 * POST /api/whatsapp/templates/loyalty/validate
 * Validate all loyalty templates for Meta compliance
 */
whatsappRouter.post('/templates/loyalty/validate', asyncHandler(async (req, res) => {
  const validation = validateAllTemplates();
  const allValid = Object.values(validation).every(v => v.valid);

  res.json({
    status: 'success',
    allValid,
    validation
  });
}));

/**
 * POST /api/whatsapp/templates/loyalty/test-send
 * Send a test loyalty message to a phone number
 * Requires: eventType, testPhone, and optional variable overrides
 */
whatsappRouter.post('/templates/loyalty/test-send', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const { eventType, testPhone, variableOverrides } = req.body;

  if (!eventType || !testPhone) {
    return res.status(400).json({ error: 'eventType and testPhone are required' });
  }

  if (!LOYALTY_EVENT_TYPES[eventType]) {
    return res.status(400).json({ error: `Invalid event type` });
  }

  const service = new LoyaltyTemplateService(restaurantId);

  // Get template to check status
  const templateName = LOYALTY_TEMPLATES[LOYALTY_EVENT_TYPES[eventType]].name;
  const statuses = await service.getAllTemplateStatuses();
  const templateStatus = statuses.find(s => s.name === templateName);

  if (templateStatus?.meta_status !== 'APPROVED') {
    return res.status(400).json({
      error: `Template is not APPROVED by Meta (current: ${templateStatus?.meta_status || 'DRAFT'}). Cannot send test.`,
      templateStatus
    });
  }

  // Build mock context for test send
  const mockContext = {
    customer: {
      id: 'test-customer',
      fullName: 'Test Customer',
      phoneNumber: testPhone,
      pointsBalance: 350,
      totalVisitsCount: 5,
      currentTier: { tierName: 'Gold' }
    },
    restaurant: { name: 'Test Restaurant' },
    pointsEarned: 100,
    pointsBalance: 350,
    pointsExpiring: 50,
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    reward: { name: 'Free Dessert' },
    pointsUsed: 200,
    offer: { details: '20% off next visit', expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
  };

  // Apply any variable overrides
  Object.assign(mockContext, variableOverrides);

  const result = await service.sendLoyaltyMessage(LOYALTY_EVENT_TYPES[eventType], testPhone, mockContext);

  res.json({
    status: 'success',
    result
  });
}));

// ============================================================================
// 4. CAMPAIGNS (Creation, Test Send, Execution & Analytics)
// ============================================================================

/**
 * GET /api/whatsapp/campaigns
 * List all campaigns with real-time delivery and revenue metrics
 */
whatsappRouter.get('/campaigns', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);

  if (!supabaseAdmin) {
    return res.json({ status: 'success', campaigns: [] });
  }

  let { data: campaigns, error } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (!campaigns || campaigns.length === 0) {
    const { data: allCamps } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    campaigns = allCamps || [];
  }

  if (error) throw error;

  const mapped = (campaigns || []).map(c => {
    const vm = c.variable_mapping || c.metadata || {};
    return {
      id: c.id,
      title: c.name,
      subtitle: vm.subtitle || '',
      rewardType: vm.rewardType || 'percentage',
      rewardValue: vm.rewardValue || '20',
      discountScope: vm.discountScope || 'entire',
      themeColor: vm.themeColor || '#2a7e72',
      textColor: vm.textColor || '#ffffff',
      bannerUrl: vm.bannerUrl || '',
      logoText: vm.logoText || 'YEEZY',
      expiryDate: vm.expiryDate || '',
      channel: 'whatsapp',
      targetSegment: vm.segment || 'all',
      segmentName: vm.segmentName || vm.segment || 'All Diners',
      status: c.status || 'completed',
      sentCount: c.total_sent ?? vm.sentCount ?? c.total_audience ?? 0,
      deliveredCount: c.total_delivered ?? vm.deliveredCount ?? c.total_sent ?? c.total_audience ?? 0,
      redeemedCount: 0,
      revenueGenerated: c.attributed_revenue_paise ? Math.round(c.attributed_revenue_paise / 100) : (vm.revenueGenerated || 0),
      createdAt: c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : ''
    };
  });

  res.json({
    status: 'success',
    campaigns: mapped
  });
}));

/**
 * POST /api/whatsapp/campaigns
 * Create a new campaign draft
 */
whatsappRouter.post('/campaigns', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const { name, segmentId, templateId, variableMapping, scheduledAt, frequencyCapDays } = req.body;

  if (!name || !templateId) {
    return res.status(400).json({ error: 'Campaign name and approved templateId are required' });
  }

  if (supabaseAdmin) {
    const { data: campaign, error } = await supabaseAdmin
      .from('campaigns')
      .insert({
        restaurant_id: restaurantId,
        name,
        segment_id: segmentId || null,
        template_id: templateId,
        variable_mapping: variableMapping || {},
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduled_at: scheduledAt || null,
        frequency_cap_days: frequencyCapDays || 7,
        created_by: req.user?.email || 'owner'
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ status: 'success', campaign });
  }

  res.status(201).json({ status: 'success', campaign: { name, status: 'draft' } });
}));

/**
 * DELETE /api/whatsapp/campaigns/:id
 * Delete a campaign from the database
 */
whatsappRouter.delete('/campaigns/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const restaurantId = getTenantId(req);

  if (supabaseAdmin) {
    await supabaseAdmin
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);
  }

  res.json({ status: 'success', message: 'Campaign deleted' });
}));

/**
 * POST /api/whatsapp/campaigns/test-send
 * Send a sample message to restaurant owner's mobile number
 */
whatsappRouter.post('/campaigns/test-send', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const { templateId, testPhone, variableMapping } = req.body;

  if (!testPhone || !templateId) {
    return res.status(400).json({ error: 'testPhone and templateId are required' });
  }

  const result = await CampaignSender.sendTestMessage({
    restaurantId,
    templateId,
    testPhone,
    variableMapping: variableMapping || {}
  });

  res.json({
    status: 'success',
    result
  });
}));

/**
 * POST /api/whatsapp/campaigns/:id/send
 * Trigger campaign batch dispatch now
 */
whatsappRouter.post('/campaigns/:id/send', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const campaignId = req.params.id;

  const result = await CampaignSender.startCampaign(campaignId, restaurantId);

  res.json({
    status: 'success',
    message: 'Campaign dispatched successfully',
    summary: result
  });
}));

/**
 * POST /api/whatsapp/campaigns/dispatch-live
 * Live dispatch of campaigns by customer segment (or single test preview)
 */
whatsappRouter.post('/campaigns/dispatch-live', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const { segment = 'atRisk', title, subtitle, rewardValue, expiryDate, testPhone, isTest, templateName } = req.body;

  const client = await MetaWhatsAppClient.forRestaurant(restaurantId);

  // If test preview requested
  if (isTest) {
    if (!testPhone) {
      return res.status(400).json({ error: 'testPhone is required for test send' });
    }

    const targetTemplate = templateName || 'hello_world';
    const params = targetTemplate === 'hello_world' ? [] : [title || 'Special Offer', String(rewardValue || '20%'), expiryDate || 'this week'];

    let sendRes = await client.sendTemplateMessage({
      recipientPhone: testPhone,
      templateName: targetTemplate,
      language: 'en',
      parameters: params
    });

    if (!sendRes.success && (sendRes.errorCode === '132001' || sendRes.errorMessage?.includes('translation'))) {
      sendRes = await client.sendTemplateMessage({
        recipientPhone: testPhone,
        templateName: targetTemplate,
        language: 'en_US',
        parameters: params
      });
    }

    return res.json({
      status: sendRes.success ? 'success' : 'error',
      isTest: true,
      recipient: testPhone,
      template: targetTemplate,
      result: sendRes
    });
  }

  // 1. Resolve recipients based on segment ('atRisk', 'lost', 'firstTimers', 'loyal', 'all')
  let recipients = [];
  if (supabaseAdmin) {
    let { data: members } = await supabaseAdmin
      .from('loyalty_members')
      .select('id, name, phone_e164, visit_count, last_visit_at, tier')
      .eq('restaurant_id', restaurantId)
      .eq('whatsapp_opt_in', true);

    if (!members || members.length === 0) {
      const { data: fallbackMembers } = await supabaseAdmin
        .from('loyalty_members')
        .select('id, name, phone_e164, visit_count, last_visit_at, tier')
        .eq('whatsapp_opt_in', true);
      members = fallbackMembers || [];
    }

    if (members && members.length > 0) {
      const now = Date.now();
      recipients = members.filter(m => {
        const lastVisitDays = m.last_visit_at ? Math.floor((now - new Date(m.last_visit_at).getTime()) / (1000 * 60 * 60 * 24)) : 999;
        const visits = m.visit_count || 1;

        if (segment === 'atRisk') return lastVisitDays >= 30 && lastVisitDays <= 90;
        if (segment === 'lost') return lastVisitDays > 90;
        if (segment === 'firstTimers') return visits <= 1;
        if (segment === 'loyal') return visits >= 4 || m.tier === 'Gold' || m.tier === 'Platinum' || m.tier === 'VIP';
        return true; // 'all'
      });
    }
  }

  // Fallback to in-memory members if Supabase returned 0
  if (recipients.length === 0 && posStore?.data?.loyaltyMembers) {
    recipients = posStore.data.loyaltyMembers.map(m => ({
      id: m.id,
      name: m.name,
      phone_e164: m.phone_e164 || m.phone,
      visit_count: m.visit_count || m.visits || 1
    }));
  }

  const targetTemplate = templateName || 'hello_world';
  let sentCount = 0;
  let failedCount = 0;
  const sampleResults = [];

  for (const recipient of recipients.slice(0, 50)) {
    try {
      const phone = recipient.phone_e164 || recipient.phone;
      if (!phone) continue;

      let params = [];
      if (targetTemplate === 'bee_first_purchase') {
        params = [recipient.name || 'Guest'];
      } else if (targetTemplate === 'hello_world' || targetTemplate === 'bee_subsequent_purc' || targetTemplate === 'bee_points_reminder' || targetTemplate === 'bee_points_expiry') {
        params = [];
      } else {
        params = [recipient.name || 'Guest'];
      }

      let r = await client.sendTemplateMessage({
        recipientPhone: phone,
        templateName: targetTemplate,
        language: 'en',
        parameters: params
      });

      if (!r.success && (r.errorCode === '132001' || r.errorMessage?.includes('translation'))) {
        r = await client.sendTemplateMessage({
          recipientPhone: phone,
          templateName: targetTemplate,
          language: 'en_US',
          parameters: params
        });
      }

      if (r.success) {
        sentCount++;
      } else {
        failedCount++;
      }
      if (sampleResults.length < 3) sampleResults.push({ phone, ...r });
    } catch (e) {
      failedCount++;
    }
  }

  // Persist campaign to database for real analytics
  let savedCampaign = null;
  if (supabaseAdmin) {
    try {
      let templateId = null;
      const { data: tRow } = await supabaseAdmin
        .from('wa_templates')
        .select('id')
        .eq('name', targetTemplate)
        .limit(1)
        .maybeSingle();

      if (tRow) {
        templateId = tRow.id;
      } else {
        const { data: anyT } = await supabaseAdmin.from('wa_templates').select('id').limit(1).maybeSingle();
        templateId = anyT?.id;
      }

      const { data, error } = await supabaseAdmin.from('campaigns').insert({
        restaurant_id: restaurantId,
        name: title || 'Special Offer Broadcast',
        template_id: templateId,
        variable_mapping: {
          segment,
          subtitle,
          rewardValue,
          expiryDate,
          themeColor: req.body.themeColor || '#2a7e72',
          textColor: req.body.textColor || '#ffffff',
          bannerUrl: req.body.bannerUrl || '',
          logoText: req.body.logoText || 'YEEZY',
          sentCount,
          deliveredCount: sentCount,
          failedCount,
          template: targetTemplate,
          revenueGenerated: 0
        },
        status: sentCount > 0 ? 'completed' : 'active',
        total_audience: recipients.length,
        total_sent: sentCount,
        total_delivered: sentCount,
        total_failed: failedCount,
        sent_at: new Date().toISOString()
      }).select().single();

      if (error) {
        console.error('[Dispatch-live DB insert error]', error);
      } else {
        savedCampaign = data;
      }
    } catch (dbErr) {
      console.warn('[Dispatch-live DB insert warning]', dbErr.message);
    }
  }

  res.json({
    status: 'success',
    segment,
    totalTargeted: recipients.length,
    sentCount,
    failedCount,
    template: targetTemplate,
    campaign: savedCampaign,
    sampleResults
  });
}));

/**
 * GET /api/whatsapp/campaigns/:id/analytics
 * Get detailed campaign performance analytics, failures, and 7-day attributed revenue
 */
whatsappRouter.get('/campaigns/:id/analytics', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const campaignId = req.params.id;

  if (!supabaseAdmin) {
    return res.json({
      status: 'success',
      analytics: {
        sent: 120,
        delivered: 114,
        read: 98,
        failed: 6,
        opt_outs: 1,
        delivery_rate_percent: 95.0,
        read_rate_percent: 86.0,
        cost_inr: 93.60,
        attributed_revenue_inr: 12450.00,
        roi_multiplier: 133.0
      }
    });
  }

  // 1. Fetch Campaign
  const { data: campaign, error: cErr } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('restaurant_id', restaurantId)
    .single();

  if (cErr || !campaign) throw new Error('Campaign not found');

  // 2. Refresh 7-day attributed revenue
  await supabaseAdmin.rpc('fn_sync_campaign_attributed_revenue', {
    p_campaign_id: campaignId
  }).catch(() => {});

  // 3. Fetch failure details with human-readable error reasons
  const { data: failures } = await supabaseAdmin
    .from('campaign_messages')
    .select('phone_e164, error_code, error_message, created_at')
    .eq('campaign_id', campaignId)
    .eq('status', 'failed')
    .limit(50);

  const sent = campaign.total_sent || 0;
  const delivered = campaign.total_delivered || 0;
  const read = campaign.total_read || 0;
  const deliveryRate = sent > 0 ? Number(((delivered / sent) * 100).toFixed(1)) : 0;
  const readRate = delivered > 0 ? Number(((read / delivered) * 100).toFixed(1)) : 0;
  const revenueInr = Number((Number(campaign.attributed_revenue_paise || 0) / 100).toFixed(2));
  const costInr = Number(campaign.actual_cost || 0);

  res.json({
    status: 'success',
    analytics: {
      campaign_name: campaign.name,
      status: campaign.status,
      sent,
      delivered,
      read,
      failed: campaign.total_failed || 0,
      opt_outs: campaign.total_opt_outs || 0,
      delivery_rate_percent: deliveryRate,
      read_rate_percent: readRate,
      cost_inr: costInr,
      attributed_revenue_inr: revenueInr,
      roi_multiplier: costInr > 0 ? Number((revenueInr / costInr).toFixed(1)) : 0,
      failures: failures || []
    }
  });
}));

// ============================================================================
// 5. META APP REVIEW & RECORDING TEST ENDPOINTS
// Dedicated endpoints to record Video 1 (Messaging) & Video 2 (Management)
// ============================================================================

/**
 * GET /api/whatsapp/meta-review/status
 * Check Meta token validity, WABA ID, Phone ID, and permissions
 */
whatsappRouter.get('/meta-review/status', asyncHandler(async (req, res) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID || '';
  const wabaId = process.env.META_WABA_ID || '';
  const appId = process.env.META_APP_ID || '1449921280434310';

  if (!token) {
    return res.json({
      status: 'error',
      connected: false,
      tokenValid: false,
      message: 'No Meta access token configured',
      appId,
      phoneNumberId,
      wabaId
    });
  }

  try {
    const debugRes = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${token}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const debugData = await debugRes.json();

    if (debugData.error) {
      return res.json({
        status: 'error',
        connected: false,
        tokenValid: false,
        error: debugData.error.message,
        errorCode: debugData.error.code,
        appId,
        phoneNumberId,
        wabaId
      });
    }

    const info = debugData.data || {};
    res.json({
      status: 'success',
      connected: true,
      tokenValid: info.is_valid,
      appId: info.app_id || appId,
      scopes: info.scopes || [],
      expiresAt: info.expires_at ? new Date(info.expires_at * 1000).toLocaleString() : 'Permanent',
      phoneNumberId,
      wabaId
    });
  } catch (err) {
    res.json({
      status: 'error',
      connected: false,
      tokenValid: false,
      error: err.message,
      appId,
      phoneNumberId,
      wabaId
    });
  }
}));

/**
 * POST /api/whatsapp/meta-review/save-credentials
 * Save or update Meta token, Phone Number ID, and WABA ID
 */
whatsappRouter.post('/meta-review/save-credentials', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const { accessToken, phoneNumberId, wabaId, displayPhone, verifiedName } = req.body;

  if (accessToken) {
    process.env.META_ACCESS_TOKEN = accessToken.trim();
    process.env.WHATSAPP_ACCESS_TOKEN = accessToken.trim();
  }
  if (phoneNumberId) process.env.META_PHONE_NUMBER_ID = phoneNumberId.trim();
  if (wabaId) process.env.META_WABA_ID = wabaId.trim();

  if (supabaseAdmin) {
    await supabaseAdmin.from('wa_accounts').upsert({
      restaurant_id: restaurantId,
      access_token: process.env.META_ACCESS_TOKEN,
      phone_number_id: process.env.META_PHONE_NUMBER_ID,
      waba_id: process.env.META_WABA_ID,
      display_phone_number: displayPhone || '+91 97456 30606',
      verified_name: verifiedName || 'Durbar',
      status: 'CONNECTED',
      updated_at: new Date().toISOString()
    }, { onConflict: 'restaurant_id' }).catch(() => {});
  }

  res.json({
    status: 'success',
    message: 'Meta API credentials updated successfully'
  });
}));

/**
 * POST /api/whatsapp/meta-review/send-message
 * Send a live test message via Meta Graph API (for Video 1: whatsapp_business_messaging)
 */
whatsappRouter.post('/meta-review/send-message', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const { recipientPhone, templateName = 'hello_world', language = 'en_US', parameters = [] } = req.body;

  if (!recipientPhone) {
    return res.status(400).json({ error: 'recipientPhone is required' });
  }

  const client = await MetaWhatsAppClient.forRestaurant(restaurantId);
  const result = await client.sendTemplateMessage({
    recipientPhone,
    templateName,
    language,
    parameters
  });

  res.json({
    status: 'success',
    message: 'Message dispatched successfully to Meta Graph API',
    recipientPhone,
    templateName,
    result
  });
}));

/**
 * POST /api/whatsapp/meta-review/create-template
 * Create a message template via Meta Graph API (for Video 2: whatsapp_business_management)
 */
whatsappRouter.post('/meta-review/create-template', asyncHandler(async (req, res) => {
  const restaurantId = getTenantId(req);
  const { name, category = 'MARKETING', language = 'en_US', body, headerText, footerText, buttons, exampleValues } = req.body;

  if (!name || !body) {
    return res.status(400).json({ error: 'Template name and body are required' });
  }

  const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const client = await MetaWhatsAppClient.forRestaurant(restaurantId);

  const result = await client.submitTemplate({
    name: cleanName,
    category,
    language,
    body,
    headerText,
    footerText,
    buttons,
    exampleValues: exampleValues || ['Alex']
  });

  if (supabaseAdmin) {
    await supabaseAdmin.from('wa_templates').upsert({
      restaurant_id: restaurantId,
      name: cleanName,
      category,
      language,
      body,
      header_text: headerText || null,
      footer_text: footerText || null,
      buttons: buttons || [],
      variables: (exampleValues || []).map((v, i) => ({ index: i + 1, name: `var_${i+1}`, sample: v })),
      meta_status: result.status,
      meta_template_id: result.metaTemplateId
    }, { onConflict: 'restaurant_id,name' }).catch(() => {});
  }

  res.status(201).json({
    status: 'success',
    message: 'Template submitted to Meta Graph API',
    result: {
      templateName: cleanName,
      metaTemplateId: result.metaTemplateId,
      status: result.status
    }
  });
}));

