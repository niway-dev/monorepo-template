import { z } from "zod";

export const todoBaseSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required").max(500),
  completed: z.boolean(),
  userId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createTodoSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
});

export const updateTodoSchema = z.object({
  title: z.string().min(1, "Title is required").max(500).optional(),
  completed: z.boolean().optional(),
});

export type TodoBase = z.infer<typeof todoBaseSchema>;
export type CreateTodo = z.infer<typeof createTodoSchema>;
export type UpdateTodo = z.infer<typeof updateTodoSchema>;
