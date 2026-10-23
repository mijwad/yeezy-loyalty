// Loyalty Points Module REST API Router
// Section 5 Compliance: Endpoints for Member Lookup, Earn, Redeem, Referrals, ROI, Multipliers
import { Router } from 'express';
import { posStore } from '../db/store.js';
import {
  calculateEarn,
  previewRedeem,
  commitRedeem,
  evaluateReferralQualification,
  calculateOrderRefundReversal,
  normalizePhone
} from '../../lib/loyalty/engine.js';
import { calculateROI } from '../../lib/loyalty/roi.js';
import { validateLoyaltyConfig, DEFAULT_LOYALTY_CONFIG } from '../../lib/loyalty/config.js';
import { defaultWhatsAppProvider, WhatsAppTemplates } from '../../lib/loyalty/whatsapp.js';
import { t } from '../../lib/loyalty/i18n.js';

export const loyaltyRouter = Router();

// In-memory rate limiter for member lookups (30 requests per minute per IP)
const lookupRateLimits = new Map();
function rateLimitLookup(req, res, next) {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 30;

  const timestamps = (lookupRateLimits.get(clientIp) || []).filter(ts => now - ts < windowMs);
  if (timestamps.length >= maxRequests) {
    return res.status(429).json({
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many phone lookups. Please wait a minute before trying again.'
    });
  }

  timestamps.push(now);
  lookupRateLimits.set(clientIp, timestamps);
  next();
}

/**
 * 1. POST /api/loyalty/members/lookup
 * Cashier or customer enters phone -> returns member details, balance, tier, and instant redeemable limits.
 */
