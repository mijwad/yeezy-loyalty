/**
 * Request Validation Middleware using Zod
 * Provides schema validation for all API endpoints
 */
import { z } from 'zod';
import { normalizePhone } from '../../lib/loyalty/engine.js';

/**
 * Validation schemas for different request types
 */
export const schemas = {
  // Customer upsert (PUT /customers/:phone)
  customerUpsert: z.object({
    body: z.object({
      name: z.string().min(1).max(256).optional(),
      birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      anniversary: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      email: z.string().email().optional(),
      metadata: z.record(z.unknown()).optional()
    }),
    params: z.object({
      phone: z.string().min(10).max(20) // E.164 format
    })
  }),

  // Loyalty member lookup
  loyaltyLookup: z.object({
    body: z.object({
      phone: z.string().min(10).max(20),
      name: z.string().max(256).optional(),
      restaurant_id: z.string().optional(),
      bill_paise: z.number().int().nonnegative().optional(),
      order_type: z.enum(['dine_in', 'takeaway', 'delivery', 'curbside']).optional()
    })
  }),

  // Earn points request
  loyaltyEarn: z.object({
    body: z.object({
      order_id: z.string().min(1).max(128),
      member_phone: z.string().min(10).max(20),
      member_name: z.string().max(256).optional(),
      subtotal_paise: z.number().int().nonnegative(),
      discounts_paise: z.number().int().nonnegative().optional(),
      points_redeemed_paise: z.number().int().nonnegative().optional(),
      order_type: z.enum(['dine_in', 'takeaway', 'delivery', 'curbside']).optional(),
      restaurant_id: z.string().optional()
    })
  }),

  // Redeem preview
  loyaltyRedeemPreview: z.object({
    body: z.object({
      member_phone: z.string().min(10).max(20),
      bill_paise: z.number().int().positive(),
      requested_points: z.number().int().positive().optional(),
      order_type: z.enum(['dine_in', 'takeaway', 'delivery', 'curbside']).optional(),
      has_conflicting_discounts: z.boolean().optional(),
      restaurant_id: z.string().optional()
    })
  }),

  // Redeem commit
  loyaltyRedeemCommit: z.object({
    body: z.object({
      order_id: z.string().min(1).max(128),
      member_phone: z.string().min(10).max(20),
      bill_paise: z.number().int().positive(),
      requested_points: z.number().int().positive().optional(),
      order_type: z.enum(['dine_in', 'takeaway', 'delivery', 'curbside']).optional(),
      restaurant_id: z.string().optional()
    })
  }),

  // Referral creation
  loyaltyReferral: z.object({
    body: z.object({
      referrer_phone: z.string().min(10).max(20),
      referee_phone: z.string().min(10).max(20),
      restaurant_id: z.string().optional()
    })
  }),

  // Program config update
  loyaltyProgramUpdate: z.object({
    body: z.object({
      config: z.object({
        point_value_paise: z.number().int().positive().optional(),
        earn: z.object({
          base_rate_bps: z.number().int().positive().optional(),
          eligible_amount: z.string().optional(),
          big_bill: z.object({
            enabled: z.boolean().optional(),
            threshold_paise: z.number().int().positive().optional(),
            bonus_points: z.number().int().nonnegative().optional()
          }).optional(),
          streak: z.object({
            enabled: z.boolean().optional(),
            within_days: z.number().int().positive().optional(),
            bonus_points: z.number().int().nonnegative().optional()
          }).optional(),
          bonus_points_expiry_days: z.number().int().positive().optional(),
          points_expiry_days: z.number().int().positive().optional()
        }).optional(),
        tiers: z.array(z.object({
          name: z.string().min(1),
          min_visits: z.number().int().nonnegative(),
          multiplier: z.number().positive()
        })).min(1).optional(),
        redeem: z.object({
          min_points: z.number().int().nonnegative().optional(),
          min_bill_paise: z.number().int().nonnegative().optional(),
          max_percent_of_bill: z.number().min(1).max(100).optional(),
          stackable_with_discounts: z.boolean().optional(),
          allowed_order_types: z.array(z.string()).optional()
        }).optional(),
        referral: z.object({
          enabled: z.boolean().optional(),
          referrer_points: z.number().int().nonnegative().optional(),
          referee_points: z.number().int().nonnegative().optional(),
          qualify_min_first_bill_paise: z.number().int().positive().optional(),
          max_referrals_per_month: z.number().int().positive().optional()
        }).optional(),
        winback: z.object({
          enabled: z.boolean().optional(),
          inactive_days: z.number().int().positive().optional(),
          multiplier: z.number().positive().optional(),
          valid_days: z.number().int().positive().optional()
        }).optional(),
        guardrail: z.object({
          max_effective_earn_rate_bps: z.number().int().positive().optional()
        }).optional()
      }),
      restaurant_id: z.string().optional()
    })
  }),

  // Multiplier rule
  multiplierRule: z.object({
    body: z.object({
      id: z.string().optional(),
      restaurant_id: z.string().optional(),
      name: z.string().min(1).max(128),
      multiplier: z.number().positive().max(10),
      days_of_week: z.array(z.number().int().min(0).max(6)).min(1),
      start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:\d{2})?$/),
      end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:\d{2})?$/),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      is_active: z.boolean().optional(),
      priority: z.number().int().optional()
    })
  }),

  // Refund reversal
  loyaltyRefund: z.object({
    body: z.object({
      order_id: z.string().min(1).max(128),
      original_order_paise: z.number().int().positive().optional(),
      refund_paise: z.number().int().positive(),
      restaurant_id: z.string().optional()
    })
  }),

  // V1 Public API - Customer lookup
  v1CustomerLookup: z.object({
    query: z.object({
      phone: z.string().min(10).max(20),
      bill_paise: z.string().transform(v => parseInt(v, 10)).optional()
    })
  }),

  // V1 Public API - Customer upsert
  v1CustomerUpsert: z.object({
    params: z.object({
      phone: z.string().min(10).max(20)
    }),
    body: z.object({
      name: z.string().max(256).optional(),
      birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      anniversary: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    })
  }),

  // V1 Public API - Reserve points
  v1ReservePoints: z.object({
    body: z.object({
      phone: z.string().min(10).max(20),
      points: z.number().int().positive(),
      bill_paise: z.number().int().positive(),
      ttl_seconds: z.number().int().positive().max(86400).optional()
    })
  }),

  // V1 Public API - Commit points
  v1CommitPoints: z.object({
    params: z.object({
      id: z.string().uuid()
    }),
    body: z.object({
      order_id: z.string().max(128).optional()
    })
  }),

  // V1 Public API - Release points
  v1ReleasePoints: z.object({
    params: z.object({
      id: z.string().uuid()
    })
  }),

  // V1 Public API - Orders (earn)
  v1Orders: z.object({
    body: z.object({
      order_id: z.string().min(1).max(128),
      phone: z.string().min(10).max(20),
      subtotal_paise: z.number().int().nonnegative(),
      order_type: z.enum(['dine_in', 'takeaway', 'delivery', 'curbside']),
      reservation_id: z.string().uuid().optional(),
      metadata: z.record(z.unknown()).optional()
    })
  }),

  // V1 Public API - Refund
  v1Refund: z.object({
    params: z.object({
      id: z.string().min(1).max(128)
    }),
    body: z.object({
      refund_paise: z.number().int().positive()
    })
  }),

  // Marketplace - Outlet create
  outletCreate: z.object({
    body: z.object({
      name: z.string().min(1).max(256),
      address: z.string().max(512).optional(),
      posSystem: z.enum(['petpooja', 'rms', 'toast', 'square', 'custom']),
      restId: z.string().min(1).max(64),
      posConfig: z.record(z.unknown()).optional()
    })
  }),

  // Marketplace - API key create
  apiKeyCreate: z.object({
    body: z.object({
      name: z.string().min(1).max(128),
      scopes: z.array(z.enum([
        'customers:read', 'customers:write',
        'points:earn', 'points:redeem',
        'webhooks:read', 'webhooks:write'
      ])).optional(),
      expiresInDays: z.number().int().positive().max(3650).optional(), // Max 10 years
      isTest: z.boolean().optional()
    })
  })
};

