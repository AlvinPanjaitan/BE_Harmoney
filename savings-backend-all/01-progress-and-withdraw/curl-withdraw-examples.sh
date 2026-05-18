#!/usr/bin/env bash
# =============================================================================
# curl examples — POST /api/savings/:id/withdraw
# =============================================================================
# Tip: generate a test JWT with:
#   node -e "
#     const jwt = require('jsonwebtoken');
#     console.log(jwt.sign(
#       { sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', email: 'alice@example.com' },
#       'your-JWT_SECRET',
#       { expiresIn: '1h' }
#     ));
#   "
# =============================================================================

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.\
eyJzdWIiOiJhMWIyYzNkNC1lNWY2LTc4OTAtYWJjZC1lZjEyMzQ1Njc4OTAiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwiaWF0IjoxNzQ3Mzg1NjAwfQ.\
REPLACE_WITH_REAL_SIGNATURE"

GOAL_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
BASE="http://localhost:3000/api"

# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  1. Happy path — full body"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 200,
    "note": "Emergency repair",
    "date": "2026-05-16T12:00:00Z"
  }' | jq
# Expected HTTP 201:
# {
#   "id": "f7e6d5c4-b3a2-4190-8fed-cba987654321",
#   "savingsId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#   "type": "WITHDRAWAL",
#   "amount": 200,
#   "date": "2026-05-16T12:00:00.000Z",
#   "note": "Emergency repair",
#   "newTotalSaved": 800
# }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  2. Happy path — amount only (note + date omitted)"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}' | jq
# note will be null; date will be the server's current timestamp

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  3. Happy path — decimal amount"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 49.99, "note": "Subscription cancel refund"}' | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  4. Exact full-balance withdrawal (savedAmount → 0)"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "note": "Full withdrawal"}' | jq
# newTotalSaved: 0

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  5. Amount exceeds balance → 400 Insufficient funds"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 999999}' | jq
# {
#   "statusCode": 400,
#   "message": "Insufficient funds: cannot withdraw 999999 from a balance of 1000."
# }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  6. Missing amount → 400 Validation"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note": "No amount"}' | jq
# { "message": ["amount is required", "amount must be a number..."] }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  7. Amount = 0 → 400"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 0}' | jq
# { "message": ["amount must be greater than 0"] }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  8. Negative amount → 400"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": -100}' | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  9. More than 2 decimal places → 400"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10.999}' | jq
# { "message": ["amount must be a number with at most 2 decimal places"] }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌ 10. Invalid ISO date → 400"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "date": "16/05/2026"}' | jq
# { "message": ["date must be a valid ISO 8601 date-time string"] }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌ 11. note over 500 chars → 400"
echo "══════════════════════════════════════════════════════════"
LONG=$(python3 -c "print('x' * 501)")
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\": 100, \"note\": \"$LONG\"}" | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌ 12. Unknown property in body → 400 (forbidNonWhitelisted)"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "hack": "injected"}' | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌ 13. No JWT token → 401"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}' | jq
# { "statusCode": 401, "message": "Access denied — valid JWT Bearer token required" }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌ 14. Valid token, wrong owner → 403"
echo "══════════════════════════════════════════════════════════"
OTHER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.OTHER_PAYLOAD.SIG"
curl -s -X POST "$BASE/savings/$GOAL_ID/withdraw" \
  -H "Authorization: Bearer $OTHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}' | jq
# { "statusCode": 403, "message": "You do not have permission to modify this savings goal." }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌ 15. Goal not found → 404"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/00000000-0000-0000-0000-000000000000/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}' | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌ 16. Malformed UUID in path → 400 (ParseUUIDPipe)"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/not-a-valid-uuid/withdraw" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}' | jq
# { "statusCode": 400, "message": "Validation failed (uuid is expected)" }
