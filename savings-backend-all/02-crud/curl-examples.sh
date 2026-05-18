#!/usr/bin/env bash
# =============================================================================
# curl examples — Savings CRUD API
# =============================================================================
# Generate a test JWT:
#   node -e "
#     const jwt = require('jsonwebtoken');
#     console.log(jwt.sign(
#       { sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', email: 'alice@example.com' },
#       'your-JWT_SECRET',
#       { expiresIn: '1h' }
#     ));
#   "
# =============================================================================

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.PAYLOAD.SIGNATURE"
BASE="http://localhost:3000/api"
GOAL_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# ─── CREATE ──────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  POST /api/savings — Create a new goal"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Car Fund",
    "targetAmount": 5000,
    "deadline": "2026-12-31",
    "note": "New car for the family"
  }' | jq
# Expected HTTP 201:
# {
#   "id": "<uuid>",
#   "userId": "a1b2c3d4-...",
#   "name": "Car Fund",
#   "targetAmount": 5000,
#   "currentSaved": 0,
#   "deadline": "2026-12-31T00:00:00.000Z",
#   "note": "New car for the family",
#   "status": "active",
#   "createdAt": "...",
#   "updatedAt": "..."
# }

# ─── READ ────────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  GET /api/savings — List all (no filters)"
echo "══════════════════════════════════════════════════════════"
curl -s "$BASE/savings" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  GET /api/savings?status=active — Filter by status"
echo "══════════════════════════════════════════════════════════"
curl -s "$BASE/savings?status=active" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  GET /api/savings?status=completed&sort=deadline"
echo "══════════════════════════════════════════════════════════"
curl -s "$BASE/savings?status=completed&sort=deadline" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  GET /api/savings/:id — Get one by id"
echo "══════════════════════════════════════════════════════════"
curl -s "$BASE/savings/$GOAL_ID" \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── UPDATE ──────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  PATCH /api/savings/:id — Mark as completed"
echo "══════════════════════════════════════════════════════════"
curl -s -X PATCH "$BASE/savings/$GOAL_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}' | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  PATCH /api/savings/:id — Rename + adjust target"
echo "══════════════════════════════════════════════════════════"
curl -s -X PATCH "$BASE/savings/$GOAL_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Family Car Fund",
    "targetAmount": 7500
  }' | jq

# ─── DELETE ──────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ✅  DELETE /api/savings/:id"
echo "══════════════════════════════════════════════════════════"
curl -s -X DELETE "$BASE/savings/$GOAL_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
# { "message": "Savings goal deleted successfully" }

# ─── ERROR SCENARIOS ─────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  Missing required field on POST → 400"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetAmount": 1000}' | jq
# { "message": ["name is required", "name must be a string"] }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  Negative targetAmount → 400"
echo "══════════════════════════════════════════════════════════"
curl -s -X POST "$BASE/savings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "targetAmount": -100}' | jq
# { "message": ["targetAmount must be greater than 0"] }

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  name > 100 chars → 400"
echo "══════════════════════════════════════════════════════════"
LONG=$(python3 -c "print('x' * 101)")
curl -s -X POST "$BASE/savings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$LONG\", \"targetAmount\": 100}" | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  Invalid status on PATCH → 400"
echo "══════════════════════════════════════════════════════════"
curl -s -X PATCH "$BASE/savings/$GOAL_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "archived"}' | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  Invalid ?status= query param → 400"
echo "══════════════════════════════════════════════════════════"
curl -s "$BASE/savings?status=pending" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  No JWT → 401"
echo "══════════════════════════════════════════════════════════"
curl -s "$BASE/savings" | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  Another user's goal → 403"
echo "══════════════════════════════════════════════════════════"
OTHER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.OTHER_USER.SIG"
curl -s "$BASE/savings/$GOAL_ID" \
  -H "Authorization: Bearer $OTHER_TOKEN" | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  Non-existent id → 404"
echo "══════════════════════════════════════════════════════════"
curl -s "$BASE/savings/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "══════════════════════════════════════════════════════════"
echo " ❌  Malformed UUID → 400 (ParseUUIDPipe)"
echo "══════════════════════════════════════════════════════════"
curl -s "$BASE/savings/not-a-uuid" \
  -H "Authorization: Bearer $TOKEN" | jq
