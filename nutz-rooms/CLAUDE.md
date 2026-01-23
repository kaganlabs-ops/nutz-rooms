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
