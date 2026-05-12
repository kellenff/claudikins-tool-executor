import { executeCode } from "../sandbox/runtime.js";
import type { ExecuteCodeInput } from "../schemas.js";

/**
 * Execute TypeScript/JavaScript code in sandbox
 */
export async function handleExecuteCode(params: ExecuteCodeInput): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: {
    logs: unknown[];
    error?: string;
    stack?: string;
  };
  isError: boolean;
}> {
  const result = await executeCode(params.code, params.timeout);

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    structuredContent: { ...result },
    isError: !!result.error,
  };
}
