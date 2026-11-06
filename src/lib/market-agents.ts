import type { MatchView } from "./football";
import { scoreMatrix } from "./football";

export type MarketCategory = "Resultado" | "Golos" | "Equipa" | "Ambas marcam";
export type MarketQuote = { id: string; category: MarketCategory; label: string; probability: number; fairOdds: number | null; bookmakerOdds: number | null };

/** Derive football markets from Dixon-Coles/xG. Provider only supplies 1X2 prices. */
export function getMatchMarkets(match: MatchView): MarketQuote[] {
  const matrix = scoreMatrix(match.homeXg, match.awayXg, -0.1, 10);
  let home = 0, draw = 0, away = 0, bothScore = 0;
  const totals = new Map<number, number>(), homeGoals = new Map<number, number>(), awayGoals = new Map<number, number>();
  matrix.forEach((row, h) => row.forEach((probability, a) => {
    if (h > a) home += probability; else if (h === a) draw += probability; else away += probability;
    if (h > 0 && a > 0) bothScore += probability;
    totals.set(h + a, (totals.get(h + a) ?? 0) + probability);
    homeGoals.set(h, (homeGoals.get(h) ?? 0) + probability);
    awayGoals.set(a, (awayGoals.get(a) ?? 0) + probability);
  }));
  const over = (distribution: Map<number, number>, line: number) => [...distribution].reduce((sum, [value, p]) => sum + (value > line ? p : 0), 0);
  const quote = (id: string, category: MarketCategory, label: string, probability: number, bookmakerOdds: number | null = null): MarketQuote => ({ id, category, label, probability, fairOdds: probability > 0 ? 1 / probability : null, bookmakerOdds });
  const markets: MarketQuote[] = [
    quote("home", "Resultado", `Vitória ${match.home}`, home, match.odds?.home ?? null),
    quote("draw", "Resultado", "Empate", draw, match.odds?.draw ?? null),
    quote("away", "Resultado", `Vitória ${match.away}`, away, match.odds?.away ?? null),
    quote("1x", "Resultado", "Dupla hipótese 1X", home + draw),
    quote("x2", "Resultado", "Dupla hipótese X2", draw + away),
    quote("12", "Resultado", "Dupla hipótese 12", home + away),
  ];
  for (const line of [0.5, 1.5, 2.5, 3.5, 4.5]) {
    const p = over(totals, line), suffix = String(line).replace(".", "_");
    markets.push(quote(`over-${suffix}`, "Golos", `Mais de ${line} golos`, p), quote(`under-${suffix}`, "Golos", `Menos de ${line} golos`, 1 - p));
  }
  markets.push(quote("btts-yes", "Ambas marcam", "Ambas marcam — Sim", bothScore), quote("btts-no", "Ambas marcam", "Ambas marcam — Não", 1 - bothScore));
  for (const line of [0.5, 1.5, 2.5]) {
    const suffix = String(line).replace(".", "_"), h = over(homeGoals, line), a = over(awayGoals, line);
    markets.push(quote(`home-over-${suffix}`, "Equipa", `${match.home}: mais de ${line} golos`, h), quote(`home-under-${suffix}`, "Equipa", `${match.home}: menos de ${line} golos`, 1 - h), quote(`away-over-${suffix}`, "Equipa", `${match.away}: mais de ${line} golos`, a), quote(`away-under-${suffix}`, "Equipa", `${match.away}: menos de ${line} golos`, 1 - a));
  }
  return markets;
}

export function calculateMarketEdge(probability: number, decimalOdds: number) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1 || !Number.isFinite(decimalOdds) || decimalOdds <= 1) return null;
  return probability * decimalOdds - 1;
}

/** Indicative quarter-Kelly stake capped at a low configurable bankroll percentage. */
export function calculateResponsibleStake(probability: number, decimalOdds: number, bankroll: number, maxStakePercent: number) {
  const edge = calculateMarketEdge(probability, decimalOdds);
  if (edge === null || edge <= 0 || !Number.isFinite(bankroll) || bankroll <= 0) return 0;
  const b = decimalOdds - 1;
  const fullKelly = (b * probability - (1 - probability)) / b;
  const limit = Math.max(0, Math.min(maxStakePercent, 2)) / 100;
  return Math.round(Math.min(fullKelly * 0.25, limit) * bankroll * 100) / 100;
}

export function getRecentFormSummary(form: string) {
  const marks = form.toUpperCase().split("").filter((mark) => "WDL".includes(mark)).slice(-5);
  if (!marks.length) return "Sem forma recente disponível";
  const points = marks.reduce((sum, mark) => sum + (mark === "W" ? 3 : mark === "D" ? 1 : 0), 0);
  return `${marks.join(" · ")} (${points}/${marks.length * 3} pontos nos últimos ${marks.length} jogos)`;
}
