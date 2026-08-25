#!/usr/bin/env bash

set -euo pipefail

env_file="${AGENT_STUDIO_ENV_FILE:-/etc/agent-studio.env}"
service_name="${AGENT_STUDIO_SERVICE:-agent-studio}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script with sudo."
  exit 1
fi

read -r -p "Responses API Base URL: " base_url
read -r -s -p "Responses API Key: " api_key
printf "\n"
read -r -p "Responses model ID: " model
read -r -p "Maximum output tokens [4096]: " max_output_tokens
read -r -p "Reasoning effort (none, low, medium, high) [medium]: " reasoning_effort

max_output_tokens="${max_output_tokens:-4096}"
reasoning_effort="${reasoning_effort:-medium}"

if [[ ! "$base_url" =~ ^https?://[^[:space:]]+$ ]]; then
  echo "Base URL must start with http:// or https://."
  exit 1
fi

if [[ -z "$api_key" || -z "$model" ]]; then
  echo "API Key and model ID are required."
  exit 1
fi

if [[ ! "$max_output_tokens" =~ ^[0-9]+$ ]] || (( max_output_tokens < 256 || max_output_tokens > 32768 )); then
  echo "Maximum output tokens must be an integer from 256 through 32768."
  exit 1
fi

case "$reasoning_effort" in
  none|low|medium|high) ;;
  *)
    echo "Reasoning effort must be none, low, medium, or high."
    exit 1
    ;;
esac

escape_environment_value() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

mkdir -p "$(dirname "$env_file")"
temporary_file="$(mktemp "${env_file}.XXXXXX")"
trap 'rm -f "$temporary_file"' EXIT

if [[ -f "$env_file" ]]; then
  grep -Ev '^(MOCK_LLM|RESPONSES_API_BASE_URL|RESPONSES_API_KEY|RESPONSES_MODEL|RESPONSES_MAX_OUTPUT_TOKENS|RESPONSES_REASONING_EFFORT)=' "$env_file" > "$temporary_file" || true
else
  cat > "$temporary_file" <<'EOF'
DATABASE_URL="file:/var/lib/agent-studio/agent-studio.db"
MOCK_LLM="false"
EOF
fi

{
  printf '\n# Managed Responses API configuration\n'
  printf 'MOCK_LLM="false"\n'
  printf 'RESPONSES_API_BASE_URL=%s\n' "$(escape_environment_value "$base_url")"
  printf 'RESPONSES_API_KEY=%s\n' "$(escape_environment_value "$api_key")"
  printf 'RESPONSES_MODEL=%s\n' "$(escape_environment_value "$model")"
  printf 'RESPONSES_MAX_OUTPUT_TOKENS=%s\n' "$(escape_environment_value "$max_output_tokens")"
  printf 'RESPONSES_REASONING_EFFORT=%s\n' "$(escape_environment_value "$reasoning_effort")"
} >> "$temporary_file"

if [[ -f "$env_file" ]]; then
  backup_file="${env_file}.bak.$(date +%Y%m%d%H%M%S)"
  cp --preserve=mode,ownership "$env_file" "$backup_file"
fi

install -o root -g agentstudio -m 0640 "$temporary_file" "$env_file"
systemctl restart "$service_name"
systemctl is-active --quiet "$service_name"
echo "Updated $env_file and restarted $service_name."