loyaltyRouter.post(['/members/lookup', '/lookup'], rateLimitLookup, (req, res) => {
  try {
    const restaurantId = req.tenantId || req.body.restaurant_id || req.body.restID || 'ten_yeezy_01';
    const rawPhone = req.body.phone || req.body.customer_phone || req.body.phone_e164;
    const name = req.body.name || req.body.customer_name;
    const billPaise = req.body.bill_paise || (req.body.bill_amount ? Math.round(Number(req.body.bill_amount) * 100) : 0);

    if (!rawPhone) {
      return res.status(400).json({ status: 'error', message: 'Customer phone number is required' });
    }

    const phoneE164 = normalizePhone(rawPhone);
    const member = posStore.getOrCreateLoyaltyMember(restaurantId, phoneE164, name);
    const balance = posStore.getMemberBalance(restaurantId, member.id);
    const program = posStore.getLoyaltyProgram(restaurantId);

    // Calculate preview if bill is provided
    let redeemPreview = null;
    if (billPaise > 0) {
      redeemPreview = previewRedeem({
        config: program.config,
        isProgramActive: program.is_active,
        memberBalance: balance,
        input: {
          restaurant_id: restaurantId,
          member_phone: phoneE164,
          bill_paise: billPaise,
          order_type: req.body.order_type || 'dine_in'
        }
      });
    }

    return res.json({
      status: 'success',
      member: {
        id: member.id,
        phone_e164: member.phone_e164,
        name: member.name,
        tier: member.tier,
        visit_count: member.visit_count,
        lifetime_spend_paise: member.lifetime_spend_paise,
        last_visit_at: member.last_visit_at,
        joined_at: member.joined_at
      },
      points_balance: balance,
      point_value_paise: program.config.point_value_paise,
      worth_inr: (balance * program.config.point_value_paise) / 100,
      redeem_preview: redeemPreview
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * 2. POST /api/loyalty/earn
 * Internal engine endpoint called automatically on order payment/settlement.
 * Runs atomically inside row-level lock and guarantees idempotency per order_id.
 */
loyaltyRouter.post('/earn', async (req, res) => {
  try {
    const restaurantId = req.tenantId || req.body.restaurant_id || 'ten_yeezy_01';
    const {
      order_id,
      member_phone,
      member_name,
      subtotal_paise,
      discounts_paise = 0,
      points_redeemed_paise = 0,
      order_type = 'dine_in'
    } = req.body;

    if (!order_id || !member_phone) {
      return res.status(400).json({ status: 'error', message: 'order_id and member_phone are required' });
    }

    const program = posStore.getLoyaltyProgram(restaurantId);
    if (!program.is_active) {
      return res.json({ status: 'skipped', message: 'Loyalty program is inactive' });
    }

    const cleanPhone = normalizePhone(member_phone);
    const member = posStore.getOrCreateLoyaltyMember(restaurantId, cleanPhone, member_name);
    const lockKey = `${restaurantId}:${member.id}`;

    // Execute atomically with row lock
    const result = await posStore.withMemberLock(lockKey, async () => {
      const currentBalance = posStore.getMemberBalance(restaurantId, member.id);
      const existingOrderIds = posStore.data.loyaltyLedger
        .filter(e => e.restaurant_id === restaurantId && e.order_id)
        .map(e => e.order_id);

      const activeRules = posStore.getMultiplierRules(restaurantId);
      const lastCampaign = posStore.getLastCampaignForMember(restaurantId, member.id);

      const earnResult = calculateEarn({
        config: program.config,
        member,
        input: {
          restaurant_id: restaurantId,
          order_id: String(order_id),
          member_phone: cleanPhone,
          subtotal_paise: Number(subtotal_paise),
          discounts_paise: Number(discounts_paise),
          points_redeemed_paise: Number(points_redeemed_paise),
          order_type
        },
        existingOrderIds,
        activeRules,
        lastWinbackCampaignSentAt: lastCampaign?.sent_at,
        currentBalance
      });

      if (earnResult.skipped) {
        return {
          status: 'skipped',
          reason: earnResult.skip_reason,
          balance: currentBalance,
          member
        };
      }

      // Append ledger entries
      for (const entry of earnResult.ledger_entries) {
        posStore.appendLoyaltyLedgerEntry({
          restaurant_id: restaurantId,
          member_id: member.id,
          order_id: String(order_id),
          type: entry.type,
          points: entry.points,
          remaining: entry.remaining,
          expires_at: entry.expires_at,
          meta: entry.meta
        });
      }

      // Update member profile
      member.visit_count += 1;
      member.last_visit_at = new Date().toISOString();
      member.lifetime_spend_paise += Number(subtotal_paise);
      member.tier = earnResult.new_tier;
      posStore.persist();

      // Check referral qualification on first paid order
      if (member.referred_by_member_id && member.visit_count === 1) {
        const qualifiedCountThisMonth = posStore.getQualifiedReferralsThisMonth(
          restaurantId,
          member.referred_by_member_id
        );
        const refQual = evaluateReferralQualification({
          config: program.config,
          refereeFirstBillPaise: Number(subtotal_paise),
          referrerQualifiedCountThisMonth: qualifiedCountThisMonth,
          orderId: String(order_id)
        });

        if (refQual.qualifies) {
          // Credit referrer
          posStore.appendLoyaltyLedgerEntry({
            restaurant_id: restaurantId,
            member_id: member.referred_by_member_id,
            order_id: String(order_id),
            type: 'earn_referral',
            points: refQual.referrer_points,
            remaining: refQual.referrer_points,
            expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
            meta: { referee_id: member.id, order_id }
          });
          // Credit referee
          posStore.appendLoyaltyLedgerEntry({
            restaurant_id: restaurantId,
            member_id: member.id,
            order_id: String(order_id),
            type: 'earn_referral',
            points: refQual.referee_points,
            remaining: refQual.referee_points,
            expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
            meta: { referrer_id: member.referred_by_member_id, order_id }
          });

          // Mark referral qualified
          const referralRecord = posStore.data.loyaltyReferrals.find(
            r => r.restaurant_id === restaurantId && r.referee_member_id === member.id
          );
          if (referralRecord) {
            referralRecord.status = 'qualified';
            referralRecord.qualified_order_id = String(order_id);
            posStore.persist();
          }
        }
      }

      // Send WhatsApp notification stub
      defaultWhatsAppProvider.sendMessage({
        to: cleanPhone,
        templateName: 'points_earned',
        language: 'en',
        parameters: {
          dinerName: member.name,
          pointsEarned: earnResult.total_points_earned,
          totalBalance: earnResult.new_balance,
          inrValue: (earnResult.new_balance * program.config.point_value_paise) / 100
        }
      });

      return {
        status: 'success',
        earn: earnResult,
        member
      };
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * 3. POST /api/loyalty/redeem/preview
 * Calculates allowed redeem points, discount in paise, and enforces all validation checks.
 */
loyaltyRouter.post('/redeem/preview', (req, res) => {
  try {
    const restaurantId = req.tenantId || req.body.restaurant_id || 'ten_yeezy_01';
    const { member_phone, bill_paise, requested_points, order_type = 'dine_in', has_conflicting_discounts = false } = req.body;

    if (!member_phone || bill_paise === undefined) {
      return res.status(400).json({ status: 'error', message: 'member_phone and bill_paise are required' });
    }

    const cleanPhone = normalizePhone(member_phone);
    const member = posStore.getOrCreateLoyaltyMember(restaurantId, cleanPhone);
    const balance = posStore.getMemberBalance(restaurantId, member.id);
    const program = posStore.getLoyaltyProgram(restaurantId);

    const preview = previewRedeem({
      config: program.config,
      isProgramActive: program.is_active,
      memberBalance: balance,
      input: {
        restaurant_id: restaurantId,
        member_phone: cleanPhone,
        bill_paise: Number(bill_paise),
        requested_points: requested_points !== undefined ? Number(requested_points) : undefined,
        order_type,
        has_conflicting_discounts: Boolean(has_conflicting_discounts)
      }
    });

    return res.json({
      status: preview.allowed ? 'success' : 'rejected',
      ...preview
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * 4. POST /api/loyalty/redeem/commit
 * Deducts points FIFO by earliest expires_at, writes negative redeem row, and prevents race conditions.
 */
loyaltyRouter.post('/redeem/commit', async (req, res) => {
  try {
    const restaurantId = req.tenantId || req.body.restaurant_id || 'ten_yeezy_01';
    const { order_id, member_phone, bill_paise, requested_points, order_type = 'dine_in' } = req.body;

    if (!order_id || !member_phone || bill_paise === undefined) {
      return res.status(400).json({ status: 'error', message: 'order_id, member_phone, and bill_paise are required' });
    }

    const cleanPhone = normalizePhone(member_phone);
    const member = posStore.getOrCreateLoyaltyMember(restaurantId, cleanPhone);
    const lockKey = `${restaurantId}:${member.id}`;

    const commitResult = await posStore.withMemberLock(lockKey, async () => {
      const balance = posStore.getMemberBalance(restaurantId, member.id);
      const program = posStore.getLoyaltyProgram(restaurantId);

      const preview = previewRedeem({
        config: program.config,
        isProgramActive: program.is_active,
        memberBalance: balance,
        input: {
          restaurant_id: restaurantId,
          member_phone: cleanPhone,
          bill_paise: Number(bill_paise),
          requested_points: requested_points !== undefined ? Number(requested_points) : undefined,
          order_type
        }
      });

      if (!preview.allowed) {
        return {
          status: 'rejected',
          code: preview.error_code,
          message: preview.error_message
        };
      }

      const activeEarnEntries = posStore.getActiveEarnEntries(restaurantId, member.id);
      const committed = commitRedeem({
        preview,
        input: {
          restaurant_id: restaurantId,
          order_id: String(order_id),
          member_phone: cleanPhone,
          bill_paise: Number(bill_paise),
          redeem_points: preview.redeem_points
        },
        activeEarnEntries
      });

      // Decrement remaining on consumed earn entries
      for (const alloc of committed.fifo_allocations) {
        posStore.decrementEntryRemaining(alloc.earn_entry_id, alloc.points_deducted);
      }

      // Append negative redeem ledger row
      posStore.appendLoyaltyLedgerEntry({
        restaurant_id: restaurantId,
        member_id: member.id,
        order_id: String(order_id),
        type: 'redeem',
        points: committed.ledger_entry.points,
        remaining: 0,
        expires_at: null,
        meta: committed.ledger_entry.meta
      });

      return {
        status: 'success',
        ...committed
      };
    });

    return res.status(commitResult.status === 'success' ? 200 : 400).json(commitResult);
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * 5. POST /api/loyalty/referrals
 * Create a referral linking a new referee to an existing referrer member.
 */
loyaltyRouter.post('/referrals', (req, res) => {
  try {
    const restaurantId = req.tenantId || req.body.restaurant_id || 'ten_yeezy_01';
    const { referrer_phone, referee_phone } = req.body;

    if (!referrer_phone || !referee_phone) {
      return res.status(400).json({ status: 'error', message: 'referrer_phone and referee_phone are required' });
    }

    const cleanReferrer = normalizePhone(referrer_phone);
    const cleanReferee = normalizePhone(referee_phone);

    if (cleanReferrer === cleanReferee) {
      return res.status(400).json({ status: 'error', message: 'Members cannot refer themselves.' });
    }

    const referrer = posStore.getOrCreateLoyaltyMember(restaurantId, cleanReferrer);
    const referee = posStore.getOrCreateLoyaltyMember(restaurantId, cleanReferee);

    if (referee.visit_count > 0) {
      return res.status(400).json({ status: 'error', message: 'Referee is already an existing guest.' });
    }

    referee.referred_by_member_id = referrer.id;
    const referral = posStore.createReferral(restaurantId, referrer.id, referee.id);

    return res.json({
      status: 'success',
      referral
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * 6. GET & PUT /api/loyalty/program
 * Get and update per-restaurant configuration with Zod validation.
 */
loyaltyRouter.get('/program', (req, res) => {
  try {
    const restaurantId = req.tenantId || req.query.restaurant_id || 'ten_yeezy_01';
    const program = posStore.getLoyaltyProgram(restaurantId);
    return res.json({
      status: 'success',
      program
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

loyaltyRouter.put('/program', (req, res) => {
  try {
    const restaurantId = req.tenantId || req.body.restaurant_id || 'ten_yeezy_01';
    const updates = req.body.config || req.body;

    const { program, warning } = posStore.updateLoyaltyProgram(restaurantId, updates);

    return res.json({
      status: 'success',
      message: 'Loyalty program configuration updated successfully',
      program,
      warning
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

/**
 * 7. POST /api/loyalty/simulate
 * Pure ROI simulation function for restaurant owners.
 */
loyaltyRouter.post('/simulate', (req, res) => {
  try {
    const result = calculateROI(req.body);
    return res.json({
      status: 'success',
      simulation: result
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * 8. GET & POST /api/loyalty/multipliers
 * Multiplier rule management for slow-slot and festival surges.
 */
loyaltyRouter.get('/multipliers', (req, res) => {
  try {
    const restaurantId = req.tenantId || req.query.restaurant_id || 'ten_yeezy_01';
    const rules = posStore.getMultiplierRules(restaurantId);
    return res.json({ status: 'success', rules });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

loyaltyRouter.post('/multipliers', (req, res) => {
  try {
    const restaurantId = req.tenantId || req.body.restaurant_id || 'ten_yeezy_01';
    const rule = posStore.saveMultiplierRule({
      ...req.body,
      restaurant_id: restaurantId
    });
    return res.json({ status: 'success', rule });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * 9. POST /api/loyalty/refund
 * Reverses points on refunded orders.
 */
loyaltyRouter.post('/refund', (req, res) => {
  try {
    const restaurantId = req.tenantId || req.body.restaurant_id || 'ten_yeezy_01';
    const { order_id, original_order_paise, refund_paise } = req.body;

    if (!order_id) {
      return res.status(400).json({ status: 'error', message: 'order_id is required' });
    }

    const orderEntries = posStore.data.loyaltyLedger.filter(
      e => e.restaurant_id === restaurantId && e.order_id === String(order_id)
    );

    const reversal = calculateOrderRefundReversal({
      orderEntries,
      originalOrderPaise: Number(original_order_paise || refund_paise),
      refundPaise: Number(refund_paise),
      orderId: String(order_id)
    });

    if (reversal.reversalLedgerEntry) {
      posStore.appendLoyaltyLedgerEntry({
        restaurant_id: restaurantId,
        member_id: orderEntries[0]?.member_id,
        order_id: String(order_id),
        ...reversal.reversalLedgerEntry
      });
    }

    return res.json({
      status: 'success',
      points_reversed: reversal.totalPointsReversed
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * 10. POST /api/loyalty/cron/expire
 * Scheduled expiry cron run.
 */
loyaltyRouter.post('/cron/expire', (req, res) => {
  try {
    const restaurantId = req.tenantId || req.body.restaurant_id || 'ten_yeezy_01';
    const expiredRows = posStore.expireOldPoints(restaurantId, new Date());
    return res.json({
      status: 'success',
      expired_count: expiredRows.length,
      expired_rows: expiredRows
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * 11. GET /api/loyalty/receipt/:orderId
 * Thermal printer text generator.
 */
loyaltyRouter.get('/receipt/:orderId', (req, res) => {
  try {
    const { orderId } = req.params;
    const restaurantId = req.tenantId || req.query.restaurant_id || 'ten_yeezy_01';
    const lang = (req.query.lang || 'en');

    const entries = posStore.data.loyaltyLedger.filter(
      e => e.restaurant_id === restaurantId && e.order_id === orderId
    );
    const earnedThisBill = entries
      .filter(e => e.type.startsWith('earn_') && e.points > 0)
      .reduce((sum, e) => sum + e.points, 0);

    const memberId = entries[0]?.member_id;
    const balance = memberId ? posStore.getMemberBalance(restaurantId, memberId) : 0;
    const program = posStore.getLoyaltyProgram(restaurantId);
    const inrValue = (balance * program.config.point_value_paise) / 100;

    const receiptLines = [
      '========================================',
      `       ${t('receipt_title', lang)}       `,
      '========================================',
      t('receipt_points_earned', lang, { points: earnedThisBill }),
      t('receipt_points_balance', lang, { balance, inr: inrValue }),
      t('receipt_next_milestone', lang, { more: '150' }),
      '----------------------------------------',
      `       ${t('receipt_thank_you', lang)}       `,
      '========================================'
    ].join('\n');

    return res.type('text/plain').send(receiptLines);
  } catch (err) {
    return res.status(500).send('Error generating receipt');
  }
});

/**
 * 12. GET /api/loyalty/dashboard/metrics
 * Real data analytics: active members, points issued/redeemed, liability, repeat rate, ROI.
 */
loyaltyRouter.get('/dashboard/metrics', (req, res) => {
  try {
    const restaurantId = req.tenantId || req.query.restaurant_id || 'ten_yeezy_01';
    const members = posStore.data.loyaltyMembers.filter(m => m.restaurant_id === restaurantId);
    const ledger = posStore.data.loyaltyLedger.filter(e => e.restaurant_id === restaurantId);
    const program = posStore.getLoyaltyProgram(restaurantId);

    const pointsIssued = ledger.filter(e => e.type.startsWith('earn_') && e.points > 0).reduce((s, e) => s + e.points, 0);
    const pointsRedeemed = Math.abs(ledger.filter(e => e.type === 'redeem').reduce((s, e) => s + e.points, 0));
    const pointsExpired = Math.abs(ledger.filter(e => e.type === 'expire').reduce((s, e) => s + e.points, 0));
    const outstandingLiabilityPoints = Math.max(0, pointsIssued - pointsRedeemed - pointsExpired);
    const outstandingLiabilityInr = (outstandingLiabilityPoints * program.config.point_value_paise) / 100;

    const repeatMembers = members.filter(m => m.visit_count > 1).length;
    const repeatRate = members.length > 0 ? (repeatMembers / members.length) * 100 : 0;

    // Total sales paise from members
    const totalSalesPaise = members.reduce((s, m) => s + (m.lifetime_spend_paise || 0), 0);
    const discountPaise = pointsRedeemed * program.config.point_value_paise;
    const effectiveCostPct = totalSalesPaise > 0 ? (discountPaise / totalSalesPaise) * 100 : 0;

    const guardrailBps = program.config.guardrail.max_effective_earn_rate_bps;
    const isGuardrailExceeded = (effectiveCostPct * 100) > guardrailBps;

    return res.json({
      status: 'success',
      metrics: {
        activeMembers: members.length,
        repeatRate: parseFloat(repeatRate.toFixed(1)),
        pointsIssued,
        pointsRedeemed,
        pointsExpired,
        outstandingLiabilityPoints,
        outstandingLiabilityInr,
        effectiveCostPct: parseFloat(effectiveCostPct.toFixed(2)),
        guardrailBps,
        isGuardrailExceeded,
        referralsCount: posStore.data.loyaltyReferrals.filter(r => r.restaurant_id === restaurantId).length
      }
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});
