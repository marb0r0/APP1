export type AgentMarketCategory = "Todos" | "Resultado" | "Golos" | "Equipa" | "Ambas marcam";

export type MarketRow = {
  key: string;
  label: string;
  category: AgentMarketCategory;
  league: string;
  fixture: string;
};

export function AgentsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-fg">
      <h1 className="font-display text-3xl font-bold">Agents</h1>
      <p className="mt-2 text-sm text-muted">
        Feature scaffold for the market-analysis flow. Move the current MarketAgents logic here gradually.
      </p>
    </div>
  );
}
