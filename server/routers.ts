import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { mdsRouter } from "./mds/router";
import { z } from "zod";
import {
  clearLocalSession,
  loginLocalUser,
  registerLocalUser,
} from "./_core/local-auth";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  mds: mdsRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    registerLocal: publicProcedure
      .input(
        z.object({
          firstName: z.string().trim().min(2).max(60),
          lastName: z.string().trim().min(2).max(80),
          password: z.string().min(10).max(200),
          accountType: z.enum(["particular", "professional"]),
        })
      )
      .mutation(async ({ input, ctx }) =>
        registerLocalUser({ ...input, req: ctx.req, res: ctx.res })
      ),
    loginLocal: publicProcedure
      .input(
        z.object({
          firstName: z.string().trim().min(2).max(60),
          lastName: z.string().trim().min(2).max(80),
          password: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ input, ctx }) =>
        loginLocalUser({ ...input, req: ctx.req, res: ctx.res })
      ),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await clearLocalSession(ctx.req, ctx.res);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
