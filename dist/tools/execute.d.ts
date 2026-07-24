import { Effect } from 'effect';
import { E as ExecuteCodeInput } from '../schemas-9t_yp478.js';
import 'zod';

type ExecuteCodeResult = {
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: {
        logs: unknown[];
        error?: string;
        stack?: string;
    };
    isError: boolean;
};
declare const executeCodeEffect: (params: ExecuteCodeInput) => Effect.Effect<ExecuteCodeResult, unknown>;
/** Execute TypeScript/JavaScript code in sandbox */
declare function handleExecuteCode(params: ExecuteCodeInput): Promise<ExecuteCodeResult>;

export { executeCodeEffect, handleExecuteCode };
