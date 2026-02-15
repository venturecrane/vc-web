---
title: 'Building an MCP Server for Workflow Orchestration'
date: 2026-02-15
description: 'A practical walkthrough of building an MCP server that bridges an AI coding CLI to a custom backend API, with lessons on tool design and fleet deployment.'
author: 'Venture Crane'
tags: ['mcp', 'agent-tooling', 'infrastructure', 'typescript']
draft: true
---

Before MCP, our agent integration was a collection of bash scripts invoked through a CLI skill system. The scripts called our backend API, parsed JSON with `jq`, and rendered output for the agent to consume. It worked, but barely.

The problems compounded. Environment variables set in the shell didn't reliably pass through to skill execution. Auth conflicts arose when scripts needed both OAuth tokens (for GitHub) and API keys (for our context backend) in the same invocation. Every new machine in the fleet required manual setup of script paths, permissions, and configuration. Adding a new tool meant writing bash, registering it in a command manifest, and debugging string escaping issues across three different shells.

MCP replaced all of that with a single pattern: a typed, validated, locally running server that the AI CLI connects to over stdio.

---

## What MCP Is (Briefly)

Model Context Protocol is the standard extension mechanism for AI coding tools. It defines a JSON-RPC protocol over stdio that lets a host application (like Claude Code) discover and invoke tools provided by a server process.

The key properties that matter in practice:

- **Stdio transport.** The MCP server is a subprocess of the CLI. No ports, no HTTP, no discovery. The CLI spawns it and communicates over stdin/stdout.
- **Typed tool schemas.** Each tool declares its inputs as a JSON Schema. The CLI validates inputs before calling the tool, and the agent sees the schema to understand what parameters are available.
- **Single-file configuration.** A `.mcp.json` file in the repo root (or a global config for other CLIs) declares which servers to start and what environment variables to pass. No shell profiles, no `export` statements, no sourcing dotfiles.
- **Auth via config.** API keys go in the MCP config file, passed as environment variables to the server process. The CLI handles this at startup. No interactive prompts, no token refresh flows.

For our use case, this means: install once, configure once, and every agent session on that machine gets the same reliable tooling.

---

## The Architecture

We don't connect the AI CLI directly to our cloud API. Instead, a local MCP server (Node.js, TypeScript) acts as middleware:

```
┌─────────────────────────────────────────────────────┐
│                  Developer Machine                    │
│                                                       │
│  ┌──────────────┐     stdio      ┌────────────────┐ │
│  │  Claude Code   │ ◄──────────► │   MCP Server    │ │
│  │  (AI agent)    │              │   (Node.js)     │ │
│  └──────────────┘              │                  │ │
│                                  │  • Git repo      │ │
│                                  │    detection     │ │
│                                  │  • GitHub CLI    │ │
│                                  │    integration   │ │
│                                  │  • Doc self-     │ │
│                                  │    healing       │ │
│                                  │  • Input         │ │
│                                  │    validation    │ │
│                                  └───────┬────────┘ │
│                                          │           │
└──────────────────────────────────────────┼───────────┘
                                           │ HTTPS
                                           ▼
                              ┌────────────────────────┐
                              │  Cloudflare Worker + D1 │
                              │  (Context API)          │
                              │  • Sessions             │
                              │  • Handoffs             │
                              │  • Knowledge store      │
                              │  • Doc management       │
                              └────────────────────────┘
```

**Why a local server instead of direct API calls?** Several reasons:

1. **Client-side intelligence.** The MCP server detects the current git repo, resolves the venture/project context, and passes that to the API. The API doesn't need to know about local filesystem layout.
2. **Tool composition.** Some tools call the `gh` CLI for GitHub data, the filesystem for local files, and the API for remote state - all in a single tool invocation. A remote API can't do that.
3. **Fail-fast validation.** Zod schemas validate inputs before any network call. Bad input gets a clear error message instantly, not after a round-trip.
4. **The API stays simple.** The cloud backend is stateless HTTP. No git operations, no filesystem access, no shell commands. The complexity lives in the MCP server where it can be tested and iterated quickly.

