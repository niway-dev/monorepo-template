import { Elysia, InternalServerError } from "elysia";
import { UnauthorizedError, NotFoundError, BadRequestError, ConflictError } from "./errors";
import { errorBody } from "./response-helpers";

export const errorHandlerPlugin = new Elysia()
  .error({
    UnauthorizedError,
    NotFoundError,
    BadRequestError,
    ConflictError,
    InternalServerError,
  })
  .onError(({ code, error, set }) => {
    if (code === "UnauthorizedError") {
      set.status = 401;
      return errorBody(error.message);
    }

    if (code === "NotFoundError") {
      set.status = 404;
      return errorBody(error.message);
    }

    if (code === "BadRequestError" || code === "ConflictError") {
      set.status = error.status;
      return errorBody(error.message);
    }

    if (code === "InternalServerError") {
      set.status = 500;
      return errorBody(error.message);
    }

    if (code === "VALIDATION") {
      set.status = 400;
      return errorBody(error.message);
    }

    set.status = 500;
    return errorBody("Internal server error");
  });
