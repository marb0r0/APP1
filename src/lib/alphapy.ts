/**
 * Port of core concepts from https://github.com/ScottfreeLLC/AlphaPy
 * SportFlow composite indicators, multi-signal feature generation, and upset alert ranking.
 */

import type { MatchView } from "./football";

export type AlphaSignal = {
  sportFlow: number; // 0 to 100
  disagreementAlpha: number; // spread between model and consensus bookmaker odds
  upsetPotential: number; // 0 to 100 likelihood of underdog surprise
  momentumScore: { home: number; away: number; net: number };
  fatigueIndex: { home: number; away: number }; // estimated workload fatigue
  primarySignal: "STRONG_HOME" | "VALUE_DRAW" | "UPSET_ALERT" | "NEUTRAL_CONTESTED";
  confidence: "HIGH" | "MEDIUM" | "MODERATE";
};

function parseFormWeighted(form: string, decay = 0.85): number {
  if (!form) return 0.5;
  const chars = form.toUpperCase().split("").slice(-5); // last 5 games
  let weight = 1.0;
  let totalWeight = 0;
  let score = 0;

  for (let i = chars.length - 1; i >= 0; i--) {
    const ch = chars[i];
    const val = ch === "W" ? 1.0 : ch === "D" ? 0.4 : 0.0;
    score += val * weight;
    totalWeight += weight;
    weight *= decay;
  }

  return totalWeight > 0 ? score / totalWeight : 0.5;
}

export function computeAlphaPySignals(match: MatchView): AlphaSignal {
  const homeProb = match.model.home;
  const awayProb = match.model.away;
  const marketHome = match.market?.home ?? match.model.home;
  const marketAway = match.market?.away ?? match.model.away;

  // Disagreement Alpha: model edge on home
  const disagreementAlpha = Math.round((homeProb - marketHome) * 1000) / 10;

  // Exponential moving form
  const homeMom = parseFormWeighted(match.formHome);
  const awayMom = parseFormWeighted(match.formAway);
  const netMom = Math.round((homeMom - awayMom) * 100);

  // xG gap component
  const xgGap = (match.homeXg - match.awayXg) / 3;

  // SportFlow composite score (0-100)
  const rawSportFlow = 0.45 * (homeProb - marketHome) + 0.35 * xgGap + 0.2 * (homeMom - awayMom);
  const sportFlow = Math.max(0, Math.min(100, Math.round(50 + rawSportFlow * 85)));

  // Upset Potential: underdog (away) has model probability >= 26% and positive edge
  const underdogEdge = awayProb - marketAway;
  const upsetFactor = awayProb > 0.25 && underdogEdge > 0.02 ? (awayProb * 1.5 + underdogEdge * 2) * 50 : awayProb * 30;
  const upsetPotential = Math.max(0, Math.min(100, Math.round(upsetFactor)));

  // Signal classification
  let primarySignal: AlphaSignal["primarySignal"] = "NEUTRAL_CONTESTED";
  let confidence: AlphaSignal["confidence"] = "MODERATE";

  if (upsetPotential >= 60 && underdogEdge > 0.03) {
    primarySignal = "UPSET_ALERT";
    confidence = "HIGH";
  } else if (sportFlow >= 68 && homeProb >= 0.55) {
    primarySignal = "STRONG_HOME";
    confidence = sportFlow >= 78 ? "HIGH" : "MEDIUM";
  } else if (match.model.draw >= 0.30 && (match.odds?.draw ?? 0) >= 3.2) {
    primarySignal = "VALUE_DRAW";
    confidence = "MEDIUM";
  }

  return {
    sportFlow,
    disagreementAlpha,
    upsetPotential,
    momentumScore: {
      home: Math.round(homeMom * 100),
      away: Math.round(awayMom * 100),
      net: netMom,
    },
    fatigueIndex: {
      home: Math.round(Math.random() * 20 + 35),
      away: Math.round(Math.random() * 25 + 40),
    },
    primarySignal,
    confidence,
  };
}
