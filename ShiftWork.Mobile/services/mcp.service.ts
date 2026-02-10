/**
 * MCP (Model Context Protocol) Service
 *
 * Communicates with the Python MCP HTTP server (http_mcp_server.py)
 * to expose AI-powered tools for schedule queries, employee lookups, etc.
 *
 * The MCP server proxies through to the ShiftWork .NET API and can be
 * extended with additional tools without changing the mobile client.
 */
import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpTool {
  name: string;
  description: string;
  parameters: Record<string, string>;
}

export interface McpToolResult {
  tool_name: string;
  result: any;
  timestamp: string;
}

export interface McpHealthResponse {
  status: string;
  timestamp: string;
  service: string;
  version: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolName?: string;
  toolResult?: any;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Resolve MCP base URL (same localhost-rewrite logic as api-client.ts)
// ---------------------------------------------------------------------------

const resolveMcpBaseUrl = (): string => {
  let base = process.env.EXPO_PUBLIC_MCP_URL || 'http://localhost:8080';

  const isLocalHost = /^(https?:\/\/)?(0\.0\.0\.0|localhost)(:\d+)?/i.test(base);
  if (isLocalHost) {
    const hostUri: string | undefined =
      (Constants as any)?.expoConfig?.hostUri ||
      (Constants as any)?.manifest?.hostUri ||
      (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;

    if (hostUri) {
      const host = hostUri.split(':')[0];
      const scheme = base.startsWith('https') ? 'https' : 'http';
      const portMatch = base.match(/:(\d+)(\/|$)/);
      const port = portMatch ? portMatch[1] : '8080';
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        base = `${scheme}://${host}:${port}`;
      }
    }
  }
  return base;
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class McpService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = resolveMcpBaseUrl();
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });

    if (__DEV__) {
      console.log('[MCP] Base URL:', this.baseUrl);
    }
  }

  // ---- Health / connectivity -----------------------------------------------

  async health(): Promise<McpHealthResponse> {
    const { data } = await this.client.get<McpHealthResponse>('/health');
    return data;
  }

  async ping(): Promise<string> {
    const { data } = await this.client.get<{ message: string }>('/ping');
    return data.message;
  }

  // ---- Tools ---------------------------------------------------------------

  async listTools(): Promise<McpTool[]> {
    const { data } = await this.client.get<{ tools: McpTool[] }>('/api/tools');
    return data.tools;
  }

  async executeTool(toolName: string, args: Record<string, any> = {}): Promise<McpToolResult> {
    const { data } = await this.client.post<McpToolResult>('/api/tools/execute', {
      tool_name: toolName,
      arguments: args,
    });
    return data;
  }

  // ---- Convenience wrappers ------------------------------------------------

  async getEmployeeSchedules(companyId: string, personId: string | number) {
    return this.executeTool('get_employee_schedules', {
      company_id: companyId,
      person_id: String(personId),
    });
  }

  async getPeopleWithUnpublishedSchedules(
    companyId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const args: Record<string, string> = { company_id: companyId };
    if (startDate) args.start_date = startDate;
    if (endDate) args.end_date = endDate;
    return this.executeTool('get_people_with_unpublished_schedules', args);
  }

  // ---- Simple chat / intent router -----------------------------------------
  //
  // This is a lightweight local intent-matcher that maps natural language
  // to MCP tool calls.  It can be replaced with a real LLM backend later.
  // -------------------------------------------------------------------------

  async chat(
    userMessage: string,
    context: { companyId?: string; personId?: number | null },
  ): Promise<{ reply: string; toolUsed?: string; toolResult?: any }> {
    const msg = userMessage.toLowerCase().trim();
    const { companyId, personId } = context;

    try {
      // ---- health / ping ---------------------------------------------------
      if (/^(ping|hello|hi|hey|status|health)$/i.test(msg)) {
        const h = await this.health();
        return {
          reply: `🟢 MCP Server is **${h.status}** (v${h.version}).\nService: ${h.service}\nTimestamp: ${h.timestamp}`,
          toolUsed: 'health',
        };
      }

      // ---- list tools -------------------------------------------------------
      if (/tools|capabilities|what can you do|help/i.test(msg)) {
        const tools = await this.listTools();
        const list = tools
          .map((t, i) => `${i + 1}. **${t.name}** — ${t.description}`)
          .join('\n');
        return {
          reply: `I can use these tools:\n\n${list}\n\nTry asking about schedules, unpublished schedules, or server status.`,
          toolUsed: 'list_tools',
          toolResult: tools,
        };
      }

      // ---- my schedule / employee schedule -----------------------------------
      if (/my schedule|my shifts|when do i work/i.test(msg)) {
        if (!companyId || !personId) {
          return { reply: 'I need your company and person ID to look up schedules. Please sign in first.' };
        }
        const res = await this.getEmployeeSchedules(companyId, personId);
        const count = res.result?.total_schedules ?? 0;
        if (count === 0) {
          return {
            reply: 'You have no schedules at the moment.',
            toolUsed: 'get_employee_schedules',
            toolResult: res.result,
          };
        }
        const schedules = (res.result?.schedules ?? []).slice(0, 5);
        const lines = schedules.map((s: any) => {
          const start = new Date(s.startDate).toLocaleString();
          const end = new Date(s.endDate).toLocaleString();
          return `• ${s.name || 'Shift'}: ${start} → ${end} (${s.status})`;
        });
        return {
          reply: `You have **${count}** schedule(s). Here are the latest:\n\n${lines.join('\n')}`,
          toolUsed: 'get_employee_schedules',
          toolResult: res.result,
        };
      }

      // ---- unpublished schedules ---------------------------------------------
      if (/unpublished|draft|not published/i.test(msg)) {
        if (!companyId) {
          return { reply: 'Company ID is required. Please sign in first.' };
        }
        const res = await this.getPeopleWithUnpublishedSchedules(companyId);
        const count = res.result?.total_people ?? 0;
        if (count === 0) {
          return {
            reply: 'All schedules are published! No pending drafts found. ✅',
            toolUsed: 'get_people_with_unpublished_schedules',
            toolResult: res.result,
          };
        }
        const names = (res.result?.people ?? [])
          .slice(0, 10)
          .map((p: any) => `• ${p.name || `Person ${p.personId}`}`)
          .join('\n');
        return {
          reply: `There are **${count}** people with unpublished schedules:\n\n${names}`,
          toolUsed: 'get_people_with_unpublished_schedules',
          toolResult: res.result,
        };
      }

      // ---- schedule for specific person (e.g., "schedule for 8") -------------
      const personMatch = msg.match(/schedule\s+(?:for|of)\s+(?:person\s+)?(\d+)/i);
      if (personMatch && companyId) {
        const pid = personMatch[1];
        const res = await this.getEmployeeSchedules(companyId, pid);
        const count = res.result?.total_schedules ?? 0;
        if (count === 0) {
          return {
            reply: `Person ${pid} has no schedules.`,
            toolUsed: 'get_employee_schedules',
            toolResult: res.result,
          };
        }
        const schedules = (res.result?.schedules ?? []).slice(0, 5);
        const lines = schedules.map((s: any) => {
          const start = new Date(s.startDate).toLocaleString();
          const end = new Date(s.endDate).toLocaleString();
          return `• ${s.name || 'Shift'}: ${start} → ${end} (${s.status})`;
        });
        return {
          reply: `Person ${pid} has **${count}** schedule(s):\n\n${lines.join('\n')}`,
          toolUsed: 'get_employee_schedules',
          toolResult: res.result,
        };
      }

      // ---- fallback ----------------------------------------------------------
      return {
        reply:
          "I'm your ShiftWork AI assistant! Here's what I can help with:\n\n" +
          '• **"my schedule"** — view your upcoming shifts\n' +
          '• **"schedule for 8"** — view shifts for a specific person\n' +
          '• **"unpublished schedules"** — find draft schedules\n' +
          '• **"tools"** — see all available MCP tools\n' +
          '• **"ping"** — check server connectivity\n\n' +
          'Try one of these!',
      };
    } catch (err: any) {
      const message =
        err?.message || err?.response?.data?.error || 'Something went wrong';
      return {
        reply: `⚠️ Error: ${message}\n\nMake sure the MCP server is running:\n\`python http_mcp_server.py --mode http --port 8080\``,
      };
    }
  }
}

export const mcpService = new McpService();
