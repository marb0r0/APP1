import { useEffect, useState } from "react";
import type { Todo, TodoFilter } from "./todos.types";

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<TodoFilter>("all");

  useEffect(() => {
    setTodos([]);
  }, []);

  return {
    todos,
    setTodos,
    filter,
    setFilter,
  };
}
