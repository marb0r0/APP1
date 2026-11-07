export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
};

export type TodoFilter = "all" | "active" | "completed";

export function TodosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-fg">
      <h1 className="font-display text-3xl font-bold">Todos</h1>
      <p className="mt-2 text-sm text-muted">
        Feature scaffold for the todo flow. Move the current route logic here once the migration is complete.
      </p>
    </div>
  );
}