/**
 * Validate request against schema
 * @param {string} schemaName - Name of schema from schemas object
 * @returns {Function} Express middleware
 */
export function validateRequest(schemaName) {
  const schema = schemas[schemaName];
  if (!schema) {
    throw new Error(`Validation schema '${schemaName}' not found`);
  }

  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params
    });

    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }));

      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        errors
      });
    }

    // Attach validated data to request
    req.validated = result.data;
    next();
  };
}

/**
 * Sanitize phone number to E.164 format
 */
export function sanitizePhone(req, res, next) {
  if (req.body?.phone) {
    req.body.phone = normalizePhone(req.body.phone);
  }
  if (req.body?.member_phone) {
    req.body.member_phone = normalizePhone(req.body.member_phone);
  }
  if (req.body?.customer_phone) {
    req.body.customer_phone = normalizePhone(req.body.customer_phone);
  }
  if (req.query?.phone) {
    req.query.phone = normalizePhone(req.query.phone);
  }
  next();
}

/**
 * Sanitize and validate monetary amounts (convert to paise)
 */
export function sanitizeAmounts(req, res, next) {
  const amountFields = [
    'subtotal_paise', 'discounts_paise', 'points_redeemed_paise',
    'bill_paise', 'refund_paise', 'original_order_paise',
    'subtotal', 'discounts', 'points_redeemed',
    'bill_amount', 'gross_amount', 'net_paid', 'loyalty_discount'
  ];

  for (const field of amountFields) {
    if (req.body?.[field] !== undefined) {
      const value = parseFloat(req.body[field]);
      if (isNaN(value) || value < 0) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_AMOUNT',
          message: `${field} must be a non-negative number`
        });
      }
      // If field doesn't end with _paise, assume it's in rupees and convert
      if (!field.endsWith('_paise') && field !== 'loyalty_discount') {
        req.body[field + '_paise'] = Math.round(value * 100);
      } else {
        req.body[field] = Math.round(value);
      }
    }
  }
  next();
}

export default { validateRequest, sanitizePhone, sanitizeAmounts, schemas };