# Video-Scroll

**Create once. Publish everywhere.** — AI-assisted video workflow for YouTube (16:9) and Instagram Reels (9:16).

## Phase 1 (current)

- Topic → AI script & scenes (demo mode without OpenAI key)
- FFmpeg render: landscape MP4 + portrait crop
- Publish stubs for YouTube + Instagram (OAuth in Phase 2)
- Project dashboard with PostgreSQL

## Prerequisites

- Node.js 20+
- Docker Desktop (PostgreSQL + Redis)
- FFmpeg on PATH

## Quick start

```powershell
# 1. Clone & install
cd Video-Scroll
npm install

# 2. Environment
copy .env.example .env

# 3. Start database
npm run docker:up

# 4. Run migrations
npm run db:migrate

# 5. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Health check

```powershell
curl http://localhost:3000/api/health
```

Returns FFmpeg + database status.

## Project structure

```
src/
├── app/              # Next.js pages & API routes
├── components/       # UI
├── lib/
│   ├── ai/           # Script generation
│   ├── media/        # FFmpeg render pipeline
│   └── publish/      # YouTube & Instagram upload
└── generated/prisma/ # Database client
```

## Environment variables

See `.env.example` for all options. Minimum for local dev:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `OPENAI_API_KEY` | Optional — enables real AI scripts |
| `OUTPUT_DIR` | Where rendered MP4s are saved |

## Workflow

1. **Create** — enter a topic at `/create`
2. **Generate** — AI builds script + scenes
3. **Render** — FFmpeg creates YouTube + Reel files in `output/`
4. **Publish** — stubs ready; wire OAuth next

## Git on Windows vs WSL

Clone with **PowerShell Git** into OneDrive paths. WSL `/mnt/c` + OneDrive often breaks `chmod` on `.git`.

## License

Private — abhaygha/Video-Scroll
