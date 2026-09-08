# Met — AI subsystem

Production module integrated into MetaTest. There is exactly one AI
character, **Met** (eyes-only `AICharacter` on the frontend), acting as a
Persian-speaking teacher for four subjects — math, physics, chemistry,
biology — plus a general study chat. Everything a student pays is in
**coins** (daily quota + purchased); provider tokens are internal.

## Setup

1. Run the SQL migrations in order (all idempotent on MariaDB ≥ 10.5):

```bash
for f in 001_ai_teacher 002_ai_books 005_usage_costs 006_met_subjects 007_met_voice 008_met_ai_subsystem; do
  mysql -u USER -p DATABASE < ai-teacher/sql/$f.sql
done
```

`008_met_ai_subsystem.sql` is the current schema: coin buckets + ledger
types, detailed usage logs, `tam24_ai_model_pricing`, knowledge base
(`tam24_ai_knowledge*`), `tam24_ai_suggestions`, `tam24_ai_files`,
conversation PDF references + chunks, `tam24_ai_tool_calls`, new AI
settings, and it **drops** the legacy teacher tables/columns
(`tam24_ai_teachers`, `tam24_ai_teacher_starter_messages`,
`tam24_ai_student_profiles`, `tam24_users.ai_teacher_id` …).

2. Environment — see [`.env.example`](./.env.example). Minimum:

```env
AI_ENABLED=true
AI_API_KEY=...            # never sent to the browser
AI_BASE_URL=https://api.gapgpt.app/v1
AI_TEXT_MODEL=gpt-5.6-luna
```

Every capability has its own flag (`AI_VISION_ENABLED`,
`AI_IMAGE_GENERATION_ENABLED`, `AI_STT_ENABLED`, `AI_TTS_ENABLED`,
`AI_PDF_REFERENCES_ENABLED`, `AI_MEMORY_ENABLED`,
`AI_KNOWLEDGE_BASE_ENABLED`, `AI_TOOLS_ENABLED`, `AI_SUGGESTIONS_ENABLED`)
and its own model. `GET /bootstrap` returns the *effective* matrix
(`features.*`) so the UI hides what is off. `AI_ENABLED=false` makes the AI
area render an unavailable state while the rest of MetaTest is untouched.

3. Textbooks (subject-level RAG, optional): put PDFs under `public/books/`
   and ingest once — unchanged chunks are not re-embedded:

```bash
node ai-teacher/scripts/ingestBook.js --book=1 --file=public/books/physics-10.pdf
```

4. Prompts live in `subjects.js` (`generalPrompt` = identity, `referenceInstructions`
   = how to teach that subject). Non-null `general_prompt` /
   `reference_instructions` in `tam24_ai_subjects` override the code.

5. Knowledge base: insert human-authored rows into `tam24_ai_knowledge`
   (`subject_key`, `grade`, `chapter`, `title`, `content`, `examples`,
   `key_points`). Retrieval is FULLTEXT + keyword scoring, re-ranked with
   embeddings when `tam24_ai_knowledge_chunks` has vectors.

## Layout

