# ANTIGRAVITY AGENT BUILD PROMPT
## Project: IDEA TO IPO — Virtual Venture Capital & Live Startup IPO Simulator
### Visual System Reference: shadcn/ui Dashboard & Landing Template (ShadcnStore)

> **How to use this file**: Paste this entire document into Antigravity as your task/system prompt (or drop it into the workspace as `AGENT.md` / `TASK.md` and reference it in your first message: *"Follow AGENT.md exactly, build in the phased order specified, and stop after each phase for verification."*). It is written so an autonomous coding agent can execute it end-to-end with minimal ambiguity.

---

## 0. ROLE & OPERATING INSTRUCTIONS FOR THE AGENT

You are acting as a **senior full-stack product engineer and design systems specialist**. You will build a complete, production-quality Next.js 14 application called **IDEA TO IPO**.

**Non-negotiable operating rules:**
1. **Work in phases, in order** (see Section 12). Do not skip ahead. After finishing a phase, run the app, fix any build/type errors, and only then proceed.
2. **Never invent silent scope changes.** If something in this spec is ambiguous, choose the most conservative interpretation consistent with the rest of the document and note the assumption in a code comment.
3. **Prefer small, verifiable commits/diffs** over one giant generation. Generate file-by-file where practical.
4. **Always leave the project in a runnable state.** If a phase can't fully complete, stub the remainder with clearly marked `// TODO(phase-n)` comments rather than leaving broken imports or partial types.
5. **Type-safety first.** No `any` unless absolutely unavoidable; if used, comment why.
6. **Re-read Section 2 (Design System) before writing ANY component.** Visual consistency is graded as strictly as functional correctness.
7. At the end of every phase, produce a short checklist confirming what was built, what was tested, and what remains.

---

## 1. EXECUTIVE SUMMARY — WHAT WE ARE BUILDING

**IDEA TO IPO** is a real-time virtual venture capital simulation and live startup pitch exchange, built for live auditorium/university events ("Vision Club Live Auditorium Edition"). Startups pitch on stage; both institutional judges ("FIIs") and audience members ("Retail Investors") bid virtual INR (₹) capital on them in real time. A big-screen public "market" view broadcasts a live leaderboard, ticker, and valuation charts to the room, while an admin ("Event Director") has absolute governance over the market — freezing it, transitioning IPO states, adjusting capital, cancelling transactions, and certifying final awards.

This is **two products fused into one codebase**, mirroring the reference template's own duality:

| Reference template concept | This project's equivalent |
|---|---|
| Marketing **landing page** | Hero landing page at `/` with 1-tap role login (Section 8.2) |
| **Dashboard app** (mail, tasks, chat, calendar) | Role-specific operational terminals: `/teams`, `/market`, `/leaderboard`, `/portfolio`, `/startup/[slug]`, `/fii`, `/investor`, `/admin` |
| Collapsible sidebar + topbar shell | Persistent app shell wrapping every authenticated route, themed for a "cyber-fintech" trading floor rather than generic SaaS |

The functional specification, data model, financial engine, RBAC, and state machine are governed by the attached **PROJECT_DOCUMENTATION.md** ("the Spec"), which is the single source of truth for *what the system does*. This prompt is the source of truth for *what it looks like and how the agent should build it*.

---

## 2. DESIGN SYSTEM — VISUAL DIRECTION (shadcn Dashboard & Landing Template, reskinned)

Base the component architecture, layout primitives, and interaction patterns on **ShadcnStore's "Shadcn Dashboard & Landing Template"** (`shadcnstore.com/templates/dashboard/shadcn-dashboard-landing-template`) — an open-source shadcn/ui v3 + Tailwind CSS v4 + Next.js App Router template that ships both a marketing landing page and a full app-shell dashboard (sidebar navigation, collapsible/multiple sidebar layouts, command palette, light/dark theming, data tables, charts, calendar/chat/mail/task-style pages).

