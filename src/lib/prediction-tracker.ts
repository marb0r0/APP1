export type PredictionResult = "pending" | "won" | "lost" | "void";

export type PredictionEntry = {
  id: string;
  fixture: string;
  league: string;
  market?: string;
  modelProbability: number;
  marketOdds: number;
  closingOdds?: number;
  stake: number;
  result: PredictionResult;
  notes: string;
  oddsSource?: string;
  createdAt: string;
};

export type PredictionSummary = {
  total: number;
  closed: number;
  wins: number;
  losses: number;
  voids: number;
  winRate: number;
  averageEdge: number;
  averageStake: number;
  netProfit: number;
  roi: number;
  brierScore: number;
  maxDrawdown: number;
};

export function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function calculateEdge(probability: number, decimalOdds: number): number {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1 || !Number.isFinite(decimalOdds) || decimalOdds <= 1) return 0;
  return probability * decimalOdds - 1;
}

export function calculateProfit(entry: Pick<PredictionEntry, "marketOdds" | "stake" | "result">): number {
  if (entry.result === "pending" || entry.result === "void") return 0;
  if (!Number.isFinite(entry.marketOdds) || entry.marketOdds <= 1 || !Number.isFinite(entry.stake) || entry.stake < 0) return 0;
  return entry.result === "won" ? entry.stake * (entry.marketOdds - 1) : -entry.stake;
}

export function summarizePredictions(entries: PredictionEntry[]): PredictionSummary {
  const settled = entries.filter((entry) => entry.result === "won" || entry.result === "lost");
  const voids = entries.filter((entry) => entry.result === "void").length;
  const totalStaked = settled.reduce((sum, entry) => sum + entry.stake, 0);
  const wins = settled.filter((entry) => entry.result === "won").length;
  const losses = settled.length - wins;
  const profit = settled.reduce((sum, entry) => sum + calculateProfit(entry), 0);
  const averageEdge = settled.length
    ? settled.reduce((sum, entry) => sum + calculateEdge(entry.modelProbability, entry.marketOdds), 0) / settled.length
    : 0;
  const brierScore = settled.length
    ? settled.reduce((sum, entry) => sum + (entry.modelProbability - (entry.result === "won" ? 1 : 0)) ** 2, 0) / settled.length
    : 0;

  let balance = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const chronological = [...settled].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const entry of chronological) {
    balance += calculateProfit(entry);
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, peak - balance);
  }

  return {
    total: entries.length,
    closed: settled.length,
    wins,
    losses,
    voids,
    winRate: settled.length ? wins / settled.length : 0,
    averageEdge,
    averageStake: settled.length ? totalStaked / settled.length : 0,
    netProfit: Number(profit.toFixed(2)),
    roi: totalStaked > 0 ? Number(((profit / totalStaked) * 100).toFixed(2)) : 0,
    brierScore: Number(brierScore.toFixed(4)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
  };
}

export function summarizeByMarket(entries: PredictionEntry[]) {
  const groups = new Map<string, PredictionEntry[]>();
  for (const entry of entries) {
    if (entry.result !== "won" && entry.result !== "lost") continue;
    const key = entry.market?.trim() || "Sem categoria";
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.entries()].map(([market, rows]) => ({ market, ...summarizePredictions(rows) }));
}

export function exportPredictionsCsv(entries: PredictionEntry[]): string {
  const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const header = ["createdAt", "fixture", "league", "market", "modelProbability", "marketOdds", "closingOdds", "stake", "result", "oddsSource", "notes"];
  const lines = entries.map((entry) => [entry.createdAt, entry.fixture, entry.league, entry.market ?? "", entry.modelProbability, entry.marketOdds, entry.closingOdds ?? "", entry.stake, entry.result, entry.oddsSource ?? "", entry.notes].map(cell).join(","));
  return [header.map(cell).join(","), ...lines].join("\n");
}
