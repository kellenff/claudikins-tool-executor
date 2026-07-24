import { Schema } from 'effect';

declare const searchToolsInputSchema: Schema.Struct<{
    readonly query: Schema.String;
    readonly limit: Schema.withDecodingDefault<Schema.Number, never>;
    readonly offset: Schema.withDecodingDefault<Schema.Number, never>;
}>;
type SearchToolsInput = typeof searchToolsInputSchema.Type;
declare const getToolSchemaInputSchema: Schema.Struct<{
    readonly name: Schema.String;
}>;
type GetToolSchemaInput = typeof getToolSchemaInputSchema.Type;
declare const executeCodeInputSchema: Schema.Struct<{
    readonly code: Schema.String;
    readonly timeout: Schema.withDecodingDefault<Schema.Number, never>;
}>;
type ExecuteCodeInput = typeof executeCodeInputSchema.Type;

export type { ExecuteCodeInput as E, GetToolSchemaInput as G, SearchToolsInput as S };
