/**
 * List command - Lists all available libraries and their versions.
 */

import type { Command } from "commander";
import { createDocumentManagement } from "../../store";
import { ListLibrariesTool } from "../../tools";
import { formatOutput } from "../utils";

export async function listAction(options: { serverUrl?: string }) {
  const { serverUrl } = options;

  // List command doesn't need embeddings - explicitly disable for local execution
  const docService = await createDocumentManagement({
    serverUrl,
    embeddingConfig: serverUrl ? undefined : null,
  });
  try {
    const listLibrariesTool = new ListLibrariesTool(docService);

    // Call the tool directly - tracking is now handled inside the tool
    const result = await listLibrariesTool.execute();

    console.log(formatOutput(result.libraries));
  } finally {
    await docService.shutdown();
  }
}

export function createListCommand(program: Command): Command {
  return program
    .command("list")
    .description("List all available libraries and their versions")
    .option(
      "--server-url <url>",
      "URL of external pipeline worker RPC (e.g., http://localhost:6280/api)",
    )
    .action(listAction);
}
