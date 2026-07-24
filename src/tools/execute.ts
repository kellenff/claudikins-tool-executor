import { Effect } from "effect";

import { executeCode } from "../sandbox/runtime.js";
import { getAppRuntime } from "../runtime.js";
import type { ExecuteCodeInput } from "../schemas.js";

type ExecuteCodeResult = {
  content: { type: "text"; text: string }[];
  structuredContent: {
    logs: unknown[];
    error?: string;
    stack?: string;
  };
  isError: boolean;
};

export const executeCodeEffect = (
  params: ExecuteCodeInput,
): Effect.Effect<ExecuteCodeResult, unknown> =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => executeCode(params.code, params.timeout),
      catch: (cause) => cause,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { ...result },
      isError: !!result.error,
    };
  });

/** Execute TypeScript/JavaScript code in sandbox */
export async function handleExecuteCode(params: ExecuteCodeInput): Promise<ExecuteCodeResult> {
  return getAppRuntime().runPromise(executeCodeEffect(params));
}
