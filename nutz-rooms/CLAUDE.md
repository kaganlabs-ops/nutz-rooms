# NUTZ Rooms

Voice AI that talks like Kagan Sumer, founder of Gorillas. Built with Next.js, ElevenLabs voice, and Claude for intelligence.

## What is NUTZ

NUTZ is a voice-first AI assistant with Kagan's personality - direct, no bullshit, startup-focused. It:
- Talks like Kagan texts (short, lowercase, "u" "r" "ur")
- Shares Kagan's real stories (Gorillas, N26 at -5-8k euros, flyers in mailboxes)
- Pushes users toward action with "ONE THING" focus
- Creates artifacts (one-pagers, MVP scopes, action lists) during voice calls
- Tracks commitments and follows up

## Key Files

### Core Configuration
- `/package.json` - Next.js 16, React 19, ElevenLabs, Anthropic SDK, Zep for memory
- `/src/lib/openai.ts` - System prompts for Kagan's personality (text and voice modes)

### Voice Flow
- `/src/components/VoiceCall.tsx` - Main voice call UI, ElevenLabs WebSocket connection, transcript handling
- `/src/app/api/voice-context/route.ts` - Fetches user memory and commitments before voice call starts
- `/src/app/api/voice-save/route.ts` - Saves transcript to Zep after call ends

### Artifact Flow
- `/src/app/api/create-artifact/route.ts` - Generates Kagan-style documents during voice calls using Claude

### Commitment Flow
- `/src/lib/commitments.ts` - Commitment types, deadline parsing, localStorage + API storage

## Architecture

### Voice Flow
1. User opens VoiceCall component
2. `voice-context` API fetches from Zep: user memory, recent conversations, active commitments
3. ElevenLabs WebSocket connects with dynamic variables (opening_message, zep_context)
4. During call: transcript updates, ONE THING detection, artifact triggers
5. On end: `voice-save` API persists transcript to Zep thread

### Artifact Flow
1. VoiceCall detects trigger phrases ("got you, working on it", "on it, give me a sec")
2. Calls `/api/create-artifact` with conversation transcript
3. Claude generates Kagan-style document (filled in, not templates, with deadlines)
4. Artifact appears in UI for user to view/copy

### Commitment Flow
1. VoiceCall detects commitment triggers ("done", "locked in", "bet")
2. Extracts commitment + deadline from Kagan's previous message
3. Saves to localStorage + API on call end
4. Next call: voice-context includes commitments for Kagan to check in

## Running the Project

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Start production
npm start
```

### Environment Variables
```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
ZEP_API_KEY=
```

## Key Prompts

### Kagan Text Personality
`/src/lib/openai.ts` - `KAGAN_SYSTEM_PROMPT`
- How he talks (short, lowercase, specific emojis)
- Matching energy rules
- His stories (Gorillas, Ronnie, 5 euro bill)
- ONE THING pinning
- GIF usage rules

### Kagan Voice Personality
`/src/lib/openai.ts` - `KAGAN_VOICE_PROMPT`
- Same personality adapted for speech (no "u"/"r", more filler words)
- Artifact creation triggers
- Story sharing guidance
- Commitment tracking instructions

### Artifact Generation
`/src/app/api/create-artifact/route.ts` - `KAGAN_ARTIFACT_PROMPT`
- Kagan's 5 principles (ONE THING, First Principles, Tight Deadlines, Demo Mentality, Math Not Vibes)
- Rules: fill in details, take stances, end with today actions
- Good vs bad artifact examples

## Testing

```bash
# Test artifact quality (10 scenarios)
npx tsx scripts/test-artifact-quality.ts

