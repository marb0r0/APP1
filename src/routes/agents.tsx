import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getBoard } from "@/lib/football.functions";
import type { Board, MatchView } from "@/lib/football";
import {
  calculateMarketEdge,
  calculateResponsibleStake,
  getMatchMarkets,
  getRecentFormSummary,
  type MarketCategory,
} from "@/lib/market-agents";

export const Route = createFileRoute("/agents")({
  loader: () => getBoard({ data: { offset: 0 } }),
  component: MarketAgents,
});

const CATEGORIES: Array<MarketCategory | "Todos"> = ["Todos", "Resultado", "Golos", "Equipa", "Ambas marcam"];

function MarketAgents() {
  const board = Route.useLoaderData() as Board;
  const [selectedId, setSelectedId] = useState(board.matches[0]?.id ?? "");
  const [category, setCategory] = useState<MarketCategory | "Todos">("Todos");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [bankroll, setBankroll] = useState(250);
  const [maxStakePercent, setMaxStakePercent] = useState(1);

  const match = board.matches.find((item) => item.id === selectedId) ?? board.matches[0] ?? null;
  const allMarkets = useMemo(() => (match ? getMatchMarkets(match) : []), [match]);
  const rows = allMarkets
    .filter((market) => category === "Todos" || market.category === category)
    .map((market) => {
      const key = `${match?.id}:${market.id}`;
      const typedPrice = prices[key];
      const odds = typedPrice === undefined ? market.bookmakerOdds : Number(typedPrice);
      const edge = odds == null ? null : calculateMarketEdge(market.probability, odds);
      const stake = odds == null ? 0 : calculateResponsibleStake(market.probability, odds, bankroll, maxStakePercent);
      return { ...market, key, odds, edge, stake };
    });
  const opportunities = rows
    .filter((row) => row.edge !== null && row.edge >= 0.02)
    .sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));

  function updatePrice(key: string, value: string) {
    setPrices((previous) => ({ ...previous, [key]: value }));
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <Link to="/" className="text-xs font-semibold text-primary hover:underline">← Voltar ao Pitchline</Link>
          <p className="mt-3 text-xs font-mono uppercase tracking-widest text-gold">Central de agentes especializados</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-fg sm:text-4xl">Mercados, estatísticas e risco</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            Análise assistida por regras transparentes. As probabilidades são estimativas do modelo, não previsões garantidas.
          </p>
        </div>
        <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs text-fg sm:max-w-sm">
          <strong className="text-gold">Jogo responsável:</strong> defina um limite que possa perder, não persiga prejuízos e nunca trate uma estimativa como rendimento certo.
        </div>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <AgentCard title="Analista de mercados" status={opportunities.length ? `${opportunities.length} oportunidade(s) indicativa(s)` : "Sem valor confirmado"}>
          {opportunities.length
            ? `Maior edge observado: ${opportunities[0].label} (${(100 * (opportunities[0].edge ?? 0)).toFixed(1)}%). Confirme a odd e a liquidez diretamente na casa.`
            : "Com as odds introduzidas, não foi encontrado edge mínimo de 2%. Mercados sem preço não são classificados como oportunidades."}
        </AgentCard>
        <AgentCard title="Analista de estatísticas" status={match ? `${match.league} · xG ${match.homeXg.toFixed(2)}–${match.awayXg.toFixed(2)}` : "Sem jogos disponíveis"}>
          {match
            ? `${match.home}: ${getRecentFormSummary(match.formHome)}. ${match.away}: ${getRecentFormSummary(match.formAway)}. Mercados derivados da matriz de resultados Dixon–Coles.`
            : "Não existem jogos para analisar neste momento."}
        </AgentCard>
        <AgentCard title="Gestor de banca e risco" status={`Limite por aposta: ${maxStakePercent.toFixed(2)}%`}>
          A stake indicativa usa Quarter-Kelly e um teto definido por si. Stake igual a zero quando não há odd válida ou edge positivo. Não são executadas apostas.
        </AgentCard>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-fg">Scanner de oportunidades por mercado</h2>
            <p className="mt-1 text-xs text-muted">Insira odds decimais para mercados sem cotação disponível. Sem odd de mercado, não calculamos valor esperado.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="text-muted">Banca (€)
              <input type="number" min="0" step="10" value={bankroll} onChange={(event) => setBankroll(Math.max(0, Number(event.target.value) || 0))} className="mt-1 block w-28 rounded-lg border border-line bg-bg px-3 py-2 font-mono text-fg" />
            </label>
            <label className="text-muted">Teto por aposta (%)
              <input type="number" min="0" max="2" step="0.25" value={maxStakePercent} onChange={(event) => setMaxStakePercent(Math.max(0, Math.min(2, Number(event.target.value) || 0)))} className="mt-1 block w-28 rounded-lg border border-line bg-bg px-3 py-2 font-mono text-fg" />
            </label>
          </div>
        </div>

        {board.matches.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="agent-match">Jogo</label>
            <select id="agent-match" value={match?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)} className="min-w-64 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg">
              {board.matches.map((item) => <option key={item.id} value={item.id}>{item.home} vs {item.away} · {item.league}</option>)}
            </select>
            <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-bg p-1">
              {CATEGORIES.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-md px-2.5 py-1.5 text-xs ${category === item ? "bg-primary font-semibold text-primary-ink" : "text-muted hover:text-fg"}`}>{item}</button>)}
            </div>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-line bg-bg p-5 text-sm text-muted">Não há jogos disponíveis para a data atual. Tente novamente mais tarde.</p>
        )}

        {!!board.matches.length && <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-xs">
            <span className="text-muted">Jogos analisados: <strong className="text-fg">{board.matches.length}</strong></span>
            <span className="text-muted">Oportunidades com edge ≥ 2%: <strong className="text-gold">{opportunities.length}</strong></span>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wide text-muted">
                <tr><th className="px-3 py-3">Mercado</th><th className="px-3 py-3 text-right">Prob. modelo</th><th className="px-3 py-3 text-right">Odd justa</th><th className="px-3 py-3 text-right">Odd mercado</th><th className="px-3 py-3 text-right">Edge</th><th className="px-3 py-3 text-right">Stake indicativa</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.id} className={row.edge !== null && row.edge >= 0.02 ? "bg-primary/5" : "bg-surface"}>
                    <td className="px-3 py-2.5"><span className="text-[10px] text-muted">{row.category}</span><span className="block font-semibold text-fg">{row.label}</span></td>
                    <td className="px-3 py-2.5 text-right font-mono text-fg">{(row.probability * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted">{row.fairOdds ? row.fairOdds.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <input aria-label={`Odd de mercado para ${row.label}`} type="number" min="1.01" step="0.01" placeholder="Odd" value={prices[row.key] ?? row.bookmakerOdds ?? ""} onChange={(event) => updatePrice(row.key, event.target.value)} className="w-20 rounded border border-line bg-bg px-2 py-1.5 text-right font-mono text-fg" />
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${row.edge !== null && row.edge >= 0.02 ? "text-primary" : "text-muted"}`}>{row.edge === null ? "—" : `${row.edge >= 0 ? "+" : ""}${(row.edge * 100).toFixed(1)}%`}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gold">{row.stake > 0 ? `€${row.stake.toFixed(2)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}
      </section>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        As odds 1X2 vêm da fonte de dados do jogo quando disponíveis; as restantes odds são preenchidas manualmente e não são verificadas. Probabilidades, edge e stakes são estimativas, não aconselhamento financeiro nem garantia de lucro. Considere comissões, limites, variações de odds e a possibilidade de perder a totalidade da stake.
      </p>
    </main>
  );
}

function AgentCard({ title, status, children }: { title: string; status: string; children: string }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-primary">{title}</h2>
      <p className="mt-2 font-display text-base font-semibold text-fg">{status}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{children}</p>
    </article>
  );
}

void (null as unknown as MatchView | null);
