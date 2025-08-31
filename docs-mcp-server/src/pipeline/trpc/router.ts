/**
 * tRPC router exposing pipeline procedures for external workers.
 * Provides a minimal RPC surface to replace legacy REST endpoints.
 *
 * This module now exports a factory to build the router from a provided t instance,
 * allowing us to compose multiple routers under a single /api endpoint.
 */

import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { ScraperOptions } from "../../scraper/types";
import { PipelineJobStatus } from "../types";
import type { IPipeline } from "./interfaces";

// Context carries the pipeline instance
export interface PipelineTrpcContext {
  pipeline: IPipeline;
}

const t = initTRPC.context<PipelineTrpcContext>().create();

// Schemas
const nonEmptyTrimmed = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => s.length > 0, "must not be empty");

const optionalTrimmed = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.string().min(1).optional().nullable(),
);

const enqueueInput = z.object({
  library: nonEmptyTrimmed,
  version: optionalTrimmed,
  options: z.custom<ScraperOptions>(),
});

const jobIdInput = z.object({ id: z.string().min(1) });

const getJobsInput = z.object({
  status: z.nativeEnum(PipelineJobStatus).optional(),
});

// Factory to create a pipeline router from any t instance whose context contains `pipeline`
export function createPipelineRouter(trpc: unknown) {
  const tt = trpc as typeof t;
  return tt.router({
    enqueueJob: tt.procedure
      .input(enqueueInput)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: PipelineTrpcContext;
          input: z.infer<typeof enqueueInput>;
        }) => {
          const jobId = await ctx.pipeline.enqueueJob(
            input.library,
            input.version ?? null,
            input.options,
          );
          return { jobId };
        },
      ),

    getJob: tt.procedure
      .input(jobIdInput)
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: PipelineTrpcContext;
          input: z.infer<typeof jobIdInput>;
        }) => {
          return ctx.pipeline.getJob(input.id);
        },
      ),

    getJobs: tt.procedure
      .input(getJobsInput.optional())
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: PipelineTrpcContext;
          input: z.infer<typeof getJobsInput> | undefined;
        }) => {
          const jobs = await ctx.pipeline.getJobs(input?.status);
          return { jobs };
        },
      ),

    cancelJob: tt.procedure
      .input(jobIdInput)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: PipelineTrpcContext;
          input: z.infer<typeof jobIdInput>;
        }) => {
          await ctx.pipeline.cancelJob(input.id);
          return { success: true } as const;
        },
      ),

    clearCompletedJobs: tt.procedure.mutation(
      async ({ ctx }: { ctx: PipelineTrpcContext }) => {
        const count = await ctx.pipeline.clearCompletedJobs();
        return { count };
      },
    ),
  });
}

// Default router for standalone usage (keeps existing imports working)
export const pipelineRouter = createPipelineRouter(t);

export type PipelineRouter = typeof pipelineRouter;
