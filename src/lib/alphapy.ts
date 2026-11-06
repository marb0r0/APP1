/**
 * Transparent, descriptive signals for the match desk.
 * These heuristics are not calibrated forecasts: validate them against a large,
 * time-ordered historical sample before interpreting them as betting edges.
 */
import type { MatchView } from "./football";

export type AlphaSignal = {
  /** Descriptive 0–100 home-lean index, not a probability or confidence score. */
  sportFlow: number;
  /** Model-vs-market gap in percentage points; the app model already blends market data. */
  disagreementAlpha: number;
  /** Model probability of the less-favoured team winning, not an upset forecast. */
  upsetPotential: number;
  momentumScore: { home: number; away: number; net: number };
  /** No load data is available; never fabricate a fatigue estimate. */
  fatigueIndex: null;
  primarySignal: "STRONG_HOME" | "VALUE_DRAW" | "UPSET_ALERT" | "NEUTRAL_CONTESTED";
  /** No historical calibration has been performed. */
  confidence: "UNVALIDATED";
};

function parseFormWeighted(form: string, decay = 0.85): number | null {
  const chars = form.toUpperCase().split("").filter((ch) => "WDL".includes(ch)).slice(-5);
  if (!chars.length) return null;

  let weight = 1;
  let totalWeight = 0;
  let score = 0;
  for (let i = chars.length - 1; i >= 0; i--) {
    const ch = chars[i];
    const points = ch === "W" ? 1 : ch === "D" ? 0.4 : 0;
    score += points * weight;
    totalWeight += weight;
    weight *= decay;
  }
  return totalWeight > 0 ? score / totalWeight : null;
}

export function computeAlphaPySignals(match: MatchView): AlphaSignal {
  const homeProb = match.model.home;
  const awayProb = match.model.away;
  const marketHome = match.market?.home;
  const marketAway = match.market?.away;
  // This is a blended-model gap, not an independent edge: modelFromInputs uses market odds.
  const disagreementAlpha = marketHome == null
    ? 0
    : Math.round((homeProb - marketHome) * 1000) / 10;

  const homeMom = parseFormWeighted(match.formHome);
  const awayMom = parseFormWeighted(match.formAway);
  const netMom = homeMom == null || awayMom == null
    ? 0
    : Math.round((homeMom - awayMom) * 100);

  // Keep the index descriptive and based only on available xG/form data.
  const xgGap = Math.max(-1, Math.min(1, (match.homeXg - match.awayXg) / 3));
  const formGap = homeMom == null || awayMom == null ? 0 : homeMom - awayMom;
  const sportFlow = Math.max(0, Math.min(100, Math.round(50 + xgGap * 35 + formGap * 15)));

  const homeIsUnderdog = marketHome != null && marketAway != null
    ? marketHome < marketAway
    : homeProb < awayProb;
  const underdogProbability = homeIsUnderdog ? homeProb : awayProb;
  // Displayed as probability from the app's blended model, never a calibrated upset chance.
  const upsetPotential = Math.round(underdogProbability * 100);

  let primarySignal: AlphaSignal["primarySignal"] = "NEUTRAL_CONTESTED";
  if (match.model.draw > homeProb && match.model.draw > awayProb) {
    primarySignal = "VALUE_DRAW";
  } else if (homeProb >= 0.55 && sportFlow >= 60) {
    primarySignal = "STRONG_HOME";
  } else if (underdogProbability >= 0.3) {
    primarySignal = "UPSET_ALERT";
  }

  return {
    sportFlow,
    disagreementAlpha,
    upsetPotential,
    momentumScore: {
      home: homeMom == null ? 0 : Math.round(homeMom * 100),
      away: awayMom == null ? 0 : Math.round(awayMom * 100),
      net: netMom,
    },
    fatigueIndex: null,
    primarySignal,
    confidence: "UNVALIDATED",
  };
}
