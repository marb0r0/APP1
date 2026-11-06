import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";

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
};

export const getAiCoachReport = createServerFn({ method: "POST" })
  .validator((input: CoachReportRequest) => input)
  .handler(async ({ data }): Promise<CoachReportResponse> => {
    const { acwr, acute, chronic, recentResults, upcomingMatch } = data;

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI();
        const prompt = `Você é o Autonomous Tactical Coach & Sports Science Advisor do FootStats AI.
Analise os seguintes dados biométricos e competitivos:
- Rácio de Carga Aguda:Crónica (ACWR): ${acwr.toFixed(2)} (Aguda: ${acute}, Crónica: ${chronic}).
- Resultados Recentes: ${recentResults.join(", ") || "Sem histórico recente"}.
${
  upcomingMatch
    ? `- Próximo Jogo: ${upcomingMatch.home} vs ${upcomingMatch.away} (Liga: ${upcomingMatch.league}, xG Casa: ${upcomingMatch.homeXg}, xG Fora: ${upcomingMatch.awayXg}).`
    : ""
}

Forneça um relatório executivo em JSON com o seguinte formato:
{
  "headline": "Uma frase de impacto sobre o estado da equipa/atleta",
  "injuryRiskLevel": "BAIXO" ou "MODERADO" ou "ELEVADO",
  "workloadVerdict": "Diagnóstico do ACWR e fadiga neuromuscular",
  "tacticalAdvice": ["Recomendação tática 1", "Recomendação 2", "Recomendação 3"],
  "keyPrescription": "Ação imediata recomendada para o próximo treino/jogo"
}
Retorne APENAS o JSON válido, sem formatação markdown extra.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });

        const text = response.text?.trim() ?? "";
        if (text) {
          const parsed = JSON.parse(text) as CoachReportResponse;
          return {
            ...parsed,
            modelUsed: "Gemini 3.8 Flash (FootStats-AI)",
          };
        }
      } catch (err) {
        console.warn("[FootStats-AI] Gemini call failed or offline, using rule-based advisor:", err);
      }
    }

    // Deterministic Sports Science & Tactical Heuristic Fallback
    let injuryRiskLevel: CoachReportResponse["injuryRiskLevel"] = "BAIXO";
    let headline = "Carga Equilibrada: Zona Ótima de Rendimento (Sweet Spot)";
    let workloadVerdict =
      "O rácio ACWR encontra-se na faixa ótima (0.80 - 1.30), maximizando a adaptação física e minimizando o risco de lesões.";
    let tacticalAdvice: string[] = [
      "Manter intensidade normal nos blocos de transição ofensiva rápida.",
      "Estimular pressão pós-perda sem receio de sobrecarga neuromuscular.",
      "Próximo jogo favorável à imposição de ritmo físico alto.",
    ];
    let keyPrescription = "Preservar a programação habitual com 1 dia de recuperação ativa pós-jogo.";

    if (acwr > 1.45) {
      injuryRiskLevel = "ELEVADO";
      headline = "Alerta Vermelho de Sobrecarga: Pico Agudo Perigoso";
      workloadVerdict = `O ACWR atingiu ${acwr.toFixed(2)}, indicando que a carga da última semana superou em mais de 45% a média histórica mensal. Risco iminente de lesão muscular/tendínea.`;
      tacticalAdvice = [
        "Adotar bloco médio/baixo para reduzir metros percorridos em alta velocidade (HSR).",
        "Substituições antecipadas aos 60 minutos para jogadores-chave de corredor.",
        "Privilegiar fases de posse de bola controlada para pausar o jogo.",
      ];
      keyPrescription = "Redução imediata de 30% do volume no próximo treino e ênfase em sono e crioterapia.";
    } else if (acwr < 0.8) {
      injuryRiskLevel = "MODERADO";
      headline = "Subtreino Detectado: Risco de Falta de Ritmo Competitivo";
      workloadVerdict = `O ACWR está em ${acwr.toFixed(2)}, sugerindo destreino ou subcarga na última semana.`;
      tacticalAdvice = [
        "Aumentar estímulos de potência em campo reduzido (Small-Sided Games).",
        "Ajustar tempos de reação para evitar lentidão nas disputas de primeira bola.",
      ];
      keyPrescription = "Sessão curta e intensa de velocidade com foco em transições rápidas.";
    }

    return {
      headline,
      injuryRiskLevel,
      workloadVerdict,
      tacticalAdvice,
      keyPrescription,
      modelUsed: "FootStats-AI Sports Engine (Algorítmico)",
    };
  });
