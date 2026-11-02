/**
 * Petpooja Zod Schemas
 * Lenient validation: accept numbers as strings, handle inconsistent casing
 */

import { z } from 'zod';

// Helper: accept string or number, coerce to number
const numStr = z.union([z.string(), z.number()]).transform((v) => Number(v));

// Helper: accept string or number, coerce to string
const strOrNum = z.union([z.string(), z.number()]).transform((v) => String(v));

// Restaurant object
const RestaurantSchema = z.object({
  res_name: z.string(),
  address: z.string(),
  contact_information: z.string(),
  restID: z.string(),
  eateryBranchCode: z.string(),
});

// Customer object
const CustomerSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string(), // Required
  loyaltyCode: z.string().optional(),
});

// OrderItem object
const OrderItemSchema = z.object({
  name: z.string(),
  itemid: numStr,
  specialnotes: z.string().optional(),
  price: numStr,
  quantity: numStr,
  total: numStr,
  addon: z.array(z.any()).optional(),
  discount: numStr.optional(),
});

// Tax object
const TaxSchema = z.object({
  title: z.string(),
  type: z.string(), // "P" or "F"
  rate: numStr,
  amount: numStr,
}).partial().optional(); // Optional if no tax

// Discount object
const DiscountSchema = z.object({
  title: z.string(),
  type: z.string(), // "P" or "F"
  rate: numStr,
  amount: numStr,
}).partial().optional(); // Optional if no discount

// Order object - handle inconsistent casing (Invoice_amount vs invoice_amount)
const OrderSchema = z.object({
  orderID: strOrNum,
  delivery_charges: numStr.optional(),
  order_type: z.string(),
  payment_type: z.string(),
  table_no: numStr.optional(),
  no_of_persons: numStr.optional(),
  discount_total: numStr,
  tax_total: numStr,
  round_off: numStr.optional(),
  core_total: numStr,
  total: numStr,
  created_on: z.string(),
  orderFrom: z.string().optional(),
  totalCharges: numStr.optional(),
  // Also accept lowercase variants
  invoice_amount: numStr.optional(),
  invoice_no: strOrNum.optional(),
}).transform((data) => ({
  ...data,
  invoice_amount: data.invoice_amount ?? data.Invoice_amount,
  invoice_no: data.invoice_no ?? data.Invoice_no,
}));

// Full data object for saveOrder
const SaveOrderDataSchema = z.object({
  Restaurant: RestaurantSchema,
  Customer: CustomerSchema,
  Order: OrderSchema,
  OrderItem: z.array(OrderItemSchema),
  Tax: TaxSchema,
  Discount: DiscountSchema,
});

// Save Order Request
export const SaveOrderRequestSchema = z.object({
  token: z.string(),
  data: SaveOrderDataSchema,
});

// Get Rewards Request
export const GetRewardsRequestSchema = z.object({
  token: z.string(),
  number: z.string(),
  eateryBranchCode: z.string(),
  bill_amount: numStr,
});

// Redeem Request
export const RedeemRequestSchema = z.object({
  token: z.string(),
  number: z.string(),
  reward_points: z.string().optional(), // Reward ID as string
  points: z.string().optional(), // Cashback points as string
  invoice_amount: numStr,
  invoice_no: strOrNum,
  eateryBranchCode: z.string(),
}).transform((data) => ({
  ...data,
  reward_points: data.reward_points ? String(data.reward_points) : '',
  points: data.points ? Number(data.points) : 0,
}));

// Verify OTP Request
export const VerifyOtpRequestSchema = z.object({
  token: z.string(),
  number: z.string(),
  reward_points: z.string().optional(),
  points: z.string().optional(),
  invoice_amount: numStr,
  invoice_no: strOrNum,
  eateryBranchCode: z.string(),
  otp: z.string(),
}).transform((data) => ({
  ...data,
  reward_points: data.reward_points ? String(data.reward_points) : '',
  points: data.points ? Number(data.points) : 0,
}));

// Type exports
export type SaveOrderRequest = z.infer<typeof SaveOrderRequestSchema>;
export type GetRewardsRequest = z.infer<typeof GetRewardsRequestSchema>;
export type RedeemRequest = z.infer<typeof RedeemRequestSchema>;
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;