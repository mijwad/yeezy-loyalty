/**
 * Customer-Facing Rewards Page API
 * Thin data-mapping layer for the "My Rewards" page
 * GET /api/rewards/:token
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { normalizePhone, maskPhone } from '../lib/phone';
import { pointsToRupeeEquivalent, calculateRedeemablePoints, PointsConfig } from '../lib/points';

const router = Router();

interface RewardsPageData {
  // Customer info
  customer: {
    firstName: string;
    maskedPhone: string;
  };
  // Outlet/restaurant info
  outlet: {
    name: string;
    logoUrl?: string;
    brandColor: string;
    contactPhone?: string;
  };
  // Loyalty program config
  program: {
    displayMode: 'points' | 'cash'; // Per-restaurant setting
    pointValuePaise: number;
    earnRate: number; // Points per ₹100
    minBillPaise: number;
    maxRedeemPercent: number;
  };
  // Balance info
  balance: {
    points: number; // Internal points
    displayValue: string; // Formatted for display (pts or ₹)
    expiresAt?: Date; // Soonest expiring balance
    expiringSoon: boolean; // Within 7 days
  };
  // Redeemable balance for a typical bill
  redeemable: {
    points: number;
    displayValue: string;
    billAmountPaise: number; // Reference bill amount used
  };
  // Available rewards (what customer can redeem now)
  availableRewards: Array<{
    id: string;
    name: string;
    description?: string;
    pointsCost: number;
    displayCost: string;
    discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_ITEM';
    discountValue?: number;
    minBillPaise: number;
    isUnlocked: boolean;
    progressToUnlock?: number; // 0-100 for progress bar
  }>;
  // Tier progress (for cashback-style programs)
  tierProgress?: {
    currentTier: string;
    nextTier?: string;
    currentTierBenefit: string;
    nextTierBenefit?: string;
    progressPercent: number;
    pointsToNextTier?: number;
  };
  // Program rules for Terms card
  terms: {
    minPurchase: string;
    maxRedeemPercent: number;
    noCashExchange: boolean;
    cannotCombineOffers: boolean;
    pointsExpiryDays?: number;
  };
}

function getFirstName(fullName?: string | null): string {
  if (!fullName) return 'there';
  return fullName.trim().split(/\s+/)[0];
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatCurrency(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

// GET /api/rewards/:token - Returns data for rewards page
// NOTE: Currently uses outletId + phone for development.
// Production needs: JWT token decode -> outletId + customerId
router.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    // DEVELOPMENT MODE: Token format "outletId:phone" or just use query params
    // PRODUCTION: Decode JWT token to get outletId + customerId
    let outletId: string;
    let phone: string;

    if (token.includes(':')) {
      [outletId, phone] = token.split(':');
    } else {
      // Fallback: check query params (for testing)
      outletId = req.query.outletId as string;
      phone = req.query.phone as string;
    }

    if (!outletId || !phone) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Link expired or invalid. Please request a new link from the restaurant.',
      });
    }

    const normalizedPhone = normalizePhone(phone);

    // Fetch outlet with restaurant info
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      include: { restaurant: true },
    });

    if (!outlet) {
      return res.status(404).json({ error: 'Outlet not found' });
    }

    // Fetch customer
    const customer = await prisma.customer.findUnique({
      where: { outletId_phone: { outletId, phone: normalizedPhone } },
    });

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found',
        message: 'This rewards link is not associated with a valid account.',
      });
    }

    // Get current balance
    const lastLedger = await prisma.pointsLedger.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
    });
    const balancePoints = lastLedger?.balanceAfter ?? 0;

    // Get active rewards for this outlet
    const now = new Date();
    const rewards = await prisma.reward.findMany({
      where: {
        outletId,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      orderBy: { pointsCost: 'asc' },
    });

    // Program config
    const pointsConfig: PointsConfig = { pointValuePaise: outlet.pointValuePaise };
    const referenceBillPaise = 100000; // ₹1000 reference bill for redeemable calculation

    // Calculate redeemable points for reference bill
    const redeemablePoints = calculateRedeemablePoints(
      balancePoints,
      referenceBillPaise,
      pointsConfig,
      {
        minBillPaise: outlet.minBillPaise,
        minPoints: outlet.minPoints,
        maxRedeemPercent: outlet.maxRedeemPercent,
      }
    );

    // Determine display mode (per-restaurant setting - default to 'points')
    // In production, this would come from LoyaltyConfig table
    const displayMode: 'points' | 'cash' = 'points'; // TODO: Fetch from LoyaltyConfig

    // Format balance for display
    const balanceDisplayValue = displayMode === 'cash'
      ? `₹${pointsToRupeeEquivalent(balancePoints, pointsConfig)} cashback`
      : `${formatNumber(balancePoints)} pts`;

    const redeemableDisplayValue = displayMode === 'cash'
      ? `₹${pointsToRupeeEquivalent(redeemablePoints, pointsConfig)} off`
      : `${formatNumber(redeemablePoints)} pts`;

    // Check for expiring points (TODO: Implement expiry tracking)
    // For now, no expiry data exists in the schema
    const expiresAt: Date | undefined = undefined;
    const expiringSoon = false;

    // Map rewards with unlock status
    const availableRewards = rewards.map((reward, index) => {
      const canAfford = balancePoints >= reward.pointsCost;
      const displayCost = displayMode === 'cash'
        ? `₹${pointsToRupeeEquivalent(reward.pointsCost, pointsConfig)}`
        : `${formatNumber(reward.pointsCost)} pts`;

      // Progress to unlock this reward (if not yet affordable)
      let progressToUnlock: number | undefined;
      if (!canAfford && balancePoints > 0) {
        progressToUnlock = Math.min(100, Math.round((balancePoints / reward.pointsCost) * 100));
      }

      return {
        id: reward.id,
        name: reward.name,
        description: reward.description,
        pointsCost: reward.pointsCost,
        displayCost,
        discountType: reward.discountType,
        discountValue: reward.discountValue ?? undefined,
        minBillPaise: reward.minBillPaise,
        isUnlocked: canAfford,
        progressToUnlock,
      };
    });

    // Calculate tier progress (for cashback-style programs)
    // Simple tier logic: Silver (0-999 pts), Gold (1000-4999), Platinum (5000+)
    let tierProgress: RewardsPageData['tierProgress'];
    if (displayMode === 'cash') {
      const tiers = [
        { name: 'Silver', minPoints: 0, benefit: 'Earn 5% back on every bill' },
        { name: 'Gold', minPoints: 1000, benefit: 'Earn 7% back on every bill' },
        { name: 'Platinum', minPoints: 5000, benefit: 'Earn 10% back on every bill' },
      ];

      let currentTier = tiers[0];
      let nextTier = tiers[1];

      for (let i = tiers.length - 1; i >= 0; i--) {
        if (balancePoints >= tiers[i].minPoints) {
          currentTier = tiers[i];
          nextTier = tiers[i + 1];
          break;
        }
      }

      const progressPercent = nextTier
        ? Math.min(100, Math.round(((balancePoints - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100))
        : 100;

      tierProgress = {
        currentTier: currentTier.name,
        nextTier: nextTier?.name,
        currentTierBenefit: currentTier.benefit,
        nextTierBenefit: nextTier?.benefit,
        progressPercent,
        pointsToNextTier: nextTier ? nextTier.minPoints - balancePoints : undefined,
      };
    }

    // Program terms (from outlet config)
    const terms = {
      minPurchase: formatCurrency(outlet.minBillPaise),
      maxRedeemPercent: outlet.maxRedeemPercent,
      noCashExchange: true,
      cannotCombineOffers: true,
      pointsExpiryDays: undefined, // TODO: Add when expiry tracking is implemented
    };

    // Build response
    const data: RewardsPageData = {
      customer: {
        firstName: getFirstName(customer.name),
        maskedPhone: `+91 •••••${normalizedPhone.slice(-5)}`,
      },
      outlet: {
        name: outlet.name,
        logoUrl: undefined, // TODO: Add logoUrl field to Outlet model
        brandColor: '#2563EB', // TODO: Add brandColor field to Outlet/Restaurant model
        contactPhone: outlet.contactInfo,
      },
      program: {
        displayMode,
        pointValuePaise: outlet.pointValuePaise,
        earnRate: Math.round(10000 / outlet.pointValuePaise), // Points per ₹100
        minBillPaise: outlet.minBillPaise,
        maxRedeemPercent: outlet.maxRedeemPercent,
      },
      balance: {
        points: balancePoints,
        displayValue: balanceDisplayValue,
        expiresAt,
        expiringSoon,
      },
      redeemable: {
        points: redeemablePoints,
        displayValue: redeemableDisplayValue,
        billAmountPaise: referenceBillPaise,
      },
      availableRewards,
      tierProgress,
      terms,
    };

    // Security headers
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });

    res.json(data);
  } catch (error) {
    console.error('Rewards page API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Unable to load rewards. Please try again later.',
    });
  }
});

export default router;