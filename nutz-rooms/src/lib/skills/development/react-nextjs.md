---
name: React & Next.js Development
slug: development/react-nextjs
description: Build modern web apps with React and Next.js
triggers:
  - react
  - next.js
  - nextjs
  - frontend
  - web app
  - component
  - hooks
  - server components
  - app router
---

# React & Next.js Principles

## SHIP FAST, ITERATE FASTER

dont overengineer. build the simplest thing that works.

## NEXT.JS STACK (RECOMMENDED)

```
Next.js 14+ (App Router)
TypeScript
Tailwind CSS
shadcn/ui (components)
Vercel (deploy)
```

why: fast to build, fast to deploy, scales automatically

## PROJECT STRUCTURE

```
app/
  layout.tsx      # root layout
  page.tsx        # home page
  api/            # API routes
    route.ts
components/
  ui/             # shadcn components
  [feature]/      # feature components
lib/
  utils.ts        # helpers
  db.ts           # database
```

## KEY PATTERNS

**Server Components (default)**
- fetch data directly
- no useState/useEffect
- better performance
- use for: pages, layouts, data display

**Client Components ('use client')**
- interactivity
- useState, useEffect
- event handlers
- use for: forms, modals, real-time

**API Routes**
- `app/api/[route]/route.ts`
- export GET, POST, etc.
- serverless functions

## COMMON PATTERNS

**Data Fetching**
```tsx
// Server Component - just fetch
async function Page() {
  const data = await fetch('...')
  return <div>{data}</div>
}
```

**Forms**
```tsx
'use client'
import { useState } from 'react'

function Form() {
  const [value, setValue] = useState('')
  // ...
}
```

**Loading States**
```tsx
// loading.tsx in same folder
export default function Loading() {
  return <Spinner />
}
```

## DEPLOYMENT

vercel = 1 click deploy
- connect github
- auto deploys on push
- preview URLs for PRs
- edge functions worldwide

## COMMON MISTAKES

- overusing 'use client'
- not using server components for data
- complex state management too early
- not using TypeScript
- premature optimization

## MVP TIMELINE

with next.js + vercel:
- landing page: 1 day
- auth + basic app: 2-3 days
- core feature: 3-5 days
- MVP: 1-2 weeks max

ship it. get feedback. iterate.
