---
name: API Design
slug: development/api-design
description: Help founders design clean, usable APIs
triggers:
  - api
  - api design
  - rest api
  - graphql
  - endpoints
  - api architecture
---

# API Design

## KEEP IT SIMPLE

most startups over-engineer their APIs.
u need CRUD for 3-5 resources, not a "platform."

## REST BASICS

```
GET    /users          → list users
GET    /users/:id      → get one user
POST   /users          → create user
PUT    /users/:id      → update user
DELETE /users/:id      → delete user
```

use nouns, not verbs:
- good: `GET /orders`
- bad: `GET /getOrders`

## RESPONSE FORMAT

consistent structure:
```json
{
  "data": { ... },
  "meta": { "page": 1, "total": 100 },
  "error": null
}
```

or for errors:
```json
{
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

## HTTP STATUS CODES

- 200 OK → success
- 201 Created → new resource
- 400 Bad Request → client error
- 401 Unauthorized → no auth
- 403 Forbidden → no permission
- 404 Not Found → doesn't exist
- 500 Server Error → ur fault

## AUTHENTICATION

### API Keys (simple)
- header: `X-API-Key: xxx`
- good for server-to-server

### JWT (for users)
- header: `Authorization: Bearer xxx`
- token contains user info
- expires, needs refresh

## VERSIONING

always version ur API:
- `/v1/users`
- `/v2/users`

old versions keep working.
new features go in new version.

## COMMON MISTAKES

- no rate limiting (get DDoS'd)
- no pagination (return 10k records)
- inconsistent naming
- no error codes
- breaking changes without versioning

## GRAPHQL vs REST

### Use REST when:
- simple CRUD
- caching matters
- team knows REST

### Use GraphQL when:
- complex nested data
- multiple clients need different shapes
- team knows GraphQL

for most startups: REST is fine.
