# AI Private Teacher Module

Production module integrated into Metatest.

## Setup

1. Run the SQL migration:

```bash
mysql -u USER -p DATABASE < ai-teacher/sql/001_ai_teacher.sql
```

If `ADD COLUMN IF NOT EXISTS` is unsupported on your MySQL version, add these columns manually:

```sql
ALTER TABLE tam24_users
  ADD COLUMN ai_teacher_id INT NULL DEFAULT NULL,
  ADD COLUMN ai_teacher_onboarding_completed TINYINT(1) NOT NULL DEFAULT 0;
```

2. Environment variables (GapGPT — [quickstart](https://gapgpt.app/platform-v2/docs/quickstart)):

```env
# Required — key from GapGPT dashboard
GAPGPT_API_KEY=your_gapgpt_api_key_here
GAPGPT_BASE_URL=https://api.gapgpt.app/v1

# Models: gpt-5.6-luna (test) | gpt-5.6-terra | gpt-5.6-sol
AI_TEACHER_MODEL=gpt-5.6-luna
AI_TEACHER_MODEL_LOW=gpt-5.6-luna
AI_TEACHER_MODEL_MEMORY=gpt-5.6-luna
AI_TEACHER_TIMEOUT_MS=90000
AI_PROVIDER_STREAM_USAGE=false
```

Smoke-test:

```bash
GAPGPT_API_KEY=your_key node ai-teacher/scripts/test-gapgpt.js
```

3. Server mounts routes automatically:

```js
app.use('/api/ai-teacher', require('./ai-teacher/routes'));
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ai-teacher/bootstrap` | Onboarding status, wallet, teacher |
| POST | `/api/ai-teacher/profile` | Save student AI profile |
| GET | `/api/ai-teacher/teachers` | Active teachers |
| POST | `/api/ai-teacher/select-teacher` | Select teacher + create conversation + starter |
| GET | `/api/ai-teacher/session` | Open current teacher chat |
| GET | `/api/ai-teacher/conversations` | History (paginated) |
| GET | `/api/ai-teacher/conversations/:id` | Load conversation |
| POST | `/api/ai-teacher/conversations` | New conversation + starter |
| POST | `/api/ai-teacher/settings` | AI settings |
| GET | `/api/ai-teacher/wallet` | Balance (+ daily refill) |
| POST | `/api/ai-teacher/chat/stream` | SSE streaming chat |

## Tests

```bash
node ai-teacher/__tests__/coinWallet.test.js
```

## Notes

- First teacher greeting never calls the AI provider.
- Coin charges are server-side (reserve → usage → finalize / refund).
- Daily refill is idempotent per user per calendar day.
- Frontend never receives system prompts or pricing authority.
