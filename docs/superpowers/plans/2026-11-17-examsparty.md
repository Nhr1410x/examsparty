# Examsparty Implementation Plan

> **For agentic workers:** Execute inline using superpowers:executing-plans. The user supplied the approved blueprint and requested implementation.

**Goal:** Implement the learning and administration MVP and prepare both services for Render.
**Architecture:** React/TypeScript frontend; Express API; PostgreSQL with immutable attempt snapshots. Frontend proxies /api so cookies stay first-party.
**Tech Stack:** React, Vite, Express, pg, Zod, Node test runner.
**Spec:** ../../../blueprint-he-thong-on-tap.md (workspace root).

## Constraints and decisions
- Vietnamese interface, green palette, responsive light/dark themes.
- Guest learning; anonymous contributions use contact email and secret tracking code. No student registration in MVP.
- Five question types; essays remain ungraded. Code blocks are display-only.
- PostgreSQL persists images (maximum 2 MB each) for the MVP, preventing loss on Render ephemeral disks; migrate assets to object storage at scale.
- Backend authority for answers, permissions, timeouts and grading; fixed snapshots survive edits.
- No existing repository or callers; create backend, frontend, fixtures, tests, deployment and documentation together.

## Review focus
- Hidden answers and unapproved content never leak to public endpoints.
- Attempt IDs alone cannot access another browser's work.
- Expiry and concurrent saves cannot mutate submitted results.
- Malformed JSON and answer references produce field-specific errors.
- Administration requires a valid non-blocked account and CSRF-safe requests.

## Tasks
- [x] 1. Write domain tests (validation, scoring, redaction, immutable shuffling); run RED, implement domain, run GREEN.
- [x] 2. Add PostgreSQL schema, seed, API and integration tests for ownership, moderation, expiry, authentication and uploads.
- [x] 3. Build public pages, attempt/review screens, contribution editor/tracker and admin tools. Type-check and production build.
- [x] 4. Add Render blueprint, local database setup, environment examples and operating instructions. Run all checks and inspect UI if browser tooling is available.

## Execution notes
- The supplied blueprint is the design authority; no replacement design approval was needed. Implemented directly in the supplied workspace (no existing Git repository or worktree).
- Domain/API tests use pg-mem with PostgreSQL's jsonb_array_length registered in the test/development adapter. Production uses the pg driver and real PostgreSQL only.
- Browser automation unavailable: browser host unavailable and native Chrome control not approved. Docker daemon is not running; real PostgreSQL integration remains unverified.
- A read-only independent final review found an empty-flush autosave deadlock and unpublished question edits leaking into live exams. Both received failing regression tests and fixes.
- The review also identified cross-browser recovery of unpublished images. Treated as an important recovery defect because secret-code revision must work after losing the original cookie; added session grants after successful tracking-code verification and a failing-then-passing API test.
- Shared environment TOTP and in-memory rate limits remain documented single-owner/single-instance constraints. No remote repository, paid resources, or deployment were created.
- Final verification: `npm run check` passed TypeScript, 20 domain/API tests and 4 React/DOM tests. `npm run test:proxy` passed production build and 1 HTTP/proxy test (25 tests total). All temporary demo servers were stopped. Last dependency installation audit reported zero vulnerabilities.
