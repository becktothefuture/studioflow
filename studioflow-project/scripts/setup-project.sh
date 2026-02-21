#!/usr/bin/env bash
set -u -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
ENV_LOCAL_FILE="$ROOT_DIR/.env.local"
FIGMA_TOKEN_HELP_URL="https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens"
FIGMA_SECURITY_SETTINGS_URL="https://www.figma.com/settings?tab=security"
FIGMA_API_BASE="${STUDIOFLOW_FIGMA_API_BASE:-https://api.figma.com/v1}"
MONITOR_INTERVAL_DEFAULT="${STUDIOFLOW_MONITOR_INTERVAL:-60}"
MONITOR_DEEP_EVERY_DEFAULT="${STUDIOFLOW_MONITOR_DEEP_EVERY:-5}"

RUN_ID="$(date +"%Y%m%d-%H%M%S")"
LOG_DIR="$ROOT_DIR/.setup-logs/$RUN_ID"
mkdir -p "$LOG_DIR"

if [[ -t 1 ]]; then
  BRAND=$'\033[38;2;153;186;200m'
  BRAND_SOFT=$'\033[38;2;122;146;158m'
  WHITE=$'\033[97m'
  GREEN=$'\033[92m'
  YELLOW=$'\033[93m'
  RED=$'\033[91m'
  RESET=$'\033[0m'
  CLEAR=$'\033[2K'
else
  BRAND=""
  BRAND_SOFT=""
  WHITE=""
  GREEN=""
  YELLOW=""
  RED=""
  RESET=""
  CLEAR=""
fi

declare -a STEP_NAMES=()
declare -a STEP_COMMANDS=()
declare -a STEP_FIXES=()
declare -a STEP_SEVERITIES=()
declare -a STEP_STATUSES=()

declare -a ISSUE_NAMES=()
declare -a ISSUE_STATUSES=()
declare -a ISSUE_FIXES=()

fail_count=0
warn_count=0
FIGMA_VALIDATION_SCOPE=""
FIGMA_VALIDATION_KIND=""
FIGMA_VALIDATION_HTTP_CODE=""
FIGMA_VALIDATION_CURL_EXIT=""
FIGMA_VALIDATION_ERROR_SNIPPET=""
FIGMA_HTTP_CODE=""
FIGMA_HTTP_BODY=""
FIGMA_CURL_EXIT=0
FIGMA_CURL_ERROR=""

