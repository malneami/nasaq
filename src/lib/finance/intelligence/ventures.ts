import type { VentureFinanceRow } from '@/lib/finance/intelligence/types';
import type { TxnRow } from '@/lib/finance/intelligence/summary';

function isExpense(type: string) {
  return type === 'expense' || type === 'fee' || type === 'withdrawal';
}

function isIncome(type: string) {
  return type === 'income' || type === 'deposit';
}

/**
 * Venture / project finance from scoped transactions + project_finances overrides.
 */
export function computeVentureFinance(input: {
  projects: {
    id: string;
    name: string;
    stage: string;
    state: string;
    moneyInvested: number;
    timeInvestedMinutes: number;
    currency: string;
  }[];
  projectFinances: {
    projectId: string;
    moneyInvested: number;
    revenue: number;
    timeInvestedMinutes: number;
    currency: string;
  }[];
  transactions: TxnRow[];
}): VentureFinanceRow[] {
  const financeByProject = new Map(
    input.projectFinances.map((row) => [row.projectId, row]),
  );
  const txnInvested = new Map<string, number>();
  const txnRevenue = new Map<string, number>();

  for (const row of input.transactions) {
    if (!row.projectId) {
      continue;
    }
    // Prefer business-scoped project money; still count personal project spend as invested.
    if (isExpense(row.type)) {
      txnInvested.set(
        row.projectId,
        (txnInvested.get(row.projectId) ?? 0) + row.amount,
      );
    }
    if (isIncome(row.type) && (row.scope === 'business' || row.scope === 'personal')) {
      txnRevenue.set(
        row.projectId,
        (txnRevenue.get(row.projectId) ?? 0) + row.amount,
      );
    }
  }

  return input.projects.map((project) => {
    const pf = financeByProject.get(project.id);
    const investedMinor = Math.max(
      pf?.moneyInvested ?? 0,
      project.moneyInvested,
      txnInvested.get(project.id) ?? 0,
    );
    const revenueMinor = Math.max(
      pf?.revenue ?? 0,
      txnRevenue.get(project.id) ?? 0,
    );
    const timeInvestedMinutes = Math.max(
      pf?.timeInvestedMinutes ?? 0,
      project.timeInvestedMinutes,
    );
    return {
      projectId: project.id,
      name: project.name,
      stage: project.stage,
      state: project.state,
      investedMinor,
      revenueMinor,
      netMinor: revenueMinor - investedMinor,
      timeInvestedMinutes,
      currency: pf?.currency ?? project.currency,
    };
  });
}
