# Savings Module — addFunds & calculateProgress

NestJS module implementing the `Savings` entity with two required business methods:

- **`addFunds(savingId, amount, fromWalletId, userId)`** — atomic wallet → savings transfer
- **`calculateProgress(savingId)`** — returns `currentAmount / targetAmount` as a decimal

Plus basic CRUD (`create`, `findOne`) and HTTP routes for all of the above.

---

## Project Structure

```
src/
├── savings/
│   ├── entities/
│   │   └── savings.entity.ts        ← integer PK, walletId FK, double-precision amounts
│   ├── dto/
│   │   ├── create-savings.dto.ts
│   │   └── add-funds.dto.ts
│   ├── savings.service.ts           ← addFunds + calculateProgress + helpers
│   ├── savings.controller.ts        ← POST /, GET /:id, POST /:id/add-funds, GET /:id/progress
│   ├── savings.module.ts
│   └── test/
│       ├── savings.service.spec.ts  ← 38 tests covering every branch
│       └── savings.controller.spec.ts
└── wallet/
    ├── entities/wallet.entity.ts    ← STUB — replace with the real Wallet
    ├── wallet.service.ts            ← STUB — exposes debitInTransaction()
    └── wallet.module.ts
```

---

## Stated Assumptions

Per the spec, several things are assumed rather than implemented:

1. **The Wallet module is owned by another team.** The `wallet/` folder here is a
   minimal stub providing only what `SavingsService` consumes: a `Wallet` entity
   with `{ walletId, userId, balance }` and a `WalletService` exposing
   `findOne()` and `debitInTransaction()`. Delete this folder and re-point the
   imports when integrating with the real module.

2. **JWT auth is already wired.** `JwtAuthGuard`, `@CurrentUser()`, and the
   `JwtPayload` type are assumed to exist at `src/common/guards/`,
   `src/common/decorators/`, and `src/auth/strategies/`. The controller imports
   them but does not define them.

3. **`addFunds()` takes a `userId` parameter** even though the spec signature
   shows only `(savingId, amount, fromWalletId)`. Ownership is a service-layer
   concern — pushing it to the controller risks inconsistent enforcement across
   callers. The controller pulls `userId` from the JWT and passes it explicitly.

4. **"Source wallet belongs to the same user" is enforced transitively.** The
   service checks `userId === ownerWallet.userId` (savings owner) AND
   `userId === fromWallet.userId` (debit source). Both must equal the JWT user,
   which transitively means both wallets belong to the same person.

5. **`double precision` is used for amounts as specified**, even though
   production financial code should use `numeric(14,2)`. To keep this safe-ish
   the service rounds to 2 decimal places after every arithmetic operation —
   see the `0.1 + 0.2` test case.

6. **Transaction isolation is `SERIALIZABLE`** with pessimistic write locks on
   both rows. This is the strictest level PostgreSQL offers — required to
   prevent two concurrent transfers from each reading the same wallet balance
   and both passing the funds check.

---

## API Reference

All endpoints require a JWT Bearer token.

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST`  | `/api/savings`              | `CreateSavingsDto` | Created `Savings` |
| `GET`   | `/api/savings/:id`          | —                  | `Savings` |
| `POST`  | `/api/savings/:id/add-funds`| `AddFundsDto`      | `{ message }` |
| `GET`   | `/api/savings/:id/progress` | —                  | `{ savingId, currentAmount, targetAmount, progress }` |

---

## curl Examples

```bash
# Generate a test JWT
TOKEN=$(node -e "
  const jwt = require('jsonwebtoken');
  console.log(jwt.sign(
    { sub: 'user-uuid-here', email: 'alice@example.com' },
    'your-JWT_SECRET',
    { expiresIn: '1h' }
  ));
")

BASE="http://localhost:3000/api"

# ── Create a new savings goal ──────────────────────────────────────────
curl -X POST "$BASE/savings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "walletId": 10,
    "name": "Vacation Fund",
    "targetAmount": 5000,
    "startDate": "2026-01-01T00:00:00Z",
    "endDate":   "2026-12-31T23:59:59Z"
  }'

# ── Get a goal by id ───────────────────────────────────────────────────
curl "$BASE/savings/1" \
  -H "Authorization: Bearer $TOKEN"

# ── Add funds (wallet 11 → savings 1) ──────────────────────────────────
curl -X POST "$BASE/savings/1/add-funds" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 250, "fromWalletId": 11}'
# → { "message": "Funds added successfully" }

# ── Check progress ─────────────────────────────────────────────────────
curl "$BASE/savings/1/progress" \
  -H "Authorization: Bearer $TOKEN"
# → { "savingId": 1, "currentAmount": 250, "targetAmount": 5000, "progress": 0.05 }
```

### Error scenarios

```bash
# 400 — amount must be > 0
curl -X POST "$BASE/savings/1/add-funds" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 0, "fromWalletId": 11}'

# 400 — goal has ended (now > endDate)
# 400 — insufficient balance in source wallet

# 403 — source wallet belongs to a different user
# 403 — savings goal belongs to a different user

# 404 — savings goal not found
# 404 — source wallet not found
```

---

## Running the Tests

```bash
npm test                 # all tests
npm test savings.service # focus on the service
```

### Service-test coverage

`savings.service.spec.ts` contains 38 tests across these groups:

- **addFunds → success** — debit, credit, commit, lock, release, void return, float-safe arithmetic
- **addFunds → 400** — amount=0, negative, NaN, goal not started, goal ended, insufficient funds
- **addFunds → 404** — goal missing, owner wallet missing, source wallet missing
- **addFunds → 403** — caller ≠ savings owner, caller ≠ source-wallet owner
- **addFunds → rollback** — rolls back on every error type, always releases connection, never commits on failure
- **calculateProgress** — normal case, rounding, target=0, target<0, current=0, current<0, overfunded (>1), fully funded (=1), 404, string-numerics from PostgreSQL
- **create / findOne** — happy path + every error code

---

## Concurrency Model

The most important detail of this module is how `addFunds()` handles concurrent
transfers against the same wallet:

```
─── Time ──►

Request A: BEGIN → lock wallet 11 → balance 500 → debit 400 → balance 100 → COMMIT
Request B:                         BEGIN → wait for lock ────────────────► lock wallet 11
                                                                           → balance 100
                                                                           → debit 400 ❌ 400 Insufficient
```

Without `SELECT ... FOR UPDATE`, both requests would read balance 500 simultaneously,
both would pass the funds check, and one debit would be silently lost. The
service test `concurrent withdrawals safety` simulates this exact split-read.

The same lock is held on the `Savings` row, so two simultaneous `addFunds()`
calls can't both compute a stale `currentAmount` and overwrite each other's
update.
