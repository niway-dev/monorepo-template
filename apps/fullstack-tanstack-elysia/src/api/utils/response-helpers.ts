import type { ApiResponse } from "@monorepo-template/domain/types";

export function successBody<T>(data: T): ApiResponse<T> {
  return {
    data,
    error: null,
  };
}

export function createdBody<T>(data: T): ApiResponse<T> {
  return successBody(data);
}

export function errorBody(message: string): ApiResponse<never> {
  return {
    data: null,
    error: { message },
  };
}