load_local_env_file() {
  if [[ -f "$ENV_LOCAL_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_LOCAL_FILE"
    set +a
  fi
}

escape_for_env() {
  local value="$1"
  printf '%q' "$value"
}

upsert_env_value() {
  local key="$1"
  local value="$2"
  local escaped
  local tmp_file
  escaped="$(escape_for_env "$value")"
  tmp_file="$(mktemp)"

  if [[ -f "$ENV_LOCAL_FILE" ]]; then
    awk -v key="$key" -v value="$escaped" '
      BEGIN { updated = 0 }
      $0 ~ "^[[:space:]]*" key "=" {
        print key "=" value
        updated = 1
        next
      }
      { print }
      END {
        if (!updated) print key "=" value
      }
    ' "$ENV_LOCAL_FILE" >"$tmp_file"
  else
    printf "%s=%s\n" "$key" "$escaped" >"$tmp_file"
  fi

  mv "$tmp_file" "$ENV_LOCAL_FILE"
  chmod 600 "$ENV_LOCAL_FILE" 2>/dev/null || true
}

has_figma_credentials() {
  [[ -n "${FIGMA_ACCESS_TOKEN:-}" && -n "${FIGMA_FILE_KEY:-}" ]]
}

trim_ws() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

strip_control_chars() {
  local value="$1"
  printf '%s' "$value" | tr -d '\r\n\t'
}

sanitize_token_input() {
  local value="$1"
  value="$(strip_control_chars "$value")"
  value="$(trim_ws "$value")"
  value="${value#Authorization: Bearer }"
  value="${value#Bearer }"
  value="${value#X-Figma-Token: }"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  fi
  if [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  value="$(printf '%s' "$value" | tr -d '[:space:]')"
  value="$(printf '%s' "$value" | LC_ALL=C tr -cd '\41-\176')"
  printf '%s' "$value"
}

sanitize_file_input() {
  local value="$1"
  value="$(strip_control_chars "$value")"
  value="$(trim_ws "$value")"
  printf '%s' "$value"
}

response_snippet() {
  local text="$1"
  printf '%s' "$text" | tr '\n' ' ' | sed -E 's/[[:space:]]+/ /g' | cut -c1-160
}

mask_token() {
  local value="$1"
  local length=${#value}
  if (( length <= 8 )); then
    printf '%s' "$value"
    return
  fi
  printf '%s...%s' "${value:0:4}" "${value: -4}"
}

normalize_figma_file_key() {
  local input="$1"
  local trimmed
  trimmed="$(printf '%s' "$input" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  if [[ "$trimmed" =~ figma\.com/(design|file|proto|board)/([^/?#]+) ]]; then
    printf '%s' "${BASH_REMATCH[2]}"
    return
  fi
  if [[ "$trimmed" =~ figma\.com/integrations/claim/([^/?#]+) ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return
  fi
  printf '%s' "$trimmed"
}

maybe_open_figma_token_page() {
  if [[ ! -t 0 || ! -t 1 ]]; then
    return
  fi
  if ! has_open_command; then
    return
  fi
  read -r -p "Open token page in browser now? [Y/n]: " open_now
  if [[ ! "$open_now" =~ ^[Nn]$ ]]; then
    open "$FIGMA_SECURITY_SETTINGS_URL" >/dev/null 2>&1 || true
  fi
}

prompt_token_value() {
  local existing="$1"
  local force_new="${2:-0}"
  local token_input=""
  local keep_hint=""

  if [[ "$force_new" != "1" && -n "$existing" ]]; then
    keep_hint=" (press Enter to keep current)"
    printf "Current FIGMA_ACCESS_TOKEN: %s\n" "$(mask_token "$existing")"
  elif [[ "$force_new" == "1" ]]; then
    printf "%sPrevious token failed validation. Paste a new FIGMA_ACCESS_TOKEN.%s\n" "$YELLOW" "$RESET"
  fi

  while true; do
    read -r -p "FIGMA_ACCESS_TOKEN$keep_hint: " token_input
    token_input="$(sanitize_token_input "$token_input")"

    if [[ -z "$token_input" ]]; then
      if [[ "$force_new" != "1" && -n "$existing" ]]; then
        printf '%s' "$(sanitize_token_input "$existing")"
        return 0
      fi
      printf "%sToken is required for live Figma API. Paste token or type SKIP to cancel setup.%s\n" "$YELLOW" "$RESET"
      read -r -p "Type value or SKIP: " token_input
      token_input="$(sanitize_token_input "$token_input")"
    fi

    if [[ "$token_input" == "SKIP" ]]; then
      return 1
    fi

    if [[ "$token_input" =~ figma\.com/ ]]; then
      printf "%sThat looks like a URL, not a token. Use your personal access token.%s\n" "$YELLOW" "$RESET"
      continue
    fi

    if [[ "$token_input" != figd_* ]]; then
      printf "%sToken format looks unusual. Paste a personal access token that starts with figd_.%s\n" "$YELLOW" "$RESET"
      continue
    fi

    if [[ -n "$token_input" ]]; then
      printf '%s' "$token_input"
      return 0
    fi
  done
}

prompt_file_key_value() {
  local existing="$1"
  local file_input=""
  local keep_hint=""
  local normalized=""

  if [[ -n "$existing" ]]; then
    keep_hint=" (press Enter to keep current)"
    printf "Current FIGMA_FILE_KEY: %s\n" "$existing"
  fi

  while true; do
    read -r -p "FIGMA_FILE_KEY or full Figma URL$keep_hint: " file_input
    file_input="$(sanitize_file_input "$file_input")"
    if [[ -z "$file_input" ]]; then
      if [[ -n "$existing" ]]; then
        printf '%s' "$(sanitize_file_input "$existing")"
        return 0
      fi
      printf "%sFile key is required for live Figma API. Paste key/URL or type SKIP to cancel setup.%s\n" "$YELLOW" "$RESET"
      read -r -p "Type value or SKIP: " file_input
      file_input="$(sanitize_file_input "$file_input")"
    fi

    if [[ "$file_input" == "SKIP" ]]; then
      return 1
    fi

    if [[ "$file_input" =~ ^figd_ ]]; then
      printf "%sThat looks like a token. Paste a Figma file URL or file key.%s\n" "$YELLOW" "$RESET"
      continue
    fi

    normalized="$(normalize_figma_file_key "$file_input")"
    normalized="$(sanitize_file_input "$normalized")"
    if [[ -n "$normalized" ]]; then
      printf '%s' "$normalized"
      return 0
    fi
  done
}

http_request_json() {
  local url="$1"
  local token="$2"
  local body_file=""
  local err_file=""
  local code=""

  body_file="$(mktemp)"
  err_file="$(mktemp)"

  code="$(curl -sS --connect-timeout 10 --max-time 20 -H "X-Figma-Token: $token" -w '%{http_code}' "$url" -o "$body_file" 2>"$err_file")"
  FIGMA_CURL_EXIT=$?
  FIGMA_HTTP_CODE="${code:-000}"
  FIGMA_HTTP_BODY="$(cat "$body_file" 2>/dev/null || true)"
  FIGMA_CURL_ERROR="$(response_snippet "$(cat "$err_file" 2>/dev/null || true)")"

  rm -f "$body_file" "$err_file"
}

record_validation_failure() {
  local scope="$1"
  local kind="$2"
  local http_code="$3"
  local curl_exit="$4"
  local snippet="$5"

  FIGMA_VALIDATION_SCOPE="$scope"
  FIGMA_VALIDATION_KIND="$kind"
  FIGMA_VALIDATION_HTTP_CODE="$http_code"
  FIGMA_VALIDATION_CURL_EXIT="$curl_exit"
  FIGMA_VALIDATION_ERROR_SNIPPET="$snippet"
}

print_transport_failure() {
  local scope_label="$1"

  printf "%sCould not reach Figma API (connection/request error).%s %s\n" "$RED" "$RESET" "$scope_label"
  echo "curl exit code: ${FIGMA_CURL_EXIT:-unknown}"
  if [[ -n "${FIGMA_CURL_ERROR:-}" ]]; then
    echo "curl error: $FIGMA_CURL_ERROR"
  fi
  if [[ -n "${FIGMA_HTTP_CODE:-}" && "${FIGMA_HTTP_CODE:-}" != "000" ]]; then
    echo "HTTP code: $FIGMA_HTTP_CODE"
  fi
  if [[ "${FIGMA_CURL_EXIT:-}" == "43" ]]; then
    echo "Hint: token input likely contains unsupported characters. Re-paste only the raw figd_ token."
  fi
  echo "Check network/VPN/proxy/firewall and retry."
}

validate_figma_token_live() {
  local token="$1"
  local snippet=""

  FIGMA_VALIDATION_SCOPE="token"
  FIGMA_VALIDATION_KIND=""
  FIGMA_VALIDATION_HTTP_CODE=""
  FIGMA_VALIDATION_CURL_EXIT=""
  FIGMA_VALIDATION_ERROR_SNIPPET=""

  printf "%sValidating Figma token...%s\n" "$WHITE" "$RESET"
  http_request_json "$FIGMA_API_BASE/me" "$token"

  if [[ "${FIGMA_CURL_EXIT:-1}" -ne 0 || "${FIGMA_HTTP_CODE:-000}" == "000" ]]; then
    snippet="$FIGMA_CURL_ERROR"
    record_validation_failure "token" "token_transport" "${FIGMA_HTTP_CODE:-000}" "${FIGMA_CURL_EXIT:-1}" "$snippet"
    print_transport_failure "(token check)"
    return 1
  fi

  if [[ "${FIGMA_HTTP_CODE:-000}" == "200" ]]; then
    printf "%sToken validated.%s\n" "$GREEN" "$RESET"
    return 0
  fi

  snippet="$(response_snippet "${FIGMA_HTTP_BODY:-}")"
  if [[ "${FIGMA_HTTP_CODE:-000}" == "401" || "${FIGMA_HTTP_CODE:-000}" == "403" ]]; then
    record_validation_failure "token" "token_invalid" "${FIGMA_HTTP_CODE:-000}" "${FIGMA_CURL_EXIT:-0}" "$snippet"
    printf "%sToken validation failed.%s HTTP %s\n" "$RED" "$RESET" "${FIGMA_HTTP_CODE:-000}"
    if [[ -n "$snippet" ]]; then
      echo "Reason: $snippet"
    fi
    echo "Token help: $FIGMA_TOKEN_HELP_URL"
    return 1
  fi

  record_validation_failure "token" "token_unknown_http" "${FIGMA_HTTP_CODE:-000}" "${FIGMA_CURL_EXIT:-0}" "$snippet"
  printf "%sToken validation failed.%s HTTP %s\n" "$RED" "$RESET" "${FIGMA_HTTP_CODE:-000}"
  if [[ -n "$snippet" ]]; then
    echo "Reason: $snippet"
  fi
  echo "Token help: $FIGMA_TOKEN_HELP_URL"
  return 1
}

validate_figma_file_access_live() {
  local token="$1"
  local file_key="$2"
  local snippet=""

  FIGMA_VALIDATION_SCOPE="file"
  FIGMA_VALIDATION_KIND=""
  FIGMA_VALIDATION_HTTP_CODE=""
  FIGMA_VALIDATION_CURL_EXIT=""
  FIGMA_VALIDATION_ERROR_SNIPPET=""

  printf "%sValidating Figma file access...%s\n" "$WHITE" "$RESET"
  http_request_json "$FIGMA_API_BASE/files/$file_key?depth=1" "$token"

  if [[ "${FIGMA_CURL_EXIT:-1}" -ne 0 || "${FIGMA_HTTP_CODE:-000}" == "000" ]]; then
    snippet="$FIGMA_CURL_ERROR"
    record_validation_failure "file" "file_transport" "${FIGMA_HTTP_CODE:-000}" "${FIGMA_CURL_EXIT:-1}" "$snippet"
    print_transport_failure "(file access check)"
    return 1
  fi

  if [[ "${FIGMA_HTTP_CODE:-000}" == "200" ]]; then
    printf "%sFile key validated.%s\n" "$GREEN" "$RESET"
    return 0
  fi

  snippet="$(response_snippet "${FIGMA_HTTP_BODY:-}")"
  case "${FIGMA_HTTP_CODE:-000}" in
    401)
      record_validation_failure "file" "file_token_invalid" "${FIGMA_HTTP_CODE:-000}" "${FIGMA_CURL_EXIT:-0}" "$snippet"
      printf "%sFile validation failed.%s HTTP %s\n" "$RED" "$RESET" "${FIGMA_HTTP_CODE:-000}"
      if [[ -n "$snippet" ]]; then
        echo "Reason: $snippet"
      fi
      echo "Token is no longer valid. Re-enter FIGMA_ACCESS_TOKEN."
      return 1
      ;;
    403)
      record_validation_failure "file" "file_forbidden" "${FIGMA_HTTP_CODE:-000}" "${FIGMA_CURL_EXIT:-0}" "$snippet"
      printf "%sFile access denied.%s HTTP %s\n" "$RED" "$RESET" "${FIGMA_HTTP_CODE:-000}"
      if [[ -n "$snippet" ]]; then
        echo "Reason: $snippet"
      fi
      echo "Token is valid, but this file is not accessible to this account/token."
      echo "Check file permissions in Figma and confirm the file key/URL."
      return 1
      ;;
    404)
      record_validation_failure "file" "file_not_found" "${FIGMA_HTTP_CODE:-000}" "${FIGMA_CURL_EXIT:-0}" "$snippet"
      printf "%sFile key / URL validation failed.%s HTTP %s\n" "$RED" "$RESET" "${FIGMA_HTTP_CODE:-000}"
      if [[ -n "$snippet" ]]; then
        echo "Reason: $snippet"
      fi
      echo "File key not found. Paste the full Figma file URL again."
      return 1
      ;;
    *)
      record_validation_failure "file" "file_unknown_http" "${FIGMA_HTTP_CODE:-000}" "${FIGMA_CURL_EXIT:-0}" "$snippet"
      printf "%sFile key / URL validation failed.%s HTTP %s\n" "$RED" "$RESET" "${FIGMA_HTTP_CODE:-000}"
      if [[ -n "$snippet" ]]; then
        echo "Reason: $snippet"
      fi
      echo "Check FIGMA_FILE_KEY or paste the full file URL again."
      return 1
      ;;
  esac
}

validate_figma_credentials_live() {
  local token="$1"
  local file_key="$2"

  if ! validate_figma_token_live "$token"; then
    return 1
  fi
  if ! validate_figma_file_access_live "$token" "$file_key"; then
    return 1
  fi

  printf "%sFigma credentials validated.%s\n" "$BRAND" "$RESET"
  return 0
}

save_figma_credentials() {
  local token="$1"
  local file_key="$2"
  local save_confirm=""

  echo
  printf "%sCredential review%s\n" "$WHITE" "$RESET"
  echo "FIGMA_ACCESS_TOKEN: $(mask_token "$token")"
  echo "FIGMA_FILE_KEY: $file_key"

  while true; do
    read -r -p "Type SAVE to persist these values to .env.local (or CANCEL): " save_confirm
    case "$save_confirm" in
      SAVE)
        export FIGMA_ACCESS_TOKEN="$token"
        export FIGMA_FILE_KEY="$file_key"
        upsert_env_value "FIGMA_ACCESS_TOKEN" "$token"
        upsert_env_value "FIGMA_FILE_KEY" "$file_key"
        echo "Saved FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY to .env.local."
        return 0
        ;;
      CANCEL)
        echo "Credential save canceled."
        return 1
        ;;
      *)
        printf "%sPlease type SAVE or CANCEL.%s\n" "$YELLOW" "$RESET"
        ;;
    esac
  done
}

configure_figma_credentials() {
  if [[ ! -t 0 || ! -t 1 ]]; then
    return 1
  fi

  local token_value=""
  local file_key_value=""
  local force_new_token="0"
  local retry=""
  local existing_token="${FIGMA_ACCESS_TOKEN:-}"
  local existing_file_key="${FIGMA_FILE_KEY:-}"

  echo
  printf "%sFigma credentials setup%s\n" "$WHITE" "$RESET"
  echo "Token help: $FIGMA_TOKEN_HELP_URL"
  echo "Direct security page: $FIGMA_SECURITY_SETTINGS_URL"
  echo "Values are saved to .env.local (git-ignored)."
  echo
  maybe_open_figma_token_page

  if [[ -n "$existing_token" && -n "$existing_file_key" ]]; then
    echo
    printf "%sChecking existing saved credentials first...%s\n" "$WHITE" "$RESET"
    if validate_figma_token_live "$existing_token"; then
      if validate_figma_file_access_live "$existing_token" "$existing_file_key"; then
        printf "%sExisting credentials are valid.%s\n" "$GREEN" "$RESET"
      fi
    fi
    if [[ "$FIGMA_VALIDATION_KIND" == "token_invalid" ]]; then
      force_new_token="1"
      printf "%sSaved token is invalid. You must paste a new token now.%s\n" "$YELLOW" "$RESET"
    fi
  fi

  while true; do
    while true; do
      echo
      printf "%sStep 1/2:%s Enter Figma token\n" "$WHITE" "$RESET"
      token_value="$(prompt_token_value "${FIGMA_ACCESS_TOKEN:-}" "$force_new_token")" || {
        printf "%sCredential setup canceled. Live API checks will remain skipped.%s\n" "$YELLOW" "$RESET"
        return 1
      }

      if validate_figma_token_live "$token_value"; then
        break
      fi

      if [[ "$FIGMA_VALIDATION_KIND" == "token_invalid" ]]; then
        force_new_token="1"
      fi

      read -r -p "Try entering token again? [Y/n]: " retry
      if [[ "$retry" =~ ^[Nn]$ ]]; then
        printf "%sCredential setup canceled. Live API checks will remain skipped.%s\n" "$YELLOW" "$RESET"
        return 1
      fi
    done

    while true; do
      echo
      printf "%sStep 2/2:%s Enter Figma file URL or key\n" "$WHITE" "$RESET"
      file_key_value="$(prompt_file_key_value "${FIGMA_FILE_KEY:-}")" || {
        printf "%sCredential setup canceled. Live API checks will remain skipped.%s\n" "$YELLOW" "$RESET"
        return 1
      }

      if validate_figma_file_access_live "$token_value" "$file_key_value"; then
        printf "%sFigma credentials validated.%s\n" "$BRAND" "$RESET"
        if ! save_figma_credentials "$token_value" "$file_key_value"; then
          printf "%sCredentials were not saved. Live API checks may be skipped.%s\n" "$YELLOW" "$RESET"
          return 1
        fi
        return 0
      fi

      if [[ "$FIGMA_VALIDATION_KIND" == "file_token_invalid" ]]; then
        force_new_token="1"
        printf "%sToken became invalid during file check. Re-enter token.%s\n" "$YELLOW" "$RESET"
        break
      fi

      read -r -p "Try entering file key/URL again? [Y/n]: " retry
      if [[ "$retry" =~ ^[Nn]$ ]]; then
        printf "%sCredential setup canceled. Live API checks will remain skipped.%s\n" "$YELLOW" "$RESET"
        return 1
      fi
    done
  done
}

prompt_figma_credentials_if_missing() {
  if has_figma_credentials || [[ ! -t 0 || ! -t 1 ]]; then
    return
  fi

  local answer=""
  local skip_confirm=""

  echo
  printf "%sLive Figma actions need FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY.%s\n" "$YELLOW" "$RESET"
  echo "Token help: $FIGMA_TOKEN_HELP_URL"
  echo "Security page: $FIGMA_SECURITY_SETTINGS_URL"

  while true; do
    read -r -p "Configure them now? [y/n]: " answer
    case "$answer" in
      y | Y | yes | YES)
        configure_figma_credentials
        return
        ;;
      n | N | no | NO)
        read -r -p "Type SKIP to continue without live Figma API: " skip_confirm
        if [[ "$skip_confirm" == "SKIP" ]]; then
          printf "%sContinuing without live Figma credentials.%s\n" "$YELLOW" "$RESET"
          return
        fi
        printf "%sSkip canceled. Choose again.%s\n" "$YELLOW" "$RESET"
        ;;
      *)
        printf "%sPlease answer y or n (blank does not skip).%s\n" "$YELLOW" "$RESET"
        ;;
    esac
  done
}