The server is built with the official `@modelcontextprotocol/sdk` package, which handles the JSON-RPC protocol, message framing, and lifecycle management. The dependency footprint is deliberately small: the SDK, Zod for validation, and Node.js standard library. No Express, no database drivers, no heavyweight frameworks.

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.24.0"
  }
}
```

---

## The Tool Inventory

The server registers 11 tools. Each one maps to a specific workflow step, not a CRUD operation.

| Tool        | Purpose                                       | Data Sources                    |
| ----------- | --------------------------------------------- | ------------------------------- |
| `preflight` | Validate environment before starting work     | Local env, `gh` CLI, API health |
| `sod`       | Initialize session, load all context          | API, GitHub, local filesystem   |
| `handoff`   | Record structured session summary             | API (writes to D1)              |
| `status`    | Show full GitHub issue breakdown by priority  | `gh` CLI                        |
| `context`   | Show current session state                    | API, git                        |
| `ventures`  | List projects with local install status       | API, filesystem scan            |
| `plan`      | Read weekly priority plan                     | Local markdown file             |
| `doc_audit` | Check and heal missing documentation          | API + local file generation     |
| `doc`       | Fetch a specific document by scope and name   | API                             |
| `note`      | Create or update enterprise knowledge         | API                             |
| `notes`     | Search knowledge store by tag, scope, or text | API                             |

The naming matters. We call the tool `sod` (Start of Day), not `create_session`. We call it `handoff`, not `update_session_status`. The names reflect what the agent is trying to accomplish, not the underlying data operation. When the agent sees `sod` in its tool list, it understands immediately: this is what you call at the start of a session.

Notice the mix of data sources. `status` calls the `gh` CLI directly (via `execSync`) to query GitHub issues - no API round-trip needed. `plan` reads a local markdown file from the repo. `sod` calls the remote API, the `gh` CLI, and the local filesystem in a single invocation. This heterogeneity is exactly why a local MCP server makes sense as middleware. A pure API integration couldn't reach the local filesystem or shell out to `gh`.

---

## Tool Design: What We Learned

After building and iterating on these tools over several months, a few design principles emerged.

### Task-oriented, not CRUD-oriented

The `sod` tool doesn't just create a session. It validates the environment, creates or resumes a session, loads the last handoff, queries P0 issues from GitHub, checks the weekly plan freshness, lists active parallel sessions, runs a documentation audit, and self-heals missing docs. A single tool call returns everything the agent needs to start working.

Early versions had separate tools for each of these: `create_session`, `get_handoff`, `get_issues`, `check_plan`. The agent had to know the right sequence and call them in order. It rarely did. Collapsing them into a single task-oriented tool improved reliability dramatically.

### Validate inputs with Zod schemas

Every tool defines a Zod schema for its input:

```typescript
export const handoffInputSchema = z.object({
  summary: z.string().describe('Summary of work completed'),
  status: z.enum(['in_progress', 'blocked', 'done']).describe('Current status'),
  issue_number: z.number().optional().describe('GitHub issue number if applicable'),
})
```

The schema serves three purposes. First, it validates input before any side effects occur. If the agent passes an invalid status value, the error is immediate and clear. Second, it generates the JSON Schema that the CLI presents to the agent, so the agent knows what parameters are available. Third, the `.describe()` annotations act as inline documentation - the agent reads them to understand what each field means.

### Return structured text the agent can reason about

Every tool returns a `message` field containing formatted markdown. Not raw JSON. Not a data structure the agent has to interpret. Structured text that the agent can read, quote, and act on directly.

```typescript
let message = '## Session Context\n\n'
message += `| Field | Value |\n|-------|-------|\n`
message += `| Venture | ${venture.name} (${venture.code}) |\n`
message += `| Repo | ${fullRepo} |\n`
message += `| Branch | ${currentRepo.branch} |\n`
message += `| Session | ${session.session.id} |\n\n`
```

We tried returning raw JSON and letting the agent format it. The agent did format it - differently every time, sometimes dropping fields, sometimes hallucinating data. Pre-formatted output is deterministic.

### Fail fast with clear messages

When something goes wrong, the tool tells the agent exactly what to do:

```typescript
if (!apiKey) {
  return {
    success: false,
    message: 'CRANE_CONTEXT_KEY not found. Launch with: launcher alpha',
  }
}
```

Not "authentication failed." Not an HTTP 401 status code. A concrete instruction: "Launch with: launcher alpha." The agent can relay this to the human verbatim, and the human knows exactly what command to run.

### One tool per workflow step

The `note` and `notes` tools could be a single `knowledge` tool with a mode parameter. We split them because they represent different workflows: `note` is "store this thing" (a write operation the human initiates), while `notes` is "find me something" (a read operation the agent often initiates autonomously). Different intents, different tools.

The exception is `note` itself, which handles both `create` and `update` via an `action` parameter. This works because the intent is the same (persist knowledge), and the agent naturally says "update that note" or "create a new note."

---

## The Server Entry Point

The entry point is straightforward. Register tools, handle calls, start the transport:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new Server(
  { name: 'my-mcp-server', version: '0.2.0' },
  { capabilities: { tools: {} } }
)

// Register tool list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'preflight',
        description: 'Run environment preflight checks...',
        inputSchema: { type: 'object', properties: {} },
      },
      // ... more tools
    ],
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  switch (name) {
    case 'preflight': {
      const input = preflightInputSchema.parse(args)
      const result = await executePreflight(input)
      return {
        content: [{ type: 'text', text: result.message }],
      }
    }
    // ... more cases
  }
})

// Start
const transport = new StdioServerTransport()
await server.connect(transport)
```

