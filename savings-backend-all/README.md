# Savings Backend — Complete Bundle

Three NestJS projects covering every savings-related endpoint built during this
session. Each lives in its own subfolder because they have different entity
schemas and would conflict if merged as-is — in production you would pick one
schema and migrate the others to match.

```
savings-backend-all/
├── 01-progress-and-withdraw/   ← deposits + withdrawals (Sessions 2 & 3)
├── 02-crud/                    ← full CRUD (Session 5)
└── 03-addfunds-with-wallet/    ← addFunds + progress with Wallet (Session 6)
```

---

## What's in each project

### 01-progress-and-withdraw

Implements the two append-only ledger endpoints:

- `POST /api/savings/:id/add`       — record a deposit
- `POST /api/savings/:id/withdraw`  — record a withdrawal

**Three entities:**
- `SavingsGoal` (parent) — running `savedAmount`, `isCompleted` flag
- `SavingsProgress` — append-only deposit log with `savedAmountSnapshot`
- `SavingsWithdrawal` — append-only withdrawal log with `savedAmountSnapshot`

**Key features:** SERIALIZABLE transactions, pessimistic write locks
(`SELECT ... FOR UPDATE`), insufficient-funds check inside the lock,
auto-completion when target reached, auto-reopen when withdrawal drops balance
below target.

**Tests:** ~50 specs covering happy paths, concurrency, floating-point precision,
goal completion/reopening, rollback, and every error branch.

---

### 02-crud

Full RESTful CRUD for savings goals:

- `GET    /api/savings`        — list (filterable by `status`, sortable)
- `GET    /api/savings/:id`    — fetch by UUID
- `POST   /api/savings`        — create
- `PATCH  /api/savings/:id`    — partial update
- `DELETE /api/savings/:id`    — delete

**Entity differences from project 01:**
- UUID primary keys (`@PrimaryGeneratedColumn('uuid')`)
- `currentSaved` field name (not `savedAmount`)
- `status` enum (`'active' | 'completed'`) instead of `isCompleted` boolean
- Composite index `[userId, status]` for filtered queries

**Key features:** Service-controlled fields (`userId`, `currentSaved`,
`status`) — cannot be injected by clients. 403 vs 404 distinction on
cross-tenant access. `deadline ASC NULLS LAST` sort ordering.

**Tests:** 43 specs across service (28) + controller (15).

---

### 03-addfunds-with-wallet

Implements the two business methods from the spec:

- `POST /api/savings/:id/add-funds`  — atomic wallet → savings transfer
- `GET  /api/savings/:id/progress`   — returns `currentAmount / targetAmount`

Plus basic CRUD (`POST /`, `GET /:id`).

**Entity differences from projects 01 and 02:**
- Integer primary key (`savingId: number`), not UUID
- `walletId` foreign key to a separate `Wallet` entity
- `currentAmount` field name (not `savedAmount` or `currentSaved`)
- `double precision` columns per spec (with service-side rounding)
- `startDate` and `endDate` define the active window

**Includes a Wallet stub module** (`src/wallet/`) — replace with your real
Wallet module on integration. The stub exposes `WalletService.debitInTransaction(qr, ...)`
which lets `SavingsService` atomically debit the wallet within its own
transaction without breaking module encapsulation.

**Tests:** 38 service specs + 15 controller specs covering every edge case
including float arithmetic, active-window check, ownership across both
wallets, and rollback on each error type.

---

## Schema collision summary

If you want to consolidate into one canonical model, here are the conflicts to resolve:

| Concept | Project 01 | Project 02 | Project 03 |
|---|---|---|---|
| Primary key | UUID | UUID | integer |
| Saved-amount column | `savedAmount` | `currentSaved` | `currentAmount` |
| Lifecycle field | `isCompleted: boolean` | `status: enum` | (none — uses date window) |
| Owner reference | `userId: string` | `userId: string` | `walletId → wallet.userId` |
| Decimal type | `numeric(14,2)` | `numeric(14,2)` | `double precision` |

**Recommended consolidation:**
- UUID primary keys (web standard)
- `currentSaved` field (most descriptive)
- `status: enum` (richer than boolean, supports future states)
- `userId` direct (don't make every query traverse a wallet relation)
- `numeric(14,2)` (correctness for money)

---

## Shared dependencies (assumed but not included)

All three projects assume the following live in a shared `auth` + `common` layer
that was built earlier in the conversation as part of the **Settings API** project:

```
src/
├── auth/
│   └── strategies/jwt.strategy.ts         ← exports JwtPayload type
└── common/
    ├── guards/jwt-auth.guard.ts            ← @UseGuards(JwtAuthGuard)
    ├── decorators/current-user.decorator.ts ← @CurrentUser() user: JwtPayload
    └── filters/http-exception.filter.ts    ← standardised error envelope
```

These are referenced by every controller's imports. In a full repo they sit
alongside the savings modules at the same level.

---

## Total content

| Project | Files | Lines |
|---|---|---|
| 01-progress-and-withdraw | 16 | ~2,200 |
| 02-crud | 10 | ~1,200 |
| 03-addfunds-with-wallet | 12 | ~1,500 |
| **Total** | **38** | **~4,900** |

Tests alone account for ~2,200 of those lines.
