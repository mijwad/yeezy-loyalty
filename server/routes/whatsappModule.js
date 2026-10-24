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

export const whatsappRouter = Router();

// Apply auth middleware to protect all campaign manager routes
whatsappRouter.use(authMiddleware);

// Helper to resolve verified restaurant tenant ID from authenticated context
function getTenantId(req) {
  const tenantId = req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
  if (!tenantId) {
    throw new Error('Restaurant tenant context is required');
  }
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
      id: 'tmpl_we_miss_you',
      name: 'we_miss_you_offer',
      language: 'en_US',
      category: 'MARKETING',
      body: 'Hi {{1}}, we haven\'t seen you at our restaurant lately! Enjoy {{2}} off your next dine-in bill valid until {{3}}. Show this message at checkout to redeem.',
      variables: [
        { index: 1, name: 'customer_name', sample: 'Rohan' },
        { index: 2, name: 'offer', sample: '20%' },
        { index: 3, name: 'expiry', sample: 'Sunday' }
      ],
      meta_status: 'APPROVED'
    },
    {
      id: 'tmpl_thank_you_reward',
      name: 'thank_you_loyal_guest',
      language: 'en_US',
      category: 'MARKETING',
      body: 'Hello {{1}}! As a special thank you for being a frequent guest, here is {{2}} bonus reward points added to your account. Valid until {{3}}.',
      variables: [
        { index: 1, name: 'customer_name', sample: 'Priya' },
        { index: 2, name: 'bonus_points', sample: '50' },
        { index: 3, name: 'expiry', sample: 'the end of this month' }
      ],
      meta_status: 'APPROVED'
    },
    {
      id: 'tmpl_welcome_back',
      name: 'welcome_back_treat',
      language: 'en_US',
      category: 'MARKETING',
      body: 'Hi {{1}}, craving your favorites? Visit us this week and get a complimentary dessert with any order above ₹500! Valid till {{2}}.',
      variables: [
        { index: 1, name: 'customer_name', sample: 'Guest' },
        { index: 2, name: 'valid_date', sample: 'Friday' }
      ],
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

  const { data: campaigns, error } = await supabaseAdmin
    .from('campaigns')
    .select('*, segments(name, preset_type), wa_templates(name, category, meta_status)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  res.json({
    status: 'success',
    campaigns: campaigns || []
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