has_open_command() {
  command -v open >/dev/null 2>&1
}

detect_mcp_figma_status() {
  if ! command -v claude >/dev/null 2>&1; then
    echo "missing (claude CLI not found)"
    return
  fi
  if claude mcp list 2>/dev/null | grep -qi figma; then
    echo "configured"
  else
    echo "missing"
  fi
}

print_environment_status() {
  local env_status="missing"
  local creds_status="missing"
  local mcp_status=""

  if [[ -f "$ENV_LOCAL_FILE" ]]; then
    env_status="present"
  fi
  if has_figma_credentials; then
    creds_status="configured"
  fi
  mcp_status="$(detect_mcp_figma_status)"

  echo
  printf "%sEnvironment status%s\n" "$WHITE" "$RESET"
  echo "Workspace: $ROOT_DIR"
  echo ".env.local: $env_status"
  echo "Figma credentials: $creds_status"
  echo "Claude MCP figma: $mcp_status"
}

print_environment_status_compact() {
  local creds_label=""
  local mcp_label=""
  local token_label=""

  if has_figma_credentials; then
    creds_label="${GREEN}configured${RESET}"
  else
    creds_label="${YELLOW}missing${RESET}"
  fi

  if command -v claude >/dev/null 2>&1 && claude mcp list 2>/dev/null | grep -qi figma; then
    mcp_label="${GREEN}configured${RESET}"
  else
    mcp_label="${YELLOW}missing${RESET}"
  fi

  if [[ -n "${FIGMA_ACCESS_TOKEN:-}" ]]; then
    token_label="${GREEN}present${RESET}"
  else
    token_label="${YELLOW}missing${RESET}"
  fi

  echo
  printf "%sStatus%s  MCP: %b  Token: %b  File key: %b\n" \
    "$WHITE" "$RESET" "$mcp_label" "$token_label" "$creds_label"
}

