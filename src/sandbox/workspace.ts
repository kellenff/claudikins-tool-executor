import {
  appendFile,
  mkdir as fsMkdir,
  stat as fsStat,
  readdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { glob as globFs } from "glob";
import { DEFAULT_MCP_RESULTS_MAX_AGE_MS, MCP_RESULTS_DIR } from "../constants.js";

// Resolve workspace relative to module location (not cwd) for plugin portability
const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, "..", "..", "workspace");

/** Resolve a path within the workspace, blocking traversal attacks */
function resolvePath(relativePath: string): string {
  const normalized = normalize(relativePath);

  // Block absolute paths and traversal
  if (normalized.startsWith("/") || normalized.startsWith("..") || normalized.includes("/../")) {
    throw new Error(`Path traversal blocked: ${relativePath}`);
  }

  const fullPath = resolve(WORKSPACE_ROOT, normalized);

  // Double-check the resolved path is within workspace
  if (!fullPath.startsWith(WORKSPACE_ROOT)) {
    throw new Error(`Path traversal blocked: ${relativePath}`);
  }

  return fullPath;
}

/** Age metadata for a file under the workspace. */
export type FileAge = { filepath: string; mtimeMs: number };

/** Pure: pick filepaths whose mtime is older than `maxAgeMs` at the reference time. */
export function selectStaleFiles(
  files: ReadonlyArray<FileAge>,
  now: number,
  maxAgeMs: number,
): string[] {
  return files.filter((entry) => now - entry.mtimeMs > maxAgeMs).map((entry) => entry.filepath);
}

/**
 * Removes stale files from the MCP results directory whose age exceeds the specified threshold.
 *
 * @param {number} [maxAgeMs] Maximum age in milliseconds before a result file is considered stale
 *   and eligible for deletion. Defaults to `DEFAULT_MCP_RESULTS_MAX_AGE_MS` when omitted.
 * @returns {Promise<number>} A promise that resolves to the number of files successfully deleted.
 *   Returns `0` when the results directory does not exist or when an unexpected error occurs.
 */
async function cleanupMcpResults(maxAgeMs = DEFAULT_MCP_RESULTS_MAX_AGE_MS): Promise<number> {
  const dir = join(WORKSPACE_ROOT, MCP_RESULTS_DIR);

  try {
    const files = await readdir(dir);
    const entries: FileAge[] = await Promise.all(
      files.map(async (file) => {
        const filepath = join(dir, file);
        const stats = await fsStat(filepath);
        return { filepath, mtimeMs: stats.mtimeMs };
      }),
    );

    const toDelete = selectStaleFiles(entries, Date.now(), maxAgeMs);

    for (const filepath of toDelete) {
      await unlink(filepath);
    }

    return toDelete.length;
  } catch (err) {
    // ENOENT is expected if directory doesn't exist yet
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return 0;
    }

    // Log unexpected errors (permissions, disk full, etc.)
    console.error("cleanupMcpResults failed:", err);
    return 0;
  }
}

/** Workspace API - all file operations scoped to ./workspace/ */
export const workspace = {
  // Core operations
  async read(path: string): Promise<string> {
    const fullPath = resolvePath(path);
    return readFile(fullPath, "utf-8");
  },

  async write(path: string, data: string): Promise<void> {
    const fullPath = resolvePath(path);
    await writeFile(fullPath, data, "utf-8");
  },

  async append(path: string, data: string): Promise<void> {
    const fullPath = resolvePath(path);
    await appendFile(fullPath, data, "utf-8");
  },

  async delete(path: string): Promise<void> {
    const fullPath = resolvePath(path);
    await unlink(fullPath);
  },

  // JSON operations
  async readJSON<T = unknown>(path: string): Promise<T> {
    const content = await workspace.read(path);
    return JSON.parse(content) as T;
  },

  async writeJSON(path: string, data: unknown): Promise<void> {
    await workspace.write(path, JSON.stringify(data, null, 2));
  },

  // Binary operations
  async readBuffer(path: string): Promise<Buffer> {
    const fullPath = resolvePath(path);
    return readFile(fullPath);
  },

  async writeBuffer(path: string, data: Buffer): Promise<void> {
    const fullPath = resolvePath(path);
    await writeFile(fullPath, data);
  },

  // Directory operations
  async list(path = "."): Promise<string[]> {
    const fullPath = resolvePath(path);
    return readdir(fullPath);
  },

  async glob(pattern: string): Promise<string[]> {
    // Block dangerous patterns
    if (pattern.includes("..")) {
      throw new Error(`Glob traversal blocked: ${pattern}`);
    }

    const matches = await globFs(pattern, {
      cwd: WORKSPACE_ROOT,
      nodir: false,
    });

    return matches;
  },

  async mkdir(path: string): Promise<void> {
    const fullPath = resolvePath(path);
    await fsMkdir(fullPath, { recursive: true });
  },

  /**
   * Checks whether a file or directory exists at the specified path. Returns false if the path does
   * not exist; throws on unexpected errors such as permission issues.
   *
   * @param path - The path to check for existence.
   * @returns A promise resolving to true if the path exists, false otherwise.
   */
  async exists(path: string): Promise<boolean> {
    try {
      const fullPath = resolvePath(path);
      await fsStat(fullPath);
      return true;
    } catch (err) {
      // ENOENT means file doesn't exist - expected
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }

      // Rethrow unexpected errors (permissions, etc.)
      throw err;
    }
  },

  // Metadata
  async stat(path: string): Promise<{ size: number; mtime: Date; isDir: boolean }> {
    const fullPath = resolvePath(path);
    const stats = await fsStat(fullPath);
    return {
      size: stats.size,
      mtime: stats.mtime,
      isDir: stats.isDirectory(),
    };
  },

  // MCP results management
  cleanupMcpResults,
};

export type Workspace = typeof workspace;
