import type { FastifyInstance } from "fastify";
import type { CancelJobTool } from "../../../tools/CancelJobTool";

/**
 * Registers the API route for cancelling jobs.
 * @param server - The Fastify instance.
 * @param cancelJobTool - The tool instance for cancelling jobs.
 */
export function registerCancelJobRoute(
  server: FastifyInstance,
  cancelJobTool: CancelJobTool
) {
  // POST /web/jobs/:jobId/cancel - Cancel a job by ID
  server.post<{ Params: { jobId: string } }>(
    "/web/jobs/:jobId/cancel",
    async (request, reply) => {
      const { jobId } = request.params;
      const result = await cancelJobTool.execute({ jobId });
      if (result.success) {
        return { success: true, message: result.message };
      } else {
        reply.status(400);
        return { success: false, message: result.message };
      }
    }
  );
}