print_menu_item() {
  local key="$1"
  local title="$2"
  local hint="$3"
  local badge="${4:-}"
  printf "  %s[%s]%s %s%s%s" "$BRAND" "$key" "$RESET" "$WHITE" "$title" "$RESET"
  if [[ -n "$badge" ]]; then
    printf " %s%s%s" "$GREEN" "$badge" "$RESET"
  fi
  printf "\n"
  if [[ -n "$hint" ]]; then
    printf "      %s%s%s\n" "$BRAND_SOFT" "$hint" "$RESET"
  fi
}

print_menu_reference() {
  echo
  printf "%sWhat do you want to do next?%s\n" "$WHITE" "$RESET"
  print_menu_item "1" "Send website to Figma" "Checks login, validates token + file, prepares payloads, syncs variables, then opens Claude." "(recommended)"
  print_menu_item "2" "Create a local proof report" "Builds a visual report on this computer only (no Figma write)."
  print_menu_item "3" "Advanced tools" "Strict API test, apply approved Figma edits back to code, monitor controls, detailed status."
  print_menu_item "q" "Quit installer" ""
}

confirm_default_yes() {
  local prompt="$1"
  local answer=""
  read -r -p "$prompt [Y/n]: " answer
  [[ ! "$answer" =~ ^[Nn]$ ]]
}

