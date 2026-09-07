#!/usr/bin/env bash
set -euo pipefail

: "${WEBHOOK_URL:?WEBHOOK_URL is required}"
: "${HEALTH_URL:?HEALTH_URL is required}"
: "${WEBHOOK_SECRET:?WEBHOOK_SECRET is required}"
: "${REBUILD_ID:?REBUILD_ID is required}"

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
jq -n --arg ref "${GITHUB_REF:-}" --arg sha "${GITHUB_SHA:-}" \
  '{triggered_by:"github-actions", ref:$ref, sha:$sha}' > "$work_dir/body.json"
sig=$(openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" "$work_dir/body.json" | awk '{print $NF}')

# A previous webhook may still be rebuilding. Do not start overlapping reloads.
accepted=false
for ((attempt=0; attempt<40; attempt++)); do
  code=$(curl -sS --connect-timeout 10 --max-time 30 \
    -o "$work_dir/response" -w '%{http_code}' -X POST \
    -H 'Content-Type: application/json' -H 'X-GitHub-Event: push' \
    -H "X-GitHub-Delivery: $REBUILD_ID" \
    -H "X-Hub-Signature-256: sha256=$sig" \
    --data-binary @"$work_dir/body.json" "$WEBHOOK_URL")
  if [ "$code" = 202 ]; then
    accepted=true
    break
  fi
  if [ "$code" != 409 ]; then
    echo "::error::Webhook returned HTTP $code"
    cat "$work_dir/response"
    exit 1
  fi
  sleep 15
done
if [ "$accepted" != true ]; then
  echo '::error::Previous rebuild did not finish within 10 minutes'
  exit 1
fi

echo "Rebuild $REBUILD_ID accepted; waiting for completion"
for ((attempt=0; attempt<60; attempt++)); do
  if curl -fsS --connect-timeout 10 --max-time 15 \
    "$HEALTH_URL" -o "$work_dir/health.json"; then
    status=$(jq -r --arg id "$REBUILD_ID" \
      'if .reload.id == $id then .reload.status else "pending" end' \
      "$work_dir/health.json")
    case "$status" in
      succeeded)
        # HTML already cached before the state swap has a five-minute TTL.
        echo 'Rebuild succeeded; allowing existing CDN responses to expire (5 minutes)'
        for ((tick=0; tick<20; tick++)); do sleep 15; done
        echo "Rebuild $REBUILD_ID published"
        exit 0
        ;;
      failed)
        echo "::error::Rebuild $REBUILD_ID failed; inspect docs engine logs"
        exit 1
        ;;
    esac
  fi
  sleep 15
done
echo "::error::Rebuild $REBUILD_ID did not complete within the polling window"
exit 1
