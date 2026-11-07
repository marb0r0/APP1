export type CoachDataQualityInput = {
  acwr: number;
  acute: number;
  chronic: number;
  sessionsCount: number;
  recentResults: string[];
};

export type CoachDataQuality = {
  status: "sufficient" | "limited" | "insufficient";
  blockers: string[];
  warnings: string[];
};

/**
 * Checks only what the coaching endpoint receives. It cannot verify the source,
 * dates, or completeness of the locally stored training sessions.
 */
export function assessCoachDataQuality(input: CoachDataQualityInput): CoachDataQuality {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!Number.isFinite(input.acwr) || input.acwr < 0) {
    blockers.push("O rácio ACWR está ausente ou inválido.");
  }
  if (!Number.isFinite(input.acute) || input.acute < 0) {
    blockers.push("A carga aguda está ausente ou inválida.");
  }
  if (!Number.isFinite(input.chronic) || input.chronic <= 0) {
    blockers.push("A carga crónica é insuficiente para calcular um rácio ACWR interpretável.");
  }
  if (!Number.isInteger(input.sessionsCount) || input.sessionsCount < 0) {
    blockers.push("A contagem de sessões é inválida.");
  } else if (input.sessionsCount < 4) {
    blockers.push("Existem menos de quatro sessões registadas; não há histórico mínimo para esta análise.");
  } else if (input.sessionsCount < 8) {
    warnings.push("O histórico de treino é curto; interpretar o ACWR com cautela.");
  }

  if (input.recentResults.length === 0) {
    warnings.push("Não foram fornecidos resultados recentes; a análise tática fica limitada.");
  } else if (input.recentResults.length < 3) {
    warnings.push("Há menos de três resultados recentes; a amostra competitiva é limitada.");
  }

  return {
    status: blockers.length ? "insufficient" : warnings.length ? "limited" : "sufficient",
    blockers,
    warnings,
  };
}
