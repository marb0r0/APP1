export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
};

export type TodoFilter = "all" | "active" | "completed";

export function readTodos() {
  return [] as Todo[];
}

export function saveTodos(_todos: Todo[]) {
  return;
}
