import {
  useMutation,
  useQuery,
  useQueryClient,
  queryOptions,
  keepPreviousData,
} from "@tanstack/react-query";
import { getTreaty } from "@/lib/treaty";
import { listTodos } from "@/server-functions/list-todos";

interface TodosParams {
  page: number;
  limit: number;
}

export const todoKeys = {
  all: ["todos"] as const,
  list: (params?: TodosParams) => [...todoKeys.all, "list", params] as const,
  detail: (id: string) => [...todoKeys.all, "detail", id] as const,
};

export const todosQueryOptions = (params: TodosParams) =>
  queryOptions({
    queryKey: todoKeys.list(params),
    queryFn: () => listTodos({ data: { page: params.page, limit: params.limit } }),
    placeholderData: keepPreviousData,
  });

export const useTodos = (params: TodosParams) => {
  return useQuery(todosQueryOptions(params));
};

export const useTodo = (id: string) => {
  return useQuery({
    queryKey: todoKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await getTreaty().todos({ id }).get();
      if (error) throw new Error("Failed to fetch todo");
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string) => {
      try {
        console.log("title => ", title);
        const { data, error } = await getTreaty().todos.post({ title });
        console.log("data => ", data);
        console.log("error => ", error);
        console.log("error.message => ", JSON.stringify(error));
        if (error) throw new Error("Failed to create todo");
        return data;
      } catch (error) {
        console.log("error => ", error);
        // throw new Error("Failed to create todo");
        return null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: todoKeys.all });
    },
  });
};

export const useUpdateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; completed?: boolean }) => {
      const { data: result, error } = await getTreaty().todos({ id }).put(data);
      if (error) throw new Error("Failed to update todo");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: todoKeys.all });
    },
  });
};

export const useDeleteTodo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await getTreaty().todos({ id }).delete();
      if (error) throw new Error("Failed to delete todo");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: todoKeys.all });
    },
  });
};

export const useCreateTestTodo = () => {
  return useMutation({
    mutationFn: async (title: string) => {
      // const { data, error } = await getTreaty().test.post({ title });
      const { data, error } = await getTreaty().test.post({ title });
      if (error) throw new Error("Failed to create todo");
      return data;
    },
  });
};
