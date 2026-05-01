import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const loadedServers = new Map();
function sanitizeServerName(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}
function makeToolName(serverName, toolName) {
    return `${sanitizeServerName(serverName)}_${toolName}`;
}
async function loadStdioServer(config) {
    if (!config.command) {
        throw new Error(`Server ${config.name}: command is required for stdio transport`);
    }
    const serverParams = {
        command: config.command,
        args: config.args || [],
        env: config.env,
    };
    const transport = new StdioClientTransport(serverParams);
    const client = new Client({
        name: `mcp-center-${config.name}`,
        version: '1.0.0',
    }, {});
    await client.connect(transport);
    const toolsResponse = await client.listTools();
    const tools = [];
    for (const tool of toolsResponse.tools || []) {
        if (config.enabledTools && config.enabledTools.length > 0) {
            if (!config.enabledTools.includes(tool.name)) {
                continue;
            }
        }
        tools.push({
            name: makeToolName(config.name, tool.name),
            originalName: tool.name,
            serverName: config.name,
            description: tool.description || '',
            inputSchema: tool.inputSchema || {},
        });
    }
    return {
        name: config.name,
        client,
        tools,
    };
}
async function loadHttpServer(config) {
    if (!config.url) {
        throw new Error(`Server ${config.name}: url is required for HTTP transport`);
    }
    const transport = new StreamableHTTPClientTransport(new URL(config.url));
    const client = new Client({
        name: `mcp-center-${config.name}`,
        version: '1.0.0',
    }, {});
    await client.connect(transport);
    const toolsResponse = await client.listTools();
    const tools = [];
    for (const tool of toolsResponse.tools || []) {
        if (config.enabledTools && config.enabledTools.length > 0) {
            if (!config.enabledTools.includes(tool.name)) {
                continue;
            }
        }
        tools.push({
            name: makeToolName(config.name, tool.name),
            originalName: tool.name,
            serverName: config.name,
            description: tool.description || '',
            inputSchema: tool.inputSchema || {},
        });
    }
    return {
        name: config.name,
        client,
        tools,
    };
}
function determineTransportType(config) {
    if (config.url) {
        return 'http';
    }
    return 'stdio';
}
export async function loadServer(config) {
    const transportType = determineTransportType(config);
    console.log(`[mcp-center] Loading server "${config.name}" (${transportType} transport)`);
    let loadedServer;
    if (transportType === 'http') {
        loadedServer = await loadHttpServer(config);
    }
    else {
        loadedServer = await loadStdioServer(config);
    }
    console.log(`[mcp-center] Loaded ${loadedServer.tools.length} tool(s) from "${config.name}"`);
    loadedServers.set(config.name, loadedServer);
    return loadedServer;
}
export async function reloadServer(config) {
    const existing = loadedServers.get(config.name);
    if (existing) {
        try {
            await existing.client.close();
        }
        catch (error) {
            console.warn(`[mcp-center] Error closing server ${config.name}:`, error);
        }
    }
    return loadServer(config);
}
export async function loadAllServers(configs) {
    const results = [];
    for (const config of configs) {
        try {
            const loaded = await loadServer(config);
            results.push(loaded);
        }
        catch (error) {
            console.error(`[mcp-center] Failed to load server "${config.name}":`, error);
        }
    }
    return results;
}
export function getAllTools() {
    const allTools = [];
    for (const server of loadedServers.values()) {
        allTools.push(...server.tools);
    }
    return allTools;
}
export async function callTool(toolName, args) {
    for (const server of loadedServers.values()) {
        const tool = server.tools.find(t => t.name === toolName);
        if (tool) {
            const result = await server.client.callTool({
                name: tool.originalName,
                arguments: args,
            });
            return result;
        }
    }
    throw new Error(`Tool not found: ${toolName}`);
}
export async function closeAllServers() {
    for (const [name, server] of loadedServers) {
        try {
            await server.client.close();
            console.log(`[mcp-center] Closed server "${name}"`);
        }
        catch (error) {
            console.warn(`[mcp-center] Error closing server "${name}":`, error);
        }
    }
    loadedServers.clear();
}
export function getLoadedServers() {
    return loadedServers;
}
//# sourceMappingURL=loader.js.map