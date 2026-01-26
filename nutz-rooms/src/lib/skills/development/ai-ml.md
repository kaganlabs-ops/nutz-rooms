---
name: AI & ML Integration
slug: development/ai-ml
description: Help founders integrate AI into their products
triggers:
  - ai
  - artificial intelligence
  - machine learning
  - llm
  - gpt
  - claude
  - openai
  - embeddings
---

# AI & ML Integration

## DON'T BUILD ML

u don't need to train models.
use APIs:
- Claude (Anthropic)
- GPT-4 (OpenAI)
- Gemini (Google)

focus on product, not ML infrastructure.

## WHAT AI IS GOOD FOR

- text generation / summarization
- classification / tagging
- search / recommendations
- image generation
- code generation
- conversation

## BASIC INTEGRATION

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1000,
  messages: [
    { role: 'user', content: 'Summarize this article: ...' }
  ]
});

const summary = response.content[0].text;
```

## PROMPT ENGINEERING

### Be specific
bad: "write something about marketing"
good: "write 3 email subject lines for a SaaS product launch targeting CTOs"

### Give examples
```
Convert these reviews to sentiment:
"Great product!" → positive
"Terrible service" → negative
"It's okay" → neutral

Now classify: "Love it!"
```

### Set constraints
"respond in JSON format"
"keep it under 100 words"
"use bullet points"

## RAG (RETRIEVAL)

for answering questions about ur data:

1. embed ur docs (vector database)
2. user asks question
3. find relevant docs
4. send to LLM with context

tools:
- Pinecone
- Supabase (pgvector)
- Weaviate

## IMAGE GENERATION

```typescript
import * as fal from '@fal-ai/serverless-client';

const result = await fal.subscribe('fal-ai/flux/schnell', {
  input: { prompt: 'a modern logo for a fitness app' }
});
```

use for:
- marketing images
- avatars
- product mockups

## COMMON MISTAKES

- no rate limiting (expensive)
- no caching (slow + expensive)
- raw LLM output to users (hallucinations)
- training custom models (waste of time)
- no error handling

## COST CONTROL

- cache common queries
- use smaller models when possible
- set max_tokens
- batch requests
- monitor usage
