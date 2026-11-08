\# N-Health Professional Restructure — Master Prompt



You are a senior full-stack architect. Your task is to \*\*professionally restructure and rewrite\*\* the N-Health monorepo without breaking any functionality.



\## CONTEXT



The current repo has an older layout:

\- `backend/` (Node.js + Express + Prisma)

\- `admin-web/` (React + Vite)

\- `mobile/` (React Native + Expo)



We are migrating to a modern monorepo with `apps/` and `packages/` separation.



\## OBJECTIVES



1\. \*\*Restructure\*\* to the target layout (see below).

2\. \*\*Rewrite\*\* all code to professional standards:

&#x20;  - Strict TypeScript (no `any`)

&#x20;  - ESLint + Prettier clean

&#x20;  - Consistent naming (camelCase for vars, PascalCase for types/components)

&#x20;  - JSDoc comments on public functions

&#x20;  - Error handling with typed exceptions

&#x20;  - Environment variables validated at startup (zod)

&#x20;  - Consistent logging (pino for backend, console wrapper for mobile)

3\. \*\*Add missing config files\*\*:

&#x20;  - `.editorconfig`, `.prettierrc`, `.nvmrc`, `.gitattributes`

&#x20;  - Root `package.json` with pnpm workspaces

&#x20;  - `turbo.json` for build orchestration

&#x20;  - `.github/workflows/` for CI

4\. \*\*Rewrite README.md\*\* professionally with:

&#x20;  - Banner with badges

&#x20;  - Clear setup instructions

&#x20;  - Architecture diagram

&#x20;  - Contributing guide

5\. \*\*Preserve 100% functionality\*\*. Every endpoint, screen, and feature must still work.



\## TARGET STRUCTURE



\[Insert the target structure from the prompt]



\## RULES



\- \*\*DO NOT\*\* delete any feature.

\- \*\*DO NOT\*\* change API contracts (endpoints, request/response shapes).

\- \*\*DO\*\* rename files to match their exports.

\- \*\*DO\*\* split large files (>500 lines) into smaller modules.

\- \*\*DO\*\* extract shared code into `packages/shared-types` and `packages/shared-utils`.

\- \*\*DO\*\* use absolute imports (`@nhealth/shared-types`) over relative (`../../..`).

\- \*\*DO\*\* add tests where none exist.

\- \*\*DO\*\* update all import paths after moving files.



\## EXECUTION ORDER



1\. Create new directory structure.

2\. Move files to their new locations.

3\. Update imports in every affected file.

4\. Rewrite each file to professional standards.

5\. Add missing configs and docs.

6\. Run linters and type-checkers.

7\. Fix all errors.

8\. Update README and CHANGELOG.



\## VERIFICATION



Before finishing, run:

\- `pnpm install` at root — must succeed

\- `pnpm -r typecheck` — must pass

\- `pnpm -r lint` — must pass

\- `pnpm -r build` — must pass

\- `docker compose -f infrastructure/docker/docker-compose.yml up -d` — must start



Report any failures with the exact error and fix them.



\## DELIVERABLE



A fully professional, production-ready monorepo, ready to push to GitHub.

