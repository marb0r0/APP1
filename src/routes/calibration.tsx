import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { evaluateCalibration, type CalibrationReport } from "@/lib/prediction-calibration";
import type { PredictionEntry } from "@/lib/prediction-tracker";

export const Route = createFileRoute("/calibration")({ component: CalibrationAgentPage });
const STORAGE_KEY = "pitchline-prediction-history-v1";

function isPredictionEntry(value: unknown): value is PredictionEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<PredictionEntry>;
  return typeof row.id === "string" && typeof row.modelProbability === "number" && Number.isFinite(row.modelProbability) && row.modelProbability >= 0 && row.modelProbability <= 1 &&
    typeof row.marketOdds === "number" && row.marketOdds > 1 &&
    (row.result === "pending" || row.result === "won" || row.result === "lost" || row.result === "void");
}

function readHistory(): PredictionEntry[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isPredictionEntry) : [];
  } catch { return []; }
}

function CalibrationAgentPage() {
  const [entries, setEntries] = useState<PredictionEntry[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { setEntries(readHistory()); setReady(true); }, []);
  const report: CalibrationReport = useMemo(() => evaluateCalibration(entries), [entries]);
  const statusLabel = report.status === "no_data" ? "Sem previsões fechadas" : report.status === "insufficient_sample" ? "Amostra insuficiente (<30)" : report.status === "preliminary" ? "Análise preliminar" : "Amostra maior — ainda não prova calibração";

  return <main className="mx-auto min-h-screen max-w-4xl px-4 pb-20 pt-8 text-fg">
    <Link to="/predictions" className="text-xs font-semibold text-primary hover:underline">← Voltar ao histórico</Link>
    <header className="mt-4 border-b border-line pb-5">
      <p className="text-xs font-mono uppercase tracking-widest text-gold">Agente de calibração</p>
      <h1 className="mt-1 font-display text-3xl font-bold">Avaliação das previsões</h1>
      <p className="mt-2 text-sm text-muted">Avalia probabilidades registadas contra resultados fechados neste navegador. Não garante desempenho futuro.</p>
    </header>

    {!ready ? <p className="mt-6 text-sm text-muted">A carregar histórico…</p> : <>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Previsões avaliadas" value={String(report.sampleSize)} />
        <Metric label="Estado da amostra" value={statusLabel} />
        <Metric label="Brier score (↓ melhor)" value={report.brierScore === null ? "—" : report.brierScore.toFixed(4)} />
        <Metric label="Log loss (↓ melhor)" value={report.logLoss === null ? "—" : report.logLoss.toFixed(4)} />
      </section>
      <section className="mt-5 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Fiabilidade por faixa de probabilidade</h2>
        <p className="mt-1 text-xs text-muted">Compara a probabilidade média indicada com a frequência observada de vitórias. Agrupa mercados diferentes; filtre por mercado antes de tirar conclusões.</p>
        {report.bins.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-xs"><thead className="text-[10px] uppercase text-muted"><tr><th className="px-2 py-2">Faixa prevista</th><th className="px-2 py-2">N</th><th className="px-2 py-2">Média prevista</th><th className="px-2 py-2">Taxa observada</th></tr></thead><tbody className="divide-y divide-line">{report.bins.map((bin) => <tr key={bin.from}><td className="px-2 py-2">{Math.round(bin.from * 100)}–{Math.round(bin.to * 100)}%</td><td className="px-2 py-2">{bin.count}</td><td className="px-2 py-2">{(bin.meanPredicted * 100).toFixed(1)}%</td><td className="px-2 py-2">{(bin.observedRate * 100).toFixed(1)}%</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-muted">Registe e liquide previsões para gerar a análise.</p>}
      </section>
      <section className="mt-5 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Limitações</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">{report.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        <p className="mt-3 text-xs text-muted">CLV média: {report.meanClosingLineValue === null ? "sem odds de fecho registadas" : `${(report.meanClosingLineValue * 100).toFixed(2)}%`}. Valor positivo significa que a odd registada foi superior à odd de fecho, segundo a fórmula usada.</p>
      </section>
    </>}
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="rounded-xl border border-line bg-surface p-3"><p className="text-[10px] uppercase tracking-wider text-muted">{label}</p><p className="mt-2 font-display text-lg font-bold">{value}</p></article>;
}
