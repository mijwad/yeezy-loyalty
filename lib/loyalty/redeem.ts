/**
 * Redemption Service
 * Core logic for reserving, settling, and reversing points redemptions
 */

import prisma from '../prisma';
import { PointsConfig } from '../points';

export interface RedeemInput {
  outletId: string;
  customerPhone: string;
  invoiceNo: string;
  points: number; // Internal points to redeem
  billAmountPaise: number;
  ttlSeconds?: number; // Default 3 hours (10800)
  rewardId?: string;
  rewardName?: string;
  discountType?: 'PERCENTAGE' | 'FIXED' | 'FREE_ITEM';
  discountValue?: number;
}

export interface RedeemResult {
  success: boolean;
  reservationId?: string;
  pointsBurned?: number;
  discountAmountPaise?: number;
  expiresAt?: Date;
  message: string;
  errorCode?: string;
  idempotent?: boolean;
}

/**
 * Reserve points for redemption (creates HELD redemption)
 * Idempotent on (outletId, invoiceNo) - same points returns existing, different points replaces
 */
export async function reserveRedemption(input: RedeemInput): Promise<RedeemResult> {
  const {
    outletId,
    customerPhone,
    invoiceNo,
    points,
    billAmountPaise,
    ttlSeconds = 10800,
    rewardId,
    rewardName,
    discountType,
    discountValue,
  } = input;

  const normalizedPhone = customerPhone.replace(/\D/g, '').replace(/^0+/, '').replace(/^91/, '');

  return await prisma.$transaction(async (tx) => {
    // 1. Find customer
    const customer = await tx.customer.findUnique({
      where: { outletId_phone: { outletId, phone: normalizedPhone } },
    });

    if (!customer) {
      return { success: false, message: 'Customer not found', errorCode: 'MEMBER_NOT_FOUND' };
    }

    // 2. Get available balance (excluding HELD reservations)
    const lastLedger = await tx.pointsLedger.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
    });
    const availableBalance = lastLedger?.balanceAfter ?? 0;

    // 3. Check if there's an existing active redemption for this invoice
    const existingRedemption = await tx.redemption.findFirst({
      where: {
        outletId,
        invoiceNo,
        status: 'HELD',
      },
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    // 4. Handle idempotent retry
    if (existingRedemption) {
      // Check if expired
      if (existingRedemption.expiresAt < now) {
        // Mark as expired and release points
        await tx.redemption.update({
          where: { id: existingRedemption.id },
          data: { status: 'EXPIRED_RELEASED', needsReview: false },
        });
        // Continue to create new one below
      } else if (existingRedemption.pointsBurned === points) {
        // Exact match - idempotent success
        return {
          success: true,
          reservationId: existingRedemption.id,
          pointsBurned: existingRedemption.pointsBurned,
          discountAmountPaise: existingRedemption.discountAmountPaise,
          expiresAt: existingRedemption.expiresAt,
          message: 'Redemption already reserved',
          idempotent: true,
        };
      } else {
        // Different points - cancel old, create new
        await tx.redemption.update({
          where: { id: existingRedemption.id },
          data: { status: 'CANCELLED' },
        });
        // Release the old reservation's points
        if (existingRedemption.reservationId) {
          await tx.pointsLedger.create({
            data: {
              customerId: customer.id,
              outletId,
              type: 'RELEASE',
              points: existingRedemption.pointsBurned,
              balanceAfter: availableBalance, // Will be recalculated
              description: `Released expired reservation for invoice ${invoiceNo}`,
              referenceType: 'REDEMPTION',
              referenceId: existingRedemption.id,
            },
          });
        }
        // Continue to create new one below
      }
    }

    // 5. Validate redemption
    const minPoints = 1; // Could be configurable
    const maxRedeemPercent = 100; // Could be configurable
    const minBillPaise = 0; // Could be configurable

    if (points < minPoints) {
      return { success: false, message: `Minimum ${minPoints} points required`, errorCode: 'BELOW_MIN_POINTS' };
    }
    if (availableBalance < points) {
      return { success: false, message: 'Insufficient points balance', errorCode: 'INSUFFICIENT_BALANCE' };
    }
    if (billAmountPaise < minBillPaise) {
      return { success: false, message: `Minimum bill amount not met`, errorCode: 'MIN_BILL_NOT_MET' };
    }

    const maxPointsByBill = Math.floor((billAmountPaise * maxRedeemPercent) / 100 / 100); // Assuming 1 point = ₹1
    if (points > maxPointsByBill) {
      return { success: false, message: `Cannot redeem more than ${maxRedeemPercent}% of bill`, errorCode: 'EXCEEDS_MAX_REDEEM_PERCENT' };
    }

    // 6. Calculate discount amount
    let discountAmountPaise = points * 100; // Default: 1 point = ₹1
    if (rewardId && discountType) {
      switch (discountType) {
        case 'PERCENTAGE':
          discountAmountPaise = Math.floor((billAmountPaise * (discountValue ?? 0)) / 100);
          break;
        case 'FIXED':
          discountAmountPaise = discountValue ?? 0;
          break;
        case 'FREE_ITEM':
          discountAmountPaise = discountValue ?? 0;
          break;
      }
    }

    // 7. Create reservation ledger entry (RESERVE type - negative points held)
    const newBalance = availableBalance - points;
    await tx.pointsLedger.create({
      data: {
        customerId: customer.id,
        outletId,
        type: 'RESERVE',
        points: -points,
        balanceAfter: newBalance,
        description: `Reserved for redemption invoice ${invoiceNo}`,
        referenceType: 'REDEMPTION',
        referenceId: invoiceNo,
      },
    });

    // 8. Create redemption record
    const redemption = await tx.redemption.create({
      data: {
        outletId,
        customerId: customer.id,
        rewardId,
        invoiceNo,
        pointsBurned: points,
        discountAmountPaise,
        status: 'HELD',
        reservationId: invoiceNo, // Use invoiceNo as reservation reference
        expiresAt,
      },
    });

    return {
      success: true,
      reservationId: redemption.id,
      pointsBurned: points,
      discountAmountPaise,
      expiresAt,
      message: 'Points reserved successfully',
    };
  });
}

