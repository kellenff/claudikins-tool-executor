#!/usr/bin/env node
import { Command } from 'commander';

declare const CLI_ROOT: string;
declare function hasExecutable(pathToCheck: string): boolean;
declare function isCommandAvailable(command: string): boolean;
declare function checkCommand(command: string, label: string, hint?: string): void;
declare function checkConfiguredServers(): void;
declare function checkUvx(): void;
declare function checkConfig(): void;
declare function checkRegistry(): boolean;
declare const program: Command;

export { CLI_ROOT, checkCommand, checkConfig, checkConfiguredServers, checkRegistry, checkUvx, hasExecutable, isCommandAvailable, program };
