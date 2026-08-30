# Delivery Platform — Transfer Snapshot

This archive is a reconstructed snapshot from the mentoring conversation. It contains the application code and schema we designed together; it does NOT contain the old PostgreSQL data, node_modules, dist, generated Prisma client, or migration history from the old laptop.

## Current scope

- NestJS modular monolith
- Prisma 7 + PostgreSQL
- Auth: register/login
- Argon2 password hashing
- JWT access tokens
- Opaque refresh tokens
- Refresh-session persistence + rotation
- JWT Strategy + AuthGuard
- Role metadata + RolesGuard
- Global application error mapping
- Order model + OrderItem model
- Order state transition map and actor checks
- Docker Compose for PostgreSQL

## New laptop setup

1. Copy `.env.example` to `.env`.
2. Put a strong local `JWT_SECRET` in `.env`.
3. Run `npm install`.
4. Run `docker compose up -d postgres`.
5. Run `npx prisma format`.
6. Run `npx prisma validate`.
7. Create the database migration history locally with:
   `npx prisma migrate dev --name init`.
8. Run `npx prisma generate`.
9. Run `npm run build`.
10. Run `npm run start:dev`.

## Important

This snapshot intentionally does not include the old database contents. Existing users/sessions from the old laptop will not exist on the new laptop unless a PostgreSQL dump is restored separately.

Also, treat all tokens shown in chat as compromised; generate fresh credentials/tokens locally.
