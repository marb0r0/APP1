import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";
import { assessCoachDataQuality } from "./coach-data-quality";

const coachReportRequestSchema = z.object({
  acwr: z.number().finite().nonnegative(),
  acute: z.number().finite().nonnegative(),
  chronic: z.number().finite().nonnegative(),
  sessionsCount: z.number().int().nonnegative(),
  recentResults: z.array(z.string().trim().min(1).max(120)).max(10),
  upcomingMatch: z.object({
    home: z.string().trim().min(1).max(100),
    away: z.string().trim().min(1).max(100),
    homeXg: z.number().finite().nonnegative(),
    awayXg: z.number().finite().nonnegative(),
    league: z.string().trim().min(1).max(100),
  }).optional(),
});

export type CoachReportRequest = z.infer<typeof coachReportRequestSchema>;

export type CoachReportResponse = {
  headline: string;
  injuryRiskLevel: "BAIXO" | "MODERADO" | "ELEVADO";
  workloadVerdict: string;
  tacticalAdvice: string[];
  keyPrescription: string;
  modelUsed: string;
};

export const coachReportSchema = z.object({
  headline: z.string().min(8).max(200),
  injuryRiskLevel: z.enum(["BAIXO", "MODERADO", "ELEVADO"]),
  workloadVerdict: z.string().min(20).max(500),
  tacticalAdvice: z.array(z.string().min(8).max(200)).min(1).max(5),
  keyPrescription: z.string().min(10).max(250),
  modelUsed: z.string().min(4).max(80).optional(),
});

export function parseCoachReport(raw: string): CoachReportResponse | null {
  try {
    const result = coachReportSchema.safeParse(JSON.parse(raw) as unknown);
    if (!result.success) {
      console.warn("[FootStats-AI] invalid coach report payload", result.error.flatten());
      return null;
    }

    return {
      ...result.data,
      modelUsed: result.data.modelUsed ?? "Gemini 3.8 Flash (FootStats-AI)",
    };
  } catch (error) {
    console.warn("[FootStats-AI] failed to parse coach report payload:", error);
    return null;
  }
}

export const getAiCoachReport = createServerFn({ method: "POST" })
  .validator((input: unknown) => coachReportRequestSchema.parse(input))
  .handler(async ({ data }): Promise<CoachReportResponse> => {
    const quality = assessCoachDataQuality(data);
    if (quality.status === "insufficient") {
      // Do not call the model or generate a fallback assessment from inadequate data.
      throw new Error(`Dados insuficientes para análise: ${quality.blockers.join(" ")}`);
    }

    const qualityNote = quality.warnings.length
      ? `Limitações dos dados: ${quality.warnings.join(" ")}`
      : "Dados recebidos sem limitações sinalizadas; não foram verificadas fontes externas nem a atualidade dos registos.";

    const { acwr, acute, chronic, recentResults, upcomingMatch } = data;
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI();
        const prompt = `Você é um assistente informativo de ciência do desporto. Não faça diagnósticos médicos nem afirme prever lesões.
Analise apenas os dados fornecidos e explicite as suas limitações.
- Rácio ACWR: ${acwr.toFixed(2)} (carga aguda: ${acute}; carga crónica: ${chronic}).
- Resultados recentes: ${recentResults.join(", ") || "não fornecidos"}.
${upcomingMatch ? `- Próximo jogo: ${upcomingMatch.home} vs ${upcomingMatch.away} (${upcomingMatch.league}; xG casa ${upcomingMatch.homeXg}; xG fora ${upcomingMatch.awayXg}).` : ""}
- Qualidade dos dados: ${quality.status}. ${qualityNote}

Devolva apenas JSON válido com headline, injuryRiskLevel (BAIXO, MODERADO ou ELEVADO), workloadVerdict, tacticalAdvice (1 a 5 recomendações gerais, não médicas) e keyPrescription (sugestão geral e cautelosa, não prescrição clínica). Não infira dados que não foram fornecidos.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });

        const parsed = response.text?.trim() ? parseCoachReport(response.text.trim()) : null;
        if (parsed) {
          return {
            ...parsed,
            workloadVerdict: `${parsed.workloadVerdict} ${qualityNote}`,
            modelUsed: "Gemini 3.8 Flash (FootStats-AI)",
          };
        }
      } catch (err) {
        console.warn("[FootStats-AI] Gemini call failed or offline, using cautious rule-based fallback:", err);
      }
    }

    // Conservative deterministic fallback; ACWR alone is not a medical assessment.
    let headline = "Análise indicativa da carga de treino";
    let injuryRiskLevel: CoachReportResponse["injuryRiskLevel"] = "MODERADO";
    let workloadVerdict = `O ACWR recebido é ${acwr.toFixed(2)}. Este indicador isolado não diagnostica fadiga nem prevê lesões.`;
    let tacticalAdvice = [
      "Rever a carga junto com perceção de esforço, recuperação e contexto individual.",
      "Comparar esta semana com o histórico completo antes de alterar o plano.",
    ];
    let keyPrescription = "Não há dados suficientes para uma prescrição individual; validar qualquer alteração com a equipa técnica ou um profissional qualificado.";

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
      workloadVerdict: `${workloadVerdict} ${qualityNote}`,
      tacticalAdvice,
      keyPrescription,
      modelUsed: "FootStats-AI Sports Engine (heurístico; não clínico)",
    };
  });
