import { z } from "zod";
import {
  EXECUTE_CODE_DEFAULT_TIMEOUT_MS,
  EXECUTE_CODE_MAX_TIMEOUT_MS,
  EXECUTE_CODE_MIN_TIMEOUT_MS,
  SEARCH_TOOLS_DEFAULT_LIMIT,
  SEARCH_TOOLS_MAX_LIMIT,
} from "./constants.js";

/**
 * Input schema for search_tools
 */
export const SearchToolsInputSchema = z
  .object({
    query: z
      .string()
      .min(1, "Query cannot be empty")
      .describe("Search query for finding relevant tools"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(SEARCH_TOOLS_MAX_LIMIT)
      .default(SEARCH_TOOLS_DEFAULT_LIMIT)
      .describe(`Maximum results to return (default: ${SEARCH_TOOLS_DEFAULT_LIMIT})`),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Number of results to skip for pagination (default: 0)"),
  })
  .strict();

export type SearchToolsInput = z.infer<typeof SearchToolsInputSchema>;

/**
 * Input schema for get_tool_schema
 */
export const GetToolSchemaInputSchema = z
  .object({
    name: z
      .string()
      .min(1, "Tool name cannot be empty")
      .describe("Tool name (from search_tools results)"),
  })
  .strict();

export type GetToolSchemaInput = z.infer<typeof GetToolSchemaInputSchema>;

/**
 * Input schema for execute_code
 */
export const ExecuteCodeInputSchema = z
  .object({
    code: z
      .string()
      .min(1, "Code cannot be empty")
      .describe("TypeScript/JavaScript code to execute"),
    timeout: z
      .number()
      .int()
      .min(EXECUTE_CODE_MIN_TIMEOUT_MS)
      .max(EXECUTE_CODE_MAX_TIMEOUT_MS)
      .default(EXECUTE_CODE_DEFAULT_TIMEOUT_MS)
      .describe(`Execution timeout in ms (default: ${EXECUTE_CODE_DEFAULT_TIMEOUT_MS})`),
  })
  .strict();

export type ExecuteCodeInput = z.infer<typeof ExecuteCodeInputSchema>;
