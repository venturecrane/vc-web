---
title: 'Finding Four Auth Vulnerabilities in One Code Review'
date: 2026-02-20
description: 'How AI-generated prototype code accumulates auth debt and how one code review session catches it systematically.'
author: 'Venture Crane'
tags: ['security', 'code-quality', 'kid-expenses', 'agent-workflow']
draft: false
---

Four authentication vulnerabilities, all in production, all exploitable, all introduced during prototyping, all found in a single code review session. None of them were bugs in the traditional sense. The code worked. The tests passed. Every endpoint returned the right data for the right requests. The problem was that they also returned the right data for the wrong requests.

Kid Expenses is a family expense tracking app for shared custody situations. It was built rapidly with AI agent assistance - functional prototype to working API in days, not weeks. That speed came with a cost we did not discover until we sat down to review the auth layer systematically.

The cost was not one vulnerability. It was a pattern.

---

## Vulnerability 1: The Header That Trusts Anyone

The auth middleware had a fallback path. If no JWT was present in the request, it checked for an `X-User-Id` header. If that header existed, the middleware trusted it. No signature verification. No token validation. Just a header value treated as authenticated identity.

Any HTTP client could impersonate any user by setting a single header:

```
GET /api/expenses
X-User-Id: victim-user-id-here
```

That is the entire attack. No token theft, no session hijacking, no cryptographic exploit. Set a header, become anyone.

The root cause was prototyping convenience. During early development, the `X-User-Id` header was a shortcut for testing API endpoints without setting up JWT mocking infrastructure. It let agents and developers hit endpoints quickly, verify response shapes, and iterate on the API surface. Useful during a spike. Catastrophic in production.

The fix in PR #141 was straightforward: remove the fallback entirely. An `X-User-Id` header with no JWT now returns 401. The header was also removed from the CORS `allowHeaders` configuration so browsers would not even send it in preflight responses. Every test file - all 10 of them - was updated to use JWT Bearer authentication instead of the convenience header. 192 tests pass.

---

## Vulnerability 2: JWTs Without Issuer Validation

The JWT verification function checked two things: signature validity and token expiry. It did not check who issued the token.

This matters because Kid Expenses uses Clerk for authentication. Clerk applications share a signing key infrastructure. A valid JWT from a different Clerk application - one that has nothing to do with Kid Expenses - could pass signature verification and be treated as an authenticated session.

The attack surface is narrow but real. Anyone running their own Clerk application could generate JWTs that Kid Expenses would accept. The signature is valid (same key pool), the token is not expired, and the middleware has no way to distinguish "this token was issued for Kid Expenses" from "this token was issued for a completely different app."

The root cause: during initial auth implementation, signature and expiry felt like sufficient validation. The `iss` claim was not checked because "we only have one Clerk app" - which was true at the time but is not a security invariant.

PR #140 added issuer validation. The expected issuer URL is derived from the existing `CLERK_DOMAIN` environment variable, so no new configuration was needed for the common case. A new optional `CLERK_ISSUER_URL` environment variable allows explicit override when the derived URL does not match. The comparison is exact string match - no substring matching, no regex, no "starts with" logic that could be tricked with a carefully crafted issuer string.

Eight new tests cover: wrong issuer, missing `iss` claim, correct issuer, no validation when the env var is unset, substring rejection, and middleware-level integration. 199 tests pass.

---

## Vulnerability 3: The Endpoint Anyone Could Call

The `/users/sync` endpoint creates user accounts and updates email addresses. It had no authentication. None.

```
POST /api/users/sync
Content-Type: application/json

{"userId": "anything", "email": "attacker@example.com"}
```

That creates a user account, or if the user ID already exists, overwrites their email address. No JWT required. No API key. No webhook signature. An open door to account creation and email takeover.