**Adopt from the reference template (structure & UX patterns):**
- App-shell layout: fixed/collapsible left **sidebar** with icon + label nav items, grouped into sections (e.g. "Market", "My Terminal", "Admin"), a **topbar** with breadcrumbs, global search / command palette (`⌘K`), notification bell, and account menu.
- Sidebar supports **collapse-to-icons** and a mobile **sheet/drawer** fallback.
- Card-based dashboard grids: KPI stat cards up top, chart panels below, data tables further down — same visual rhythm as the reference dashboard home.
- shadcn/ui primitives throughout: `Sidebar`, `Card`, `Table`, `Tabs`, `Dialog`, `Sheet`, `DropdownMenu`, `Badge`, `Avatar`, `Command`, `Skeleton`, `Toast/Sonner`, `Chart` (Recharts wrapper), `Separator`, `Tooltip`.
- Light/dark mode toggle wired through `next-themes`, exactly like the reference template — but see below for the palette override.
- Responsive breakpoints and empty/loading states (skeletons) matching the reference template's polish level.

**Override from the reference template (visual theme — per Spec §8.1 "Cyber-Fintech Aesthetics"):**
Do **not** use the reference template's default neutral/light SaaS palette as the final look. Re-skin its component structure with:
- **Background**: dark obsidian `#060911` as the app base, with semi-translucent glassmorphism panels (`backdrop-blur`, `bg-white/5`, `border-white/10`) standing in for the reference template's plain `Card` backgrounds.
- **Accent tones**:
  - Neon Emerald `#00e599` — gains, live/open states, positive deltas.
  - Neon Cyan `#00c8ff` — tech/market metrics, links, primary actions.
  - Amber Gold `#f59e0b` — institutional/FII tier, warnings, paused states.
  - Rose `#ef4444` — circuit breaker / stop / destructive actions.
- **Typography**: default UI sans-serif for body copy and nav; **`font-mono` (JetBrains Mono)** mandatory for every currency figure, transaction ID, status badge, and ticker value — this is a hard rule, not a suggestion.
- Keep the reference template's **light mode** available as a literal toggle (useful for daytime venue projection / accessibility), but **dark cyber-fintech is the default and the primary demo mode.**
- Status badges use the exact color-class mapping in Spec §5.1 (e.g. `IPO_OPEN` → `bg-emerald-500/20 text-emerald-400 border-emerald-500/40`) — implement as a single `<StatusBadge status={ipoStatus} />` component with a lookup map, don't hand-roll classes per page.

**Design tokens to define in `tailwind.config.ts` / `globals.css`:**
```
--color-bg-base: #060911;
--color-accent-emerald: #00e599;
--color-accent-cyan: #00c8ff;
--color-accent-amber: #f59e0b;
--color-accent-rose: #ef4444;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;
.glass-panel { @apply bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl; }
```

**Micro-interactions**: `canvas-confetti` burst on successful investment confirmation (Spec §8.3); animated number count-up for balances/valuations on change; smooth re-order animation (Framer Motion `layout` prop) when leaderboard cards re-rank.

---

