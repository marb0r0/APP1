/**
 * Port of core concepts from https://github.com/georgedouzas/sports-betting
 * Staking strategies, odds de-vigging, bankroll simulation, and backtesting metrics.
 */

export type StakingStrategy = "flat" | "quarter_kelly" | "half_kelly" | "full_kelly" | "proportional";
export type DevigMethod = "multiplicative" | "shin" | "proportional";

export type BetRecord = {
  id: string;
  match: string;
  league: string;
  betOn: "Home" | "Draw" | "Away";
  odds: number;
  modelProb: number;
  stake: number;
  outcome: "won" | "lost" | "pending";
  pnl: number;
  bankrollAfter: number;
};

export type BacktestSummary = {
  strategy: StakingStrategy;
  startingBankroll: number;
  endingBankroll: number;
  totalBets: number;
  wonBets: number;
  lostBets: number;
  winRate: number;
  netProfit: number;
  roi: number;
  maxDrawdownPct: number;
  brierScore: number;
  records: BetRecord[];
};

/**
 * Remove bookmaker vig (overround) to extract true implied probabilities.
 */
export function removeVig(
  oddsHome: number,
  oddsDraw: number,
  oddsAway: number,
  method: DevigMethod = "multiplicative"
): { pHome: number; pDraw: number; pAway: number; overround: number } {
  const impH = 1 / oddsHome;
  const impD = 1 / oddsDraw;
  const impA = 1 / oddsAway;
  const overround = impH + impD + impA;

  if (method === "shin") {
    // Shin's method accounts for favorite-longshot bias via insider trading parameter z
    const z = Math.max(0, (overround - 1) * 0.4);
    const pHome = (Math.sqrt(z ** 2 + 4 * (1 - z) * (impH ** 2 / overround)) - z) / (2 * (1 - z));
    const pDraw = (Math.sqrt(z ** 2 + 4 * (1 - z) * (impD ** 2 / overround)) - z) / (2 * (1 - z));
    const pAway = (Math.sqrt(z ** 2 + 4 * (1 - z) * (impA ** 2 / overround)) - z) / (2 * (1 - z));
    const sum = pHome + pDraw + pAway;
    return { pHome: pHome / sum, pDraw: pDraw / sum, pAway: pAway / sum, overround };
  }

  // Multiplicative / Proportional (standard baseline)
  return {
    pHome: impH / overround,
    pDraw: impD / overround,
    pAway: impA / overround,
    overround,
  };
}

/**
 * Kelly Criterion calculation.
 * f* = (b * p - q) / b
 * where b = decimal odds - 1, p = model probability, q = 1 - p
 */
export function calculateKellyStake(
  modelProb: number,
  decimalOdds: number,
  bankroll: number,
  fraction: 0.25 | 0.5 | 1.0 = 0.25,
  maxBankrollPct = 0.05
): { fraction: number; stake: number; edge: number } {
  const edge = modelProb * decimalOdds - 1;
  if (edge <= 0) return { fraction: 0, stake: 0, edge };

  const b = decimalOdds - 1;
  const fullKelly = b > 0 ? (b * modelProb - (1 - modelProb)) / b : 0;
  const targetFraction = Math.max(0, fullKelly * fraction);
  const cappedFraction = Math.min(targetFraction, maxBankrollPct);
  const stake = Math.round(bankroll * cappedFraction * 100) / 100;

  return { fraction: cappedFraction, stake, edge };
}

/**
 * Brier Score: Mean squared error of probabilistic forecasts.
 * Evaluates how well calibrated the model probabilities are (0.00 = perfect).
 */
export function calculateBrierScore(
  forecasts: Array<{ prob: number; actual: boolean }>
): number {
  if (forecasts.length === 0) return 0;
  let sum = 0;
  for (const f of forecasts) {
    const outcome = f.actual ? 1 : 0;
    sum += (f.prob - outcome) ** 2;
  }
  return Math.round((sum / forecasts.length) * 1000) / 1000;
}

export type SimulatedMatch = {
  id: string;
  name: string;
  league: string;
  odds: { home: number; draw: number; away: number };
  model: { home: number; draw: number; away: number };
  actualResult: "Home" | "Draw" | "Away";
};

/**
 * Historical/simulated backtest runner against a sequence of fixtures.
 */
