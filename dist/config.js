import { readFileSync, existsSync, watchFile, unwatchFile } from 'fs';
import { resolve } from 'path';
import { MCPConfigSchema } from './types.js';
let currentConfig = null;
let configPath = '';
let reloadCallback = null;
export function loadConfig(path) {
    const resolvedPath = resolve(path);
    if (!existsSync(resolvedPath)) {
        throw new Error(`Config file not found: ${resolvedPath}`);
    }
    const content = readFileSync(resolvedPath, 'utf-8');
    const parsed = JSON.parse(content);
    const config = MCPConfigSchema.parse(parsed);
    currentConfig = config;
    configPath = resolvedPath;
    return config;
}
export function getConfig() {
    return currentConfig;
}
export function watchConfig(callback) {
    if (!configPath) {
        throw new Error('No config loaded yet');
    }
    reloadCallback = callback;
    watchFile(configPath, { interval: 1000 }, () => {
        console.log('[mcp-center] Config file changed, reloading...');
        try {
            const newConfig = loadConfig(configPath);
            console.log(`[mcp-center] Loaded ${newConfig.servers.length} server(s)`);
            if (reloadCallback) {
                reloadCallback();
            }
        }
        catch (error) {
            console.error('[mcp-center] Error reloading config:', error);
        }
    });
}
export function unwatchConfig() {
    if (configPath) {
        unwatchFile(configPath);
        reloadCallback = null;
    }
}
export function getDefaultConfigPath() {
    return resolve(process.cwd(), 'mcp.json');
}
//# sourceMappingURL=config.js.map