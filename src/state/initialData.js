// Global clean zero initial state for Yeezy Restaurant Loyalty Platform

const emptyBars = [
  { label: 'W1', value: 0, amount: '₹0' },
  { label: 'W2', value: 0, amount: '₹0' },
  { label: 'W3', value: 0, amount: '₹0' },
  { label: 'W4', value: 0, amount: '₹0' },
  { label: 'W5', value: 0, amount: '₹0' },
  { label: 'W6', value: 0, amount: '₹0' },
  { label: 'W7', value: 0, amount: '₹0' },
  { label: 'W8', value: 0, amount: '₹0' },
  { label: 'W9', value: 0, amount: '₹0' },
  { label: 'W10', value: 0, amount: '₹0' },
  { label: 'W11', value: 0, amount: '₹0' },
  { label: 'W12', value: 0, amount: '₹0' }
];

export const initialData = {
  activeOutlet: 'Downtown Bistro',
  outlets: [
    { id: '1', name: 'Downtown Bistro', address: '124 Market St, Suite 100', active: true, restID: 'PP_DEL_101' }
  ],

  // Petpooja Marketplace Integration (Exact Reelo flow)
  isPetpoojaIntegrated: false,
  petpoojaRestID: 'PP_DEL_101',
  petpoojaConnectedAt: null,
  reeloKey: '89146762-bc2a-4be4-ba5f-8c0aef3a358e',
  
  user: {
    name: 'Alex Rivera',
    email: 'alex.rivera@downtownbistro.com',
    role: 'Restaurant Owner & Operator',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Alex+Rivera'
  },
  
  apiKey: 'YOUR_API_KEY_HERE',
  projectId: '11187122990638679098',
  
  timeFilter: 'today', // 'today' | 'yesterday'
  
  todayStats: {
    sales: 0,
    orders: 0,
    customers: 0,
    pointsIssued: 0,
    totalPointsCapacity: 100000,
    burnRate: '0%',
    rewardsRedeemed: 0,
    activeMembers: 0,
    activeMembersGrowth: '0%',
    repeatVisitRate: '0%',
    repeatVisitGrowth: '0%',
    loyaltyRoi: '0.0x'
  },
  
  yesterdayStats: {
    sales: 0,
    orders: 0,
    customers: 0,
    pointsIssued: 0,
    totalPointsCapacity: 100000,
    burnRate: '0%',
    rewardsRedeemed: 0,
    activeMembers: 0,
    activeMembersGrowth: '0%',
    repeatVisitRate: '0%',
    repeatVisitGrowth: '0%',
    loyaltyRoi: '0.0x'
  },
  
  creditsBalance: {
    sms: 100,
    email: 100,
    whatsappUtility: 100,
    whatsappMarketing: 100,
    autoRefillEnabled: false,
    autoRefillThreshold: 20,
    autoRefillAmount: 500
  },

  businessHighlights: {
    activeTab: 'sales', // 'sales' | 'orders' | 'customers' | 'rewards'
    tabs: {
      sales: {
        totalDisplay: '₹0',
        label: 'Total Sales',
        peakWeek: 'W1',
        peakHighlight: 'No Transactions Yet',
        peakGrowth: '0%',
        peakSubtitle: '0 orders captured so far',
        bars: emptyBars.map(b => ({ ...b, amount: '₹0' }))
      },
      orders: {
        totalDisplay: '0',
        label: 'Total Orders',
        peakWeek: 'W1',
        peakHighlight: 'No Orders Yet',
        peakGrowth: '0%',
        peakSubtitle: '0 completed orders',
        bars: emptyBars.map(b => ({ ...b, amount: '0 orders' }))
      },
      customers: {
        totalDisplay: '0',
        label: 'Total Customers',
        peakWeek: 'W1',
        peakHighlight: 'No Diners Yet',
        peakGrowth: '0%',
        peakSubtitle: '0 unique diners seated',
        bars: emptyBars.map(b => ({ ...b, amount: '0 diners' }))
      },
      rewards: {
        totalDisplay: '0',
        label: 'Rewards Redeemed',
        peakWeek: 'W1',
        peakHighlight: 'No Redemptions Yet',
        peakGrowth: '0%',
        peakSubtitle: '0 vouchers redeemed',
        bars: emptyBars.map(b => ({ ...b, amount: '0 rewards' }))
      }
    }
  },

  customers: [],

  loyaltyProgram: {
    isActive: true,
    activationDate: '2026-10-23',
    type: 'amount_spent',
    name: 'Downtown Bistro Rewards',
    title: 'Downtown Bistro Rewards',
    subtitle: 'Get rewarded on every purchase',
    logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=128&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    themeColor: '#0a7d74',
    themePalette: 'teal',
    cardBg: '#1e293b',
    spendRate: 100,
    pointsRate: 10,
    pointValueInr: 1.0,
    minBillToEarn: 100,
    minBillToRedeem: 200,
    maxDiscountPercentage: 50.0,
    maxPointsPerBill: 5000,
    welcomeBonusPoints: 100,
    rewardTiers: [
      {
        id: 'tier-1',
        points: 500,
        title: 'Get a free coffee or dessert',
        condition: '*Minimum purchase of ₹250 required to redeem reward.',
        rewardType: 'item'
      },
      {
        id: 'tier-2',
        points: 1000,
        title: "You're special. Get ₹125 off",
        condition: '*Valid on food & beverage bills above ₹500.',
        rewardType: 'discount_amount'
      },
      {
        id: 'tier-3',
        points: 1500,
        title: 'VIP Celebration: Flat 15% OFF entire bill',
        condition: '*Up to maximum discount of ₹400.',
        rewardType: 'discount_percentage'
      }
    ],
    reminders: {
      inactivityReminderDays: 30,
      inactivityReminderEnabled: true,
      inactivityMessage: "We miss you at Downtown Bistro! You have {points} loyalty points waiting. Visit us this week and enjoy a complimentary chef's treat!",
      expiryAlertMonths: 11,
      expiryAlertDays: 11,
      expiryAlertEnabled: true,
      expiryAlertMessage: 'Reminder: Your {points} points will expire soon. Redeem them before they lapse on your next visit!',
      pointsExpiryMonths: 12,
      pointsExpiryEnabled: true
    },
    channels: {
      sms: {
        enabled: true,
        senderId: 'DWNTWN',
        template: 'Hi {name}, you just earned {points} points at Downtown Bistro! Total Balance: {balance} pts. Redeem at: bit.ly/yeezy-r'
      },
      whatsappUtility: {
        enabled: true,
        verifiedBadge: true,
        template: 'Hello {name}! 🎉 Thank you for dining with us today. You earned {points} Yeezy points. Current balance: {balance} points.'
      },
      whatsappMarketing: {
        enabled: true,
        template: 'Exclusive Weekend Special for our VIP Members! Double points on all Chef Tasting menus this Saturday.'
      },
      email: {
        enabled: true,
        fromEmail: 'loyalty@downtownbistro.com',
        subject: 'Your Downtown Bistro Loyalty Statement'
      }
    },
    termsAndConditions: '1. Points are credited within 10 minutes of bill payment. 2. Points cannot be redeemed for cash or transferred. 3. Only one reward voucher can be redeemed per table per visit. 4. Downtown Bistro reserves the right to modify or terminate terms with prior notice.'
  }
};
