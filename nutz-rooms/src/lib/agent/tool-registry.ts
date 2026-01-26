import { Tool, ToolContext, ToolResult } from '@/types';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private userConnections: Map<string, string[]> = new Map(); // userId -> connected apps

  // Register a tool
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  // Register multiple tools
  registerAll(tools: Tool[]): void {
    tools.forEach(tool => this.register(tool));
  }

  // Set user's connected apps (from Composio)
  setUserConnections(userId: string, apps: string[]): void {
    this.userConnections.set(userId, apps);
  }

  // Get all tools available to a user (filters by auth requirements)
  getForUser(userId: string): Tool[] {
    const connectedApps = this.userConnections.get(userId) || [];

    return Array.from(this.tools.values()).filter(tool => {
      // Tool has no auth requirements
      if (!tool.requiresAuth || tool.requiresAuth.length === 0) {
        return true;
      }
      // User has all required apps connected
      return tool.requiresAuth.every(app => connectedApps.includes(app));
    });
  }

  // Get tools by names (for creator config)
  getByNames(names: string[], userId: string): Tool[] {
    const connectedApps = this.userConnections.get(userId) || [];

    return names
      .map(name => this.tools.get(name))
      .filter((tool): tool is Tool => {
        if (!tool) return false;
        if (!tool.requiresAuth || tool.requiresAuth.length === 0) return true;
        return tool.requiresAuth.every(app => connectedApps.includes(app));
      });
  }

  // Execute a tool
  async execute(name: string, params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool "${name}" not found` };
    }
    try {
      return await tool.execute(params, context);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Tool execution failed'
      };
    }
  }

  // Get tool definitions for Claude API format
  getToolDefinitions(tools: Tool[]): Array<{
    name: string;
    description: string;
    input_schema: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  }> {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description,
              ...(param.enum && { enum: param.enum }),
            },
          ])
        ),
        required: Object.entries(tool.parameters)
          .filter(([, param]) => param.required)
          .map(([name]) => name),
      },
    }));
  }

  // Get a single tool by name
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  // List all registered tool names
  listNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

// Global instance
export const toolRegistry = new ToolRegistry();