# Outputs saved to test-outputs/
```

## Key Patterns

### ONE THING Detection
VoiceCall watches for "ONE THING:" in Kagan's speech, extracts and pins the action item.

### Artifact Triggers
Detects intent phrases like:
- "working on it"
- "got you"
- "let me put something together"

### Commitment Triggers
Detects user confirmation phrases:
- "done", "locked in", "bet"
- "deal", "i commit", "on it"

### Session Context
- `sessionStorage.ts` tracks session metadata (count, last timestamp, last ONE THING)
- Personalized openers based on time since last session and user interests

## Phase 5: Agent Execution

Kagan can now DO things, not just advise. Works in both **chat** and **voice**.

### Architecture
- **Chat**: Claude Sonnet for conversation, Claude Opus (agent) for execution
- **Voice**: GPT-4o-mini (ElevenLabs) for conversation, Claude Opus (agent) for execution
- **Agent Brain**: Claude Opus with tools (web_search, deploy_page, create_document)

### Agent Files
- `/src/app/api/agent/route.ts` - Main agent endpoint with Claude Opus + tools
- `/src/lib/tools/deploy-page.ts` - Vercel deployment tool

### Agent Tools (Opus decides which to use)
1. **web_search** - Research competitors, market, validation
2. **deploy_page** - Build and deploy working code (HTML apps, prototypes, demos)
3. **create_document** - Generate markdown docs (clarity, MVP scope, plans)

### How It Works

**In Chat** (`/api/chat`):
1. User asks for something
2. Kagan responds with intent ("gonna build you a prototype")
3. Chat detects create intent, calls `/api/agent`
4. Agent (Opus) decides: deploy_page or create_document
5. Returns deployed URL or document to user

**In Voice** (`VoiceCall.tsx`):
1. User asks for something
2. Kagan says trigger phrase ("let me build you something")
3. VoiceCall detects trigger, fires async request to `/api/agent`
4. Conversation continues (non-blocking)
5. Result arrives, shown in UI

### Trigger Detection

**Build triggers** (→ deploy_page):
- "gonna build", "let me build", "building you"
- "let me make you", "let me spin up"
- "html prototype", "let me create"

**Document triggers** (→ create_document):
- "let me put together some clarity"
- "let me organize", "putting together a plan"
- "let me outline", "let me draft"

**Research triggers** (→ web_search):
- "let me look into that"
- "let me research", "checking now"

### Environment Variables
```
VERCEL_TOKEN=    # For page deployment
```

### Testing Agent
```bash
# Test deploy (builds working code)
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"task":"Build a workout tracker prototype","context":"User wants app for personal trainers"}'

# Test document (creates markdown)
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"task":"Create clarity doc for user priorities","context":"User has 5 projects"}'

# Test research
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"task":"Research workout tracking apps","context":"User wants to build gym app"}'
```

## Phase 6: Modular Architecture

### Core Flow
```
User message → /api/chat → Skills injection → Claude → Response
                              ↓
                         (if build trigger)
                              ↓
                        /api/agent → Tools → Deploy/Document
```

### Key Files
```
src/lib/agent/
├── index.ts           # Agent class (chat, voiceChat, tool loop)
├── tool-registry.ts   # Register and execute tools
└── skill-loader.ts    # Load skills from markdown

src/lib/creators/
└── kagan.ts           # CreatorConfig for Kagan

src/lib/skills/
├── business/          # pitch-deck, fundraising, business-model, go-to-market
├── development/       # react-nextjs
├── design/            # ui-ux
└── content/           # landing-page, copywriting

src/lib/tools/
├── index.ts           # Register all tools
└── deploy-page.ts     # Vercel deployment

src/lib/integrations/
├── fal.ts             # FAL AI (images, video, audio)
└── composio.ts        # 50+ apps (Gmail, Calendar, Notion, etc.)

src/types/
└── index.ts           # All contracts (Tool, Skill, CreatorConfig, etc.)
```

### Adding a Creator
1. Create `src/lib/creators/{name}.ts`
2. Export `CreatorConfig` matching `types/index.ts`
3. Define: personality, skills, tools, referrals
4. Agent loads it automatically

### Adding a Skill
1. Create `src/lib/skills/{category}/{name}.md`
2. Frontmatter: name, slug, description, triggers
3. Content: expertise in creator's voice
4. Auto-injects when message matches triggers

### Adding a Tool
1. Add to `src/lib/tools/index.ts`
2. Match `Tool` contract from `types/index.ts`
3. Register with `toolRegistry.register()`
4. Available to agent immediately

### Environment Variables
```
# Core
ANTHROPIC_API_KEY=
ZEP_API_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=

# Integrations
FAL_KEY=              # Image/video generation
COMPOSIO_API_KEY=     # 50+ app connections
VERCEL_TOKEN=         # Page deployment
REDIS_URL=            # Build status tracking
```

### Success Metrics
- Onboarding: < 1 hour to publish
- Tool reliability: > 95% (top 10)
- Delegation accuracy: > 90%
- D30 retention: > 40%

## Current Status

See `docs/PLAN.md` for execution status.

---

## Behavioral Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
