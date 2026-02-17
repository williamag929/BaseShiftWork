
---

## Configuration & Security

This server adds several environment-driven configuration options for security and deployment. Add these to your runtime environment or Docker compose.

- LISTEN_HOST (default: 0.0.0.0) — host to bind the HTTP server. Use 0.0.0.0 in Docker, 127.0.0.1 for local-only.
- LISTEN_PORT (default: 8080) — HTTP port.
- API_BASE_URL (default: http://localhost:5182) — base URL of the ShiftWork .NET API. Must include http:// or https://.
- MCP_AUTH_TOKEN (optional) — If set, all /api/* endpoints require Authorization: Bearer <token>.
- ALLOWED_ORIGINS (default: http://localhost:8080) — comma-separated list of allowed CORS origins.
- HTTPX_TIMEOUT / HTTPX_RETRIES / HTTPX_BACKOFF_FACTOR — control httpx timeout and retry/backoff behavior.

Example (local run with auth token):

export API_BASE_URL=http://localhost:5182
export MCP_AUTH_TOKEN=changeme
export ALLOWED_ORIGINS=http://localhost:8080
python http_mcp_server.py --mode http --port 8080

### Security Best Practices

**Authentication & Authorization:**
- When MCP_AUTH_TOKEN is set, clients must send Authorization: Bearer <token> on all /api requests.
- Keep MCP_AUTH_TOKEN secret and rotate regularly.
- All authentication attempts (success and failure) are logged to the audit trail.
- Tool executions are logged with sanitized parameters for compliance.

**Secrets Management:**
- **Development:** Environment variables are acceptable for MCP_AUTH_TOKEN.
- **Production:** Use a secrets manager (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault) instead of plain environment variables.
- Never commit secrets to source control or include in Docker images.
- Rotate MCP_AUTH_TOKEN on a regular schedule (recommended: 90 days).

**CORS Configuration:**
- In production, restrict ALLOWED_ORIGINS to your mobile app host(s) only.
- CORS credentials are automatically enabled only when MCP_AUTH_TOKEN is set.
- Avoid using wildcards (*) for ALLOWED_ORIGINS in production.

**Transport Security:**
- **⚠️ CRITICAL:** The MCP server does NOT provide TLS/HTTPS termination.
- **Production deployments MUST use HTTPS** - place the server behind a reverse proxy or API gateway.
- See "Production Deployment Architecture" section below for recommended setup.

### Production Deployment Architecture

**Recommended Setup:**
```
[Client] -> [API Gateway / Load Balancer with TLS] -> [MCP Server]
         -> [Rate Limiting / WAF]                  -> [.NET API]
```

**Components:**
1. **API Gateway / Reverse Proxy** (nginx, AWS ALB, Azure Application Gateway)
   - TLS termination (HTTPS)
   - Rate limiting (e.g., 100 requests/minute per IP)
   - Request logging and monitoring
   - Optional: IP whitelisting

2. **MCP Server** (this application)
   - Runs on internal network (not directly exposed to internet)
   - MCP_AUTH_TOKEN enforced for all /api routes
   - Connection limits: max 100 concurrent connections
   - Audit logging enabled

3. **.NET API** (ShiftWork.Api)
   - Internal network only
   - Firebase JWT authentication for end-user requests
   - Webhook notifications for data changes

**Example nginx Configuration:**
```nginx
upstream mcp_backend {
    server localhost:8080;
}

server {
    listen 443 ssl http2;
    server_name mcp.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=mcp:10m rate=100r/m;
    limit_req zone=mcp burst=20;
    
    location / {
        proxy_pass http://mcp_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Docker Compose Example:**
```yaml
version: '3.8'
services:
  mcp-server:
    build: ./python_client
    environment:
      - API_BASE_URL=http://api:5182
      - MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN}  # From secrets manager
      - ALLOWED_ORIGINS=https://mcp.example.com
      - LISTEN_HOST=0.0.0.0
      - LISTEN_PORT=8080
    networks:
      - internal
    depends_on:
      - api

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro
    networks:
      - internal
    depends_on:
      - mcp-server

networks:
  internal:
    driver: bridge
```

**Health Monitoring:**
- Use `/health` endpoint for liveness probes
- Monitor audit logs for authentication failures
- Set up alerts for:
  - High rate of authentication failures (potential brute force)
  - API connection errors (dependency failure)
  - High response times (performance degradation)

**Scaling Considerations:**
- MCP server is stateless and can be horizontally scaled
- Use load balancer session affinity if long-running tool executions are common
- Consider caching responses for read-only tools (5-10 minute TTL)

### Additional Security Recommendations

1. **Network Segmentation**
   - MCP server should not be directly accessible from the internet
   - Use private networks or VPNs for internal communication
   - Implement network policies in Kubernetes/container orchestration

2. **Monitoring & Alerting**
   - Enable audit logging in production (LOG_LEVEL=INFO)
   - Forward audit logs to SIEM or log aggregation service
   - Alert on suspicious patterns (repeated auth failures, unusual tool usage)

3. **Compliance**
   - Audit logs contain tool execution parameters - ensure PII is sanitized
   - Implement log retention policies per your compliance requirements
   - Consider encryption at rest for audit logs containing sensitive data