The root cause is a common pattern in AI-generated prototype code: an endpoint designed for a specific integration that gets exposed as a general API route. This endpoint was built for Clerk webhook callbacks. The reasoning was "Clerk will be the only caller" - which might have been true in development but was enforced by nothing. The endpoint was a regular route in the API, reachable by anyone who could send an HTTP POST.

PR #139 added auth middleware to the endpoint. More importantly, it changed the trust model: the user ID is now derived from the JWT claims, not from the request body. The frontend was updated to pass a Clerk session JWT via the Authorization header. The endpoint no longer takes the caller's word for who they are. 191 tests pass.

---

## Vulnerability 4: CORS for Everyone on Vercel

CORS was configured with this origin pattern: `*.vercel.app`. Any application deployed on Vercel could make authenticated cross-origin requests to the Kid Expenses API.

Vercel is one of the most popular deployment platforms in the JavaScript ecosystem. Millions of applications are deployed there. Every single one of them was an allowed origin for authenticated API requests to Kid Expenses.

The root cause: preview deploys. During development, every PR gets a unique Vercel preview URL. The wildcard pattern ensured that preview deploys could hit the API without CORS errors. It worked perfectly for development. It also worked perfectly for any other application on Vercel.

PR #135 tightened the pattern. The production domain is exact-matched. Preview deploys match against the specific pattern for the project's Vercel deployments, not the entire `*.vercel.app` namespace. Random Vercel-deployed origins now receive CORS rejections.

---

## Bonus: 39 Catch Blocks Leaking Information

While reviewing the auth layer, we found a fifth issue that was not an authentication vulnerability but compounded the risk. Across 12 route files, 39 error handlers were returning `details: String(error)` in their JSON responses.

```typescript
catch (error) {
  return Response.json(
    { error: 'Failed to fetch expenses', details: String(error) },
    { status: 500 }
  );
}
```

In the best case, this leaks internal error messages. In the worst case, it leaks stack traces with file paths, database connection strings from failed queries, or third-party API error responses that include account identifiers. Combined with the other vulnerabilities - particularly the unauthenticated sync endpoint - an attacker could trigger errors intentionally and harvest the leaked details.

PR #136 removed the `details` field from all 39 catch blocks. Server-side `console.error()` logging was retained so the information is still available for debugging. Clients now receive a generic error message and a status code. The internal details stay internal.

---

## The Pattern: Auth Debt

All four vulnerabilities share a root cause: prototyping shortcuts that never got removed.

| Shortcut                      | Reasoning                                       | Risk                                        |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------- |
| `X-User-Id` header fallback   | "Easier to test without setting up JWT mocking" | Any client impersonates any user            |
| No issuer validation          | "The signature check is sufficient for now"     | Cross-application token acceptance          |
| Unauthenticated `/users/sync` | "Clerk will be the only caller"                 | Open account creation and email overwrite   |
| Wildcard CORS                 | "We need preview deploys to work"               | Any Vercel app makes authenticated requests |

Each shortcut was individually reasonable. AI agents write working code fast. They create functional endpoints, add test helpers for quick iteration, and use convenient defaults that make the immediate task easier. The code works. Tests pass. The prototype ships.

But each shortcut is also a piece of security debt. And unlike technical debt - where the cost is slower development velocity - security debt compounds silently. There is no linter warning for "this endpoint should have auth." There is no test failure for "this CORS config is too permissive." The code runs correctly right up until someone exploits it.

We call this auth debt: the gap between "the code works" and "the code is secure." It accumulates naturally in AI-assisted rapid prototyping because the agent's objective is to make the feature work, and every prototyping shortcut achieves that objective. The shortcuts are invisible to automated quality checks because they are not bugs - they are missing constraints.

---

## Why Automated Checks Miss Auth Debt

The standard CI pipeline - typecheck, lint, format, test - verified all of this code as correct. Every PR that introduced a vulnerability had green CI.

TypeScript does not know that `X-User-Id` should not be trusted. ESLint does not flag missing issuer validation. Prettier does not care about CORS origins. The test suite verified that authenticated requests succeeded, but none of the tests verified that unauthenticated requests failed.

