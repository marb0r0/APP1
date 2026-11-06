import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  calculateEdge,
  clampProbability,
  exportPredictionsCsv,
  summarizeByMarket,
  summarizePredictions,
  type PredictionEntry,
  type PredictionResult,
} from "@/lib/prediction-tracker";

export const Route = createFileRoute("/predictions")({ component: PredictionTrackerPage });
const STORAGE_KEY = "pitchline-prediction-history-v1";

function isPredictionEntry(item: unknown): item is PredictionEntry {
  if (!item || typeof item !== "object") return false;
  const row = item as Partial<PredictionEntry>;
  return typeof row.id === "string" && typeof row.fixture === "string" && typeof row.league === "string" &&
    typeof row.modelProbability === "number" && Number.isFinite(row.modelProbability) && row.modelProbability >= 0 && row.modelProbability <= 1 &&
    typeof row.marketOdds === "number" && Number.isFinite(row.marketOdds) && row.marketOdds > 1 &&
    (row.closingOdds === undefined || (typeof row.closingOdds === "number" && Number.isFinite(row.closingOdds) && row.closingOdds > 1)) &&
    typeof row.stake === "number" && Number.isFinite(row.stake) && row.stake >= 0 &&
    (row.result === "pending" || row.result === "won" || row.result === "lost" || row.result === "void") &&
    typeof row.notes === "string" && typeof row.createdAt === "string" &&
    (row.market === undefined || typeof row.market === "string") && (row.oddsSource === undefined || typeof row.oddsSource === "string");
}

