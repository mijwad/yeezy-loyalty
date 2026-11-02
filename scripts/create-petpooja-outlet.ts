/**
 * Petpooja Outlet Onboarding Script
 * Creates a new outlet with a secure eateryBranchCode for Petpooja integration
 * Usage: npx tsx scripts/create-petpooja-outlet.ts <restaurantName> <outletName> [options]
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateBranchCode(length: number = 16): string {
  // Generate cryptographically random branch code
  // Exclude ambiguous characters: 0, O, I, l, 1
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: npx tsx scripts/create-petpooja-outlet.ts <restaurantName> <outletName> [options]');
    console.error('Options:');
    console.error('  --address <string>       Outlet address');
    console.error('  --contact <string>       Contact information');
    console.error('  --ignore-aggregators     Skip earning for Zomato/Swiggy (default: true)');
    console.error('  --no-ignore-aggregators  Allow earning for aggregator orders');
    console.error('  --otp-required           Enable OTP for redemption (default: false)');
    console.error('  --point-value <number>   Paise per point (default: 100 = ₹1)');
    console.error('  --earn-base <type>       CORE_TOTAL | TOTAL | CORE_MINUS_DISCOUNT (default: CORE_MINUS_DISCOUNT)');
    console.error('  --min-bill <number>      Minimum bill in rupees (default: 0)');
    console.error('  --min-points <number>    Minimum points to redeem (default: 1)');
    console.error('  --max-redeem-pct <number> Max % of bill redeemable (default: 100)');
    process.exit(1);
  }

  const restaurantName = args[0];
  const outletName = args[1];

  // Parse options
  let address = '';
  let contactInfo = '';
  let ignoreAggregators = true;
  let otpRequired = false;
  let pointValuePaise = 100;
  let earnBase: 'CORE_TOTAL' | 'TOTAL' | 'CORE_MINUS_DISCOUNT' = 'CORE_MINUS_DISCOUNT';
  let minBillPaise = 0;
  let minPoints = 1;
  let maxRedeemPercent = 100;

  for (let i = 2; i < args.length; i++) {
    switch (args[i]) {
      case '--address':
        address = args[++i];
        break;
      case '--contact':
        contactInfo = args[++i];
        break;
      case '--ignore-aggregators':
        ignoreAggregators = true;
        break;
      case '--no-ignore-aggregators':
        ignoreAggregators = false;
        break;
      case '--otp-required':
        otpRequired = true;
        break;
      case '--point-value':
        pointValuePaise = parseInt(args[++i], 10);
        break;
      case '--earn-base':
        earnBase = args[++i] as any;
        break;
      case '--min-bill':
        minBillPaise = Math.round(parseFloat(args[++i]) * 100);
        break;
      case '--min-points':
        minPoints = parseInt(args[++i], 10);
        break;
      case '--max-redeem-pct':
        maxRedeemPercent = parseInt(args[++i], 10);
        break;
    }
  }

  try {
    // Generate unique branch code
    let branchCode: string;
    let attempts = 0;
    do {
      branchCode = generateBranchCode(16);
      const existing = await prisma.outlet.findUnique({ where: { eateryBranchCode: branchCode } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new Error('Failed to generate unique branch code');
    }

    // Create or find restaurant
    let restaurant = await prisma.restaurant.findFirst({
      where: { name: restaurantName },
    });

    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: { name: restaurantName },
      });
      console.log(`✅ Created restaurant: ${restaurant.name} (${restaurant.id})`);
    } else {
      console.log(`📍 Using existing restaurant: ${restaurant.name} (${restaurant.id})`);
    }

    // Create outlet
    const outlet = await prisma.outlet.create({
      data: {
        restaurantId: restaurant.id,
        name: outletName,
        address: address || null,
        contactInfo: contactInfo || null,
        eateryBranchCode: branchCode,
        posSystem: 'PETPOOJA',
        ignoreAggregators,
        otpRequired,
        pointValuePaise,
        earnBase,
        minBillPaise,
        minPoints,
        maxRedeemPercent,
      },
    });

    console.log('\n✅ Outlet created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Restaurant: ${restaurant.name} (${restaurant.id})`);
    console.log(`Outlet:     ${outlet.name} (${outlet.id})`);
    console.log(`Address:    ${outlet.address || 'Not set'}`);
    console.log(`Contact:    ${outlet.contactInfo || 'Not set'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔑 eateryBranchCode: ${branchCode}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 Provide this to Petpooja for POS configuration:');
    console.log(`   Branch Code: ${branchCode}`);
    console.log(`   Partner Token: (set PETPOOJA_PARTNER_TOKEN in your .env)`);
    console.log('\n⚙️  Outlet Configuration:');
    console.log(`   Point Value:       1 point = ₹${pointValuePaise / 100}`);
    console.log(`   Earn Base:         ${earnBase}`);
    console.log(`   Ignore Aggregators: ${ignoreAggregators ? 'Yes' : 'No'}`);
    console.log(`   OTP Required:      ${otpRequired ? 'Yes' : 'No'}`);
    console.log(`   Min Bill:          ₹${minBillPaise / 100}`);
    console.log(`   Min Points:        ${minPoints}`);
    console.log(`   Max Redeem %:      ${maxRedeemPercent}%`);

    // Create some sample rewards
    const sampleRewards = [
      { name: '10% Off', discountType: 'PERCENTAGE' as const, pointsCost: 100, discountValue: 10, minBillPaise: 20000 },
      { name: '₹100 Off', discountType: 'FIXED' as const, pointsCost: 100, discountValue: 10000, minBillPaise: 50000 },
      { name: 'Free Coffee', discountType: 'FREE_ITEM' as const, pointsCost: 150, discountValue: 5000, minBillPaise: 0, posItemId: 'COFFEE_001' },
    ];

    for (const reward of sampleRewards) {
      await prisma.reward.create({
        data: {
          outletId: outlet.id,
          ...reward,
        },
      });
    }

    console.log('\n🎁 Created sample rewards:');
    sampleRewards.forEach((r, i) => console.log(`   ${i + 1}. ${r.name} (${r.pointsCost} points)`));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();