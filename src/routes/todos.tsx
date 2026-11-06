import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/todos")({
  component: TodoApp,
});

type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
};

type Filter = "all" | "active" | "completed";
const STORAGE_KEY = "pitchline-todos-v1";

function readTodos(): Todo[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Todo =>
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.completed === "boolean" &&
        typeof item.createdAt === "number",
    );
  } catch {
    return [];
  }
}

function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Load after hydration so server rendering never accesses browser storage.
  useEffect(() => {
    setTodos(readTodos());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // Storage can be disabled or full; the list remains usable for this visit.
    }
  }, [todos, ready]);

  const remaining = todos.filter((todo) => !todo.completed).length;
  const visibleTodos = useMemo(
    () => todos.filter((todo) => filter === "all" || (filter === "active" ? !todo.completed : todo.completed)),
    [todos, filter],
  );

  function addTodo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    setTodos((current) => [
      { id: crypto.randomUUID(), title: cleanTitle, completed: false, createdAt: Date.now() },
      ...current,
    ]);
    setTitle("");
  }

  function toggleTodo(id: string) {
    setTodos((current) => current.map((todo) => todo.id === id ? { ...todo, completed: !todo.completed } : todo));
  }

  function deleteTodo(id: string) {
    setTodos((current) => current.filter((todo) => todo.id !== id));
  }

  function clearCompleted() {
    setTodos((current) => current.filter((todo) => !todo.completed));
  }

  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: "Todas" },
    { id: "active", label: "Por fazer" },
    { id: "completed", label: "Concluídas" },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <header className="border-b border-line pb-5">
        <Link to="/" className="text-xs font-semibold text-primary hover:underline">← Voltar ao Pitchline</Link>
        <p className="mt-5 text-xs font-mono uppercase tracking-widest text-gold">Lista pessoal</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-fg sm:text-4xl">Tarefas</h1>
        <p className="mt-2 text-sm text-muted">As suas tarefas ficam guardadas neste dispositivo através do armazenamento local do navegador.</p>
      </header>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <form onSubmit={addTodo} className="flex gap-2">
          <label className="sr-only" htmlFor="new-todo">Nova tarefa</label>
          <input
            id="new-todo"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="O que precisa de fazer?"
            maxLength={180}
            className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <button type="submit" disabled={!title.trim()} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Adicionar</button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex gap-1 rounded-lg border border-line bg-bg p-1" aria-label="Filtrar tarefas">
            {filters.map((item) => (
              <button key={item.id} type="button" onClick={() => setFilter(item.id)} aria-pressed={filter === item.id} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === item.id ? "bg-primary text-primary-ink" : "text-muted hover:text-fg"}`}>
                {item.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted" aria-live="polite">{remaining} {remaining === 1 ? "tarefa por fazer" : "tarefas por fazer"}</span>
        </div>

        {visibleTodos.length ? (
          <ul className="divide-y divide-line">
            {visibleTodos.map((todo) => (
              <li key={todo.id} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                  aria-label={`${todo.completed ? "Reabrir" : "Concluir"}: ${todo.title}`}
                  className="h-5 w-5 shrink-0 accent-emerald-500"
                />
                <span className={`min-w-0 flex-1 break-words text-sm ${todo.completed ? "text-muted line-through" : "text-fg"}`}>{todo.title}</span>
                <button type="button" onClick={() => deleteTodo(todo.id)} aria-label={`Apagar: ${todo.title}`} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-live/10 hover:text-live">Apagar</button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-12 text-center">
            <p className="font-display text-lg font-semibold text-fg">{filter === "completed" ? "Ainda não concluiu tarefas" : filter === "active" ? "Está tudo em dia" : "A sua lista está vazia"}</p>
            <p className="mt-1 text-sm text-muted">{filter === "all" ? "Adicione uma tarefa acima para começar." : "Experimente outro filtro ou adicione uma tarefa."}</p>
          </div>
        )}

        {todos.some((todo) => todo.completed) && (
          <div className="mt-2 flex justify-end border-t border-line pt-3">
            <button type="button" onClick={clearCompleted} className="text-xs font-medium text-muted hover:text-live">Apagar tarefas concluídas</button>
          </div>
        )}
      </section>
      <p className="mt-4 text-center text-[11px] text-muted">Os dados são guardados apenas neste navegador e não são sincronizados entre dispositivos.</p>
    </main>
  );
}
