import { MCPConfig } from './types.js';
export declare function loadConfig(path: string): MCPConfig;
export declare function getConfig(): MCPConfig | null;
export declare function watchConfig(callback: () => void): void;
export declare function unwatchConfig(): void;
export declare function getDefaultConfigPath(): string;
//# sourceMappingURL=config.d.ts.map