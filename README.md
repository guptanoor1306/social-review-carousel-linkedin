# Social Asset Review

Mobile web reviews for Instagram / LinkedIn creative. **Slack** sends the review link and receives summaries.

## Flow

1. **Admin** signs in at `/` → create batch → add assets (upload **or** link) → **Notify Slack**.
2. **Reviewers** open the link → enter name → rate 1–5 + optional feedback.
3. **Post summary** when ready (admin button or `/social-review summary`).

## Local run

```bash
cp .env.example .env   # set ADMIN_PASSWORD, Slack tokens, PUBLIC_BASE_URL
npm install
npm start
```

- Admin: `http://localhost:3000/` — login with `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- Review links: `http://localhost:3000/review/{batchId}?token=…`

## Railway deploy

1. New project → **Deploy from GitHub** (this repo) or `railway up`.
2. Add **PostgreSQL** plugin → Railway sets `DATABASE_URL` automatically.
3. Add **Volume** (optional) mounted at `/data` for uploads if not using external storage:
   - `UPLOADS_PATH=/data/uploads`
   - `DATABASE_PATH=/data/social-voting.db` (only if **not** using Postgres)
4. Variables (Settings → Variables):

| Variable | Value |
|----------|--------|
| `PUBLIC_BASE_URL` | Your Railway URL (`https://….up.railway.app`) |
| `SLACK_BOT_TOKEN` | Bot token |
| `SLACK_APP_TOKEN` | Socket Mode app token |
| `SLACK_SIGNING_SECRET` | Signing secret |
| `ADMIN_USERNAME` | e.g. `admin` |
| `ADMIN_PASSWORD` | Strong password |
| `SESSION_SECRET` | Random string |
| `DATABASE_URL` | From Postgres plugin (recommended) |

5. Redeploy. Open `PUBLIC_BASE_URL` and sign in.

**Note:** With Postgres, file uploads are stored on the container filesystem unless you attach a volume at `UPLOADS_PATH`. For production, prefer **link mode** for assets or add a volume / S3 later.

## Slack

- Invite the bot to the channel whose ID you enter in the admin form.
- `/social-review summary [batch_id]` — post aggregated results + reviewer names.

## Auth

Only the **admin UI** and `/api/batches/*` management routes require login. Review pages stay public via `?token=…` on the link.
