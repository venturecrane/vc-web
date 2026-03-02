---
title: 'Taking Product Development Offline with Local LLMs'
date: 2026-03-02
description: 'We set up four specialized local models on a fanless laptop for offline product work. Here is what we built, what works, and what we are measuring.'
author: 'Venture Crane'
tags: ['infrastructure', 'workflow', 'local-llm']
draft: false
---

The development lab runs AI agent sessions roughly 18 hours a day across multiple machines. The agents have access to frontier models, a full MCP toolchain, context management, and a fleet of Apple Silicon hardware. When the founder is at a workstation, ideas move from thought to implementation in minutes.

The problem is the other hours. Driving. Sitting at auction houses. Coffee shops with unreliable WiFi. Ideas happen everywhere, but acting on them requires cloud AI and a network connection. The gap between having a product idea in the field and getting back to a networked machine is dead time. For a solo founder running multiple ventures, dead time compounds.

We decided to close that gap with local models running on hardware that was already in the bag.

---

## The Hardware

An M1 MacBook Air with 16GB of unified memory. Fanless design, 68 GB/s memory bandwidth, roughly 10 hours of battery. The lack of a fan is both a feature and a constraint: silent operation anywhere, but thermal throttling sets a practical ceiling on sustained inference.

That ceiling, in practice: 7-8B parameter models at Q4 quantization. One model loaded at a time. Around 20 consecutive prompts before thermal throttling kicks in. After that, a 5-10 minute cooldown or a task switch and it recovers. This is not a workstation replacement. It is a capture device.

---

## The Models

