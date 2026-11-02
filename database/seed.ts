/**
 * Database Seed Script
 * Creates sample data for development/testing
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateBranchCode(length: number = 16): string {
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Create sample restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { id: 'demo-restaurant' },
    update: {},
    create: {
      id: 'demo-restaurant',
      name: 'Demo Restaurant',
    },
  });

  console.log(`✅ Restaurant: ${restaurant.name}`);

  // Create sample outlet with Petpooja integration
  const branchCode = generateBranchCode(16);
  const outlet = await prisma.outlet.upsert({
    where: { id: 'demo-outlet' },
    update: {},
    create: {
      id: 'demo-outlet',
      restaurantId: restaurant.id,
      name: 'Main Branch',
      address: '123 Demo Street, Demo City',
      contactInfo: '9876543210',
      eateryBranchCode: branchCode,
      posSystem: 'PETPOOJA',
      ignoreAggregators: true,
      otpRequired: false,
      pointValuePaise: 100, // 1 point = ₹1
      earnBase: 'CORE_MINUS_DISCOUNT',
      minBillPaise: 0,
      minPoints: 1,
      maxRedeemPercent: 100,
    },
  });

  console.log(`✅ Outlet: ${outlet.name} (Branch Code: ${branchCode})`);

  // Create sample rewards
  const rewards = [
    {
      outletId: outlet.id,
      name: '10% Off Bill',
      description: 'Get 10% discount on your bill',
      discountType: 'PERCENTAGE' as const,
      pointsCost: 100,
      discountValue: 10,
      minBillPaise: 20000, // ₹200
      isActive: true,
    },
    {
      outletId: outlet.id,
      name: '₹100 Off',
      description: 'Flat ₹100 discount',
      discountType: 'FIXED' as const,
      pointsCost: 100,
      discountValue: 10000,
      minBillPaise: 50000, // ₹500
      isActive: true,
    },
    {
      outletId: outlet.id,
      name: 'Free Coffee',
      description: 'Complimentary coffee',
      discountType: 'FREE_ITEM' as const,
      pointsCost: 150,
      discountValue: 5000, // ₹50
      posItemId: 'COFFEE_001',
      minBillPaise: 0,
      isActive: true,
    },
    {
      outletId: outlet.id,
      name: 'Free Dessert',
      description: 'Complimentary dessert',
      discountType: 'FREE_ITEM' as const,
      pointsCost: 200,
      discountValue: 10000, // ₹100
      posItemId: 'DESSERT_001',
      minBillPaise: 0,
      isActive: true,
    },
  ];

  for (const reward of rewards) {
    await prisma.reward.upsert({
      where: { id: `reward-${reward.name.replace(/\s+/g, '-').toLowerCase()}` },
      update: {},
      create: {
        id: `reward-${reward.name.replace(/\s+/g, '-').toLowerCase()}`,
        ...reward,
      },
    });
  }

  console.log('✅ Created sample rewards');

  // Create a test customer
  const customer = await prisma.customer.upsert({
    where: {
      outletId_phone: {
        outletId: outlet.id,
        phone: '9876543210',
      },
    },
    update: {},
    create: {
      outletId: outlet.id,
      phone: '9876543210',
      name: 'Test Customer',
      address: '456 Test Lane',
    },
  });

  console.log(`✅ Customer: ${customer.name} (${customer.phone})`);

  // Add some points to the customer
  await prisma.pointsLedger.upsert({
    where: { id: 'initial-points' },
    update: {},
    create: {
      id: 'initial-points',
      customerId: customer.id,
      outletId: outlet.id,
      type: 'EARN',
      points: 500,
      balanceAfter: 500,
      description: 'Welcome bonus',
      referenceType: 'ADJUSTMENT',
      referenceId: 'welcome',
    },
  });

  console.log('✅ Added 500 welcome points to test customer');

  // Create partner token for Petpooja
  const partnerToken = 'petpooja-partner-token-2024';
  const tokenHash = crypto.createHash('sha256').update(partnerToken).digest('hex');

  await prisma.partnerToken.upsert({
    where: { id: 'petpooja-token' },
    update: {},
    create: {
      id: 'petpooja-token',
      name: 'Petpooja',
      tokenHash,
      isActive: true,
    },
  });

  console.log('✅ Created Petpooja partner token');
  console.log(`\n🔑 Partner Token (for .env): ${partnerToken}`);
  console.log(`🔑 Branch Code (for Petpooja POS): ${branchCode}`);

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });