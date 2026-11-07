import type { PredictionEntry } from "./prediction-tracker";

export type CalibrationBin = {
  from: number;
  to: number;
  count: number;
  meanPredicted: number;
  observedRate: number;
};

export type CalibrationReport = {
  sampleSize: number;
  status: "no_data" | "insufficient_sample" | "preliminary" | "larger_sample";
  brierScore: number | null;
  logLoss: number | null;
  meanClosingLineValue: number | null;
  bins: CalibrationBin[];
  notes: string[];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Evaluates settled binary selections only. A larger sample is not proof of
 * calibration; proper time-split and market-specific validation is still needed.
 */
export function evaluateCalibration(entries: PredictionEntry[], binCount = 10): CalibrationReport {
  const settled = entries.filter((entry) =>
    (entry.result === "won" || entry.result === "lost") &&
    Number.isFinite(entry.modelProbability) && entry.modelProbability >= 0 && entry.modelProbability <= 1,
  );
  const notes = [
    "Inclui apenas seleções binárias liquidadas como ganha/perdida; void e pendentes são excluídas.",
    "Misturar mercados, ligas ou períodos pode ocultar diferenças de calibração.",
    "Uma amostra maior não prova desempenho futuro; validar em dados cronológicos fora da amostra.",
  ];

  if (!settled.length) {
    return { sampleSize: 0, status: "no_data", brierScore: null, logLoss: null, meanClosingLineValue: null, bins: [], notes };
  }

  const safeBinCount = Math.max(2, Math.min(20, Math.floor(binCount)));
  const binRows = Array.from({ length: safeBinCount }, () => ({ count: 0, predicted: 0, wins: 0 }));
  let brierTotal = 0;
  let logLossTotal = 0;
  let clvTotal = 0;
  let clvCount = 0;

  for (const entry of settled) {
    const probability = clamp(entry.modelProbability, 0, 1);
    const outcome = entry.result === "won" ? 1 : 0;
    const clipped = clamp(probability, 1e-15, 1 - 1e-15);
    brierTotal += (probability - outcome) ** 2;
    logLossTotal += -(outcome * Math.log(clipped) + (1 - outcome) * Math.log(1 - clipped));
    const index = Math.min(safeBinCount - 1, Math.floor(probability * safeBinCount));
    binRows[index].count++;
    binRows[index].predicted += probability;
    binRows[index].wins += outcome;

    if (Number.isFinite(entry.closingOdds) && entry.closingOdds! > 1 && entry.marketOdds > 1) {
      // Positive means the recorded price was better than the closing price.
      clvTotal += entry.marketOdds / entry.closingOdds! - 1;
      clvCount++;
    }
  }

  const bins = binRows.flatMap((bin, index) => bin.count ? [{
    from: index / safeBinCount,
    to: (index + 1) / safeBinCount,
    count: bin.count,
    meanPredicted: bin.predicted / bin.count,
    observedRate: bin.wins / bin.count,
  }] : []);
  const sampleSize = settled.length;

  return {
    sampleSize,
    status: sampleSize < 30 ? "insufficient_sample" : sampleSize < 100 ? "preliminary" : "larger_sample",
    brierScore: Number((brierTotal / sampleSize).toFixed(4)),
    logLoss: Number((logLossTotal / sampleSize).toFixed(4)),
    meanClosingLineValue: clvCount ? Number((clvTotal / clvCount).toFixed(4)) : null,
    bins,
    notes,
  };
}
