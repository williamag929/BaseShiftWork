FROM python:3.11-slim

WORKDIR /app

# Install dependencies first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY http_mcp_server.py .

# Default env vars (override in docker-compose)
ENV API_BASE_URL=http://api:80
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["python", "http_mcp_server.py", "--mode", "http", "--port", "8080"]