function readEntries(): PredictionEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isPredictionEntry) : [];
  } catch { return []; }
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function PredictionTrackerPage() {
  const [entries, setEntries] = useState<PredictionEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [fixture, setFixture] = useState("");
  const [league, setLeague] = useState("");
  const [market, setMarket] = useState("");
  const [probability, setProbability] = useState(0.5);
  const [odds, setOdds] = useState(2);
  const [closingOdds, setClosingOdds] = useState<number | "">("");
  const [stake, setStake] = useState(10);
  const [result, setResult] = useState<PredictionResult>("pending");
  const [oddsSource, setOddsSource] = useState("");
  const [notes, setNotes] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "settled">("all");

  const summary = useMemo(() => summarizePredictions(entries), [entries]);
  const byMarket = useMemo(() => summarizeByMarket(entries), [entries]);
  const edge = Number.isFinite(probability) && Number.isFinite(odds) && odds > 1 ? calculateEdge(clampProbability(probability), odds) : null;
  const visibleEntries = entries.filter((entry) => filter === "all" || (filter === "pending" ? entry.result === "pending" : entry.result !== "pending"));

  useEffect(() => { setEntries(readEntries()); setHydrated(true); }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [entries, hydrated]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fixture.trim() || !league.trim() || !Number.isFinite(probability) || probability < 0 || probability > 1 || !Number.isFinite(odds) || odds <= 1 || !Number.isFinite(stake) || stake <= 0) return;
    const entry: PredictionEntry = {
      id: makeId(), fixture: fixture.trim(), league: league.trim(), market: market.trim() || undefined,
      modelProbability: probability, marketOdds: odds, closingOdds: typeof closingOdds === "number" && closingOdds > 1 ? closingOdds : undefined,
      stake, result, notes: notes.trim(), oddsSource: oddsSource.trim() || undefined, createdAt: new Date().toISOString(),
    };
    setEntries((current) => [entry, ...current]);
    setFixture(""); setLeague(""); setMarket(""); setProbability(0.5); setOdds(2); setClosingOdds(""); setStake(10); setResult("pending"); setOddsSource(""); setNotes("");
  }

  function downloadCsv() {
    const blob = new Blob(["\uFEFF", exportPredictionsCsv(entries)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "pitchline-predictions.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  function updateEntry(id: string, update: Partial<PredictionEntry>) {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...update } : entry));
  }

  return <main className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-8 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5"><div><Link to="/" className="text-xs font-semibold text-primary hover:underline">← Voltar ao Pitchline</Link><p className="mt-3 text-xs uppercase tracking-widest text-primary">Registo e auditoria</p><h1 className="mt-1 font-display text-3xl font-bold text-fg sm:text-4xl">Histórico de previsões</h1><p className="mt-2 text-xs text-muted">Guardado neste navegador. Não sincroniza com outros dispositivos.</p></div><div className="flex gap-2"><button type="button" onClick={downloadCsv} disabled={!entries.length} className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-fg disabled:opacity-50">Exportar CSV</button><Link to="/agents" className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-fg hover:border-primary hover:text-primary">Scanner</Link></div></header>

    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><MetricCard label="Previsões / fechadas" value={`${summary.total} / ${summary.closed}`} /><MetricCard label="Win rate" value={summary.closed ? `${(summary.winRate * 100).toFixed(1)}%` : "—"} /><MetricCard label="ROI" value={summary.closed ? `${summary.roi.toFixed(1)}%` : "—"} /><MetricCard label="Lucro líquido" value={`€${summary.netProfit.toFixed(2)}`} /><MetricCard label="Drawdown máximo" value={`€${summary.maxDrawdown.toFixed(2)}`} /></section>

    <section className="mt-6 grid gap-5 xl:grid-cols-[380px,1fr]">
      <form onSubmit={handleSubmit} className="h-fit rounded-2xl border border-line bg-surface p-4"><h2 className="font-display text-xl font-bold text-fg">Registar previsão</h2><p className="mt-1 text-xs text-muted">Registe antes do evento e indique a probabilidade da seleção escolhida.</p>
        <div className="mt-4 space-y-3 text-sm">
          <Field label="Jogo / seleção"><input required maxLength={140} value={fixture} onChange={(e) => setFixture(e.target.value)} placeholder="Ex.: Porto vence" /></Field>
          <Field label="Liga"><input required maxLength={80} value={league} onChange={(e) => setLeague(e.target.value)} placeholder="Liga Portugal" /></Field>
          <Field label="Mercado"><input maxLength={80} value={market} onChange={(e) => setMarket(e.target.value)} placeholder="1X2, Over 2.5, BTTS…" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Prob. modelo (0–1)"><input required type="number" min="0" max="1" step="0.01" value={probability} onChange={(e) => setProbability(e.target.value === "" ? Number.NaN : Number(e.target.value))} /></Field><Field label="Odd inicial"><input required type="number" min="1.01" step="0.01" value={odds} onChange={(e) => setOdds(e.target.value === "" ? Number.NaN : Number(e.target.value))} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Odd de fecho (opcional)"><input type="number" min="1.01" step="0.01" value={closingOdds} onChange={(e) => setClosingOdds(e.target.value === "" ? "" : Number(e.target.value))} /></Field><Field label="Stake (€)"><input required type="number" min="0.01" step="0.01" value={stake} onChange={(e) => setStake(e.target.value === "" ? Number.NaN : Number(e.target.value))} /></Field></div>
          <Field label="Fonte da odd"><input maxLength={120} value={oddsSource} onChange={(e) => setOddsSource(e.target.value)} placeholder="Casa / fonte e hora" /></Field>
          <Field label="Estado"><select value={result} onChange={(e) => setResult(e.target.value as PredictionResult)}><option value="pending">Pendente</option><option value="won">Ganhou</option><option value="lost">Perdeu</option><option value="void">Anulada / void</option></select></Field>
          <Field label="Notas"><textarea maxLength={1000} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Razão, contexto, limitações" /></Field>
        </div>
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted">Edge teórico antes de comissões: <strong className="font-mono text-fg">{edge === null ? "—" : `${(edge * 100).toFixed(1)}%`}</strong></div>
        {storageError && <p role="alert" className="mt-3 text-xs text-live">Falha ao guardar localmente; exporte os dados se necessário.</p>}
        <button type="submit" disabled={!fixture.trim() || !league.trim() || !Number.isFinite(probability) || probability < 0 || probability > 1 || !Number.isFinite(odds) || odds <= 1 || !Number.isFinite(stake) || stake <= 0} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-ink disabled:opacity-50">Guardar previsão</button>
      </form>

      <div className="space-y-5"><section className="rounded-2xl border border-line bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-bold text-fg">Avaliação</h2><span className="text-xs text-muted">Amostra fechada: {summary.closed} · anuladas: {summary.voids}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><MiniStat label="Edge médio na seleção" value={summary.closed ? `${(summary.averageEdge * 100).toFixed(1)}%` : "—"} /><MiniStat label="Stake média" value={summary.closed ? `€${summary.averageStake.toFixed(2)}` : "—"} /><MiniStat label="Brier score" value={summary.closed ? summary.brierScore.toFixed(3) : "—"} /></div><p className="mt-3 text-[11px] leading-relaxed text-muted">Resultados passados não garantem resultados futuros. Compare Brier Score apenas em mercados/tipos de previsão equivalentes. O fecho de odds é introduzido manualmente e não prova CLV sem uma fonte auditável.</p>
        {byMarket.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[500px] text-xs"><thead className="text-left text-[10px] uppercase text-muted"><tr><th className="py-2">Mercado</th><th className="py-2">n</th><th className="py-2">Acerto</th><th className="py-2">ROI</th><th className="py-2">Brier</th></tr></thead><tbody className="divide-y divide-line">{byMarket.map((row) => <tr key={row.market}><td className="py-2 text-fg">{row.market}</td><td className="py-2">{row.closed}</td><td className="py-2">{(row.winRate * 100).toFixed(1)}%</td><td className="py-2">{row.roi.toFixed(1)}%</td><td className="py-2">{row.brierScore.toFixed(3)}</td></tr>)}</tbody></table></div>}</section>

      <section className="rounded-2xl border border-line bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3"><h2 className="font-display text-xl font-bold text-fg">Registo auditável</h2><select aria-label="Filtrar previsões" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="rounded-lg border border-line bg-bg px-3 py-2 text-xs text-fg"><option value="all">Todas</option><option value="pending">Pendentes</option><option value="settled">Fechadas / anuladas</option></select></div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line"><table className="min-w-full text-left text-xs"><thead className="bg-bg text-[10px] uppercase tracking-wider text-muted"><tr><th className="px-3 py-2">Jogo / mercado</th><th className="px-3 py-2">P</th><th className="px-3 py-2">Odds</th><th className="px-3 py-2">Stake</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">P&amp;L</th><th className="px-3 py-2" /></tr></thead><tbody className="divide-y divide-line">{visibleEntries.length ? visibleEntries.map((entry) => <tr key={entry.id} className="align-top"><td className="px-3 py-2.5"><strong className="text-fg">{entry.fixture}</strong><span className="block text-[10px] text-muted">{entry.league}{entry.market ? ` · ${entry.market}` : ""}</span><span className="block text-[10px] text-muted">{new Date(entry.createdAt).toLocaleString("pt-PT")}{entry.oddsSource ? ` · ${entry.oddsSource}` : ""}</span>{entry.notes && <span className="block max-w-64 break-words text-[10px] text-muted">{entry.notes}</span>}</td><td className="px-3 py-2.5 font-mono">{(entry.modelProbability * 100).toFixed(1)}%</td><td className="px-3 py-2.5"><span className="font-mono">{entry.marketOdds.toFixed(2)}</span><label className="mt-1 block text-[9px] text-muted">fecho<input aria-label={`Odd de fecho de ${entry.fixture}`} type="number" min="1.01" step="0.01" value={entry.closingOdds ?? ""} onChange={(e) => updateEntry(entry.id, { closingOdds: e.target.value === "" ? undefined : Number(e.target.value) })} className="mt-0.5 w-16 rounded border border-line bg-bg px-1 py-0.5 text-fg" /></label></td><td className="px-3 py-2.5 font-mono text-gold">€{entry.stake.toFixed(2)}</td><td className="px-3 py-2.5"><select aria-label={`Resultado de ${entry.fixture}`} value={entry.result} onChange={(e) => updateEntry(entry.id, { result: e.target.value as PredictionResult })} className="rounded border border-line bg-bg px-2 py-1 text-[10px] text-fg"><option value="pending">Pendente</option><option value="won">Ganhou</option><option value="lost">Perdeu</option><option value="void">Void</option></select></td><td className="px-3 py-2.5 font-mono">{entry.result === "pending" || entry.result === "void" ? "—" : `€${(entry.result === "won" ? entry.stake * (entry.marketOdds - 1) : -entry.stake).toFixed(2)}`}</td><td className="px-3 py-2.5"><button type="button" onClick={() => setEntries((current) => current.filter((item) => item.id !== entry.id))} className="text-[10px] text-muted hover:text-live">Apagar</button></td></tr>) : <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted">Sem previsões neste filtro.</td></tr>}</tbody></table></div>
      </section></div>
    </section>
    <p className="mt-4 text-[11px] text-muted">Ferramenta de estudo, não aconselhamento financeiro. Se apostar, defina limites que consiga cumprir e procure apoio se sentir perda de controlo.</p>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs text-muted">{label}{children && <div className="mt-1 [&_input]:block [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-line [&_input]:bg-bg [&_input]:px-3 [&_input]:py-2 [&_input]:text-fg [&_textarea]:block [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-line [&_textarea]:bg-bg [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:text-fg [&_select]:block [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-line [&_select]:bg-bg [&_select]:px-3 [&_select]:py-2 [&_select]:text-fg">{children}</div>}</label>;
}

function MetricCard({ label, value }: { label: string; value: string }) { return <article className="rounded-2xl border border-line bg-surface p-4"><p className="text-[10px] uppercase tracking-widest text-muted">{label}</p><p className="mt-2 font-display text-2xl font-bold text-fg">{value}</p></article>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-line bg-bg p-3"><p className="text-[10px] uppercase tracking-widest text-muted">{label}</p><p className="mt-2 font-display text-xl font-bold text-fg">{value}</p></div>; }