Each tool is a separate module that exports a Zod schema and an `execute` function. The entry point is purely routing and transport. This separation makes each tool independently testable.

---

## The API Client Layer

A dedicated API client class encapsulates all communication with the cloud backend:

```typescript
export class CraneApi {
  private apiKey: string
  private apiBase: string

  constructor(apiKey: string, apiBase: string) {
    this.apiKey = apiKey
    this.apiBase = apiBase
  }

  async startSession(params: {
    venture: string
    repo: string
    agent: string
  }): Promise<SodResponse> {
    const response = await fetch(`${this.apiBase}/sod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Relay-Key': this.apiKey,
      },
      body: JSON.stringify({ ...params, schema_version: '1.0' }),
    })
    if (!response.ok) throw new Error(`API error: ${response.status}`)
    return response.json() as Promise<SodResponse>
  }

  // ... more methods
}
```

Every API method follows the same pattern: construct the request, include the API key header, handle errors. The class uses Node.js native `fetch` (no Axios, no `node-fetch`), keeping the dependency count low.

The API client also includes a simple in-memory cache for data that doesn't change within a session (like the ventures list). Since the MCP server is a long-lived process, this cache persists across tool calls within the same session.

All response types are defined as TypeScript interfaces in the same file. This gives us type safety end-to-end: the API client returns typed responses, and the tool functions consume them with full IntelliSense.

---

## Testing MCP Tools

Each tool has a corresponding test file. The testing strategy has three layers:

**Unit tests mock the API and external dependencies.** The test suite uses Vitest with module mocking:

```typescript
vi.mock('../lib/github.js')
vi.mock('../lib/repo-scanner.js')

it('returns pass when all checks succeed', async () => {
  process.env.CRANE_CONTEXT_KEY = 'test-key'
  vi.mocked(checkGhAuth).mockReturnValue({
    installed: true,
    authenticated: true,
  })
  vi.mocked(getCurrentRepoInfo).mockReturnValue(mockRepoInfo)
  mockFetch.mockResolvedValue({ ok: true })

  const result = await executePreflight({})

  expect(result.all_passed).toBe(true)
  expect(result.checks).toHaveLength(4)
})
```

Each test resets modules between runs (`vi.resetModules()`) to ensure clean state. Environment variables are snapshotted in `beforeEach` and restored in `afterEach`. The `fetch` global is stubbed to control API responses.

**Integration tests hit the real API.** These run less frequently (not in CI on every push) but verify that the MCP server talks to the actual Cloudflare Worker correctly. They use real API keys from Infisical and validate response shapes against TypeScript interfaces.

**E2E verification runs on machine bootstrap.** When a new machine joins the fleet, the bootstrap script validates the full chain: MCP server starts, connects via stdio, tool calls return valid responses, API connectivity works. This catches misconfigurations that unit tests can't reach (wrong Node.js version, missing npm link, broken PATH).

The test patterns we settled on:

- Mock external dependencies (API, GitHub CLI, filesystem) at the module level
- Test the `execute*` functions directly, not through the MCP protocol layer
- Assert on both the structured result (`.all_passed`, `.success`) and the human-readable message (`.message`)
- Use fixtures for common test data (repo info, venture configs)

---

## Fleet Deployment

The MCP server needs to be installed on every development machine. Since it's part of a monorepo built with TypeScript, deployment means: pull the latest code, build, and re-link the binary.

A deployment script automates this across the fleet:

```bash
#!/bin/bash
# Deploy MCP server to all fleet machines
set -e

MACHINES=("machine1" "machine2" "machine3")

for SSH_HOST in "${MACHINES[@]}"; do
  ssh "$SSH_HOST" << 'EOF'
    cd ~/dev/project-console
    git stash --include-untracked
    git pull origin main
    cd packages/mcp-server
    npm install
    npm run build
    npm link
