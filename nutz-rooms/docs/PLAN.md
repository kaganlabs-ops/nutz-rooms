# NUTZ Execution Plan

## End Goal
1. Fast Onboarding - Creator → AI Agent in < 1 hour
2. Capable Agents - 100+ tools, 40+ skills, reliable
3. Delegation - Kagan → Mike → Sarah seamlessly
4. Retention - 40% D30

---

## Week 1: Unify

| Task | Status |
|------|--------|
| Skills injection in chat route | ✅ |
| Update CLAUDE.md with architecture | ✅ |
| Create docs/PLAN.md | ✅ |
| Audit types/index.ts | ✅ |
| Agent class accepts CreatorConfig | ✅ |
| Create /api/chat-v2 (shadow) | ✅ |
| Test parity | ✅ |
| Switch routes | ✅ |

**Note:** `/api/chat-legacy` available for rollback until Feb 2, 2026.

---

## Week 2: Capabilities

| Task | Status |
|------|--------|
| web_search reliable | ✅ (Claude built-in) |
| generate_image (FAL) | ✅ |
| edit_image (FAL) | ✅ |
| gmail_send (Composio) | ✅ |
| gmail_read (Composio) | ✅ |
| calendar_list (Composio) | ✅ |
| calendar_create (Composio) | ✅ |
| notion_create (Composio) | ✅ |
| scrape_url (Firecrawl) | ✅ |
| create_slides (pptxgenjs) | ✅ |
| Complete 36 skills | ✅ (36/36) |
| OAuth UI (/settings) | ✅ |

**Tools registered:** 19 total (3 built-in + 7 FAL + 7 Composio + 1 Firecrawl + 1 Slides)

---

## Weeks 3-4: Onboarding

| Task | Status |
|------|--------|
| WhatsApp processor | ⏳ |
| YouTube processor | ⏳ |
| Twitter processor | ⏳ |
| Voice processor | ⏳ |
| Combined analyzer | ⏳ |
| Config generator | ⏳ |
| Onboarding UI (5 steps) | ⏳ |

---

## Week 5: Delegation

| Task | Status |
|------|--------|
| Mike creator (fitness) | ⏳ |
| Sarah creator (mindfulness) | ⏳ |
| Referral detection | ⏳ |
| Context handoff | ⏳ |

---

## Week 6: Retention

| Task | Status |
|------|--------|
| Commitments (extract/store/remind) | ⏳ |
| Analytics events | ⏳ |
| Proactive check-ins | ⏳ |

---

## Types Audit

### Existing (types/index.ts)
- ✅ Tool, ToolParameter, ToolContext, ToolResult
- ✅ Skill
- ✅ CreatorConfig, Referral
- ✅ ChatOptions, ChatMessage, BrainFact, SessionMetadata
- ✅ AgentResponse, ToolCallResult
- ✅ ChatResponse

### Missing (add when needed)
- ⏳ WhatsAppAnalysis, YouTubeAnalysis, TwitterAnalysis, VoiceAnalysis (Week 3)
- ⏳ CombinedAnalysis (Week 3)
- ⏳ Commitment (Week 6 - currently in lib/commitments.ts)
- ⏳ Job, JobRun (if async work needed)
- ⏳ AnalyticsEvent (Week 6)

---

## Legend
- ✅ Complete
- 🔄 In Progress
- ⏳ Not Started
