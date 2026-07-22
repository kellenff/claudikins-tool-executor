import { E as ExecuteCodeInput } from '../schemas-9t_yp478.js';
import 'zod';

/** Execute TypeScript/JavaScript code in sandbox */
declare function handleExecuteCode(params: ExecuteCodeInput): Promise<{
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
}>;

export { handleExecuteCode };
