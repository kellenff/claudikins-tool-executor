import { Schema } from 'effect';

declare const SearchToolsInputSchema: Schema.Struct<{
    readonly query: Schema.String;
    readonly limit: Schema.withDecodingDefault<Schema.Number, never>;
    readonly offset: Schema.withDecodingDefault<Schema.Number, never>;
}>;
type SearchToolsInput = typeof SearchToolsInputSchema.Type;
declare const GetToolSchemaInputSchema: Schema.Struct<{
    readonly name: Schema.String;
}>;
type GetToolSchemaInput = typeof GetToolSchemaInputSchema.Type;
declare const ExecuteCodeInputSchema: Schema.Struct<{
    readonly code: Schema.String;
    readonly timeout: Schema.withDecodingDefault<Schema.Number, never>;
}>;
type ExecuteCodeInput = typeof ExecuteCodeInputSchema.Type;

export type { ExecuteCodeInput as E, GetToolSchemaInput as G, SearchToolsInput as S };
