import { z } from 'zod';

/**
 * Input schema for search_tools
 */
declare const SearchToolsInputSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
type SearchToolsInput = z.infer<typeof SearchToolsInputSchema>;
/**
 * Input schema for get_tool_schema
 */
declare const GetToolSchemaInputSchema: z.ZodObject<{
    name: z.ZodString;
}, z.core.$strict>;
type GetToolSchemaInput = z.infer<typeof GetToolSchemaInputSchema>;
/**
 * Input schema for execute_code
 */
declare const ExecuteCodeInputSchema: z.ZodObject<{
    code: z.ZodString;
    timeout: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
type ExecuteCodeInput = z.infer<typeof ExecuteCodeInputSchema>;

export type { ExecuteCodeInput as E, GetToolSchemaInput as G, SearchToolsInput as S };
