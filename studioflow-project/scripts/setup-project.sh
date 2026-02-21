#!/usr/bin/env bash
set -u -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
ENV_LOCAL_FILE="$ROOT_DIR/.env.local"
FIGMA_TOKEN_HELP_URL="https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens"
FIGMA_SECURITY_SETTINGS_URL="https://www.figma.com/settings?tab=security"
MONITOR_INTERVAL_DEFAULT="${STUDIOFLOW_MONITOR_INTERVAL:-60}"
MONITOR_DEEP_EVERY_DEFAULT="${STUDIOFLOW_MONITOR_DEEP_EVERY:-5}"

RUN_ID="$(date +"%Y%m%d-%H%M%S")"
LOG_DIR="$ROOT_DIR/.setup-logs/$RUN_ID"
mkdir -p "$LOG_DIR"

if [[ -t 1 ]]; then
  BRAND=$'\033[38;2;153;186;200m'
  BRAND_SOFT=$'\033[38;2;122;146;158m'
  WHITE=$'\033[97m'
  YELLOW=$'\033[93m'
  RED=$'\033[91m'
  RESET=$'\033[0m'
  CLEAR=$'\033[2K'
else
  BRAND=""
  BRAND_SOFT=""
  WHITE=""
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
  printf '%s' "$trimmed"
}

maybe_open_figma_token_page() {
  if [[ ! -t 0 || ! -t 1 ]]; then
    return
  fi
  if ! command -v open >/dev/null 2>&1; then
    return
  fi
  read -r -p "Open token page in browser now? [Y/n]: " open_now
  if [[ ! "$open_now" =~ ^[Nn]$ ]]; then
    open "$FIGMA_SECURITY_SETTINGS_URL" >/dev/null 2>&1 || true
  fi
}

