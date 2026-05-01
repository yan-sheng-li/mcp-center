import { z } from 'zod';
export declare const MCPServerConfigSchema: z.ZodObject<{
    name: z.ZodString;
    command: z.ZodOptional<z.ZodString>;
    args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    url: z.ZodOptional<z.ZodString>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    enabledTools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    command?: string | undefined;
    args?: string[] | undefined;
    url?: string | undefined;
    env?: Record<string, string> | undefined;
    enabledTools?: string[] | undefined;
}, {
    name: string;
    command?: string | undefined;
    args?: string[] | undefined;
    url?: string | undefined;
    env?: Record<string, string> | undefined;
    enabledTools?: string[] | undefined;
}>;
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;
export declare const MCPConfigSchema: z.ZodObject<{
    servers: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        command: z.ZodOptional<z.ZodString>;
        args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        url: z.ZodOptional<z.ZodString>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        enabledTools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        command?: string | undefined;
        args?: string[] | undefined;
        url?: string | undefined;
        env?: Record<string, string> | undefined;
        enabledTools?: string[] | undefined;
    }, {
        name: string;
        command?: string | undefined;
        args?: string[] | undefined;
        url?: string | undefined;
        env?: Record<string, string> | undefined;
        enabledTools?: string[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    servers: {
        name: string;
        command?: string | undefined;
        args?: string[] | undefined;
        url?: string | undefined;
        env?: Record<string, string> | undefined;
        enabledTools?: string[] | undefined;
    }[];
}, {
    servers: {
        name: string;
        command?: string | undefined;
        args?: string[] | undefined;
        url?: string | undefined;
        env?: Record<string, string> | undefined;
        enabledTools?: string[] | undefined;
    }[];
}>;
export type MCPConfig = z.infer<typeof MCPConfigSchema>;
export interface ToolInfo {
    name: string;
    originalName: string;
    serverName: string;
    description: string;
    inputSchema: object;
}
export interface LoadedServer {
    name: string;
    client: any;
    tools: ToolInfo[];
}
//# sourceMappingURL=types.d.ts.map