## 3. TECH STACK (must match exactly)

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js App Router | `^14.2.15` |
| Runtime | Node.js | `>=20.x` |
| Language | TypeScript (strict mode) | `^5.6.3` |
| UI Kit | shadcn/ui (v3 components, copied into `src/components/ui`) | latest |
| Styling | Tailwind CSS | `^3.4.14` (or v4 if the reference template's generated scaffold uses it — keep internally consistent) |
| ORM | Prisma Client & CLI | `^5.21.1` |
| Database | SQLite (embedded, `prisma/dev.db`) | — |
| Charts | Recharts | `^2.13.0` |
| Icons | Lucide React | `^0.453.0` |
| Animation | Framer Motion | latest |
| Celebration FX | canvas-confetti | `^1.9.3` |
| Theming | next-themes | latest |
| Test runner | tsx (for `scripts/verify-all.ts`) | `^4.19.1` |

Do not substitute a different ORM, database, or component library. Do not reach for a state-management library beyond React Context — the Spec's `AuthContext` pattern (§10) is sufficient.

---

## 4. DATA MODEL (Prisma Schema) — implement exactly as specified

Translate **Spec §3 (3.1–3.8)** into `prisma/schema.prisma` verbatim: `User`, `Startup`, `Investment`, `CapitalAdjustment`, `MarketState`, `AuditLog`, `ActivityFeed`, `FinalAward`, with every field, type, default, and relation listed there (see the ER diagram in Spec §3 and the field-by-field clauses in §3.1–§3.8). Key structural reminders:
- `MarketState` is a **singleton** row (`id = "global"`).
- `Investment.id` is a custom human-readable format `INV-XXXXXX`, not a `cuid()`.
- Cascade deletes: `Investment.investorId → User`, `Investment.startupId → Startup`, `CapitalAdjustment.userId → User`.
- `Startup.teamMembers` is a serialized JSON string field (parse/stringify at the boundary, never store as a native array in SQLite).

After writing the schema, run and verify:
```bash
npm run db:push
```

---

## 5. RBAC — ROLES & ACCESS MATRIX

Implement four roles exactly as in **Spec §4**: `ADMIN`, `FII`, `RETAIL`, `STARTUP`, plus anonymous/public access. Reproduce the full access matrix from Spec §4.1 as route guards (middleware or per-page server checks) — do not simplify it to "logged in vs not." Each row of that table (bidding rights, terminal access, admin powers, etc.) must be independently enforced server-side, not just hidden in the UI.

**Auth mechanics (Spec §4.2):**
- Cookie `idea_ipo_user_id`, `path: "/"`, `sameSite: "lax"`, `maxAge: 604800`.
- Fallback header `x-user-id` for decoupled API clients.
- Every authenticated request updates `User.lastActiveAt` and sets `isOnline = true`.
- `status === "BLOCKED"` users are rejected at `getCurrentUser()` before anything else runs.
- Build the 1-tap demo login exactly as described in Spec §8.2 and the credentials table at the end of the Spec (Admin / 3 FII judges / 3 Retail investors / 1 Startup founder) — these are the actual seed accounts, not placeholders.

---

## 6. IPO LIFECYCLE STATE MACHINE

Implement the 9-state machine from **Spec §5** (`COMING_UP → PITCHING → QA → IPO_OPEN ⇄ IPO_PAUSED → IPO_CLOSED → UNDER_REVIEW → FINALIZED`, with a `DISQUALIFIED` branch from any pre-`IPO_OPEN` state) as a strict server-side transition guard — reject any transition not present in the Mermaid diagram in Spec §5. Use the exact badge label + Tailwind color class per state from the table in Spec §5.1 inside the shared `<StatusBadge />` component described in Section 2 above. Only `IPO_OPEN` accepts bids; every other state must return a clear rejection from the investment API.

---

## 7. FINANCIAL ENGINE — CORRECTNESS IS THE #1 PRIORITY

This is the highest-risk part of the build. Follow **Spec §6** to the letter:

1. **INR formatting** (§6.1): implement `formatINR()` exactly as specified (`Cr` ≥ 1,00,00,000; `L` ≥ 1,00,000; `k` ≥ 1,000), and the subscription-ratio classification (`UNDERSUBSCRIBED` < 0.95×, `FULLY_SUBSCRIBED` 0.95–1.05×, `OVERSUBSCRIBED` > 1.05×).
2. **Atomic investment execution** (§6.2): every bid must run inside a single `prisma.$transaction`, performing, in order: (a) re-fetch and lock the fresh user balance, (b) reject on insufficient funds, (c) decrement balance / increment `totalInvested`, (d) create the `Investment` record with the `INV-XXXXXX` id format, (e) increment the startup's totals and role-specific breakdown, (f) write an `ActivityFeed` entry. Copy the reference transaction shape in §6.2 as your implementation baseline.
3. **Concurrency safety** (§6.3): rely on SQLite write serialization + Prisma transactions so two simultaneous bids against the same balance cannot both succeed if funds are insufficient for both — this must be provably true via the verification suite (Section 9 of this prompt / test #5).
4. **Cancellation, reversal, restoration** (§6.4): implement `CANCEL`, `REVERSE`, and `RESTORE` exactly as specified, including the balance/startup-total math and the audit trail writes.
5. **Manual capital adjustment** (§6.5): implement the delta formula exactly —
   `Δ = newCapital − previousCapital`; `newBalance = max(0, previousBalance + Δ)` — with a mandatory `reason` string, logged to both `CapitalAdjustment` and `AuditLog`.
6. **Manual startup total override** (§6.6): `newTotal >= 0` and `reason.trim().length >= 5`, else `400`.
7. **Master circuit breaker** (§6.7): `MarketState.isMarketActive = false` must instantly and globally block all bidding across every startup, regardless of individual `ipoStatus`.

Never round currency at intermediate steps — only at display time via `formatINR`.

---

## 8. API ROUTES — COMPLETE REST CONTRACT

Implement every route listed in **Spec §7.1–§7.7** with matching methods, request bodies, and response shapes, including:
- `POST /api/investments` (bidding engine, §7.1)
- `GET /api/market/overview`, `GET /api/market/state` (§7.2–§7.3)
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (§7.4)
- `GET /api/portfolio` (§7.5, response shape shown in the Spec must match exactly — `user`, `holdings[]`, `totalHoldingsCount`, `recentTransactions[]`)
- `GET /api/startups`, `GET /api/startups/[slug]` (§7.6)
- The full admin surface under `/api/admin/*` (§7.7): users, capital adjustment, transactions (+ cancel/restore), startup status transitions, valuation override, market freeze, audit logs, awards (get + confirm), and `reset-demo`.

Every route must perform its own RBAC check (Section 5) independent of the UI.

---

## 9. PAGES — MAP TEMPLATE STRUCTURE TO SPEC ROUTES

Use the reference template's **landing page** pattern for `/`, and its **dashboard/app-shell** pattern (sidebar + topbar + card grids) for everything else. Build these routes with the exact feature sets from **Spec §8.2–§8.9**:

| Route | Reference-template analogue | Must include (from the Spec) |
|---|---|---|
| `/` | Marketing landing hero | Full-viewport hero (`h-[calc(100vh-68px)]`, no scroll), `hero-bg.png` with gradient mask, 1-tap demo login for all 4 roles (§8.2) |
| `/teams` | Dashboard "list/kanban" page | Startup cards w/ embedded live sparkline (`TeamRealtimeGraph`), instant-bid modal with quick-amount buttons (₹25k/₹50k/₹1L/₹2L), confetti burst on success, 2.5s auto-poll (§8.3) |
| `/market` & `/leaderboard` | Dashboard analytics/overview page | Fullscreen projector toggle, live re-ordering leaderboard, cumulative multi-line market chart, retail-vs-FII donut chart, live ticker/activity stream (§8.4) |
| `/portfolio` | Dashboard "account/billing" page | Capital/liquidity/committed summary, cap-table holdings (table + card view), asset-allocation pie chart, transaction history (§8.5) |
| `/startup/[slug]` | Dashboard "detail/profile" page | Full pitch dossier, pitch-deck link, founder bio cards, recent-bids ledger table (§8.6) |
| `/fii` | Dashboard "power-user" terminal | Institutional cheque-size presets (₹10L/₹25L/₹50L/₹1Cr), two-step confirmation, due-diligence valuation panel (§8.7) |
| `/investor` | Dashboard terminal (lighter variant) | Percentage-of-balance quick allocation (10/25/50/100%), live subscription-status badges (§8.8) |
| `/admin` | Dashboard "settings/control panel" with tabs | Six consoles exactly as listed in §8.9: Control Room, Users, Transactions, Override, Audit Logs, Awards Ceremony — implement as tabs or a secondary sidebar within `/admin`, reusing the reference template's settings-page layout pattern |

For every authenticated page, wrap content in the shared app shell (sidebar + topbar) described in Section 2, with the sidebar's nav groups matching this table's left column, filtered per the RBAC matrix (Section 5) — a `RETAIL` user should never see `/admin` or `/fii` in their sidebar, even though the routes are also guarded server-side.

---

## 10. PROJECT STRUCTURE

Recreate the directory layout from **Spec §10** verbatim, including `prisma/`, `public/hero-bg.png`, `scripts/verify-all.ts`, and the full `src/app`, `src/components`, `src/context`, `src/lib`, `src/types` breakdown listed there. Additionally, house the shadcn/ui primitives under `src/components/ui/` (per the reference template's convention) and put shared app-shell pieces (`AppSidebar.tsx`, `Topbar.tsx`, `CommandPalette.tsx`, `StatusBadge.tsx`) under `src/components/shell/`.

---

## 11. VERIFICATION SUITE

Implement `scripts/verify-all.ts` to cover all **16 scenarios in Spec §9** (retail invest, FII invest, overdraft protection, closed-IPO gating, concurrent double-spend, admin pause, master freeze, cancellation, cancellation restoration, live leaderboard re-ordering, chart telemetry sync, presence tracking, capital-adjustment logging, mandatory override justification length, final freeze, award immutability). The script must be runnable via:
```bash
npx tsx scripts/verify-all.ts
```
and must print a PASS/FAIL table matching the one in Spec §9. **Do not consider the build complete until all 16 scenarios pass.**

---

## 12. BUILD ORDER — EXECUTE IN THIS SEQUENCE

**Phase 0 — Scaffold**
Init Next.js 14 App Router + TypeScript project; install and configure Tailwind, shadcn/ui (pull in the component set the reference template uses: sidebar, card, table, tabs, dialog, sheet, dropdown-menu, badge, avatar, command, skeleton, sonner, separator, tooltip, chart); wire `next-themes`; set up the design tokens from Section 2.

**Phase 1 — Data layer**
Write `prisma/schema.prisma` (Section 4), run `db:push`, write `prisma/seed.ts` matching the seed data implied by the credentials table at the end of the Spec (4 startups: FinFlow, GreenGo, HealthAI, EduSpark; 8 users across all roles with the exact starting capital figures shown), and `src/lib/prisma.ts` singleton.

**Phase 2 — Auth & app shell**
Build `src/lib/auth.ts`, `src/context/AuthContext.tsx`, the login/logout/me API routes, the cookie/header auth mechanics (Section 5), and the shared sidebar + topbar shell with role-filtered navigation.

**Phase 3 — Landing page**
Build `/` per Section 9's row for it, including the 1-tap login switcher.

**Phase 4 — Financial engine & core APIs**
Build the investments engine (Section 7 in full), market state/overview endpoints, and portfolio endpoint. Write unit-level manual tests for the transaction logic before moving on.

**Phase 5 — Investor-facing pages**
Build `/teams`, `/fii`, `/investor`, `/portfolio`, `/startup/[slug]` per Section 9.

**Phase 6 — Public broadcast pages**
Build `/market` and `/leaderboard`, including the fullscreen projector mode and live charts.

**Phase 7 — Admin Mission Control**
Build `/admin` with all six consoles and their backing `/api/admin/*` routes (Section 8).

**Phase 8 — Verification & polish**
Write and run `scripts/verify-all.ts` (Section 11) until all 16 scenarios pass; do a full visual pass against Section 2's design system on every page; add loading skeletons and empty states matching the reference template's polish; test responsive/mobile behavior of the sidebar and bidding modals.

**Phase 9 — Ops manual**
Confirm the install/seed/verify/run flow works exactly as documented in Spec §11, and that the demo credentials table logs in correctly for all 8 seeded accounts.

---

## 13. DEFINITION OF DONE

- [ ] `npm install && npm run db:push && npm run db:seed && npm run dev` works with zero manual intervention.
- [ ] All 16 verification scenarios (Section 11) pass.
- [ ] Every route in Section 9 exists, is RBAC-guarded server-side, and matches its feature checklist.
- [ ] Visual language matches Section 2 on every screen (dark cyber-fintech default, `font-mono` on all currency/IDs/badges, correct status-color mapping, glass panels, sidebar+topbar shell).
- [ ] Master circuit breaker, IPO state machine, and all financial math match Sections 6–7 exactly, with no partial/rolled-back states possible under concurrency.
- [ ] Light/dark theme toggle works app-wide.
- [ ] Confetti + count-up + leaderboard re-order animations are present and not janky.
- [ ] All 8 demo accounts log in via 1-tap and land on their correct default page (per the credentials table in the Spec).

---

*End of build prompt. Treat Sections 3–11 as hard requirements sourced from PROJECT_DOCUMENTATION.md; treat Sections 1–2 as the visual mandate sourced from the shadcn Dashboard & Landing Template. Where the two ever conflict, functional correctness (the Spec) wins over aesthetic fidelity (the template) — reskin, don't break behavior.*
