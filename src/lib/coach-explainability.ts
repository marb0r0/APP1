import type { CoachDataQuality, CoachDataQualityInput } from "./coach-data-quality";

export type CoachConfidence = "BAIXA" | "MODERADA";

export type CoachExplainability = {
  confidence: CoachConfidence;
  sourceStatus: CoachDataQuality["status"];
  usedInputs: string[];
  limitations: string[];
  nonClinicalWarning: string;
};

/** Confidence is capped at MODERADA: data quality checks are not model calibration. */
export function buildCoachExplainability(
  input: CoachDataQualityInput,
  quality: CoachDataQuality,
): CoachExplainability {
  const usedInputs = [
    `ACWR: ${input.acwr.toFixed(2)}`,
    `carga aguda: ${input.acute.toFixed(2)}`,
    `carga crónica: ${input.chronic.toFixed(2)}`,
    `sessões registadas: ${input.sessionsCount}`,
    `resultados recentes fornecidos: ${input.recentResults.length}`,
  ];

  const limitations = [
    ...quality.warnings,
    "A aplicação não verifica a origem nem a atualidade dos registos.",
    "Não foram fornecidos dados individuais de lesões, sintomas, sono ou recuperação.",
    "O ACWR isolado não diagnostica fadiga nem prevê lesões.",
  ];

  return {
    confidence: quality.status === "sufficient" ? "MODERADA" : "BAIXA",
    sourceStatus: quality.status,
    usedInputs,
    limitations: [...new Set(limitations)],
    nonClinicalWarning:
      "Informação desportiva indicativa, não é diagnóstico médico nem substitui avaliação de um profissional qualificado.",
  };
}

/** Appends transparent provenance to the existing report text shown in the Lab UI. */
export function formatCoachExplainability(explanation: CoachExplainability): string {
  return [
    `Confiança: ${explanation.confidence} (qualidade dos dados: ${explanation.sourceStatus}).`,
    `Dados usados: ${explanation.usedInputs.join("; ")}.`,
    `Limitações: ${explanation.limitations.join(" ")}`,
    explanation.nonClinicalWarning,
  ].join(" ");
}
