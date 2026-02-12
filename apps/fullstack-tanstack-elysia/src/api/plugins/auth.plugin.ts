import { Elysia } from "elysia";
import { UnauthorizedError } from "../utils/errors";
import { auth } from "@/lib/auth/auth-server";

export const authMacro = new Elysia({ name: "auth-macro" }).error({ UnauthorizedError }).macro({
  isAuth: {
    async resolve({ request: { headers } }) {
      const session = await auth.api.getSession({ headers });
      if (!session) throw new UnauthorizedError();

      return {
        user: session.user,
        session: session.session,
      };
    },
  },
});
