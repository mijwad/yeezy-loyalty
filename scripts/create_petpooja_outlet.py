#!/usr/bin/env python3
"""Petpooja Outlet Onboarding Script.

Creates a new outlet with a secure eateryBranchCode for Petpooja integration.
Usage: python -m scripts.create_petpooja_outlet <restaurantName> <outletName> [options]
"""

import sys
import os
import uuid
import time
import secrets
import string

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from free_claude_code.runtime.sqlite_database import SQLiteDatabase
from pathlib import Path


def generate_branch_code(length: int = 16) -> str:
    """Generate cryptographically random branch code."""
    # Exclude ambiguous characters: 0, O, I, l, 1
    charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    return ''.join(secrets.choice(charset) for _ in range(length))


async def main():
    args = sys.argv[1:]

    if len(args) < 2:
        print('Usage: python -m scripts.create_petpooja_outlet <restaurantName> <outletName> [options]')
        print('Options:')
        print('  --address <string>       Outlet address')
        print('  --contact <string>       Contact information')
        print('  --ignore-aggregators     Skip earning for Zomato/Swiggy (default: true)')
        print('  --no-ignore-aggregators  Allow earning for aggregator orders')
        print('  --otp-required           Enable OTP for redemption (default: false)')
        print('  --point-value <number>   Paise per point (default: 100 = ₹1)')
        print('  --earn-base <type>       CORE_TOTAL | TOTAL | CORE_MINUS_DISCOUNT (default: CORE_MINUS_DISCOUNT)')
        print('  --min-bill <number>      Minimum bill in rupees (default: 0)')
        print('  --min-points <number>    Minimum points to redeem (default: 1)')
        print('  --max-redeem-pct <number> Max % of bill redeemable (default: 100)')
        print('  --whatsapp-template <name> WhatsApp template name (default: purchase_confirmation)')
        print('  --whatsapp-lang <code>   WhatsApp language code (default: en)')
        sys.exit(1)

    restaurant_name = args[0]
    outlet_name = args[1]

    # Parse options
    address = ''
    contact_info = ''
    ignore_aggregators = True
    otp_required = False
    point_value_paise = 100
    earn_base = 'CORE_MINUS_DISCOUNT'
    min_bill_paise = 0
    min_points = 1
    max_redeem_percent = 100
    whatsapp_template = 'purchase_confirmation'
    whatsapp_lang = 'en'

    i = 2
    while i < len(args):
        if args[i] == '--address':
            address = args[i + 1]
            i += 2
        elif args[i] == '--contact':
            contact_info = args[i + 1]
            i += 2
        elif args[i] == '--ignore-aggregators':
            ignore_aggregators = True
            i += 1
        elif args[i] == '--no-ignore-aggregators':
            ignore_aggregators = False
            i += 1
        elif args[i] == '--otp-required':
            otp_required = True
            i += 1
        elif args[i] == '--point-value':
            point_value_paise = int(args[i + 1])
            i += 2
        elif args[i] == '--earn-base':
            earn_base = args[i + 1]
            i += 2
        elif args[i] == '--min-bill':
            min_bill_paise = int(float(args[i + 1]) * 100)
            i += 2
        elif args[i] == '--min-points':
            min_points = int(args[i + 1])
            i += 2
        elif args[i] == '--max-redeem-pct':
            max_redeem_percent = int(args[i + 1])
            i += 2
        elif args[i] == '--whatsapp-template':
            whatsapp_template = args[i + 1]
            i += 2
        elif args[i] == '--whatsapp-lang':
            whatsapp_lang = args[i + 1]
            i += 2
        else:
            i += 1

    # Database path
    db_path = Path.home() / '.free-claude-code' / 'fcc.db'
    lock_path = Path.home() / '.free-claude-code' / 'fcc.lock'

    db = SQLiteDatabase(db_path, lock_path)
    await db.start()

    try:
        # Generate unique branch code
        branch_code = generate_branch_code(16)
        attempts = 0
        while attempts < 10:
            existing = db.execute(
                "SELECT id FROM outlets WHERE eatery_branch_code = ?",
                (branch_code,)
            ).fetchone()
            if not existing:
                break
            branch_code = generate_branch_code(16)
            attempts += 1

        if attempts >= 10:
            raise Exception('Failed to generate unique branch code')

        # Create or find restaurant
        restaurant = db.execute(
            "SELECT id FROM restaurants WHERE name = ?",
            (restaurant_name,)
        ).fetchone()

        if not restaurant:
            restaurant_id = str(uuid.uuid4())
            now = int(time.time())
            db.execute(
                "INSERT INTO restaurants (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (restaurant_id, restaurant_name, now, now)
            )
            print(f'✅ Created restaurant: {restaurant_name} ({restaurant_id})')
        else:
            restaurant_id = restaurant['id']
            print(f'📍 Using existing restaurant: {restaurant_name} ({restaurant_id})')

        # Create outlet
        outlet_id = str(uuid.uuid4())
        now = int(time.time())

        db.execute(
            """INSERT INTO outlets (
                id, restaurant_id, name, address, contact_info, eatery_branch_code,
                rest_id, pos_system, ignore_aggregators, otp_required,
                point_value_paise, earn_base, min_bill_paise, min_points,
                max_redeem_percent, whatsapp_purchase_template, whatsapp_language,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                outlet_id, restaurant_id, outlet_name, address or None, contact_info or None,
                branch_code, None, 'PETPOOJA', int(ignore_aggregators), int(otp_required),
                point_value_paise, earn_base, min_bill_paise, min_points,
                max_redeem_percent, whatsapp_template, whatsapp_lang, now, now
            )
        )

        print('\n✅ Outlet created successfully!')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print(f'Restaurant: {restaurant_name} ({restaurant_id})')
        print(f'Outlet:     {outlet_name} ({outlet_id})')
        print(f'Address:    {address or "Not set"}')
        print(f'Contact:    {contact_info or "Not set"}')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print(f'🔑 eateryBranchCode: {branch_code}')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('\n📋 Provide this to Petpooja for POS configuration:')
        print(f'   Branch Code: {branch_code}')
        print(f'   Partner Token: (set PETPOOJA_PARTNER_TOKEN in your .env)')
        print('\n⚙️  Outlet Configuration:')
        print(f'   Point Value:         1 point = ₹{point_value_paise / 100}')
        print(f'   Earn Base:           {earn_base}')
        print(f'   Ignore Aggregators:  {ignore_aggregators}')
        print(f'   OTP Required:        {otp_required}')
        print(f'   Min Bill:            ₹{min_bill_paise / 100}')
        print(f'   Min Points:          {min_points}')
        print(f'   Max Redeem %:        {max_redeem_percent}%')
        print(f'   WhatsApp Template:   {whatsapp_template}')
        print(f'   WhatsApp Language:   {whatsapp_lang}')

        # Create some sample rewards
        sample_rewards = [
            {'name': '10% Off', 'discount_type': 'PERCENTAGE', 'points_cost': 100, 'discount_value': 10, 'min_bill_paise': 20000},
            {'name': '₹100 Off', 'discount_type': 'FIXED', 'points_cost': 100, 'discount_value': 10000, 'min_bill_paise': 50000},
            {'name': 'Free Coffee', 'discount_type': 'FREE_ITEM', 'points_cost': 150, 'discount_value': 5000, 'min_bill_paise': 0, 'pos_item_id': 'COFFEE_001'},
        ]

        for reward in sample_rewards:
            reward_id = str(uuid.uuid4())
            db.execute(
                """INSERT INTO rewards (
                    id, outlet_id, name, description, discount_type, points_cost,
                    discount_value, pos_item_id, min_bill_paise, is_active,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    reward_id, outlet_id, reward['name'], f"Get {reward['name']}",
                    reward['discount_type'], reward['points_cost'],
                    reward['discount_value'], reward.get('pos_item_id'),
                    reward['min_bill_paise'], 1, now, now
                )
            )

        print('\n🎁 Created sample rewards:')
        for i, r in enumerate(sample_rewards):
            print(f'   {i + 1}. {r["name"]} ({r["points_cost"]} points)')

    except Exception as e:
        print(f'❌ Error: {e}')
        sys.exit(1)
    finally:
        await db.close()


if __name__ == '__main__':
    import asyncio
    asyncio.run(main())