prompt_token_value() {
  local existing="$1"
  local token_input=""
  local keep_hint=""

  if [[ -n "$existing" ]]; then
    keep_hint=" (press Enter to keep current)"
    printf "Current FIGMA_ACCESS_TOKEN: %s\n" "$(mask_token "$existing")"
  fi

  while true; do
    read -r -s -p "FIGMA_ACCESS_TOKEN$keep_hint: " token_input
    echo

    if [[ -z "$token_input" ]]; then
      if [[ -n "$existing" ]]; then
        printf '%s' "$existing"
        return 0
      fi
      printf "%sToken is required for live Figma API. Paste token or type SKIP to cancel setup.%s\n" "$YELLOW" "$RESET"
      read -r -p "Type value or SKIP: " token_input
    fi

    if [[ "$token_input" == "SKIP" ]]; then
      return 1
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
    if [[ -z "$file_input" ]]; then
      if [[ -n "$existing" ]]; then
        printf '%s' "$existing"
        return 0
      fi
      printf "%sFile key is required for live Figma API. Paste key/URL or type SKIP to cancel setup.%s\n" "$YELLOW" "$RESET"
      read -r -p "Type value or SKIP: " file_input
    fi

    if [[ "$file_input" == "SKIP" ]]; then
      return 1
    fi

    normalized="$(normalize_figma_file_key "$file_input")"
    if [[ -n "$normalized" ]]; then
      printf '%s' "$normalized"
      return 0
    fi
  done
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

  echo
  printf "%sFigma credentials setup%s\n" "$WHITE" "$RESET"
  echo "Token help: $FIGMA_TOKEN_HELP_URL"
  echo "Direct security page: $FIGMA_SECURITY_SETTINGS_URL"
  echo "Values are saved to .env.local (git-ignored)."
  echo
  maybe_open_figma_token_page

  token_value="$(prompt_token_value "${FIGMA_ACCESS_TOKEN:-}")" || {
    printf "%sCredential setup canceled. Live API checks will remain skipped.%s\n" "$YELLOW" "$RESET"
    return 1
  }
  file_key_value="$(prompt_file_key_value "${FIGMA_FILE_KEY:-}")" || {
    printf "%sCredential setup canceled. Live API checks will remain skipped.%s\n" "$YELLOW" "$RESET"
    return 1
  }

  if ! save_figma_credentials "$token_value" "$file_key_value"; then
    printf "%sCredentials were not saved. Live API checks may be skipped.%s\n" "$YELLOW" "$RESET"
    return 1
  fi

  return 0
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

  echo
  printf "%sLaunch Menu (6 options)%s\n" "$WHITE" "$RESET"
  echo "Type one number in the interactive launcher below."
  echo "1) Demo website -> Figma now (recommended)"
  echo "   Generates payloads, runs bridge checks, syncs variables (if creds exist), then offers to open Claude."
  echo
  echo "2) Local proof only (no live Figma needed)"
  echo "   Runs demo capture and generates proof/latest/index.html."
  echo
  echo "3) Strict bridge + API gate test"
  echo "   Requires credentials and runs strict MCP + API checks."
  echo
  echo "4) Apply approved Figma edits back to code"
  echo "   Verifies handoff, applies canvas edits, then runs check/build/manifest update."
  echo
  echo "5) Full loop with proof artifact"
  echo "   Runs end-to-end loop and regenerates proof."
  echo
  echo "6) Start always-on bridge monitor"
  echo "   Starts detached monitor for MCP + deep bridge checks."
  echo
  echo "Monitor commands:"
  echo "  npm run monitor:figma-bridge:start"
  echo "  npm run monitor:figma-bridge:status"
  echo "  npm run monitor:figma-bridge:stop"
  echo
  echo "Full plan and Claude playbook setup:"
  echo "  docs/ON_YOUR_MARKS_SET_GO.md"
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

  while true; do
    echo
    printf "%sChoose next action%s [1-6, c=configure Figma creds, q=quit]: " "$WHITE" "$RESET"
    read -r choice || return

    case "$choice" in
      1)
        run_interactive_action "Demo website -> Figma prep" "npm run demo:figma:prep" || continue
        if has_figma_credentials; then
          run_interactive_action "Sync variables to Figma" "npm run figma:variables:sync" || continue
        else
          printf "%sSkipping variable sync (FIGMA_ACCESS_TOKEN / FIGMA_FILE_KEY missing).%s\n" "$YELLOW" "$RESET"
        fi
        read -r -p "Open Claude now for /mcp and push prompt? [Y/n]: " open_claude
        if [[ ! "$open_claude" =~ ^[Nn]$ ]]; then
          claude
        fi
        ;;
      2)
        run_interactive_action "Local proof capture" "npm run demo:website:capture"
        ;;
      3)
        prompt_figma_credentials_if_missing
        if ! has_figma_credentials; then
          printf "%sCannot run strict gate without FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY.%s\n" "$YELLOW" "$RESET"
          continue
        fi
        run_interactive_action "Strict bridge + API gate test" "STUDIOFLOW_STRICT_FIGMA_BRIDGE=1 npm run check:figma-bridge"
        ;;
      4)
        run_interactive_action "Apply approved Figma edits back to code" \
          "npm run loop:verify-canvas && npm run loop:canvas-to-code && npm run check && npm run build && npm run manifest:update"
        ;;
      5)
        run_interactive_action "Full loop with proof artifact" "npm run loop:run && npm run loop:proof"
        ;;
      6)
        run_interactive_action "Start always-on bridge monitor" \
          "npm run monitor:figma-bridge:start -- --interval $MONITOR_INTERVAL_DEFAULT --deep-every $MONITOR_DEEP_EVERY_DEFAULT"
        ;;
      c | C)
        configure_figma_credentials
        ;;
      q | Q)
        return
        ;;
      *)
        printf "%sPlease choose 1, 2, 3, 4, 5, 6, c, or q.%s\n" "$YELLOW" "$RESET"
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
add_step "Running deep bridge healthcheck" 'if [[ -n "${FIGMA_ACCESS_TOKEN:-}" && -n "${FIGMA_FILE_KEY:-}" ]]; then STUDIOFLOW_STRICT_FIGMA_BRIDGE=1 npm run check:figma-bridge; else npm run check:figma-bridge; fi' "FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=... STUDIOFLOW_STRICT_FIGMA_BRIDGE=1 npm run check:figma-bridge" "fail"

TOTAL_STEPS="${#STEP_NAMES[@]}"

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

maybe_spawn_bridge_monitor_from_installer
interactive_launch_menu

exit 0
