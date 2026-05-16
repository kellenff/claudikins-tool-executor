import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ServerConfig, AuditLogEntry } from '../types.js';

declare function getServerConfigs(): ServerConfig[];
declare const SERVER_CONFIGS: ServerConfig[];
/**
 * Initialize client states (all disconnected)
 */
declare function initClientStates(): void;
/**
 * Get a client, connecting lazily if needed
 */
declare function getClient(name: string): Promise<Client | null>;
/**
 * Disconnect a specific client
 */
declare function disconnectClient(name: string): Promise<void>;
/**
 * Disconnect all clients
 */
declare function disconnectAll(): Promise<void>;
/**
 * Clean up idle clients (run periodically)
 */
declare function cleanupIdleClients(): Promise<void>;
/**
 * Get list of currently connected clients
 */
declare function getConnectedClients(): string[];
/**
 * Get list of all available clients (connected or not)
 */
declare function getAvailableClients(): string[];
/**
 * Log an MCP call for auditing
 */
declare function logMcpCall(entry: AuditLogEntry): void;
/**
 * Get recent audit log entries
 */
declare function getAuditLog(limit?: number): AuditLogEntry[];
declare function startLifecycleManagement(): void;
/**
 * Stop lifecycle management (for testing)
 */
declare function stopLifecycleManagement(): void;

export { SERVER_CONFIGS, cleanupIdleClients, disconnectAll, disconnectClient, getAuditLog, getAvailableClients, getClient, getConnectedClients, getServerConfigs, initClientStates, logMcpCall, startLifecycleManagement, stopLifecycleManagement };
