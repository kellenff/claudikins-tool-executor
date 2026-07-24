import { G as GetToolSchemaInput } from '../schemas-9t_yp478.js';
import { ToolDefinition } from '../types.js';
import 'zod';
import '@modelcontextprotocol/sdk/client/index.js';

/**
 * Build the success response when a tool was found. Pure: derives everything from `tool`. The
 * structuredContent mirrors the YAML fields plus `example` and optional `notes`.
 */
declare function toToolSchemaResponse(tool: ToolDefinition): {
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: {
        name: string;
        server: string;
        description: string;
        inputSchema: object;
        example: string;
        notes: string | undefined;
    };
    isError?: undefined;
};
/**
 * Build the error response when a tool was not found. Pure: the requested name is woven into the
 * error message and `search_tools` is suggested as the discovery path.
 */
declare function errorToolSchemaResponse(name: string): {
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
    structuredContent?: undefined;
};
/** Get full inputSchema for a specific tool */
declare function handleGetToolSchema(params: GetToolSchemaInput): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
    structuredContent?: undefined;
} | {
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: {
        name: string;
        server: string;
        description: string;
        inputSchema: object;
        example: string;
        notes: string | undefined;
    };
    isError?: undefined;
}>;

export { errorToolSchemaResponse, handleGetToolSchema, toToolSchemaResponse };
