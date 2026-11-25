# Installation Guide - Build Script Workaround

## Issue: pnpm v9 Build Script Security

pnpm v9.x has strict build script validation to prevent malicious packages from running arbitrary code during install.

**Error Message:**
```
ERR_PNPM_IGNORED_BUILDS
Ignored build scripts: @prisma/client, @prisma/engines, esbuild, prisma
```

## Solution

These are legitimate build scripts needed for Prisma and esbuild. Approve them with:

```bash
pnpm install

# When prompted about ignored build scripts, approve them interactively:
pnpm install --interactive-install build-scripts

# OR manually approve specific packages:
pnpm approve-builds @prisma/client @prisma/engines prisma esbuild
```

If interactive mode doesn't work, use:

```bash
# Downgrade pnpm to v8 (simpler, but not recommended for new projects)
npm install -g pnpm@8

# Then reinstall
pnpm install
```

Or use Docker to avoid this issue entirely:

```bash
# Use the provided Docker setup instead
pnpm run docker:up
```

## After Installation

Once dependencies are installed, proceed with:

```bash
# 1. Build backend
cd apps/backend && pnpm build

# 2. Test with Docker
pnpm run docker:up

# 3. Seed data
docker compose exec backend npm run prisma:seed
```

## Why This Happens

- `@prisma/client` needs to generate TypeScript types from schema.prisma
- `prisma` CLI itself needs native binary compilation
- `esbuild` compiles faster than tsc (used in build tools)

All three are legitimate and safe.
