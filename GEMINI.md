# Mehwar Flow - Agent Guidelines

## Local Stack Execution Rule

Whenever asked to **run**, **start**, **pull**, or **test** the project, ALWAYS follow this hybrid execution setup:

1. **Docker Infrastructure:**
   - Run ONLY `redis`, `minio`, `minio-init`, and `mailpit` in Docker Compose (`docker compose up -d redis minio minio-init mailpit`).
   - Stop Docker app containers (`web`, `api`, `worker`, `postgres`, `migrate`).

2. **PostgreSQL Database:**
   - ALWAYS connect to the host machine's PostgreSQL server on `localhost:5432`.
   - Use `postgresql://postgres:root@localhost:5432/mehwar` for direct/migration connections.
   - Use `postgresql://mehwar_app:root@localhost:5432/mehwar` for application RLS connections.

3. **Application Services (Local Terminal Processes):**
   - Run API Backend (`@mehwar/api`), Worker (`@mehwar/worker`), and Web Frontend (`@mehwar/web`) as local node/pnpm dev processes (`pnpm --filter <app> dev`) with `.env` loaded.

4. **Skill Reference:**
   - Refer to the `mehwar-run` skill (`.agents/skills/mehwar-run/SKILL.md`) for detailed step-by-step procedures.