```
ai-teacher/
  config.js            env → PROVIDER / MODELS / FLAGS / featureStatus() / coins / limits
  subjects.js          4 subjects + general: prompts, colors, icons
  routes.js            /api/ai-teacher/* (auth, AI guards, rate limits, uploads)
  controller.js        bootstrap, conversations, wallet/ledger, settings, memory, references, uploads, voice
  chatController.js    the streaming turn (SSE)
  middleware.js        requireAi / requireFeature / per-user rate limits
  shared.js            shaping helpers + wallet snapshot
  services/
    aiProvider.js      OpenAI-compatible client (chat, stream+abort, embeddings, STT, TTS, images)
    coinWallet.js      daily + purchased buckets, ledger, reserve → finalize / refund, purchases
    pricing.js         DB-backed model pricing (cache) → USD → IRR → coins
    usageLogger.js     tam24_ai_usage_logs + tam24_ai_tool_calls
    promptBuilder.js   settings normalisation, system prompt assembly, model/temperature resolution
    memoryService.js   long-term memory extraction + rolling conversation summary
    conversationService.js  conversations, paginated messages, regenerate helpers, Persian titles
    knowledgeService.js     curated knowledge retrieval + usage audit
    ragService.js           textbook chunks (embeddings / keyword)
    referencesService.js    per-conversation PDFs: upload → extract → chunk → embed → retrieve
    toolsService.js         search_questions, get_user_learning_profile, get_recent_quiz_activity, generate_image
    suggestionsService.js   seeded + AI-refilled conversation starters (pool of 10, serve 4)
    fileStorage.js          /uploads/ai/{images,audio,pdfs,generated}, validation, sharp, tam24_ai_files
    pdfText.js              pdf-parse v2 wrapper
```

## API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/bootstrap` | features, user, subjects, settings, wallet, latest conversation — works when AI is off |
| GET | `/subjects` · `/suggestions?subject=` · POST `/suggestions/:id/used` | |
| GET | `/session` | resume latest conversation (+ first page of messages) |
| POST/GET | `/conversations` | create (`subjectKey`) / list (`subject`, `q`, `limit`, `offset`) |
| GET/PATCH/DELETE | `/conversations/:id` | messages paginated with `beforeId` + `references` |
| GET/POST/DELETE | `/conversations/:id/references[/:refId]` | PDF upload field `pdf`; max 4 active per conversation |
| GET | `/wallet` · `/wallet/ledger` | buckets + daily quota / auditable ledger |
| GET/POST | `/settings` | tone, reasoningLevel, verbosity, creativity, conciseMode, efficientMode, alwaysExamples, stepByStep, voiceReplies, memoryEnabled, knowledgeEnabled, pdfReferencesEnabled |
| GET/DELETE | `/memory[/:id]` | student can audit / forget long-term memory |
| POST | `/upload-image` | field `image` → `{fileId,url,…}` (vision input) |
| POST | `/voice/transcribe` | field `audio` (+`durationSeconds`) → text, flat coins |
| POST | `/voice/speak` | `{messageId}` → mp3 url; replays free |
| POST | `/chat/stream` | SSE — `{conversationId?, subjectKey?, message, attachments:[{fileId}], regenerateMessageId?, inputMode?}` |

SSE events: `status` (thinking · processing · generating · ready), `meta`,
`user_message`, `assistant_start`, `delta`, `tool`, `attachment`, `done`,
`title`, `error` (`code` ∈ INSUFFICIENT_COINS, VISION_UNAVAILABLE,
AI_TIMEOUT, AI_PROVIDER_ERROR, EMPTY_RESPONSE, RATE_LIMITED, …).
Aborting the request stops generation; the partial answer is saved with
`status='stopped'` and only consumed tokens are charged.

## Coins

- `applyDailyGrant` runs on every wallet read: on a new local day the
  unused daily coins expire (`daily_expire`) and the plan quota is granted
  (`daily_grant`) — race-safe via the unique `(user, type, reference_id)`.
- A chat turn: `reserveCoins` (daily first, then purchased, `FOR UPDATE`) →
  provider → `finalizeCharge` (release reservation, charge real cost in the
  same transaction as the message + usage log) or `refundReservation`.
- Every movement is a ledger row with `daily_delta` / `purchased_delta`;
  `GET /wallet/ledger` hides the reservation mechanics.
- Real provider cost is recorded per operation (`cost_usd`, `cost_irr`,
  `exchange_rate_irr`) from `tam24_ai_model_pricing` with config fallbacks.

## Tests

```bash
node ai-teacher/__tests__/coinWallet.test.js   # pricing, wallet buckets (fake DB), prompts, settings
node ai-teacher/__tests__/walletRace.test.js
AI_API_KEY=... node ai-teacher/scripts/test-gapgpt.js
```
