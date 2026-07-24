/** Age metadata for a file under the workspace. */
type FileAge = {
    filepath: string;
    mtimeMs: number;
};
/** Pure: pick filepaths whose mtime is older than `maxAgeMs` at the reference time. */
declare function selectStaleFiles(files: ReadonlyArray<FileAge>, now: number, maxAgeMs: number): string[];
/**
 * Removes stale files from the MCP results directory whose age exceeds the specified threshold.
 *
 * @param {number} [maxAgeMs] Maximum age in milliseconds before a result file is considered stale
 *   and eligible for deletion. Defaults to `DEFAULT_MCP_RESULTS_MAX_AGE_MS` when omitted.
 * @returns {Promise<number>} A promise that resolves to the number of files successfully deleted.
 *   Returns `0` when the results directory does not exist or when an unexpected error occurs.
 */
declare function cleanupMcpResults(maxAgeMs?: number): Promise<number>;
/** Workspace API - all file operations scoped to ./workspace/ */
declare const workspace: {
    read(path: string): Promise<string>;
    write(path: string, data: string): Promise<void>;
    append(path: string, data: string): Promise<void>;
    delete(path: string): Promise<void>;
    readJSON<T = unknown>(path: string): Promise<T>;
    writeJSON(path: string, data: unknown): Promise<void>;
    readBuffer(path: string): Promise<Buffer>;
    writeBuffer(path: string, data: Buffer): Promise<void>;
    list(path?: string): Promise<string[]>;
    glob(pattern: string): Promise<string[]>;
    mkdir(path: string): Promise<void>;
    /**
     * Checks whether a file or directory exists at the specified path. Returns false if the path does
     * not exist; throws on unexpected errors such as permission issues.
     *
     * @param path - The path to check for existence.
     * @returns A promise resolving to true if the path exists, false otherwise.
     */
    exists(path: string): Promise<boolean>;
    stat(path: string): Promise<{
        size: number;
        mtime: Date;
        isDir: boolean;
    }>;
    cleanupMcpResults: typeof cleanupMcpResults;
};
type Workspace = typeof workspace;

export { type FileAge, type Workspace, selectStaleFiles, workspace };
