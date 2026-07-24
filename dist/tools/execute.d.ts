import { E as ExecuteCodeInput } from '../schemas-D1Zdh_oa.js';
import 'effect';

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