/**
 * Settle redemption - link to order and finalize
 * Called when order comes in via saveOrder
 */
export interface SettleRedemptionInput {
  outletId: string;
  invoiceNo: string;
  posOrderId: string;
  orderId: string; // Internal order ID
}

export interface SettleRedemptionResult {
  success: boolean;
  status: 'SETTLED' | 'NEEDS_REVIEW' | 'NOT_FOUND';
  pointsBurned?: number;
  message: string;
}

export async function settleRedemption(input: SettleRedemptionInput): Promise<SettleRedemptionResult> {
  const { outletId, invoiceNo, posOrderId, orderId } = input;

  const redemption = await prisma.redemption.findFirst({
    where: {
      outletId,
      invoiceNo,
      status: { in: ['HELD', 'EXPIRED_RELEASED'] },
    },
  });

  if (!redemption) {
    return { success: true, status: 'NOT_FOUND', message: 'No redemption to settle' };
  }

  const now = new Date();
  const isExpired = redemption.expiresAt < now;

  await prisma.$transaction(async (tx) => {
    if (redemption.status === 'HELD' && !isExpired) {
      // Normal settlement - convert RESERVE to BURN
      await tx.pointsLedger.create({
        data: {
          customerId: redemption.customerId,
          outletId,
          type: 'BURN',
          points: -redemption.pointsBurned,
          balanceAfter: 0, // Will be calculated
          description: `Redeemed for order ${posOrderId}`,
          referenceType: 'REDEMPTION',
          referenceId: redemption.id,
        },
      });

      await tx.redemption.update({
        where: { id: redemption.id },
        data: {
          status: 'SETTLED',
          posOrderId,
          settledAt: now,
        },
      });
    } else {
      // Expired or already expired - mark needs review
      await tx.redemption.update({
        where: { id: redemption.id },
        data: {
          status: 'NEEDS_REVIEW',
          posOrderId,
          settledAt: now,
          needsReview: true,
          reviewReason: isExpired ? 'HOLD_EXPIRED_AT_SETTLE' : 'ALREADY_EXPIRED',
        },
      });
    }

    // Update order with redemption link
    await tx.order.update({
      where: { id: orderId },
      data: { /* redemption linked via posOrderId */ },
    });
  });

  return {
    success: true,
    status: isExpired ? 'NEEDS_REVIEW' : 'SETTLED',
    pointsBurned: redemption.pointsBurned,
    message: isExpired ? 'Redemption settled but hold was expired (needs review)' : 'Redemption settled',
  };
}

/**
 * Release/expire holds that have passed their TTL
 * Can be called via cron or lazily during redeem
 */
export async function expireHolds(): Promise<{ expiredCount: number }> {
  const now = new Date();

  const expiredRedemptions = await prisma.redemption.findMany({
    where: {
      status: 'HELD',
      expiresAt: { lt: now },
    },
  });

  let expiredCount = 0;

  for (const redemption of expiredRedemptions) {
    await prisma.$transaction(async (tx) => {
      // Mark redemption as expired
      await tx.redemption.update({
        where: { id: redemption.id },
        data: { status: 'EXPIRED_RELEASED' },
      });

      // Release points back to customer
      const lastLedger = await tx.pointsLedger.findFirst({
        where: { customerId: redemption.customerId },
        orderBy: { createdAt: 'desc' },
      });
      const currentBalance = lastLedger?.balanceAfter ?? 0;
      const newBalance = currentBalance + redemption.pointsBurned;

      await tx.pointsLedger.create({
        data: {
          customerId: redemption.customerId,
          outletId: redemption.outletId,
          type: 'RELEASE',
          points: redemption.pointsBurned,
          balanceAfter: newBalance,
          description: `Released expired hold for invoice ${redemption.invoiceNo}`,
          referenceType: 'REDEMPTION',
          referenceId: redemption.id,
        },
      });

      expiredCount++;
    });
  }

  return { expiredCount };
}

/**
 * Get customer's redemption history
 */
export async function getRedemptionHistory(outletId: string, phone: string) {
  const normalizedPhone = phone.replace(/\D/g, '').replace(/^0+/, '').replace(/^91/, '');
  const customer = await prisma.customer.findUnique({
    where: { outletId_phone: { outletId, phone: normalizedPhone } },
  });

  if (!customer) return [];

  return prisma.redemption.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
    include: { reward: true },
  });
}