import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getBoard } from "@/lib/football.functions";
import type { Board } from "@/lib/football";
import {
  calculateMarketEdge,
  calculateResponsibleStake,
  getMatchMarkets,
  getRecentFormSummary,
  type MarketCategory,
} from "@/lib/market-agents";
import { evaluateRisk } from "@/lib/risk-agent";
import { evaluateCalibration } from "@/lib/prediction-calibration";
import type { PredictionEntry } from "@/lib/prediction-tracker";

export const Route = createFileRoute("/agents")({
  loader: () => getBoard({ data: { offset: 0 } }),
  component: MarketAgents,
});

const CATEGORIES: Array<MarketCategory | "Todos"> = ["Todos", "Resultado", "Golos", "Equipa", "Ambas marcam"];
const CALIBRATION_STORAGE_KEY = "pitchline-prediction-history-v1";

type MarketRow = ReturnType<typeof getMatchMarkets>[number] & {
  key: string;
  fixture: string;
  league: string;
  phase: string;
  odds: number | null;
  edge: number | null;
  stake: number;
};

function MarketAgents() {
  const board = Route.useLoaderData() as Board;
  const [category, setCategory] = useState<MarketCategory | "Todos">("Todos");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [minOdds, setMinOdds] = useState(1.01);
  const [minEdge, setMinEdge] = useState(2);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [bankroll, setBankroll] = useState(250);
  const [maxStakePercent, setMaxStakePercent] = useState(1);
  const [dailyLimitPercent, setDailyLimitPercent] = useState(5);
  const [mode, setMode] = useState<"study" | "review">("study");
  const [calibrationReport, setCalibrationReport] = useState<ReturnType<typeof evaluateCalibration> | null>(null);

  const leagues = useMemo(() => [...new Set(board.matches.map((match) => match.league))].sort(), [board.matches]);
  const fixtures = useMemo(() => board.matches.filter((match) => match.phase === "pre"), [board.matches]);

  const allRows = useMemo<MarketRow[]>(
    () =>
      fixtures.flatMap((match) =>
        getMatchMarkets(match).map((market) => {
          const key = `${match.id}:${market.id}`;
          const typedPrice = prices[key];
          const odds = typedPrice === undefined ? market.bookmakerOdds : Number(typedPrice);
          const validOdds = odds != null && Number.isFinite(odds) && odds > 1 ? odds : null;
          const edge = validOdds == null ? null : calculateMarketEdge(market.probability, validOdds);
          const stake = validOdds == null ? 0 : calculateResponsibleStake(market.probability, validOdds, bankroll, maxStakePercent);
          return {
            ...market,
            key,
            fixture: `${match.home} vs ${match.away}`,
            league: match.league,
            phase: match.phase,
            odds: validOdds,
            edge,
            stake,
          };
        }),
      ),
    [fixtures, prices, bankroll, maxStakePercent],
  );

  const filteredRows = allRows.filter(
    (row) =>
      (category === "Todos" || row.category === category) &&
      (leagueFilter === "all" || row.league === leagueFilter) &&
      (row.odds === null || row.odds >= minOdds),
  );

  const opportunities = filteredRows
    .filter((row) => row.edge !== null && row.edge >= minEdge / 100)
    .sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));

  const suggestedExposure = opportunities.reduce((sum, row) => sum + row.stake, 0);
  const exposureLimit = Math.max(0, bankroll * dailyLimitPercent / 100);
  const exposureAlert = suggestedExposure > exposureLimit && opportunities.length > 0;
  const best = opportunities[0] ?? null;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      const entries = Array.isArray(parsed)
        ? parsed.filter((item): item is PredictionEntry => {
            if (!item || typeof item !== "object") return false;
            const row = item as Partial<PredictionEntry>;
            return (
              typeof row.id === "string" &&
              typeof row.fixture === "string" &&
              typeof row.league === "string" &&
              typeof row.modelProbability === "number" &&
              Number.isFinite(row.modelProbability) &&
              row.modelProbability >= 0 &&
              row.modelProbability <= 1 &&
              typeof row.marketOdds === "number" &&
              Number.isFinite(row.marketOdds) &&
              row.marketOdds > 1 &&
              typeof row.stake === "number" &&
              Number.isFinite(row.stake) &&
              row.stake >= 0 &&
              (row.result === "pending" ||
                row.result === "won" ||
                row.result === "lost" ||
                row.result === "void") &&
              typeof row.notes === "string" &&
              typeof row.createdAt === "string"
            );
          })
        : [];

      setCalibrationReport(evaluateCalibration(entries));
    } catch {
      setCalibrationReport(evaluateCalibration([]));
    }
  }, []);

  const riskSummary = useMemo(
    () =>
      evaluateRisk({
        bankroll,
        dailyExposureLimitPercent: dailyLimitPercent,
        maxStakePercent: maxStakePercent,
        dataQuality: opportunities.length > 0 ? "sufficient" : "limited",
        picks: opportunities.slice(0, 5).map((row, index) => ({
          id: `${row.key}-${index}`,
          probability: row.probability,
          decimalOdds: row.odds ?? 1.01,
          requestedStake: row.stake,
        })),
      }),
    [bankroll, dailyLimitPercent, maxStakePercent, opportunities],
  );

  const calibrationWeight = calibrationReport
    ? calibrationReport.status === "larger_sample"
      ? 1
      : calibrationReport.status === "preliminary"
        ? 0.75
        : calibrationReport.status === "insufficient_sample"
          ? 0.45
          : 0.25
    : 0.5;

  const overallDecisionScore = useMemo(() => {
    if (!opportunities.length) return 22;

    const avgEdgePct = (opportunities.reduce((sum, row) => sum + (row.edge ?? 0), 0) / opportunities.length) * 100;
    const riskScore =
      riskSummary.status === "within_limit"
        ? 100
        : riskSummary.status === "scaled_to_limit"
          ? 72
          : riskSummary.status === "blocked"
            ? 18
            : 28;

    return Math.min(100, Math.max(18, Math.round(avgEdgePct * 2.1 + riskScore * 0.38 + calibrationWeight * 35)));
  }, [calibrationWeight, opportunities, riskSummary.status]);

  const decisionSummary =
    overallDecisionScore >= 80
      ? { label: "Aprovar", tone: "text-live border-live/40 bg-live/10" }
      : overallDecisionScore >= 60
        ? { label: "Verificar", tone: "text-gold border-gold/40 bg-gold/10" }
        : { label: "Ignorar", tone: "text-muted border-line bg-surface" };

  function updatePrice(key: string, value: string) {
    setPrices((previous) => ({ ...previous, [key]: value }));
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-6 sm:px-6">
      <header className="glass-panel surface-glow mt-2 rounded-[28px] p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link to="/" className="text-xs font-semibold text-primary hover:underline">← Voltar ao Pitchline</Link>
            <p className="mt-3 text-xs font-mono uppercase tracking-[0.28em] text-gold">Central de decisão</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-fg sm:text-5xl">Mercados, risco e calibração</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
              Estimativas transparentes. O painel combina edge, limite de exposição e qualidade histórica para priorizar sinais.
            </p>
          </div>

          <div className="min-w-[220px] rounded-2xl border border-primary/30 bg-primary/8 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Score geral</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <span className="font-display text-4xl font-bold text-fg">{overallDecisionScore}</span>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${decisionSummary.tone}`}>
                {decisionSummary.label}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <AgentCard title="Analista de mercados" status={opportunities.length ? `${opportunities.length} sinal(is) de edge` : "Sem sinal acima do filtro"}>
          {best
            ? `Maior estimativa: ${best.fixture} · ${best.label}, edge ${(100 * (best.edge ?? 0)).toFixed(1)}%. Odds podem estar desatualizadas; confirme preço e liquidez.`
            : "Sem preço válido ou sem seleção acima do edge mínimo."}
        </AgentCard>
        <AgentCard title="Analista estatístico" status={`${fixtures.length} jogos pré-jogo · fonte ${board.source}`}>
          {fixtures[0]
            ? `${fixtures[0].home}: ${getRecentFormSummary(fixtures[0].formHome)}. ${fixtures[0].away}: ${getRecentFormSummary(fixtures[0].formAway)}. Mercados derivados do xG/Dixon–Clarke e comparados com o mercado.`
            : "Sem jogos pré-jogo disponíveis para análise estatística."}
        </AgentCard>
        <AgentCard title="Controlo de risco" status={exposureAlert ? "Limite de exposição excedido" : `Exposição sugerida dentro do limite`}>
          {`Exposição agregada €${suggestedExposure.toFixed(2)} / limite definido €${exposureLimit.toFixed(2)}. Este controlo é indicativo e não bloqueia apostas externas.`}
        </AgentCard>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="Banca de referência" value={`€${bankroll.toFixed(2)}`} />
        <MiniStat label="Exposição sugerida" value={`€${suggestedExposure.toFixed(2)}`} />
        <MiniStat
          label="Edge médio filtrado"
          value={
            opportunities.length
              ? `${((opportunities.reduce((sum, row) => sum + (row.edge ?? 0), 0) / opportunities.length) * 100).toFixed(1)}%`
              : "—"
          }
        />
        <MiniStat label="Melhor sinal" value={best ? `${best.fixture}: ${best.label}` : "—"} />
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Agentes</p>
          <div className="mt-2 flex flex-col gap-2">
            <Link to="/risk" className="text-xs font-semibold text-primary hover:underline">
              Ir para Agente de risco
            </Link>
            <Link to="/calibration" className="text-xs font-semibold text-primary hover:underline">
              Ir para Agente de calibração
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-2">
        <article className="glass-panel rounded-[24px] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-fg">Agente de risco</h2>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-wide text-primary">
              {riskSummary.status}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted">Stake pedida</dt>
              <dd className="mt-1 font-mono text-fg">€{riskSummary.totalRequested.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted">Stake aprovada</dt>
              <dd className="mt-1 font-mono text-fg">€{riskSummary.approvedTotal.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted">Limite</dt>
              <dd className="mt-1 font-mono text-fg">€{riskSummary.exposureLimit.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted">Alertas</dt>
              <dd className="mt-1 text-xs text-muted">{riskSummary.warnings.length}</dd>
            </div>
          </dl>
          <div className="mt-3 flex justify-end">
            <Link to="/risk" className="text-xs font-semibold text-primary hover:underline">
              Abrir controlo de risco →
            </Link>
          </div>
        </article>

        <article className="glass-panel rounded-[24px] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-fg">Agente de calibração</h2>
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-wide text-gold">
              {calibrationReport ? calibrationReport.status : "sem dados"}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted">Amostra</dt>
              <dd className="mt-1 font-mono text-fg">{calibrationReport?.sampleSize ?? 0}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted">Brier score</dt>
              <dd className="mt-1 font-mono text-fg">
                {calibrationReport?.brierScore == null ? "—" : calibrationReport.brierScore.toFixed(4)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted">Log loss</dt>
              <dd className="mt-1 font-mono text-fg">
                {calibrationReport?.logLoss == null ? "—" : calibrationReport.logLoss.toFixed(4)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted">CLV média</dt>
              <dd className="mt-1 font-mono text-fg">
                {calibrationReport?.meanClosingLineValue == null
                  ? "—"
                  : `${(calibrationReport.meanClosingLineValue * 100).toFixed(2)}%`}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex justify-end">
            <Link to="/calibration" className="text-xs font-semibold text-primary hover:underline">
              Abrir calibração →
            </Link>
          </div>
        </article>
      </section>

      <section className="mt-5 glass-panel rounded-[28px] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-fg">Scanner multi-jogo e multi-mercado</h2>
            <p className="mt-1 max-w-3xl text-xs text-muted">
              Só os preços 1X2 podem vir do fornecedor. Introduza as restantes odds manualmente. A comparação usa as
              probabilidades do modelo base e aplica o controlo de risco indicativo para cada sinal.
            </p>
          </div>
          <label className="text-xs text-muted">
            Modo
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as typeof mode)}
              className="mt-1 block rounded-lg border border-line bg-bg px-3 py-2 text-fg"
            >
              <option value="study">Estudo</option>
              <option value="review">Revisão</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs text-muted">
            Banca (€)
            <input
              type="number"
              min="0"
              step="10"
              value={bankroll}
              onChange={(event) => setBankroll(Math.max(0, Number(event.target.value) || 0))}
              className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg"
            />
          </label>
          <label className="text-xs text-muted">
            Teto por sinal (%)
            <input
              type="number"
              min="0"
              max="2"
              step="0.25"
              value={maxStakePercent}
              onChange={(event) => setMaxStakePercent(Math.max(0, Math.min(2, Number(event.target.value) || 0)))}
              className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg"
            />
          </label>
          <label className="text-xs text-muted">
            Limite de exposição (%)
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={dailyLimitPercent}
              onChange={(event) => setDailyLimitPercent(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
              className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg"
            />
          </label>
          <label className="text-xs text-muted">
            Edge mínimo (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={minEdge}
              onChange={(event) => setMinEdge(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
              className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg"
            />
          </label>
          <label className="text-xs text-muted">
            Odd mínima
            <input
              type="number"
              min="1.01"
              step="0.05"
              value={minOdds}
              onChange={(event) => setMinOdds(Math.max(1.01, Number(event.target.value) || 1.01))}
              className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="agent-league">
            Competição
          </label>
          <select
            id="agent-league"
            value={leagueFilter}
            onChange={(event) => setLeagueFilter(event.target.value)}
            className="rounded-lg border border-line bg-bg px-3 py-2 text-xs text-fg"
          >
            <option value="all">Todas as ligas</option>
            {leagues.map((league) => (
              <option key={league} value={league}>
                {league}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-bg p-1">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                aria-pressed={category === item}
                className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium ${
                  category === item ? "bg-primary text-primary-ink" : "text-muted hover:text-fg"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-xs">
          <span className="text-muted">
            Fonte: {board.source} · Atualizado {new Date(board.generatedAt).toLocaleTimeString("pt-PT", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="text-muted">
            {filteredRows.length} mercados · {opportunities.length} acima do edge mínimo
          </span>
        </div>

        {exposureAlert && (
          <p role="status" className="mt-3 rounded-xl border border-live/40 bg-live/10 p-3 text-xs text-live">
            A soma das stakes indicativas ultrapassa o limite de exposição que definiu.
          </p>
        )}

        {mode === "study" && (
          <p className="mt-3 text-xs text-muted">
            Modo de estudo: registe previsões no histórico antes de avaliar o desempenho. As stakes são apenas um cálculo
            demonstrativo e não confirmam valor do investimento.
          </p>
        )}

        {fixtures.length ? (
          <div className="mt-3 overflow-x-auto rounded-[20px] border border-line">
            <table className="w-full min-w-[1120px] text-left text-xs">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-[0.18em] text-muted">
                <tr>
                  <th className="px-3 py-3">Jogo / mercado</th>
                  <th className="px-3 py-3 text-right">Prob. xG</th>
                  <th className="px-3 py-3 text-right">Odd justa</th>
                  <th className="px-3 py-3 text-right">Odd do mercado</th>
                  <th className="px-3 py-3 text-right">Edge</th>
                  <th className="px-3 py-3 text-right">Stake</th>
                  <th className="px-3 py-3 text-right">Decisão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredRows.map((row) => {
                  const edgePct = ((row.edge ?? 0) * 100);
                  const riskDecision = evaluateRisk({
                    bankroll,
                    dailyExposureLimitPercent: dailyLimitPercent,
                    maxStakePercent: maxStakePercent,
                    dataQuality: edgePct >= minEdge ? "sufficient" : "limited",
                    picks: [{
                      id: row.key,
                      probability: row.probability,
                      decimalOdds: row.odds ?? 1.01,
                      requestedStake: row.stake,
                    }],
                  });

                  const calibrationScore = calibrationReport
                    ? calibrationReport.status === "larger_sample"
                      ? 100
                      : calibrationReport.status === "preliminary"
                        ? 72
                        : calibrationReport.status === "insufficient_sample"
                          ? 45
                          : 24
                    : 60;

                  const score = Math.min(
                    100,
                    Math.max(
                      12,
                      Math.round(edgePct * 1.8 + (riskDecision.status === "within_limit" ? 28 : riskDecision.status === "scaled_to_limit" ? 16 : 8) + calibrationScore * 0.32),
                    ),
                  );

                  const decision =
                    score >= 80
                      ? { label: "Aprovar", tone: "text-live border-live/40 bg-live/10" }
                      : score >= 60
                        ? { label: "Verificar", tone: "text-gold border-gold/40 bg-gold/10" }
                        : { label: "Ignorar", tone: "text-muted border-line bg-surface" };

                  return (
                    <tr key={row.key} className={row.edge !== null && row.edge >= minEdge / 100 ? "bg-primary/5" : "bg-surface"}>
                      <td className="px-3 py-2.5">
                        <span className="block text-[10px] text-muted">
                          {row.league} · {row.category}
                        </span>
                        <span className="block font-semibold text-fg">{row.fixture}</span>
                        <span className="block text-[10px] text-muted">{row.label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-fg">{(row.probability * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted">
                        {row.fairOdds ? row.fairOdds.toFixed(2) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          aria-label={`Odd de mercado para ${row.fixture} ${row.label}`}
                          type="number"
                          min="1.01"
                          step="0.01"
                          placeholder="Odd"
                          value={prices[row.key] ?? row.bookmakerOdds}
                          onChange={(event) => updatePrice(row.key, event.target.value)}
                          className="w-20 rounded-lg border border-line bg-bg px-2 py-1 text-right text-fg"
                        />
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-semibold ${
                          row.edge !== null && row.edge >= minEdge / 100 ? "text-primary" : "text-muted"
                        }`}
                      >
                        {row.edge === null ? "—" : `${(row.edge * 100).toFixed(1)}%`}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-fg">
                        {row.stake > 0 ? `€${row.stake.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${decision.tone}`}>
                          {decision.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-line bg-bg p-5 text-sm text-muted">
            Não há jogos pré-jogo disponíveis.
          </p>
        )}
      </section>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Probabilidades e stakes não são aconselhamento financeiro nem garantia de lucro. Dados de lesões, escalações,
        liquidez, limites, e contexto externo podem mudar rapidamente. Este painel é um estudo e não substitui ter
        disciplina financeira e responsabilidade.
      </p>
    </main>
  );
}

function AgentCard({ title, status, children }: { title: string; status: string; children: string }) {
  return (
    <article className="glass-panel rounded-[24px] p-4">
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{title}</h2>
      <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-muted">{status}</p>
      <p className="mt-3 text-sm leading-relaxed text-fg">{children}</p>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 truncate font-display text-xl font-bold text-fg">{value}</p>
    </div>
  );
}

export default MarketAgents;
