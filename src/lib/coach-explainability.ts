import type { CoachDataQuality, CoachDataQualityInput } from "./coach-data-quality";

export type CoachConfidence = "BAIXA" | "MODERADA";

export type CoachExplainability = {
  confidence: CoachConfidence;
  sourceStatus: CoachDataQuality["status"];
  usedInputs: string[];
  limitations: string[];
  nonClinicalWarning: string;
};

const SOURCE_STATUS_LABELS: Record<CoachDataQuality["status"], string> = {
  sufficient: "sem alertas automáticos",
  limited: "limitada",
  insufficient: "insuficiente",
};

/** Confidence is capped at MODERADA: data quality checks are not model calibration. */
export function buildCoachExplainability(
  input: CoachDataQualityInput,
  quality: CoachDataQuality,
): CoachExplainability {
  const usedInputs = [
    `ACWR ${input.acwr.toFixed(2)}`,
    `carga aguda ${input.acute.toFixed(2)}`,
    `carga crónica ${input.chronic.toFixed(2)}`,
    `${input.sessionsCount} sessões registadas`,
    `${input.recentResults.length} resultados recentes fornecidos`,
  ];

  const limitations = [
    ...quality.warnings,
    "A origem e a atualidade dos registos não são verificadas.",
    "Não foram fornecidos dados individuais de lesões, sintomas, sono ou recuperação.",
    "O ACWR isolado não diagnostica fadiga nem prevê lesões.",
  ];

  return {
    confidence: quality.status === "sufficient" ? "MODERADA" : "BAIXA",
    sourceStatus: quality.status,
    usedInputs,
    limitations: [...new Set(limitations)],
    nonClinicalWarning:
      "Informação desportiva indicativa; não é diagnóstico médico nem substitui avaliação de um profissional qualificado.",
  };
}

/**
 * The current Lab route renders workloadVerdict as plain text, so format the
 * explainability metadata as clearly labeled text that remains readable there.
 */
export function formatCoachExplainability(explanation: CoachExplainability): string {
  return [
    `Confiança: ${explanation.confidence}.`,
    `Qualidade dos dados: ${SOURCE_STATUS_LABELS[explanation.sourceStatus]}.`,
    `Dados usados: ${explanation.usedInputs.join("; ")}.`,
    `Limitações: ${explanation.limitations.join(" ")}`,
    `Aviso: ${explanation.nonClinicalWarning}`,
  ].join(" | ");
}