We set up [Ollama](https://ollama.com) with four specialized models, each with a custom system prompt tuned to our stack. The key decision was specialization over generality. A single general-purpose 8B model tries to be everything and is mediocre at all of it. Four focused models, each pre-loaded with our conventions, eliminate the re-explaining that wastes context window and produces drift.

| Alias        | Base Model        | Temp | Purpose                                            |
| ------------ | ----------------- | ---- | -------------------------------------------------- |
| `field-prd`  | Qwen3 8B          | 0.7  | Product requirements documents                     |
| `field-code` | Qwen 2.5 Coder 7B | 0.3  | TypeScript / Cloudflare Workers code               |
| `field-wire` | Qwen3 8B          | 0.5  | React / Tailwind components from descriptions      |
| `field-arch` | DeepSeek-R1 8B    | 0.4  | Architecture decisions with step-by-step reasoning |

Plus `llava:7b` for converting paper sketches and whiteboard photos into component code via the laptop camera.

**Why these specific models.** Qwen3 8B handles structured document generation well at this parameter count. It follows templates consistently. Qwen 2.5 Coder 7B is purpose-built for code generation and respects conventions baked into its system prompt more reliably than general models. DeepSeek-R1 8B does chain-of-thought reasoning natively, which matters for architecture decisions where you want the model to think through constraints before committing to an answer.

**What the system prompts contain.** Each model already knows the tech stack: Next.js or Astro with Tailwind on the frontend, Cloudflare Workers with Hono on the backend, D1/KV/R2 for storage. The PRD writer knows our requirements template: problem statement, hypothesis, kill criteria, acceptance criteria, agent brief. The code model knows our file layout conventions, response shapes, and type patterns. No re-explaining every session.

Temperature choices are deliberate. The code model runs cold (0.3) because we want deterministic, convention-following output. The PRD writer runs warmer (0.7) because requirements writing benefits from some creative variation. The architect sits in between (0.4) where reasoning is structured but not rigid.

---

## The Workflow

Shell aliases drop you into interactive sessions with the right model. Each one is a custom Ollama Modelfile: a base model plus a system prompt plus tuned parameters, registered as a named model.

```bash
field-prd    # PRD writer - structured requirements docs
field-code   # Code generation - Workers/Hono/D1
field-wire   # Screen description to React/Tailwind component
field-arch   # Architecture decisions with chain-of-thought
field-vision # Photo/sketch analysis via multimodal model
```

A typical field session:

```bash
# Start a PRD for a new feature
field-prd "Write a PRD for expense splitting between two households" \
  > ~/field-work/project-a/prds/expense-splitting-v1.md

# Get architecture guidance
field-arch "Should I use D1 or KV for storing split configurations? \
  They update monthly and need to be queryable by household."

# Generate the route handler
field-code "Write a Hono route handler for POST /api/splits \
  that creates a new expense split configuration in D1" \
  > ~/field-work/project-a/code/splits-route.ts

# Convert a napkin sketch to a component
field-vision --images ~/photo.jpg \
  "Convert this wireframe to a React component with Tailwind"
```

Output gets saved to organized directories, one per project, with subdirectories for PRDs, code, wireframes, migrations, and session logs. A session log template tracks what was generated, which models were used, and estimates quality for lab integration.

**Back at the lab**, files get copied into the real repository and Claude Code refines them against the actual codebase: fixing imports, aligning with existing patterns, running the test suite. The field output is a head start, not a finished product.

---

## The 8K Context Configuration

This is the biggest behavioral shift from working with frontier models. Cloud models give you 100K+ context windows. You can paste an entire file and say "refactor this." These models support up to 32K tokens natively, but we configured them to 8,192 tokens to stay within the M1 Air's thermal budget. That is roughly 6,000 words of combined input and output.

The practical effect: you describe what you want instead of showing what you have. "Write a Hono route handler that creates an expense split in D1" works. "Here is my existing codebase, add expense splitting" does not fit.

This turns out to be a useful discipline. Prompts become tighter. Requirements become more explicit. You cannot lean on the model to figure out what you mean from surrounding code - you have to say it. The output is more predictable as a result, even if narrower in scope.

---

## Honest Quality Assessment

We are not going to pretend 8B models compete with frontier models. They do not. Here is what we expect based on initial testing:

| Output Type      | Expected Quality           | What Needs Lab Work                                             |
| ---------------- | -------------------------- | --------------------------------------------------------------- |
| PRDs             | 80-90% usable              | Structure is solid, details need refinement                     |
| Route handlers   | 60-80% correct             | Imports and file paths will be wrong, types need checking       |
| React components | 70-85% structural accuracy | Tailwind classes usually right, state logic needs review        |
| D1 migrations    | 50-70% correct             | Schema is directional, constraints and indexes need manual work |

The code model produces syntactically correct TypeScript that follows our conventions because the system prompt specifies them. What it gets wrong: import paths (it does not know the actual project structure), peer dependencies between files, and edge cases in error handling. These are exactly the things Claude Code catches in 15-30 minutes of lab refinement.

The PRD writer is the strongest performer. Structured document generation at 8B parameters is genuinely useful. The model follows the template, fills in reasonable content, and produces something that reads like a first draft rather than a hallucination. Kill criteria and acceptance criteria still need human judgment, but the structure and framing save significant time.

Migrations are the weakest. D1 schema design requires understanding the full data model, and an 8K context window cannot hold enough of it to make good relational decisions. We use these as starting points, not as anything close to final.

---

## What Surprised Us

**Setup time was trivial.** Pulling four models, creating custom Modelfiles, configuring aliases, building the directory structure, and running a smoke test took under 15 minutes. Most of that was download time over WiFi. The actual configuration was maybe 3 minutes of file creation.

**System prompts make a disproportionate difference at small parameter counts.** A vanilla Qwen3 8B prompt produces generic, vaguely helpful output. The same model with a 200-word system prompt specifying our stack conventions, response format, and file layout patterns produces output that looks like it came from someone who has worked in the codebase before. The delta is much larger than the same system prompt would make on a frontier model, probably because the smaller model has less competing training data to override.

**Thermal management is a real workflow concern.** The M1 Air handles 15-20 prompts comfortably before performance degrades. This maps naturally to the rhythm of thinking through a feature, generating a few artifacts, and moving to the next thing. But it means closing the browser and Docker before field sessions, and accepting cooldown breaks as part of the flow.

**Piping to files changes how you prompt.** When output goes directly to a markdown file instead of a chat window, each prompt becomes a discrete, self-contained unit of work rather than a conversational follow-up. This produces cleaner artifacts. You think more carefully about what you ask for because you are committing the output to a file, not iterating in a chat thread.

---

## What We Would Change

A fifth model for documentation: a dedicated writer with system prompts for ADRs, runbooks, and API docs. We write documentation in the field less than we should, and a `field-doc` alias with our conventions baked in would lower the friction.

The session log template is manual. On the next iteration, we would wrap the aliases in a shell function that auto-logs which model was used, the prompt, and the output path. In practice, manual logs get skipped when things are moving fast.

---

## Kill Criteria

We set a clear signal for ourselves: if less than 50% of field-generated code survives lab refinement after a two-week pilot, we deprioritize the workflow. The overhead of generating, transferring, and refining is not worth it if lab cleanup consistently takes longer than writing from scratch.

The pilot starts with an upcoming trip, several days away from the development lab with real product decisions to make. We will track: artifacts generated per session, survival rate through lab refinement, refinement time per artifact, and whether field-generated PRDs actually get implemented or just get rewritten from scratch.

Total cost of the setup: $0. Ollama is free. The models are open-source with commercial licenses. Inference is local. The only costs are the 15 minutes of setup time and the electricity to charge the laptop.

---

## The Point

These models are not replacing Claude Code or any frontier model for the work that happens in the lab. That is not what they are for. They are capturing momentum.

The difference between "I had an idea while driving" and "I had an idea while driving, and here is a PRD, three route handlers, and a migration ready for lab refinement" is the difference between a note on a phone and a head start on implementation. For a solo founder managing multiple products, that delta compounds across every trip, every errand, every hour away from a workstation.

We will report back after the pilot with real numbers.
