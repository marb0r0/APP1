import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";
import { assessCoachDataQuality } from "./coach-data-quality";
import {
  buildCoachExplainability,
  formatCoachExplainability,
  type CoachExplainability,
} from "./coach-explainability";

export type CoachReportRequest = {
  acwr: number;
  acute: number;
  chronic: number;
  sessionsCount: number;
  recentResults: string[];
  upcomingMatch?: {
    home: string;
    away: string;
    homeXg: number;
    awayXg: number;
    league: string;
  };
};

export type CoachReportResponse = {
  headline: string;
  injuryRiskLevel: "BAIXO" | "MODERADO" | "ELEVADO";
  workloadVerdict: string;
  tacticalAdvice: string[];
  keyPrescription: string;
  modelUsed: string;
} & CoachExplainability;

export const getAiCoachReport = createServerFn({ method: "POST" })
  .validator((input: CoachReportRequest) => input)
  .handler(async ({ data }): Promise<CoachReportResponse> => {
    const quality = assessCoachDataQuality(data);
    if (quality.status === "insufficient") {
      throw new Error(`Dados insuficientes para análise: ${quality.blockers.join(" ")}`);
    }

    const explainability = buildCoachExplainability(data, quality);
    const explainabilityText = formatCoachExplainability(explainability);
    const { acwr, acute, chronic, recentResults, upcomingMatch } = data;

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI();
        const prompt = `Você é um assistente informativo de ciência do desporto. Não faça diagnósticos médicos nem afirme prever lesões.
Analise apenas os dados fornecidos e explicite as suas limitações.
- Rácio ACWR: ${acwr.toFixed(2)} (carga aguda: ${acute}; carga crónica: ${chronic}).
- Resultados recentes: ${recentResults.join(", ") || "não fornecidos"}.
${
  upcomingMatch
    ? `- Próximo jogo: ${upcomingMatch.home} vs ${upcomingMatch.away} (${upcomingMatch.league}; xG casa ${upcomingMatch.homeXg}; xG fora ${upcomingMatch.awayXg}).`
    : ""
}
- Qualidade dos dados: ${quality.status}. ${quality.warnings.length ? `Limitações dos dados: ${quality.warnings.join(" ")}` : "Dados recebidos sem limitações sinalizadas; a origem e a atualidade não foram verificadas."}

Devolva apenas JSON válido com headline, injuryRiskLevel (BAIXO, MODERADO ou ELEVADO), workloadVerdict, tacticalAdvice (1 a 5 recomendações gerais, não médicas) e keyPrescription (sugestão geral e cautelosa, não prescrição clínica). Não infira dados que não foram fornecidos.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });

        const text = response.text?.trim() ?? "";
        if (text) {
          try {
            const parsed = JSON.parse(text) as Partial<CoachReportResponse>;
            return {
              headline: parsed.headline ?? "Análise indicativa da carga de treino",
              injuryRiskLevel: parsed.injuryRiskLevel ?? "MODERADO",
              workloadVerdict: `${parsed.workloadVerdict ?? "Análise indicativa."} ${explainabilityText}`,
              tacticalAdvice: parsed.tacticalAdvice ?? [
                "Rever a carga junto com perceção de esforço, recuperação e contexto individual.",
                "Comparar esta semana com o histórico completo antes de alterar o plano.",
              ],
              keyPrescription:
                parsed.keyPrescription ??
                "Validar qualquer alteração com a equipa técnica ou um profissional qualificado.",
              modelUsed: "Gemini 3.8 Flash (FootStats-AI)",
              ...explainability,
            };
          } catch (error) {
            console.warn("[FootStats-AI] invalid JSON payload from Gemini:", error);
          }
        }
      } catch (err) {
        console.warn("[FootStats-AI] Gemini call failed or offline, using rule-based advisor:", err);
      }
    }

    let injuryRiskLevel: CoachReportResponse["injuryRiskLevel"] = "MODERADO";
    let headline = "Análise indicativa da carga de treino";
    let workloadVerdict = `O ACWR recebido é ${acwr.toFixed(2)}. Este indicador isolado não diagnostica fadiga nem prevê lesões.`;
    let tacticalAdvice: string[] = [
      "Rever a carga junto com perceção de esforço, recuperação e contexto individual.",
      "Comparar esta semana com o histórico completo antes de alterar o plano.",
    ];
    let keyPrescription =
      "Não há dados suficientes para uma prescrição individual; validar qualquer alteração com a equipa técnica ou um profissional qualificado.";

    if (acwr > 1.45) {
      headline = "Carga aguda acima da referência";
      injuryRiskLevel = "ELEVADO";
      workloadVerdict = `O ACWR recebido é ${acwr.toFixed(2)} e merece revisão contextual. Não permite, por si só, concluir que exista lesão ou risco iminente.`;
      tacticalAdvice = [
        "Rever a carga recente e sinais de recuperação com a equipa técnica.",
        "Considerar ajustar a sessão apenas após avaliar o contexto individual.",
      ];
    } else if (acwr < 0.8) {
      headline = "Carga recente abaixo da referência";
      injuryRiskLevel = "MODERADO";
      workloadVerdict = `O ACWR recebido é ${acwr.toFixed(2)}. A carga mais baixa não prova destreino e deve ser interpretada com o histórico e o contexto do atleta.`;
      tacticalAdvice = [
        "Rever a evolução da carga ao longo de várias semanas.",
        "Evitar aumentos abruptos sem acompanhamento da equipa técnica.",
      ];
    } else if (acwr <= 1.3) {
      headline = "Carga dentro da faixa de referência configurada";
      injuryRiskLevel = "BAIXO";
      workloadVerdict = `O ACWR recebido é ${acwr.toFixed(2)} e está dentro da faixa de referência configurada; isso não garante ausência de risco.`;
    }

    return {
      headline,
      injuryRiskLevel,
      workloadVerdict: `${workloadVerdict} ${explainabilityText}`,
      tacticalAdvice,
      keyPrescription,
      modelUsed: "FootStats-AI Sports Engine (heurístico; não clínico)",
      ...explainability,
    };
  });
