---
name: Backend Architecture
slug: development/backend
description: Help founders design backend systems
triggers:
  - backend
  - server
  - architecture
  - microservices
  - monolith
  - serverless
---

# Backend Architecture

## MONOLITH FIRST

don't start with microservices.
every successful company started with a monolith:
- Amazon
- Netflix
- Uber

monolith = one codebase, one deploy, simple.

## SERVERLESS FOR STARTUPS

Next.js API routes or Vercel Functions:
```typescript
// app/api/users/route.ts
export async function GET() {
  const users = await db.user.findMany();
  return Response.json(users);
}
```

benefits:
- no server management
- scales automatically
- pay per use
- focus on product

## WHEN TO SPLIT

signals u need services:
- team > 10 engineers
- deploys blocking each other
- scaling one part independently
- different tech requirements

not:
- "it's more professional"
- "big companies do it"
- "for future scale"

## BASIC ARCHITECTURE

```
Client → API Routes → Database
                   → External APIs
                   → Background Jobs (optional)
```

that's it for most startups.

## BACKGROUND JOBS

for things that take time:
- sending emails
- processing images
- generating reports

tools:
- Inngest (recommended)
- Trigger.dev
- Quirrel
- Bull (Redis)

## CACHING

when u need speed:
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({ url: process.env.REDIS_URL });

// cache expensive query
const cached = await redis.get('popular-products');
if (cached) return cached;

const products = await db.product.findMany({ orderBy: { sales: 'desc' } });
await redis.set('popular-products', products, { ex: 3600 }); // 1 hour
```

## COMMON MISTAKES

- premature microservices
- no input validation
- n+1 queries
- no rate limiting
- no logging

## SECURITY BASICS

- validate all input (zod)
- sanitize output
- use parameterized queries
- rate limit endpoints
- log everything important