maybe_open_latest_proof() {
  local proof_path="$ROOT_DIR/proof/latest/index.html"
  local answer=""
  if [[ ! -f "$proof_path" ]]; then
    return
  fi
  if [[ ! -t 0 || ! -t 1 ]]; then
    return
  fi
  if ! has_open_command; then
    return
  fi

  read -r -p "Open latest proof in browser now? [Y/n]: " answer
  if [[ ! "$answer" =~ ^[Nn]$ ]]; then
    open "$proof_path" >/dev/null 2>&1 || true
  fi
}

slugify() {
  local value="$1"
  value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  printf '%s' "$value" | tr -cs 'a-z0-9' '-'
}

print_banner() {
  cat <<EOF_BANNER
${BRAND}╭───────────────────────────────────────────────────────────╮${RESET}
${BRAND}│${RESET} ${BRAND}   _____ __            ___      ________                  ${RESET}${BRAND}│${RESET}
${BRAND}│${RESET} ${BRAND}  / ___// /___  ______/ (_)___ / ____/ /___ _      __    ${RESET}${BRAND}│${RESET}
${BRAND}│${RESET} ${BRAND}  \__ \/ __/ / / / __  / / __ \/ /_  / / __ \ | /| / /   ${RESET}${BRAND}│${RESET}
${BRAND}│${RESET} ${BRAND} ___/ / /_/ /_/ / /_/ / / /_/ / __/ / / /_/ / |/ |/ /    ${RESET}${BRAND}│${RESET}
${BRAND}│${RESET} ${BRAND}/____/\__/\__,_/\__,_/_/\____/_/   /_/\____/|__/|__/     ${RESET}${BRAND}│${RESET}
${BRAND}╰───────────────────────────────────────────────────────────╯${RESET}
EOF_BANNER
}

