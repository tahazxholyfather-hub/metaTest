# Exam integrity audit

Practice questions and live quizzes do not send `is_correct` before the student answers.

- `fetchQuestionOptions` (`quizController.js` lines 457–462) selects `id, option_text` only.
- Quiz-world question payloads map options to `id` and `text` (`quizWorldController.js` around the question formatter).
- `handleCheckAnswer` returns `correct_option_id` **after** an answer is submitted (line 912). That is immediate feedback for practice, not a pre-release leak.
- Grading of a shared quiz uses the database `is_correct` column on the server (line 1618), not a score the client sends.

The leaks are elsewhere.

## Answer keys before release — CONFIRMED

`handleGetQuestionForEdit` returns `is_correct` for every option and does not check an admin cookie (`adminController.js` from line 48). The route is `POST /api/flow` with action `Admin_get_question_for_edit`, behind `requireToken` only. SEC-005. Combined with SEC-006, no real account is required.

`handleGetFavorites` and the review-later payload include the correct option for questions the user saved. That is after the user has the question. It is not the pre-release leak. It is still answer text in a student API, which is intended for review.

## Score and time tampering — CONFIRMED

`handleFinishQuiz` (`quizController.js` lines 927–943) inserts `practice_seconds`, `questions_answered`, and `correct_answers` from the body, and prefers `req.body.user_id` over the session (SEC-008 and SEC-024). A caller can write another student’s activity and invent a perfect score.

`handleUpdateTaskProgress` (`dashboardHandler.js` lines 563–576) adds `progressIncrement` with no upper bound, for task ids 8, 9, and 10. A large number completes the task. Reward claim then pays XP from the server-side task row, so the client does not set the XP amount directly, but it does decide that the task is done (SEC-023).

## Deadlines, replay, races

Shared-quiz grading is server-side. A replay of the Zarinpal callback is mostly idempotent: a row already `paid` returns the result token, and the update takes `FOR UPDATE` (`paymentController.js` around line 596). SEC-020: the callback does not require the `Authority` query value to equal the authority stored on the row. Amount is sent to Zarinpal’s verify API, which is the right check.

Coupon `used_count` is incremented with `used_count = used_count + 1` and no `AND used_count < max_uses` (`paymentController.js` lines 406–410 and 638–643). Two concurrent checkouts can both pass the earlier count check. SEC-021.

## Leaderboard

`handleGetQuizResultByUserAndQuiz` loads any user’s result for a quiz id from the body (`quizWorldController.js` line 2493). The result screen does this when a member avatar is clicked, so “only yourself” would break that screen. Non-members can do it too. SEC-009. PR #55 requires both users to be in `quiz_members`.

`handleGetQuizMembers` lists names, avatars, and scores for a quiz id to any session that can decode the id. Share codes are the access model. Treat the code as a secret. It is not a second finding until codes are shown to be enumerable. Hashids are used (`utils/hash.js`). The salt is UNKNOWN without reading that file into a public report; if it is a constant in source, quiz ids are guessable. Recorded as a review note, not a separate confirmed id oracle, because the salt was not copied here.

## Access after the plan expires

`plan_expires_at` is returned to the client and used in `getMySubscriptionStatus`. AI coin grants call `walletSnapshot(userId, user.current_plan)` and ignore `plan_expires_at` (`ai-teacher/controller.js` lines 36, 95, 184). An expired paid plan keeps the paid daily coins (SEC-022). Quiz routes do not check the plan at all. Whether questions are supposed to be paid is a product rule. The code does not enforce one.

## OTP

Four-digit codes, no rate limit, public actions `send_otp` and `verify_otp` (SEC-010). This is both an exam-account takeover and an SMS-cost issue. The SMS password is in git (SEC-001).

## Admin bulk import

`Admin_parse_questions_docx` and `Admin_insert_questions` are on `/api/flow`. Insert checks the forgeable admin cookie. Parse does not (SEC-005). There is no CSV exporter in the paths reviewed, so spreadsheet formula injection is not a confirmed sink. Question text from the import is later rendered as HTML (SEC-013), which is the real sink.

## Scraping

Any caller who passes SEC-006 can page questions through `get_specific_question` and the practice session. Questions are the product. Rate limiting is absent (SEC-018). Not a separate finding.
