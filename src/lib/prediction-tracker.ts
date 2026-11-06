export type PredictionResult = "pending" | "won" | "lost";

export type PredictionEntry = {
  id: string;
  fixture: string;
  league: string;
  modelProbability: number;
  marketOdds: number;
  stake: number;
  result: PredictionResult;
  notes: string;
  createdAt: string;
};

export type PredictionSummary = {
  total: number;
  closed: number;
  wins: number;
  losses: number;
  winRate: number;
  averageEdge: number;
  averageStake: number;
  netProfit: number;
  roi: number;
  brierScore: number;
};

export function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function calculateEdge(probability: number, decimalOdds: number): number {
  if (!Number.isFinite(probability) || !Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    return 0;
  }
  return probability * decimalOdds - 1;
}

export function calculateProfit(entry: Pick<PredictionEntry, "modelProbability" | "marketOdds" | "stake" | "result">): number {
  if (entry.result === "pending") return 0;
  const edge = calculateEdge(entry.modelProbability, entry.marketOdds);
  if (!Number.isFinite(edge) || edge <= 0) return -entry.stake;
  return entry.result === "won" ? entry.stake * (entry.marketOdds - 1) : -entry.stake;
}

export function summarizePredictions(entries: PredictionEntry[]): PredictionSummary {
  const closed = entries.filter((entry) => entry.result !== "pending");
  const totalStaked = closed.reduce((sum, entry) => sum + entry.stake, 0);
  const wins = closed.filter((entry) => entry.result === "won").length;
  const losses = closed.filter((entry) => entry.result === "lost").length;
  const winRate = closed.length ? wins / closed.length : 0;
  const profit = entries.reduce((sum, entry) => sum + calculateProfit(entry), 0);
  const avgStake = closed.length ? totalStaked / closed.length : 0;
  const avgEdge = closed.length
    ? closed.reduce((sum, entry) => sum + calculateEdge(entry.modelProbability, entry.marketOdds), 0) / closed.length
    : 0;
  const brier = closed.length
    ? closed.reduce((sum, entry) => {
        const target = entry.result === "won" ? 1 : 0;
        return sum + (entry.modelProbability - target) ** 2;
      }, 0) / closed.length
    : 0;

  return {
    total: entries.length,
    closed: closed.length,
    wins,
    losses,
    winRate,
    averageEdge: avgEdge,
    averageStake: avgStake,
    netProfit: Number(profit.toFixed(2)),
    roi: totalStaked > 0 ? Number(((profit / totalStaked) * 100).toFixed(2)) : 0,
    brierScore: Number(brier.toFixed(4)),
  };
}
