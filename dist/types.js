import { z } from 'zod';
export const MCPServerConfigSchema = z.object({
    name: z.string(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
    env: z.record(z.string()).optional(),
    enabledTools: z.array(z.string()).optional(),
});
export const MCPConfigSchema = z.object({
    servers: z.array(MCPServerConfigSchema),
});
//# sourceMappingURL=types.js.map