add_step() {
  STEP_NAMES+=("$1")
  STEP_COMMANDS+=("$2")
  STEP_FIXES+=("$3")
  STEP_SEVERITIES+=("${4:-fail}")
}

animate_step() {
  local pid="$1"
  local prefix="$2"
  local label="$3"
  local spinner=( "◜" "◠" "◝" "◞" "◡" "◟" )
  local pulse=( "." ".." "..." )
  local i=0

  while kill -0 "$pid" >/dev/null 2>&1; do
    local spin="${spinner[$((i % ${#spinner[@]}))]}"
    local dots="${pulse[$((i % ${#pulse[@]}))]}"
    printf "\r%s%s%s%s %s%s%s%s%s" \
      "$CLEAR" "$BRAND" "$prefix" "$RESET" "$WHITE" "$label" "$BRAND_SOFT" "$dots" "$RESET"
    i=$((i + 1))
    sleep 0.1
  done
}

run_step() {
  local index="$1"
  local total="$2"
  local name="$3"
  local command="$4"
  local fix="$5"
  local severity="$6"

  local slug
  slug="$(slugify "$name")"
  local log_file="$LOG_DIR/${index}-${slug}.log"
  local prefix="[$index/$total][$([[ "$severity" == "warn" ]] && printf 'opt' || printf 'req')]"

  bash -lc "$command" >"$log_file" 2>&1 &
  local pid=$!

  animate_step "$pid" "$prefix" "$name"
  wait "$pid"
  local code=$?

  if [[ $code -eq 0 ]]; then
    printf "\r%s" "$CLEAR"
    return 0
  fi

  if [[ "$severity" == "warn" ]]; then
    printf "\r%s%s%s [WARN] %s%s\n" "$CLEAR" "$YELLOW" "$prefix" "$name" "$RESET"
    warn_count=$((warn_count + 1))
    ISSUE_NAMES+=("$name")
    ISSUE_STATUSES+=("warn")
    ISSUE_FIXES+=("$fix")
    return 0
  fi

  printf "\r%s%s%s [FAIL] %s%s\n" "$CLEAR" "$RED" "$prefix" "$name" "$RESET"
  fail_count=$((fail_count + 1))
  ISSUE_NAMES+=("$name")
  ISSUE_STATUSES+=("fail")
  ISSUE_FIXES+=("$fix")
  return 1
}

