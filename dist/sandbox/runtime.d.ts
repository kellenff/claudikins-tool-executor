import { ExecutionResult } from '../types.js';
import '@modelcontextprotocol/sdk/client/index.js';

/**
 * Execute TypeScript/JavaScript code in a sandboxed environment
 */
declare function executeCode(code: string, timeout?: number): Promise<ExecutionResult>;
/**
 * Get a list of available MCP clients (for error messages)
 */
declare function getAvailableClientNames(): string[];
/**
 * Get available MCP client bindings as exposed inside execute_code.
 */
declare function getSandboxClientBindings(): string[];

export { executeCode, getAvailableClientNames, getSandboxClientBindings };
