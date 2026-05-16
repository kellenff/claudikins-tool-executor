import { z } from 'zod';

declare const ServerConfigSchema: z.ZodObject<{
    name: z.ZodString;
    displayName: z.ZodString;
    command: z.ZodString;
    trusted: z.ZodOptional<z.ZodBoolean>;
    args: z.ZodArray<z.ZodString>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
declare const ToolExecutorConfigSchema: z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    servers: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        displayName: z.ZodString;
        command: z.ZodString;
        trusted: z.ZodOptional<z.ZodBoolean>;
        args: z.ZodArray<z.ZodString>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strict>;
type ToolExecutorConfig = z.infer<typeof ToolExecutorConfigSchema>;
type ServerConfigFromFile = z.infer<typeof ServerConfigSchema>;
declare function findConfigFile(startDir?: string): string | null;
declare function loadConfig(configPath?: string): ToolExecutorConfig | null;

export { type ServerConfigFromFile, ServerConfigSchema, type ToolExecutorConfig, ToolExecutorConfigSchema, findConfigFile, loadConfig };