print_summary() {
  local total="${#STEP_NAMES[@]}"
  local completed=$((total - fail_count))

  echo
  printf "%sSetup check-in%s\n" "$WHITE" "$RESET"
  printf "%sCompleted:%s %d/%d steps\n" "$BRAND" "$RESET" "$completed" "$total"
  printf "Result: %s%d fail%s, %s%d warn%s\n" \
    "$RED" "$fail_count" "$RESET" \
    "$YELLOW" "$warn_count" "$RESET"

  if (( fail_count > 0 || warn_count > 0 )); then
    echo
    printf "%sNeeds attention%s\n" "$WHITE" "$RESET"
    local i
    for ((i = 0; i < ${#ISSUE_NAMES[@]}; i++)); do
      local status="${ISSUE_STATUSES[$i]}"
      if [[ "$status" == "fail" ]]; then
        printf "%s[FAIL]%s %s\n" "$RED" "$RESET" "${ISSUE_NAMES[$i]}"
      else
        printf "%s[WARN]%s %s\n" "$YELLOW" "$RESET" "${ISSUE_NAMES[$i]}"
      fi
      printf "  Fix: %s\n" "${ISSUE_FIXES[$i]}"
    done
    printf "Logs: %s/\n" "${LOG_DIR#$ROOT_DIR/}"
  fi

  print_environment_status_compact
  print_menu_reference
}

print_step_checklist() {
  local total="${#STEP_NAMES[@]}"
  local i
  echo
  printf "%sSetup checklist%s\n" "$WHITE" "$RESET"
  for ((i = 0; i < total; i++)); do
    local tag="required"
    if [[ "${STEP_SEVERITIES[$i]}" == "warn" ]]; then
      tag="optional"
    fi
    printf "%2d) [%s] %s\n" "$((i + 1))" "$tag" "${STEP_NAMES[$i]}"
  done
}

print_advanced_menu() {
  echo
  printf "%sAdvanced actions%s\n" "$WHITE" "$RESET"
  print_menu_item "1" "Apply approved Figma edits back to code" "loop:verify-canvas -> loop:canvas-to-code -> check/build/manifest"
  print_menu_item "2" "Start bridge monitor" "Detached MCP + deep bridge health monitor."
  print_menu_item "3" "Bridge monitor status" "Show monitor PID and last check state."
  print_menu_item "4" "Stop bridge monitor" "Stop detached monitor."
  print_menu_item "b" "Back to main menu" ""
}

interactive_advanced_menu() {
  local advanced_choice=""
  while true; do
    print_advanced_menu
    echo
    printf "%sSelect advanced option%s [1-4, b]: " "$WHITE" "$RESET"
    read -r advanced_choice || return
    case "$advanced_choice" in
      1)
        run_interactive_action "Apply approved Figma edits back to code" \
          "npm run loop:verify-canvas && npm run loop:canvas-to-code && npm run check && npm run build && npm run manifest:update"
        ;;
      2)
        run_interactive_action "Start always-on bridge monitor" \
          "npm run monitor:figma-bridge:start -- --interval $MONITOR_INTERVAL_DEFAULT --deep-every $MONITOR_DEEP_EVERY_DEFAULT"
        ;;
      3)
        run_interactive_action "Bridge monitor status" "npm run monitor:figma-bridge:status"
        ;;
      4)
        run_interactive_action "Stop bridge monitor" "npm run monitor:figma-bridge:stop"
        ;;
      b | B)
        return
        ;;
      *)
        printf "%sPlease choose 1, 2, 3, 4, or b.%s\n" "$YELLOW" "$RESET"
        ;;
    esac
  done
}

run_interactive_action() {
  local title="$1"
  local command="$2"

  echo
  printf "%s%s%s\n" "$WHITE" "$title" "$RESET"
  echo "Command: $command"
  if bash -lc "$command"; then
    printf "%sOK%s\n" "$BRAND" "$RESET"
    return 0
  fi
  printf "%sFAIL%s\n" "$RED" "$RESET"
  return 1
}

start_bridge_monitor() {
  npm run monitor:figma-bridge:start -- --interval "$MONITOR_INTERVAL_DEFAULT" --deep-every "$MONITOR_DEEP_EVERY_DEFAULT"
}

maybe_spawn_bridge_monitor_from_installer() {
  local setting="${STUDIOFLOW_SPAWN_BRIDGE_MONITOR:-ask}"
  local answer=""

  case "$setting" in
    1 | true | TRUE | yes | YES | y | Y)
      echo
      printf "%sStarting always-on bridge monitor from installer...%s\n" "$WHITE" "$RESET"
      start_bridge_monitor || printf "%sMonitor start failed. You can retry with npm run monitor:figma-bridge:start%s\n" "$YELLOW" "$RESET"
      return
      ;;
    0 | false | FALSE | no | NO | n | N)
      return
      ;;
  esac

  if [[ ! -t 0 || ! -t 1 ]]; then
    return
  fi

  echo
  read -r -p "Start always-on bridge monitor now? [Y/n]: " answer
  if [[ "$answer" =~ ^[Nn]$ ]]; then
    return
  fi

  start_bridge_monitor || printf "%sMonitor start failed. You can retry with npm run monitor:figma-bridge:start%s\n" "$YELLOW" "$RESET"
}

