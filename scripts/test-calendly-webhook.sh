#!/usr/bin/env bash
#
# Test suite for the Calendly webhook endpoint.
# Usage:
#   ./scripts/test-calendly-webhook.sh [BASE_URL]
#
# Defaults to http://localhost:3000.
# Set CALENDLY_WEBHOOK_SIGNING_KEY in your environment (or .env.local).
#

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
ENDPOINT="${BASE_URL}/api/webhooks/calendly"
SIGNING_KEY="${CALENDLY_WEBHOOK_SIGNING_KEY:-test_secret_123}"
PASS=0
FAIL=0
TEST_EMAIL="calendly-test-$(date +%s)@example.com"

# ──────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────

green() { printf "\033[32m%s\033[0m\n" "$1" >&2; }
red()   { printf "\033[31m%s\033[0m\n" "$1" >&2; }
bold()  { printf "\033[1m%s\033[0m\n" "$1" >&2; }

# Send a signed request. Status messages go to stderr, response body to stdout.
sign_and_send() {
  local body="$1"
  local expected_status="$2"
  local label="$3"
  local extra_args="${4:-}"

  local timestamp
  timestamp=$(date +%s)
  local signature
  signature=$(printf '%s' "${timestamp}.${body}" | openssl dgst -sha256 -hmac "$SIGNING_KEY" | awk '{print $NF}')
  local sig_header="t=${timestamp},v1=${signature}"

  if [[ "$extra_args" == "bad_sig" ]]; then
    sig_header="t=${timestamp},v1=0000000000000000000000000000000000000000000000000000000000000000"
  fi

  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "Calendly-Webhook-Signature: ${sig_header}" \
    -d "$body")

  local http_code
  http_code=$(echo "$response" | tail -1)
  local resp_body
  resp_body=$(echo "$response" | sed '$d')

  if [[ "$http_code" == "$expected_status" ]]; then
    green "  PASS: ${label} (HTTP ${http_code})"
    PASS=$((PASS + 1))
  else
    red "  FAIL: ${label} — expected ${expected_status}, got ${http_code}"
    red "        Response: ${resp_body}"
    FAIL=$((FAIL + 1))
  fi

  # Response body to stdout only (for capture)
  echo "$resp_body"
}

# ──────────────────────────────────────────
# Tests
# ──────────────────────────────────────────

bold ""
bold "=== Calendly Webhook Test Suite ==="
bold "Endpoint: ${ENDPOINT}"
bold "Test email: ${TEST_EMAIL}"
bold ""

# ── Test 1: Invalid signature → 401 ──────
bold "Test 1: Invalid signature"
BODY='{"event":"invitee.created","payload":{"email":"bad@example.com","name":"Bad Actor","scheduled_event":{"start_time":"2026-03-10T10:00:00Z"},"questions_and_answers":[]}}'
sign_and_send "$BODY" "401" "Reject bad signature" "bad_sig" > /dev/null

# ── Test 2: Non-invitee.created event → 200 (ignored) ──
bold "Test 2: Ignored event type (invitee.canceled)"
BODY='{"event":"invitee.canceled","payload":{"email":"cancel@example.com"}}'
result=$(sign_and_send "$BODY" "200" "Acknowledge non-invitee.created event")
if echo "$result" | grep -q '"ok":true'; then
  green "  PASS: Response contains {ok: true}"
  PASS=$((PASS + 1))
else
  red "  FAIL: Expected {ok: true} in response"
  FAIL=$((FAIL + 1))
fi

# ── Test 3: Missing email → 400 ──────────
bold "Test 3: Missing email"
BODY='{"event":"invitee.created","payload":{"name":"No Email","scheduled_event":{"start_time":"2026-03-10T10:00:00Z"},"questions_and_answers":[]}}'
sign_and_send "$BODY" "400" "Reject missing email" > /dev/null

