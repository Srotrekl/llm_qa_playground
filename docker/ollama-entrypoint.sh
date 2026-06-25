#!/bin/bash
set -euo pipefail

OLLAMA_BASE_URL="http://${OLLAMA_HOST:-ollama:11434}"
MODEL="${MODEL_NAME:-llama3.2:1b}"

echo "[init] Waiting for Ollama at ${OLLAMA_BASE_URL} ..."
until curl -sf "${OLLAMA_BASE_URL}/api/tags" > /dev/null 2>&1; do
  sleep 3
done
echo "[init] Ollama is up."

if curl -sf "${OLLAMA_BASE_URL}/api/tags" | grep -q "\"${MODEL}\""; then
  echo "[init] Model ${MODEL} already present, skipping pull."
else
  echo "[init] Pulling model: ${MODEL} (this may take several minutes) ..."
  curl -sf -X POST "${OLLAMA_BASE_URL}/api/pull" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"${MODEL}\"}" \
    --no-buffer | while IFS= read -r line; do
      echo "[init] $line"
    done
  echo "[init] Model ${MODEL} ready."
fi
