#!/usr/bin/env bash
# =============================================================================
# curl examples — POST /api/savings/:id/add
# =============================================================================
# Replace TOKEN with a real JWT signed with your JWT_SECRET.
# The payload must contain { "sub": "<user-uuid>", "email": "..." }.
#
# Tip: generate a test token with:
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

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  1. Happy path — full body"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "note": "Monthly deposit",
    "date": "2026-05-16T10:00:00Z"
  }' | jq
# Expected HTTP 201:
# {
#   "id": "d3f1a2b4-8e9c-4a1b-b2c3-1234567890ab",
#   "savingsId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#   "amount": 500,
#   "date": "2026-05-16T10:00:00.000Z",
#   "note": "Monthly deposit",
#   "newTotalSaved": 1500
# }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  2. Happy path — amount only (note + date omitted)"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 250}' | jq
# note will be null; date will be server's current timestamp

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  3. Happy path — decimal amount"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 99.99, "note": "Rounded deposit"}' | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  4. Missing amount → 400"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note": "No amount provided"}' | jq
# {
#   "statusCode": 400,
#   "message": ["amount is required", "amount must be a number..."],
#   "error": "Bad Request"
# }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  5. Amount = 0 → 400"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 0}' | jq
# { "message": ["amount must be greater than 0"] }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  6. Negative amount → 400"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": -100}' | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  7. Invalid ISO date → 400"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "date": "16-05-2026"}' | jq
# { "message": ["date must be a valid ISO 8601 date-time string"] }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  8. note over 500 chars → 400"
echo "══════════════════════════════════════════════════════════"
LONG_NOTE=$(python3 -c "print('x' * 501)")
curl -s -X POST "$BASE/savings/$GOAL_ID/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\": 100, \"note\": \"$LONG_NOTE\"}" | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  9. Unknown property in body → 400 (forbidNonWhitelisted)"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "hackField": "injected"}' | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌ 10. No JWT token → 401"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/$GOAL_ID/add" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}' | jq
# { "statusCode": 401, "message": "Access denied — valid JWT Bearer token required" }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌ 11. Valid token but wrong owner → 403"
echo "══════════════════════════════════════════════════════════"
OTHER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.OTHER_USER_PAYLOAD.SIGNATURE"
curl -s -X POST "$BASE/savings/$GOAL_ID/add" \
  -H "Authorization: Bearer $OTHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}' | jq
# { "statusCode": 403, "message": "You do not have permission to modify this savings goal." }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌ 12. Goal not found → 404"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/00000000-0000-0000-0000-000000000000/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}' | jq
# { "statusCode": 404, "message": "Savings goal '00000000-...' not found." }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌ 13. Malformed UUID in path → 400 (ParseUUIDPipe)"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings/not-a-uuid/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}' | jq
# { "statusCode": 400, "message": "Validation failed (uuid is expected)" }
