#!/usr/bin/env bash
set -u -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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
  printf "%sNext actions%s\n" "$WHITE" "$RESET"
  echo "1) Run: claude    then inside Claude: /mcp"
  echo "2) Run: npm run demo:website:capture"
}

print_banner
echo
printf "%sLogs: %s%s%s\n\n" "$BRAND_SOFT" "${LOG_DIR#$ROOT_DIR/}" " (full transcript for troubleshooting)" "$RESET"

add_step "Loading project dependencies" "npm install" "npm install" "fail"
add_step "Ensuring Claude CLI is ready" "command -v claude >/dev/null 2>&1 || npm install -g @anthropic-ai/claude-code" "npm install -g @anthropic-ai/claude-code" "warn"
add_step "Refreshing Claude project files" "npm run setup:claude" "npm run setup:claude" "fail"
add_step "Wiring Claude + Figma bridge" "claude mcp list | grep -qi figma || claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp" "claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp && claude mcp list" "warn"
add_step "Checking Figma Code Connect package" "npm ls @figma/code-connect --depth=0 >/dev/null 2>&1 || npm install" "npm install" "warn"
add_step "Checking Figma Code Connect CLI" "npx figma connect --help" "npx figma connect --help" "warn"
add_step "Installing screenshot engine" "npx playwright install chromium" "npx playwright install chromium" "warn"
add_step "Syncing token artifacts" "npm run build:tokens" "npm run build:tokens" "fail"
add_step "Running contract fixtures" "npm run test:contracts" "npm run test:contracts" "fail"
add_step "Running quality gates" "npm run check" "npm run check" "fail"
add_step "Generating canvas handoff" "npm run loop:code-to-canvas" "npm run loop:code-to-canvas" "fail"
add_step "Validating MCP health" "npm run check:mcp" "claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp && claude mcp list" "warn"

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
  exit 1
fi

exit 0