interactive_launch_menu() {
  if [[ ! -t 0 || ! -t 1 ]]; then
    return
  fi

  prompt_figma_credentials_if_missing
  print_environment_status_compact
  print_menu_reference

  while true; do
    echo
    printf "%sSelect option%s [1-3, q]: " "$WHITE" "$RESET"
    read -r choice || return

    case "$choice" in
      1)
        if ! confirm_default_yes "Run 'Send website to Figma' now?"; then
          continue
        fi
        if ! has_figma_credentials; then
          configure_figma_credentials || continue
        fi
        run_interactive_action "Bridge + API gate test" "npm run check:figma-bridge" || continue
        run_interactive_action "Demo website -> Figma prep" "npm run demo:figma:prep" || continue
        if ! has_figma_credentials; then
          printf "%sCredentials are still missing. Open option 3 -> Status details to inspect.%s\n" "$YELLOW" "$RESET"
          continue
        fi
        if ! run_interactive_action "Sync variables to Figma" "npm run figma:variables:sync"; then
          printf "%sVariable sync skipped/failed (likely missing file_variables scopes). Continuing with code->design flow.%s\n" "$YELLOW" "$RESET"
        fi
        read -r -p "Open Claude now for /mcp and push prompt? [Y/n]: " open_claude
        if [[ ! "$open_claude" =~ ^[Nn]$ ]]; then
          claude
        fi
        ;;
      2)
        run_interactive_action "Create local proof report (no Figma write)" "npm run demo:website:capture"
        maybe_open_latest_proof
        ;;
      3)
        interactive_advanced_menu
        ;;
      q | Q)
        return
        ;;
      *)
        printf "%sPlease choose 1, 2, 3, or q.%s\n" "$YELLOW" "$RESET"
        ;;
    esac
  done
}

print_banner
echo
printf "%sLogs: %s%s%s\n\n" "$BRAND_SOFT" "${LOG_DIR#$ROOT_DIR/}" " (full transcript for troubleshooting)" "$RESET"
load_local_env_file

add_step "Loading project dependencies" "npm install" "npm install" "fail"
add_step "Ensuring Claude CLI is ready" "command -v claude >/dev/null 2>&1 || npm install -g @anthropic-ai/claude-code" "npm install -g @anthropic-ai/claude-code" "warn"
add_step "Refreshing Claude project files" "npm run setup:claude" "npm run setup:claude" "fail"
add_step "Wiring Claude + Figma bridge" "claude mcp list | grep -qi figma || claude mcp add --transport http figma https://mcp.figma.com/mcp --scope user" "claude mcp add --transport http figma https://mcp.figma.com/mcp --scope user && claude mcp list" "warn"
add_step "Checking Figma Code Connect package" "npm ls @figma/code-connect --depth=0 >/dev/null 2>&1 || npm install" "npm install" "warn"
add_step "Checking Figma Code Connect CLI" "npx figma connect --help" "npx figma connect --help" "warn"
add_step "Installing screenshot engine" "npx playwright install chromium" "npx playwright install chromium" "warn"
add_step "Syncing token artifacts" "npm run build:tokens" "npm run build:tokens" "fail"
add_step "Running contract fixtures" "npm run test:contracts" "npm run test:contracts" "fail"
add_step "Running quality gates" "npm run check" "npm run check" "fail"
add_step "Generating canvas handoff" "npm run loop:code-to-canvas" "npm run loop:code-to-canvas" "fail"
add_step "Validating MCP health" "npm run check:mcp" "claude mcp add --transport http figma https://mcp.figma.com/mcp --scope user && claude mcp list" "warn"
add_step "Running deep bridge healthcheck" "npm run check:figma-bridge" "FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=... npm run check:figma-bridge" "warn"

TOTAL_STEPS="${#STEP_NAMES[@]}"
if [[ "${STUDIOFLOW_SETUP_SHOW_CHECKLIST:-0}" == "1" ]]; then
  print_step_checklist
else
  printf "%sRunning %d setup checks%s (set STUDIOFLOW_SETUP_SHOW_CHECKLIST=1 for full list)\n" \
    "$BRAND_SOFT" "$TOTAL_STEPS" "$RESET"
fi

for ((i = 0; i < TOTAL_STEPS; i++)); do
  STEP_STATUSES+=("pending")
  run_step \
    "$((i + 1))" \
    "$TOTAL_STEPS" \
    "${STEP_NAMES[$i]}" \
    "${STEP_COMMANDS[$i]}" \
    "${STEP_FIXES[$i]}" \
    "${STEP_SEVERITIES[$i]}"

  if [[ $? -eq 0 ]]; then
    STEP_STATUSES[$i]="ok"
  else
    STEP_STATUSES[$i]="fail"
  fi
done

print_summary

if (( fail_count > 0 )); then
  printf "%sSetup failed required gates. Interactive launcher is disabled until setup passes.%s\n" "$RED" "$RESET"
  exit 1
fi

# Only auto-start monitor when explicitly requested by env var.
if [[ "${STUDIOFLOW_SPAWN_BRIDGE_MONITOR:-0}" == "1" ]]; then
  maybe_spawn_bridge_monitor_from_installer
fi
interactive_launch_menu

exit 0
