interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface ConversationalReferral {
  creatorId: string
  creatorName: string
  domain: string
  trigger: 'explicit_accept' // User said yes to an offer
}

const CREATOR_MENTIONS: Record<string, string[]> = {
  mike: ['mike', 'my pt', 'my trainer', 'personal trainer', 'this guy mike'],
  sarah: ['sarah', 'meditation person', 'mindfulness coach', 'this girl sarah'],
  kagan: ['kagan', 'startup guy', 'business guy', 'this guy kagan']
}

const OFFER_PHRASES = [
  'hook u up',
  'hook you up',
  'connect u',
  'connect you',
  'intro u',
  'intro you',
  'want me to',
  'should i connect',
  'want to meet',
  'want an intro',
  'introduce you',
  'put u in touch',
  'put you in touch'
]

const ACCEPT_PHRASES = [
  'yes', 'yeah', 'yea', 'yep', 'sure', 'ok', 'okay',
  'please', 'do it', 'lets go', 'lezgo', 'hook me up',
  'connect me', 'intro me', 'id love that', 'thatd be great',
  'that would be great', 'down', 'im down', 'bet', 'sounds good',
  'thatd be sick', 'lets do it', 'hell yeah', 'hell yea',
  'just do it', 'just connect', 'just get', 'get him', 'get her',
  'talk to him', 'talk to her', 'lets talk to'
]

// Direct request patterns that should trigger handoff without an offer
const DIRECT_REQUEST_PATTERNS = [
  /where'?s?\s+(mike|sarah|kagan)/i,
  /get\s+(?:me\s+)?(mike|sarah|kagan)/i,
  /connect\s+(?:me\s+)?(?:to\s+|with\s+)?(mike|sarah|kagan)/i,
  /(?:i\s+)?want\s+(?:to\s+talk\s+to\s+)?(mike|sarah|kagan)/i,
  /talk\s+to\s+(mike|sarah|kagan)/i,
  /let\s+me\s+talk\s+to\s+(mike|sarah|kagan)/i,
  /put\s+me\s+(?:through|on)\s+(?:to\s+|with\s+)?(mike|sarah|kagan)/i,
  /just\s+get\s+(mike|sarah|kagan)/i,
  /can\s+i\s+(?:talk|speak)\s+(?:to|with)\s+(mike|sarah|kagan)/i,
]

/**
 * Detect if a conversational referral should happen based on:
 * 1. Agent recently offered to connect user with someone AND user accepted
 * 2. User directly requested to talk to someone (e.g. "wheres mike", "get me mike")
 */
export function detectConversationalReferral(
  messages: Message[],
  currentCreator: string
): ConversationalReferral | null {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()
  if (!lastUserMsg) return null

  const userMsgLower = lastUserMsg.content.toLowerCase().trim()

  // FIRST: Check for direct requests (e.g. "wheres mike", "get me mike", "talk to sarah")
  for (const pattern of DIRECT_REQUEST_PATTERNS) {
    const match = userMsgLower.match(pattern)
    if (match) {
      const requestedCreator = match[1].toLowerCase()
      if (requestedCreator !== currentCreator) {
        return {
          creatorId: requestedCreator,
          creatorName: requestedCreator.charAt(0).toUpperCase() + requestedCreator.slice(1),
          domain: requestedCreator === 'mike' ? 'Fitness' : requestedCreator === 'sarah' ? 'Mindfulness' : 'Startups',
          trigger: 'explicit_accept'
        }
      }
    }
  }

  // SECOND: Check for offer-acceptance flow (requires at least 2 messages)
  if (messages.length < 2) return null

  const recentAssistantMsgs = messages
    .filter(m => m.role === 'assistant')
    .slice(-3)

  // Check if user's message is an acceptance
  const userAccepted = ACCEPT_PHRASES.some(phrase =>
    userMsgLower === phrase ||
    userMsgLower.startsWith(phrase + ' ') ||
    userMsgLower.startsWith(phrase + '!') ||
    userMsgLower.startsWith(phrase + ',') ||
    userMsgLower.endsWith(' ' + phrase)
  )

  if (!userAccepted) return null

  // Check if agent recently offered a referral
  for (const msg of recentAssistantMsgs) {
    const msgLower = msg.content.toLowerCase()

    const hasOffer = OFFER_PHRASES.some(phrase => msgLower.includes(phrase))
    if (!hasOffer) continue

    // Find which creator was mentioned
    for (const [creatorId, mentions] of Object.entries(CREATOR_MENTIONS)) {
      if (creatorId === currentCreator) continue

      if (mentions.some(m => msgLower.includes(m))) {
        return {
          creatorId,
          creatorName: creatorId.charAt(0).toUpperCase() + creatorId.slice(1),
          domain: creatorId === 'mike' ? 'Fitness' : creatorId === 'sarah' ? 'Mindfulness' : 'Startups',
          trigger: 'explicit_accept'
        }
      }
    }
  }

  return null
}
