import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { evaluateRisk, type RiskDataQuality, type RiskPick } from "@/lib/risk-agent";

export const Route = createFileRoute("/risk")({ component: RiskAgentPage });

function RiskAgentPage() {
  const [bankroll, setBankroll] = useState(250);
  const [dailyLimit, setDailyLimit] = useState(5);
  const [perPickLimit, setPerPickLimit] = useState(1);
  const [dataQuality, setDataQuality] = useState<RiskDataQuality>("sufficient");
  const [probability, setProbability] = useState(0.5);
  const [odds, setOdds] = useState(2);
  const [requestedStake, setRequestedStake] = useState(5);

  const pick: RiskPick = { id: "manual-selection", probability, decimalOdds: odds, requestedStake };
  const report = useMemo(() => evaluateRisk({
    bankroll,
    dailyExposureLimitPercent: dailyLimit,
    maxStakePercent: perPickLimit,
    dataQuality,
    picks: [pick],
  }), [bankroll, dailyLimit, perPickLimit, dataQuality, probability, odds, requestedStake]);

  return <main className="mx-auto min-h-screen max-w-3xl px-4 pb-20 pt-8 text-fg">
    <Link to="/agents" className="text-xs font-semibold text-primary hover:underline">← Voltar aos agentes</Link>
    <header className="mt-4 border-b border-line pb-5">
      <p className="text-xs font-mono uppercase tracking-widest text-gold">Agente de risco</p>
      <h1 className="mt-1 font-display text-3xl font-bold">Controlo de exposição</h1>
      <p className="mt-2 text-sm text-muted">Aplica limites indicativos às stakes introduzidas. Não executa apostas nem avalia a probabilidade real de perda.</p>
    </header>

    <section className="mt-5 grid gap-3 sm:grid-cols-2">
      <NumberField label="Banca de referência (€)" value={bankroll} min={0} onChange={setBankroll} />
      <NumberField label="Limite de exposição total (%)" value={dailyLimit} min={0} max={100} onChange={setDailyLimit} />
      <NumberField label="Teto por seleção (%)" value={perPickLimit} min={0} max={2} step={0.25} onChange={setPerPickLimit} />
      <label className="text-xs text-muted">Qualidade dos dados
        <select value={dataQuality} onChange={(event) => setDataQuality(event.target.value as RiskDataQuality)} className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg">
          <option value="sufficient">Sem alertas automáticos</option><option value="limited">Limitada</option><option value="insufficient">Insuficiente</option>
        </select>
      </label>
      <NumberField label="Probabilidade estimada (0–1)" value={probability} min={0} max={1} step={0.01} onChange={setProbability} />
      <NumberField label="Odd decimal" value={odds} min={1.01} step={0.01} onChange={setOdds} />
      <NumberField label="Stake indicativa pedida (€)" value={requestedStake} min={0} step={1} onChange={setRequestedStake} />
    </section>

    <section className="mt-5 rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Resultado do controlo</p>
      <p className="mt-2 font-display text-xl font-bold">{report.status === "blocked" ? "Bloqueado" : report.status === "scaled_to_limit" ? "Reduzido aos limites" : report.status === "invalid_input" ? "Entrada inválida" : "Dentro dos limites configurados"}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted">Stake pedida</dt><dd className="font-mono">€{report.totalRequested.toFixed(2)}</dd></div>
        <div><dt className="text-xs text-muted">Limite total disponível</dt><dd className="font-mono">€{report.exposureLimit.toFixed(2)}</dd></div>
        <div><dt className="text-xs text-muted">Stake aprovada pelo controlo</dt><dd className="font-mono font-bold">€{report.approvedTotal.toFixed(2)}</dd></div>
        <div><dt className="text-xs text-muted">Motivo</dt><dd className="text-xs">{report.allocations[0]?.reason ?? "—"}</dd></div>
      </dl>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted">{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </section>
  </main>;
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return <label className="text-xs text-muted">{label}<input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg" /></label>;
}
