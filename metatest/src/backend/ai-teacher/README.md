# Met — AI Tutor Module

Production module integrated into Metatest. Teachers, personas, and skills
have been retired — there is exactly one character, **Met**, specialized per
subject (math, biology, physics, chemistry) through prompt layers + RAG.

## Setup

1. Run the SQL migrations in order:

```bash
mysql -u USER -p DATABASE < ai-teacher/sql/001_ai_teacher.sql
mysql -u USER -p DATABASE < ai-teacher/sql/002_ai_books.sql
mysql -u USER -p DATABASE < ai-teacher/sql/004_iranian_teachers.sql   # legacy seed, harmless to keep
mysql -u USER -p DATABASE < ai-teacher/sql/005_usage_costs.sql
mysql -u USER -p DATABASE < ai-teacher/sql/006_met_subjects.sql       # subjects, RAG chunks, attachments
```

`006` is additive/non-destructive: it retires the teacher roster from the
product surface but leaves the historical tables in place, adds the 4
subjects, attaches each to a textbook (`tam24_ai_books.subject_key`), and
adds the chunk/embedding table used for retrieval-augmented answers.

2. Environment variables (GapGPT — [quickstart](https://gapgpt.app/platform-v2/docs/quickstart)):

```env
GAPGPT_API_KEY=your_gapgpt_api_key_here
GAPGPT_BASE_URL=https://api.gapgpt.app/v1

AI_TEACHER_MODEL=gpt-5.6-luna          # default text model
AI_TEACHER_MODEL_VISION=gpt-5.6-terra  # used automatically when a message has an image
AI_TEACHER_MODEL_TOOLS=gpt-5.6-terra
AI_TEACHER_EMBEDDING_MODEL=text-embedding-3-small
AI_TEACHER_IMAGE_MODEL=dall-e-3

AI_TEACHER_ENABLE_TOOLS=true
AI_TEACHER_ENABLE_IMAGE_GEN=true
AI_TEACHER_ENABLE_VISION=true
AI_TEACHER_ENABLE_RAG=true
AI_TEACHER_IMAGE_ENERGY_COST=40
```

3. Ingest each subject's textbook once (chunk + embed for fast retrieval):

```bash
node ai-teacher/scripts/ingestBook.js --book=1 --file=/path/to/physics-10.pdf
node ai-teacher/scripts/ingestBook.js --book=2 --file=/path/to/math-10.pdf
node ai-teacher/scripts/ingestBook.js --book=3 --file=/path/to/chemistry-10.pdf
node ai-teacher/scripts/ingestBook.js --book=4 --file=/path/to/biology-10.pdf
```

Re-running is safe and cheap: unchanged chunks are not re-embedded.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ai-teacher/bootstrap` | Intro-seen flag, subjects, wallet, latest conversation |
| POST | `/api/ai-teacher/intro-seen` | Mark the Met intro screen as seen |
| GET | `/api/ai-teacher/subjects` | The 4 subjects (name/icon/color) |
| GET | `/api/ai-teacher/session` | Resume the most recent conversation |
| GET/POST | `/api/ai-teacher/conversations` | History (paginated) / start a new one |
| GET/PATCH/DELETE | `/api/ai-teacher/conversations/:id` | Load / rename / soft-delete |
| GET | `/api/ai-teacher/wallet` | Balance (+ daily refill) |
| POST | `/api/ai-teacher/upload-image` | Upload an image for the next message |
| POST | `/api/ai-teacher/chat/stream` | SSE streaming chat (subject-aware, RAG, tools, vision) |

## How a message is answered

1. `subjects.js` general prompt (Met's identity) + reference instructions for
   the active subject are combined with `ragService`'s top-K textbook
   excerpt (embeddings similarity, falling back to keyword search, then a
   short summary) — never the whole PDF.
2. If the message looks like it needs real account data ("how am I doing in
   physics?") or an illustration, one extra non-streaming call lets the
   model use read-only tools (`toolsService.js`) before the final streamed
   reply — kept off the hot path for ordinary messages so latency stays low.
3. The reply streams over SSE; token usage is billed in real USD → IRR →
   energy, with a flat surcharge when an image was generated.
4. After the very first exchange in a conversation, a tiny follow-up call
   generates a short Persian title for the sidebar history.

## Tests

```bash
node ai-teacher/__tests__/coinWallet.test.js
node ai-teacher/__tests__/walletRace.test.js
```

## Notes

- Energy charges are server-side only (reserve → usage → finalize / refund).
- Daily refill is idempotent per user per calendar day; once a user's
  remaining energy drops below ~15% of their daily allowance, replies
  automatically shorten (fair-use, protects both the student's budget and
  ours) instead of cutting them off abruptly.
- The frontend never receives system prompts, RAG excerpts, or pricing
  internals — only text, attachments, and the energy balance.
