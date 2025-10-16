# Monitoring and Alerting

The project ships with an observability stack that captures infrastructure and
application level metrics, provisions Grafana dashboards, and forwards alerts to
Slack/Discord webhooks.

## Stack overview

| Component      | Purpose                                                        |
| -------------- | -------------------------------------------------------------- |
| Prometheus     | Scrapes Fastify, OpenAI usage, and node metrics and evaluates alerts. |
| Alertmanager   | Routes alert notifications to Slack/Discord webhooks.          |
| Grafana        | Pre-provisioned dashboards for latency, error rate, and OpenAI usage. |
| node-exporter  | Exposes host/container resource metrics to Prometheus.         |
| Fastify plugin | Exposes `/metrics` endpoint with request, error, and OpenAI counters. |

All configuration files live under [`monitoring/`](../monitoring).

## Getting started

1. **Update webhook placeholders** in [`monitoring/alertmanager.yml`](../monitoring/alertmanager.yml):
   - Replace `<SLACK_WEBHOOK_URL>` with an [Incoming Webhook](https://api.slack.com/messaging/webhooks) URL.
   - Replace `<DISCORD_WEBHOOK_URL>` with a Discord webhook URL.
   - Optionally set `<FALLBACK_WEBHOOK_URL>` for a generic HTTP receiver (e.g., incident management system).
2. (Optional) Adjust Prometheus alert thresholds in
   [`monitoring/prometheus-alerts.yml`](../monitoring/prometheus-alerts.yml).
3. Export Grafana credentials if you do not want to use the defaults:
   ```bash
   export GRAFANA_ADMIN_USER=admin
   export GRAFANA_ADMIN_PASSWORD=change-me
   ```
4. Start the full stack:
   ```bash
   docker compose up -d
   ```
5. Access the dashboards at [http://localhost:3001](http://localhost:3001)
   (default credentials are `admin` / `admin` if not overridden).

## Metrics exposed

The backend registers a `/metrics` endpoint (via `fastify-metrics`) that exports:

- `fastify_request_duration_seconds`: histogram with request latency (seconds).
- `fastify_request_errors_total`: counter of HTTP 5xx responses.
- `openai_requests_total`: counter of OpenAI API calls labeled by success/error.
- `openai_tokens_total`: counter of tokens consumed via the OpenAI API.

Prometheus scrapes the backend every 15 seconds and node-exporter every 15
seconds, enabling alert rules such as:

- `HighErrorRate`: 5xx error rate > 0.1 req/s for 5 minutes.
- `ElevatedLatencyP95`: P95 latency > 2 seconds for 10 minutes.
- `OpenAITokenSpike`: Token throughput > 500 tokens/s for 10 minutes.

## Alert routing

Alertmanager is configured with severity-based routing:

- `warning` alerts → Slack (#observability channel).
- `info` alerts → Discord webhook.
- All other severities → fallback webhook.

Set the webhook URLs before running the stack. For sensitive tokens, prefer
exporting them as environment variables and templating the configuration (e.g.,
with `envsubst`) before launching.

## Grafana dashboards

Grafana auto-loads dashboards from
[`monitoring/grafana/dashboards/`](../monitoring/grafana/dashboards). The default
**Backend Observability** dashboard includes panels for:

1. HTTP P95 latency (via `histogram_quantile` on request duration histogram).
2. HTTP error rate using the Fastify error counter.
3. OpenAI token throughput with success vs failure request rates.

Add additional dashboards by dropping JSON exports in the same directory.
