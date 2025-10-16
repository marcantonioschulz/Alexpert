#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <domain> <target_url>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOMAIN="$1"
TARGET_URL="$2"

cd "$REPO_ROOT"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to talk to the Nginx Proxy Manager API" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to parse target URLs" >&2
  exit 1
fi

API_BASE="${NPM_BASE_URL:-http://localhost:81/api}"
FORCE_SSL_RAW="${NPM_FORCE_SSL:-false}"

mapfile -t parsed_url < <(python3 - "$TARGET_URL" <<'PY'
import sys
from urllib.parse import urlparse

target = urlparse(sys.argv[1])
if not target.scheme or not target.hostname:
    raise SystemExit("Target URL must include scheme and host, e.g. https://backend:4000")
port = target.port
if port is None:
    port = 443 if target.scheme == 'https' else 80
print(target.scheme)
print(target.hostname)
print(port)
PY
)

FORWARD_SCHEME="${parsed_url[0]}"
FORWARD_HOST="${parsed_url[1]}"
FORWARD_PORT="${parsed_url[2]}"

obtain_token() {
  if [[ -n "${NPM_TOKEN:-}" ]]; then
    ACCESS_TOKEN="$NPM_TOKEN"
    return
  fi

  if [[ -z "${NPM_EMAIL:-}" || -z "${NPM_PASSWORD:-}" ]]; then
    echo "Set either NPM_TOKEN or NPM_EMAIL/NPM_PASSWORD in your environment" >&2
    exit 1
  fi

  local login_response
  login_response=$(curl -sS -X POST "$API_BASE/tokens" \
    -H 'Content-Type: application/json' \
    -d "{\"identity\":\"$NPM_EMAIL\",\"secret\":\"$NPM_PASSWORD\"}")

  ACCESS_TOKEN=$(python3 - "$login_response" <<'PY'
import json
import sys
response = json.loads(sys.argv[1])
print(response.get('token', ''))
PY
)

  if [[ -z "$ACCESS_TOKEN" ]]; then
    echo "Failed to obtain Nginx Proxy Manager token" >&2
    exit 1
  fi
}

obtain_token

fetch_existing() {
  curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE/nginx/proxy-hosts"
}

EXISTING_ID=$(fetch_existing | python3 - "$DOMAIN" <<'PY'
import json
import sys
payload = json.load(sys.stdin)
domain = sys.argv[1]
for item in payload:
    if domain in item.get('domain_names', []):
        print(item.get('id', ''))
        break
PY
)

PAYLOAD=$(python3 - <<'PY' "$DOMAIN" "$FORWARD_SCHEME" "$FORWARD_HOST" "$FORWARD_PORT" "$FORCE_SSL_RAW"
import json
import os
import sys

domain, scheme, host, port, force_ssl_raw = sys.argv[1:6]
force_ssl = force_ssl_raw.lower() in {"1", "true", "yes", "on"}
certificate_id = int(os.getenv("NPM_CERTIFICATE_ID", "0") or 0)
access_list_id = int(os.getenv("NPM_ACCESS_LIST_ID", "0") or 0)
advanced_config = os.getenv("NPM_ADVANCED_CONFIG", "")
letsencrypt_email = os.getenv("NPM_LETSENCRYPT_EMAIL", "")

payload = {
    "domain_names": [domain],
    "forward_scheme": scheme,
    "forward_host": host,
    "forward_port": int(port),
    "access_list_id": access_list_id,
    "caching_enabled": False,
    "block_exploits": True,
    "allow_websocket_upgrade": True,
    "http2_support": False,
    "certificate_id": certificate_id,
    "ssl_forced": force_ssl,
    "advanced_config": advanced_config,
    "meta": {
        "letsencrypt_email": letsencrypt_email
    }
}

print(json.dumps(payload))
PY
)

HTTP_METHOD="POST"
API_PATH="/nginx/proxy-hosts"
ACTION="created"

if [[ -n "$EXISTING_ID" ]]; then
  HTTP_METHOD="PUT"
  API_PATH="$API_PATH/$EXISTING_ID"
  ACTION="updated"
fi

curl -sS --fail -X "$HTTP_METHOD" "$API_BASE$API_PATH" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" >/dev/null

echo "Proxy host $ACTION for $DOMAIN → $TARGET_URL"