This is the gap. Positive testing ("does the right request get the right response?") was thorough. Negative testing ("does the wrong request get rejected?") was almost entirely absent. The original test suite had tests for the `X-User-Id` fallback path, but they were testing that it worked, not that it should not exist.

After the fix sprint, the test approach inverted. Every auth-related test now has a negative counterpart:

- JWT with wrong issuer returns 401
- Request with `X-User-Id` but no JWT returns 401
- `/users/sync` without Authorization header returns 401
- Cross-origin request from a non-project Vercel domain gets CORS rejection
- Error responses contain no `details` field

The total test count went from 165 to 199. The 34 new tests are almost entirely negative cases - verifying that things that should fail do fail.

---

## The Fix Sprint

PRs #132 through #144 shipped in a single session. The progression was deliberate - each fix built confidence for the next:

| PR       | Change                                            |
| -------- | ------------------------------------------------- |
| #132     | Fix missing /csv suffix on export API paths       |
| #133     | Align notification preferences API paths          |
| #134     | Add auth middleware test coverage                 |
| #135     | Tighten CORS to reject non-project Vercel origins |
| #136     | Sanitize error responses (39 catch blocks)        |
| #137     | Add ESLint to API worker                          |
| #138     | Integration tests for route handlers              |
| #139     | Require auth on /users/sync                       |
| #140     | Add issuer validation to JWT verification         |
| #141     | Remove X-User-Id auth bypass                      |
| #143-144 | PWA support (post-security sprint)                |

The ordering matters. We started with path corrections and test infrastructure (#132-#134), which let us verify the existing behavior before changing it. Then restrictive changes (#135-#136) that tighten the surface area without modifying auth logic. Then the actual auth fixes (#139-#141), each one building on the test infrastructure established earlier.

The entire sprint - discovery, fixes, tests, verification - was a single agent session. Not because the changes were trivial, but because the scope was well-defined. "Find auth problems and fix them" is a clearer objective than "make the app better." Specificity drives velocity.

---

## What This Means for AI-Assisted Prototyping

The takeaway is not "don't use AI agents to build prototypes." The takeaway is that rapid prototyping with AI agents has a specific, predictable failure mode: auth debt.

Every team using AI to rapidly scaffold APIs will accumulate the same kind of shortcuts. The test header that becomes a production bypass. The validation that seems sufficient until you realize it is not. The endpoint that works correctly but has no access control. The CORS policy that is permissive because restrictive was inconvenient during development.

The fix is not slower prototyping. The fix is a dedicated security review pass before anything is exposed to real users. Not a vague "review the code" pass - a specific checklist:

1. **For every endpoint**: what happens when the request has no auth token? Verify it returns 401.
2. **For every auth check**: what claims are validated? Signature alone is not enough.
3. **For every middleware fallback**: was it added for testing convenience? If yes, remove it.
4. **For CORS**: does the origin pattern match only your domains, or does it match an entire platform?
5. **For error responses**: what information reaches the client? Stack traces and internal paths should never leave the server.

This checklist found four vulnerabilities in Kid Expenses. We would bet it finds at least two in any AI-scaffolded API that has not had a dedicated security review.

The speed of AI-assisted prototyping is genuine. The risk is also genuine. The solution is not to choose between speed and security. It is to build the security review into the pipeline as a distinct phase, run it before the prototype becomes the product, and treat every prototyping convenience as a line item that must be explicitly resolved - kept with justification or removed.

Prototype fast. Review thoroughly. Ship with both.

---

_Kid Expenses is a family expense tracking app built with AI agent assistance. A single code review session found four authentication vulnerabilities - all prototyping shortcuts that survived into production. PRs #132 through #144 fixed the auth layer, added 34 negative test cases, and sanitized 39 error handlers. All four vulnerabilities followed the same pattern: a convenience that was reasonable during development and exploitable in production._
