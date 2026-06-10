import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';

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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable({
  providedIn: 'root',
})
export class McpService {
  private readonly baseUrl = environment.mcpUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  // Build headers with the current Firebase session token so the MCP server
  // can proxy requests to the ShiftWork API on behalf of the logged-in user.
  private authHeaders(): Observable<HttpHeaders> {
    return from(this.authService.getToken()).pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        });
        return [headers];
      }),
    );
  }

  // ---- Health / connectivity -----------------------------------------------

  health(): Observable<McpHealthResponse> {
    return this.authHeaders().pipe(
      switchMap(headers => this.http.get<McpHealthResponse>(`${this.baseUrl}/health`, { headers })),
    );
  }

  ping(): Observable<string> {
    return this.authHeaders().pipe(
      switchMap(headers =>
        this.http.get<{ message: string }>(`${this.baseUrl}/ping`, { headers }).pipe(
          switchMap(res => [res.message]),
        ),
      ),
    );
  }

  // ---- Tools ---------------------------------------------------------------

  listTools(): Observable<McpTool[]> {
    return this.authHeaders().pipe(
      switchMap(headers =>
        this.http.get<{ tools: McpTool[] }>(`${this.baseUrl}/api/tools`, { headers }).pipe(
          switchMap(res => [res.tools]),
        ),
      ),
    );
  }

  executeTool(toolName: string, args: Record<string, any> = {}): Observable<McpToolResult> {
    return this.authHeaders().pipe(
      switchMap(headers =>
        this.http.post<McpToolResult>(
          `${this.baseUrl}/api/tools/execute`,
          { tool_name: toolName, arguments: args },
          { headers },
        ),
      ),
    );
  }

  // ---- Convenience wrappers ------------------------------------------------

  getEmployeeSchedules(companyId: string, personId: string | number): Observable<McpToolResult> {
    return this.executeTool('get_employee_schedules', {
      company_id: companyId,
      person_id: String(personId),
    });
  }

  getPeopleWithUnpublishedSchedules(
    companyId: string,
    startDate?: string,
    endDate?: string,
  ): Observable<McpToolResult> {
    const args: Record<string, string> = { company_id: companyId };
    if (startDate) args['start_date'] = startDate;
    if (endDate) args['end_date'] = endDate;
    return this.executeTool('get_people_with_unpublished_schedules', args);
  }
}
