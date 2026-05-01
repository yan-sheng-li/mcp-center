import { MCPServerConfig, ToolInfo, LoadedServer } from './types.js';
export declare function loadServer(config: MCPServerConfig): Promise<LoadedServer>;
export declare function reloadServer(config: MCPServerConfig): Promise<LoadedServer>;
export declare function loadAllServers(configs: MCPServerConfig[]): Promise<LoadedServer[]>;
export declare function getAllTools(): ToolInfo[];
export declare function callTool(toolName: string, args: any): Promise<any>;
export declare function closeAllServers(): Promise<void>;
export declare function getLoadedServers(): Map<string, LoadedServer>;
//# sourceMappingURL=loader.d.ts.map