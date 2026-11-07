export type AgentMarketCategory = "Todos" | "Resultado" | "Golos" | "Equipa" | "Ambas marcam";

export type MarketRow = {
  key: string;
  label: string;
  category: AgentMarketCategory;
  league: string;
  fixture: string;
};