# ── Test 4: Full booking (new contact) ────
bold "Test 4: Full booking — new contact with all form fields"
BODY=$(cat <<EOF
{
  "event": "invitee.created",
  "payload": {
    "email": "${TEST_EMAIL}",
    "name": "Calendly Testuser",
    "text_reminder_number": "+919876543210",
    "scheduled_event": {
      "start_time": "2026-03-10T10:00:00Z"
    },
    "questions_and_answers": [
      {"question": "What is your total work experience?", "answer": "3-5 years"},
      {"question": "What is your current role?", "answer": "UI Designer"},
      {"question": "What are the key challenges you face?", "answer": "No mentorship or guidance"},
      {"question": "What is the desired salary you want to achieve?", "answer": "25 LPA"},
      {"question": "If you're being 100% honest with yourself, what's stopping you from landing your dream job?", "answer": "Lack of confidence and portfolio"},
      {"question": "Which of these best describes your current financial situation for investing in your career growth?", "answer": "I'm ready to invest in myself — I have the financial resources to take action now"},
      {"question": "How soon are you ready to start working on improving your career challenges?", "answer": "Right now — let's get started!"},
      {"question": "Please share your LinkedIn profile URL", "answer": "https://linkedin.com/in/calendly-test"}
    ]
  }
}
EOF
)
result=$(sign_and_send "$BODY" "200" "Create new contact with booking")
CONTACT_ID=$(echo "$result" | grep -o '"contact_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$CONTACT_ID" ]]; then
  green "  PASS: Got contact_id = ${CONTACT_ID}"
  PASS=$((PASS + 1))
else
  red "  FAIL: No contact_id in response"
  FAIL=$((FAIL + 1))
fi

# ── Test 5: Duplicate booking (existing contact) ──
bold "Test 5: Duplicate booking — same email, should reuse contact"
result=$(sign_and_send "$BODY" "200" "Reuse existing contact")
CONTACT_ID_2=$(echo "$result" | grep -o '"contact_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ "$CONTACT_ID" == "$CONTACT_ID_2" ]]; then
  green "  PASS: Same contact_id returned (deduplication works)"
  PASS=$((PASS + 1))
else
  red "  FAIL: Different contact_id (${CONTACT_ID} vs ${CONTACT_ID_2})"
  FAIL=$((FAIL + 1))
fi

# ── Test 6: Booking with minimal data (no form answers) ──
bold "Test 6: Minimal booking — no form answers"
MINIMAL_EMAIL="calendly-minimal-$(date +%s)@example.com"
BODY=$(cat <<EOF
{
  "event": "invitee.created",
  "payload": {
    "email": "${MINIMAL_EMAIL}",
    "name": "Minimal User",
    "scheduled_event": {
      "start_time": "2026-03-12T14:00:00Z"
    },
    "questions_and_answers": []
  }
}
EOF
)
result=$(sign_and_send "$BODY" "200" "Create contact with no form answers")
if echo "$result" | grep -q '"success":true'; then
  green "  PASS: Succeeded with empty form answers"
  PASS=$((PASS + 1))
else
  red "  FAIL: Expected success with empty form answers"
  FAIL=$((FAIL + 1))
fi

# ── Test 7: Smart quotes in questions ─────
bold "Test 7: Smart quotes in question text"
SMART_EMAIL="calendly-smart-$(date +%s)@example.com"
BODY=$(cat <<EOF
{
  "event": "invitee.created",
  "payload": {
    "email": "${SMART_EMAIL}",
    "name": "Smart Quotes",
    "scheduled_event": {
      "start_time": "2026-03-15T09:00:00Z"
    },
    "questions_and_answers": [
      {"question": "If you\u2019re being 100% honest with yourself, what\u2019s stopping you?", "answer": "Imposter syndrome"},
      {"question": "I\u2019m managing my finances carefully but can prioritize funding", "answer": "I\u2019m managing my finances carefully but can prioritize funding my growth"}
    ]
  }
}
EOF
)
result=$(sign_and_send "$BODY" "200" "Handle smart quotes in questions")
if echo "$result" | grep -q '"success":true'; then
  green "  PASS: Smart quotes handled correctly"
  PASS=$((PASS + 1))
else
  red "  FAIL: Smart quotes caused an error"
  FAIL=$((FAIL + 1))
fi

# ──────────────────────────────────────────
# Summary
# ──────────────────────────────────────────

bold ""
bold "=== Results ==="
green "Passed: ${PASS}"
if [[ $FAIL -gt 0 ]]; then
  red "Failed: ${FAIL}"
else
  bold "Failed: 0"
fi
bold ""

if [[ $FAIL -gt 0 ]]; then
  bold "Cleanup: delete test contacts manually by searching for '${TEST_EMAIL}' in Supabase"
  exit 1
else
  bold "All tests passed! Clean up test contacts in Supabase by searching for emails containing 'calendly-test-' or 'calendly-minimal-' or 'calendly-smart-'"
fi
