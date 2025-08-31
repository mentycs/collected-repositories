/**
 * Fastify service to register unified tRPC API at /api.
 * Merges pipeline and data store routers under a single endpoint.
 */

import { initTRPC } from "@trpc/server";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyInstance } from "fastify";
import type { IPipeline } from "../pipeline/trpc/interfaces";
import { createPipelineRouter, type PipelineTrpcContext } from "../pipeline/trpc/router";
import type { IDocumentManagement } from "../store/trpc/interfaces";
import { createDataRouter, type DataTrpcContext } from "../store/trpc/router";

type UnifiedContext = PipelineTrpcContext & DataTrpcContext;

export async function registerTrpcService(
  server: FastifyInstance,
  pipeline: IPipeline,
  docService: IDocumentManagement,
): Promise<void> {
  const t = initTRPC.context<UnifiedContext>().create();

  // Define a single root-level health check to avoid duplicate keys from feature routers
  const healthRouter = t.router({
    ping: t.procedure.query(async () => ({ status: "ok", ts: Date.now() })),
  });

  const router = t.mergeRouters(
    healthRouter,
    createPipelineRouter(t),
    createDataRouter(t),
  );

  await server.register(fastifyTRPCPlugin, {
    prefix: "/api",
    trpcOptions: {
      router,
      createContext: async (): Promise<UnifiedContext> => ({ pipeline, docService }),
    },
  });
}
