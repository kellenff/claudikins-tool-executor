import { ExecutionResult } from '../types.js';
import '@modelcontextprotocol/sdk/client/index.js';

/**
 * Prepared sandbox state: the AsyncFunction to invoke, its globals, and the mock console that
 * captures logs. Built synchronously so the Layer can split setup (sync) from eval (async
 * Effect.tryPromise).
 */
interface PreparedSandbox {
    readonly fn: (...args: unknown[]) => Promise<unknown>;
    readonly globalValues: unknown[];
    readonly logs: unknown[];
}
/**
 * Build the AsyncFunction + globals for a piece of code without running it. Pure sync; lets the
 * Effect layer acquire Clients/Workspace before eval.
 */
declare function prepareSandboxCode(code: string): PreparedSandbox;
/**
 * Run a prepared sandbox with a timeout. The only impurity in the sandbox pipeline: AsyncFunction
 * invocation. Errors include the timeout message — callers can match on the message text to map to
 * SandboxTimeout.
 */
declare function invokeSandboxedCode(prepared: PreparedSandbox, timeout: number): Promise<ExecutionResult>;
/** Execute TypeScript/JavaScript code in a sandboxed environment */
declare function executeCode(code: string, timeout?: number): Promise<ExecutionResult>;
/** Get a list of available MCP clients (for error messages) */
declare function getAvailableClientNames(): string[];
/** Get available MCP client bindings as exposed inside execute_code. */
declare function getSandboxClientBindings(): string[];

export { type PreparedSandbox, executeCode, getAvailableClientNames, getSandboxClientBindings, invokeSandboxedCode, prepareSandboxCode };
