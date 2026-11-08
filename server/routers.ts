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
  requestLocalPasswordReset,
  resetLocalPassword,
} from "./_core/local-auth";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  mds: mdsRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    registerLocal: publicProcedure
      .input(
        z
          .object({
            firstName: z.string().trim().min(2).max(60),
            lastName: z.string().trim().min(2).max(80),
            email: z.string().trim().email().max(320),
            password: z.string().min(10).max(200),
            passwordConfirmation: z.string().min(10).max(200),
            accountType: z.enum(["particular", "professional"]),
          })
          .refine(input => input.password === input.passwordConfirmation, {
            message: "Les deux mots de passe doivent être identiques.",
            path: ["passwordConfirmation"],
          })
      )
      .mutation(async ({ input, ctx }) =>
        registerLocalUser({ ...input, req: ctx.req, res: ctx.res })
      ),
    loginLocal: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email().max(320),
          password: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ input, ctx }) =>
        loginLocalUser({ ...input, req: ctx.req, res: ctx.res })
      ),
    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(320) }))
      .mutation(async ({ input }) => {
        await requestLocalPasswordReset(input.email);
        return { success: true as const };
      }),
    resetPassword: publicProcedure
      .input(
        z
          .object({
            token: z.string().min(40).max(100),
            newPassword: z.string().min(10).max(200),
            passwordConfirmation: z.string().min(10).max(200),
          })
          .refine(input => input.newPassword === input.passwordConfirmation, {
            message: "Les deux mots de passe doivent être identiques.",
            path: ["passwordConfirmation"],
          })
      )
      .mutation(async ({ input }) => {
        await resetLocalPassword(input);
        return { success: true as const };
      }),
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
