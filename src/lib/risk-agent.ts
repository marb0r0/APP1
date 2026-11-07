export type RiskDataQuality = "sufficient" | "limited" | "insufficient";

export type RiskPick = {
  id: string;
  probability: number;
  decimalOdds: number;
  requestedStake: number;
};

export type RiskAgentInput = {
  bankroll: number;
  dailyExposureLimitPercent: number;
  maxStakePercent: number;
  dataQuality: RiskDataQuality;
  picks: RiskPick[];
};

export type RiskAgentResult = {
  status: "within_limit" | "scaled_to_limit" | "blocked" | "invalid_input";
  totalRequested: number;
  exposureLimit: number;
  approvedTotal: number;
  allocations: Array<{ id: string; requestedStake: number; approvedStake: number; reason: string }>;
  warnings: string[];
};

const finiteBetween = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;

/**
 * Conservative exposure guardrail. It only caps user-provided indicative stakes;
 * it does not place bets, verify odds, or estimate the probability of loss.
 */
export function evaluateRisk(input: RiskAgentInput): RiskAgentResult {
  const valid =
    finiteBetween(input.bankroll, 0, 1_000_000_000) &&
    finiteBetween(input.dailyExposureLimitPercent, 0, 100) &&
    finiteBetween(input.maxStakePercent, 0, 2) &&
    ["sufficient", "limited", "insufficient"].includes(input.dataQuality) &&
    input.picks.every((pick) =>
      typeof pick.id === "string" && pick.id.length > 0 &&
      finiteBetween(pick.probability, 0, 1) &&
      Number.isFinite(pick.decimalOdds) && pick.decimalOdds > 1 &&
      Number.isFinite(pick.requestedStake) && pick.requestedStake >= 0,
    );

  if (!valid) {
    return {
      status: "invalid_input",
      totalRequested: 0,
      exposureLimit: 0,
      approvedTotal: 0,
      allocations: [],
      warnings: ["Dados inválidos: não foi calculada qualquer exposição aprovada."],
    };
  }

  const warnings = [
    "Controlo indicativo: não valida probabilidades, preços, liquidez ou correlação entre seleções.",
    "Não coloca nem bloqueia apostas fora desta aplicação. Não é aconselhamento financeiro.",
  ];
  const exposureLimit = input.bankroll * input.dailyExposureLimitPercent / 100;

  if (input.dataQuality === "insufficient" || input.bankroll === 0) {
    return {
      status: "blocked",
      totalRequested: input.picks.reduce((sum, pick) => sum + pick.requestedStake, 0),
      exposureLimit,
      approvedTotal: 0,
      allocations: input.picks.map((pick) => ({
        id: pick.id,
        requestedStake: pick.requestedStake,
        approvedStake: 0,
        reason: input.bankroll === 0 ? "Banca de referência é zero." : "Qualidade de dados insuficiente.",
      })),
      warnings: [...warnings, "Exposição aprovada definida em zero até os dados serem revistos."],
    };
  }

  const qualityFactor = input.dataQuality === "limited" ? 0.5 : 1;
  if (qualityFactor < 1) warnings.push("Dados limitados: o teto total foi reduzido para metade.");

  const perPickCap = input.bankroll * input.maxStakePercent / 100;
  const requested = input.picks.map((pick) => Math.min(pick.requestedStake, perPickCap));
  const cappedTotal = requested.reduce((sum, amount) => sum + amount, 0);
  const availableLimit = exposureLimit * qualityFactor;
  const scale = cappedTotal > availableLimit && cappedTotal > 0 ? availableLimit / cappedTotal : 1;
  const allocations = input.picks.map((pick, index) => {
    const approvedStake = Math.floor(requested[index] * scale * 100) / 100;
    const reasons = [];
    if (pick.requestedStake > perPickCap) reasons.push("limitado pelo teto por seleção");
    if (scale < 1) reasons.push("proporcionalmente reduzido para respeitar a exposição total");
    if (!reasons.length) reasons.push("dentro dos limites configurados");
    return { id: pick.id, requestedStake: pick.requestedStake, approvedStake, reason: reasons.join("; ") };
  });
  const approvedTotal = allocations.reduce((sum, allocation) => sum + allocation.approvedStake, 0);

  return {
    status: scale < 1 || requested.some((amount, index) => amount < input.picks[index].requestedStake)
      ? "scaled_to_limit"
      : "within_limit",
    totalRequested: input.picks.reduce((sum, pick) => sum + pick.requestedStake, 0),
    exposureLimit: availableLimit,
    approvedTotal,
    allocations,
    warnings,
  };
}
