#!/usr/bin/env node
import { Command } from 'commander';

declare const CLI_ROOT: string;
declare function hasExecutable(pathToCheck: string): boolean;
/**
 * Pure: scan `pathDirs` (PATH-style directories) for an executable matching `command + ext`.
 * Returns true on the first candidate that `exists` accepts. PATH entries are stripped of
 * surrounding single/double quotes; empty entries (after stripping) are skipped.
 *
 * IO contract: delegates the existence check to the caller-supplied `exists` function — no
 * filesystem, process, or env reads happen inside this function.
 */
declare function findExecutable(command: string, pathDirs: readonly string[], pathExtensions: readonly string[], exists: (candidate: string) => boolean): boolean;
declare function isCommandAvailable(command: string): boolean;
declare function checkCommand(command: string, label: string, hint?: string): void;
declare function checkConfiguredServers(): void;
declare function checkUvx(): void;
declare function checkConfig(): void;
declare function checkRegistry(): boolean;
declare const program: Command;

export { CLI_ROOT, checkCommand, checkConfig, checkConfiguredServers, checkRegistry, checkUvx, findExecutable, hasExecutable, isCommandAvailable, program };