EOF
done
```

The script includes several safety checks:

- **Pre-flight validation.** It verifies the local machine is on `main` and has no unpushed commits. Deploying unreleased code to the fleet would be a debugging nightmare.
- **Stash before pull.** Remote machines sometimes have local changes (usually `package-lock.json` differences or experimental edits). The script stashes before pulling to avoid merge conflicts.
- **npm link.** The `npm link` command creates symlinks from npm's global bin directory to the monorepo's build output. This means every terminal session on the machine uses the latest build, regardless of working directory.
- **SSH timeout and error handling.** Each machine gets a 10-second connection timeout. Failed machines are collected and reported at the end, with Tailscale troubleshooting hints.

The typical deployment flow: make changes, test locally, push to main, run the deploy script. The script SSHes to each machine in sequence, pulls, builds, and reports success or failure.

---

## The MCP Lifecycle Gotcha

This one cost us a multi-hour debugging session, so it's worth highlighting.

MCP servers run as subprocesses of the AI CLI. When you start Claude Code, it spawns the MCP server process. That process lives for the entire CLI session. Here's the catch: a **session restart** (which happens during context compaction when the conversation gets long) does NOT restart the MCP subprocess. The MCP process keeps running with whatever code it loaded at CLI startup.

This means if you rebuild the MCP server (`npm run build`) while an agent session is active, the running session still uses the old code. Only a full CLI exit and relaunch loads the new binary.

This is not a bug. It's the correct behavior - MCP servers are expected to be stable processes that outlive individual conversations. But it creates a trap during development: you change a tool, rebuild, test it, and the old behavior persists. The fix is always the same: exit the CLI, relaunch.

A related issue: Node.js caches modules at process start. If you modify a library that the MCP server imports, the cached version persists until the process restarts. Same root cause, different symptom.

We now include this in our developer onboarding docs with a simple rule: **after any MCP server change, restart the CLI.**

---

## Why MCP Beats Prompt Engineering

Before MCP, the alternative was prompt engineering: paste API documentation into the system prompt, describe the expected request format, and hope the agent constructs valid HTTP requests. This works surprisingly well for simple cases, but breaks down in production:

**Validation.** A Zod schema rejects bad input before the API call. A system prompt instruction like "the status field must be one of: in_progress, blocked, done" gets ignored roughly 5% of the time. Over hundreds of daily tool calls, that 5% creates real problems.

**Discoverability.** MCP tools show up in `claude mcp list`. The agent can inspect the tool list and schemas. System prompt instructions get compressed, truncated, or buried in context as the conversation grows.

**Reliability.** An MCP tool either succeeds or returns a structured error. An agent constructing a `curl` command from a system prompt might get the URL wrong, forget a header, or misformat the JSON body. Each of these failures requires a retry cycle that wastes time and context window.

**Composability.** A single MCP tool can call the filesystem, shell out to `gh`, and hit an HTTP API. System prompt engineering would require the agent to chain three separate actions and handle intermediate failures. The tool does this internally and returns a unified result.

**Maintainability.** Tool changes go through TypeScript compilation, Zod schema validation, and test suites. System prompt changes go through... a text diff review and manual testing.

The tradeoff is real: MCP requires building and maintaining a server process. For a single tool that calls a single API, prompt engineering might be simpler. But for a workflow orchestration system with 11 tools, multiple data sources, and fleet-wide deployment, MCP is the right abstraction.

---

## What We'd Do Differently

**Start with MCP from day one.** We spent weeks on the bash-script-with-skills approach before migrating. The migration itself took two days. We would have saved time overall by starting with MCP, even for the initial two-tool prototype.

**Invest in the API client layer early.** Our first version had inline `fetch` calls in each tool. Extracting the API client class took a refactoring pass that touched every tool. Having a dedicated client from the start would have saved churn.

**Budget SOD output from the beginning.** Our initial SOD tool returned everything - full document contents, all enterprise notes, complete handoff history. It consumed a third of the context window before the agent did any work. We retrofitted a budget system (12KB cap on enterprise notes, metadata-only document delivery) that reduced SOD token consumption by 96%. This should have been a design constraint from day one.

**Test the MCP protocol layer, not just the tool functions.** Our unit tests call `executePreflight()` directly, bypassing the MCP message framing. This means we've never caught a bug in the `ListToolsRequestSchema` handler or the tool name routing in the `switch` statement through automated tests. A small integration test that sends actual MCP messages over stdio would close this gap.

The MCP server is now the single most impactful piece of infrastructure we've built. It turns "start a coding session" from a five-minute setup ritual into a single command that gives the agent full context in under two seconds. If you're building tooling for AI coding agents, MCP is where to start.