export function runBacktest(
  matches: SimulatedMatch[],
  startingBankroll = 500,
  strategy: StakingStrategy = "quarter_kelly",
  minEdge = 0.02
): BacktestSummary {
  let currentBankroll = startingBankroll;
  let peakBankroll = startingBankroll;
  let maxDrawdown = 0;
  const records: BetRecord[] = [];
  const brierSamples: Array<{ prob: number; actual: boolean }> = [];

  for (const m of matches) {
    const markets: Array<"Home" | "Draw" | "Away"> = ["Home", "Draw", "Away"];
    for (const side of markets) {
      const odd = side === "Home" ? m.odds.home : side === "Draw" ? m.odds.draw : m.odds.away;
      const prob = side === "Home" ? m.model.home : side === "Draw" ? m.model.draw : m.model.away;
      const edge = prob * odd - 1;

      brierSamples.push({ prob, actual: m.actualResult === side });

      if (edge < minEdge) continue;

      let stake = 0;
      if (strategy === "flat") {
        stake = Math.min(currentBankroll, Math.max(2, startingBankroll * 0.02));
      } else if (strategy === "proportional") {
        stake = Math.min(currentBankroll, currentBankroll * 0.025);
      } else if (strategy === "quarter_kelly") {
        stake = calculateKellyStake(prob, odd, currentBankroll, 0.25).stake;
      } else if (strategy === "half_kelly") {
        stake = calculateKellyStake(prob, odd, currentBankroll, 0.5, 0.08).stake;
      } else if (strategy === "full_kelly") {
        stake = calculateKellyStake(prob, odd, currentBankroll, 1.0, 0.12).stake;
      }

      stake = Math.min(currentBankroll, Math.round(stake * 100) / 100);
      if (stake < 1) continue;

      const won = m.actualResult === side;
      const pnl = won ? Math.round(stake * (odd - 1) * 100) / 100 : -stake;
      currentBankroll = Math.max(0, currentBankroll + pnl);

      if (currentBankroll > peakBankroll) peakBankroll = currentBankroll;
      const drawdown = peakBankroll > 0 ? (peakBankroll - currentBankroll) / peakBankroll : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      records.push({
        id: `${m.id}-${side}`,
        match: m.name,
        league: m.league,
        betOn: side,
        odds: odd,
        modelProb: prob,
        stake,
        outcome: won ? "won" : "lost",
        pnl,
        bankrollAfter: Math.round(currentBankroll * 100) / 100,
      });

      if (currentBankroll <= 0) break;
    }
    if (currentBankroll <= 0) break;
  }

  const wonBets = records.filter((r) => r.outcome === "won").length;
  const lostBets = records.filter((r) => r.outcome === "lost").length;
  const totalBets = records.length;
  const winRate = totalBets > 0 ? wonBets / totalBets : 0;
  const netProfit = Math.round((currentBankroll - startingBankroll) * 100) / 100;
  const totalStaked = records.reduce((acc, r) => acc + r.stake, 0);
  const roi = totalStaked > 0 ? netProfit / totalStaked : 0;
  const brierScore = calculateBrierScore(brierSamples);

  return {
    strategy,
    startingBankroll,
    endingBankroll: Math.round(currentBankroll * 100) / 100,
    totalBets,
    wonBets,
    lostBets,
    winRate,
    netProfit,
    roi,
    maxDrawdownPct: Math.round(maxDrawdown * 1000) / 10,
    brierScore,
    records,
  };
}

/** Pre-packaged benchmark fixture history from recent European league slates */
export const BENCHMARK_MATCHES: SimulatedMatch[] = [
  {
    id: "bm-1",
    name: "Arsenal vs Chelsea",
    league: "Premier League",
    odds: { home: 1.82, draw: 3.8, away: 4.5 },
    model: { home: 0.62, draw: 0.22, away: 0.16 },
    actualResult: "Home",
  },
  {
    id: "bm-2",
    name: "Sporting CP vs Braga",
    league: "Liga Portugal",
    odds: { home: 1.55, draw: 4.2, away: 6.0 },
    model: { home: 0.68, draw: 0.2, away: 0.12 },
    actualResult: "Home",
  },
  {
    id: "bm-3",
    name: "Real Sociedad vs Athletic Club",
    league: "La Liga",
    odds: { home: 2.45, draw: 3.1, away: 3.2 },
    model: { home: 0.38, draw: 0.35, away: 0.27 },
    actualResult: "Draw",
  },
  {
    id: "bm-4",
    name: "Juventus vs Atalanta",
    league: "Serie A",
    odds: { home: 2.1, draw: 3.3, away: 3.6 },
    model: { home: 0.44, draw: 0.29, away: 0.27 },
    actualResult: "Home",
  },
  {
    id: "bm-5",
    name: "Dortmund vs Leverkusen",
    league: "Bundesliga",
    odds: { home: 2.6, draw: 3.6, away: 2.55 },
    model: { home: 0.33, draw: 0.26, away: 0.41 },
    actualResult: "Away",
  },
  {
    id: "bm-6",
    name: "Benfica vs Porto",
    league: "Liga Portugal",
    odds: { home: 2.2, draw: 3.25, away: 3.4 },
    model: { home: 0.49, draw: 0.28, away: 0.23 },
    actualResult: "Home",
  },
  {
    id: "bm-7",
    name: "Lyon vs Marseille",
    league: "Ligue 1",
    odds: { home: 2.7, draw: 3.4, away: 2.6 },
    model: { home: 0.34, draw: 0.3, away: 0.36 },
    actualResult: "Draw",
  },
  {
    id: "bm-8",
    name: "Liverpool vs Man City",
    league: "Premier League",
    odds: { home: 2.35, draw: 3.6, away: 2.9 },
    model: { home: 0.46, draw: 0.28, away: 0.26 },
    actualResult: "Home",
  },
];
