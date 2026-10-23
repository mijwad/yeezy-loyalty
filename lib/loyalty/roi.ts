// Pure TypeScript ROI Simulation & Metrics Engine
// Implements Section 4 & Acceptance Test 12 of Loyalty Points Module Spec.

import type { ROIInput, ROIResult } from './types.ts';

/**
 * Pure function: calculates projected restaurant loyalty ROI and break-even metrics.
 * 
 * Formula:
 * cost            = total_visits_after × avg_bill × earn_rate × redemption_rate + software_cost
 * incremental     = (visits_after − visits_before) × members × avg_bill × margin
 * net             = incremental − cost
 * roi             = net / cost
 * breakeven_lift  = (earn_rate × redemption_rate) / margin   // fraction of baseline visits needed
 */
export function calculateROI(input: ROIInput): ROIResult {
  const members = Math.max(0, input.members || 0);
  const visitsBefore = Math.max(0, input.visits_before_per_member || 0);
  const visitsAfter = Math.max(0, input.visits_after_per_member || 0);
  const avgBillPaise = Math.max(0, input.avg_bill_paise || 0);
  
  // Percentages converted to decimals (e.g. 40% -> 0.40)
  const margin = (input.contribution_margin_pct || 0) / 100;
  const earnRate = (input.earn_rate_pct || 0) / 100;
  const redemptionRate = (input.redemption_rate_pct || 0) / 100;
  const softwareCostPaise = Math.max(0, input.monthly_software_cost_paise || 0);

  const totalVisitsAfter = Math.round(members * visitsAfter);
  const incrementalVisits = Math.max(0, (visitsAfter - visitsBefore) * members);

  // Cost = total_visits_after * avg_bill * earn_rate * redemption_rate + software_cost
  const costPaise = Math.round(totalVisitsAfter * avgBillPaise * earnRate * redemptionRate + softwareCostPaise);
  
  // Incremental = (visits_after - visits_before) * members * avg_bill * margin
  const incrementalProfitPaise = Math.round(incrementalVisits * avgBillPaise * margin);

  // Net = incremental - cost
  const netProfitPaise = incrementalProfitPaise - costPaise;

  // ROI = net / cost
  const roiPct = costPaise > 0 ? (netProfitPaise / costPaise) * 100 : 0;
  const roiMultiple = costPaise > 0 ? (netProfitPaise / costPaise) + 1 : 1;

  // Breakeven lift = (earn_rate * redemption_rate) / margin
  const breakevenLiftPct = margin > 0 ? ((earnRate * redemptionRate) / margin) * 100 : 0;
  const baselineTotalVisits = members * visitsBefore;
  const breakevenAdditionalVisits = Math.round(baselineTotalVisits * (breakevenLiftPct / 100));

  return {
    total_visits_after: totalVisitsAfter,
    incremental_visits: Math.round(incrementalVisits),
    cost_paise: costPaise,
    cost_inr: Math.round(costPaise / 100),
    incremental_profit_paise: incrementalProfitPaise,
    incremental_profit_inr: Math.round(incrementalProfitPaise / 100),
    net_profit_paise: netProfitPaise,
    net_profit_inr: Math.round(netProfitPaise / 100),
    roi_pct: parseFloat(roiPct.toFixed(1)),
    roi_multiple: parseFloat(roiMultiple.toFixed(2)),
    breakeven_lift_pct: parseFloat(breakevenLiftPct.toFixed(2)),
    breakeven_additional_visits: breakevenAdditionalVisits
  };
}
