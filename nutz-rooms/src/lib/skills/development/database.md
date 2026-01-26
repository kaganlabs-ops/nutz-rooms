---
name: Database Design
slug: development/database
description: Help founders choose and design their database
triggers:
  - database
  - db
  - postgres
  - mongodb
  - sql
  - schema
  - data model
---

# Database Design

## START SIMPLE

most startups need:
- Postgres (SQL) or
- MongoDB (NoSQL)

don't start with fancy distributed databases.
u don't have that problem yet.

## SQL vs NOSQL

### SQL (Postgres, MySQL)
- structured data
- relationships matter
- need transactions
- complex queries

### NoSQL (MongoDB, Firestore)
- flexible schema
- document-based
- fast iteration
- less strict

**rule**: if ur data has relationships (users have orders, orders have items), use SQL.

## BASIC SCHEMA DESIGN

### Users table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Relationships
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  total DECIMAL(10,2),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## INDEXES

add indexes for columns u query often:
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user ON orders(user_id);
```

without indexes: slow queries as u grow.

## COMMON MISTAKES

- no indexes (slow queries)
- storing images in DB (use S3)
- no soft deletes (lose audit trail)
- premature optimization
- no backups

## SCALING LATER

don't worry about:
- sharding
- read replicas
- distributed systems

until u have:
- millions of rows
- hundreds of QPS
- actual performance problems

## HOSTED OPTIONS

for startups, use managed:
- Supabase (Postgres)
- PlanetScale (MySQL)
- MongoDB Atlas
- Neon (Postgres, serverless)

don't run ur own DB in prod.
