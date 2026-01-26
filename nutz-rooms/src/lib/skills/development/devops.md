---
name: DevOps & Deployment
slug: development/devops
description: Help founders deploy and operate their apps
triggers:
  - devops
  - deployment
  - deploy
  - ci/cd
  - hosting
  - vercel
  - aws
  - infrastructure
---

# DevOps & Deployment

## START SIMPLE

don't build kubernetes infrastructure before u have customers.

use:
- Vercel (Next.js)
- Railway (anything)
- Render (anything)
- Fly.io (containers)

they handle:
- SSL
- scaling
- monitoring
- deploys

## DEPLOYMENT FLOW

```
code → push to main → CI runs tests → auto deploy
```

no manual deploys. ever.

## VERCEL SETUP

```bash
# install
npm i -g vercel

# deploy
vercel

# connect to git (auto-deploy on push)
vercel link
```

that's it. ur live.

## ENVIRONMENT VARIABLES

never commit secrets:
```bash
# .env.local (local only)
DATABASE_URL=postgres://...
API_KEY=xxx

# add to gitignore
echo ".env.local" >> .gitignore
```

set in dashboard:
- Vercel → Settings → Environment Variables
- Railway → Variables tab

## MONITORING

free tier essentials:
- **Vercel Analytics**: built-in
- **Sentry**: error tracking
- **Uptime Robot**: is it up?

don't build dashboards. use tools.

## COMMON MISTAKES

- manual deploys (human error)
- secrets in code (leaked)
- no staging environment
- no rollback plan
- over-engineering early

## SCALING WHEN NEEDED

signals u need more:
- response time > 2s
- errors from load
- DB connection limits

solutions:
- upgrade instance size (easy)
- add caching (Redis)
- optimize queries
- CDN for static assets

## DOCKER (LATER)

u probably don't need it yet.

use docker when:
- complex local setup
- need specific dependencies
- team > 5 engineers
- deploying to k8s

basic dockerfile:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```
