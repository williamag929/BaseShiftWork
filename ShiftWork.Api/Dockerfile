# ── Build ────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /app
COPY . .
RUN dotnet restore
RUN dotnet publish -c Release -o out

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app/out .

# Install curl for health check (slim Debian base)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Run as non-root
RUN adduser --disabled-password --home /app --shell /bin/sh appuser \
    && chown -R appuser /app
USER appuser

EXPOSE 80
ENV ASPNETCORE_URLS=http://0.0.0.0:80

# All secrets/config must be injected via environment variables — never COPY .env
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost/health || exit 1

ENTRYPOINT ["dotnet", "ShiftWork.Api.dll"]
