//server.js
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
// const router = express.Router();
const multer = require('multer');
const { profile, ensureAvatarDir } = require('./runtimeMode');
const { reportError, logFile } = require('./reportError');
const uploadDir = ensureAvatarDir(profile);
const { ensureVisitorCountIds } = require('./visitorCounts');
const cookieParser = require('cookie-parser');
// const jwt = require('jsonwebtoken');
const { requireToken } = require('./middleware/auth');
const { requireInternalService } = require('./middleware/internalAuth');
const { sniffImage, IMAGE_EXT, randomStoredName, assertInside } = require('./utils/uploadSniff');
const quizController = require('./controllers/quizController');
const userController = require('./controllers/userController');
const adminController = require('./controllers/adminController');
const purgeQuestions = require('./admin/purgeQuestions');
const quizWorldController = require('./controllers/quizWorldController');
const bankSelection = require('./controllers/bankSelection');
const dashboardRoutes = require('./routes/dashboardRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const aiTeacherRoutes = require('./ai-teacher/routes');
const walletController = require('./controllers/walletController');
const adminRoutes = require('./routes/adminRoutes');
const blogRoutes = require('./routes/blogRoutes');
const contactRoutes = require('./routes/contactRoutes');
const { ensureBlogSchema } = require('./controllers/blogController');
const { ensureContactSchema } = require('./controllers/contactController');
const chemballController = require('./controllers/chemballController');
const questionDisplayController = require('./controllers/questionDisplayController');
const { ensureSchema: ensureQuestionDisplaySchema } = require('./questionDisplayStore');
const pushService = require('./push/pushService');
const { ensureAdminSchema } = require('./middleware/adminAuth');
const { ensureQuestionImageColumns } = require('./admin/questionImages');
const { loadRuntimeOverlayFromDb } = require('./controllers/adminAiController');
const { ensureDiamondPlanActive } = require('./controllers/paymentController');
const app = express();
const PORT = process.env.PORT || 3000;






app.use(cookieParser());

// API responses. The public HTML document is served by the edge proxy, which
// must set the same headers on document responses (see SECURITY_AUDIT.md).
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    if (proto === 'https' || req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
});


// Bytes are held in memory until magic-byte sniffing accepts them. The client
// filename and MIME type are ignored (SEC-007).
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});
// ----------------------------

const frontendOrigins = profile.corsOrigins;

app.use(cors({
    origin: (origin, cb) => {
        // Same-origin / server-to-server requests have no Origin header.
        if (!origin) return cb(null, true);
        if (frontendOrigins.includes(origin) || frontendOrigins.includes('*')) return cb(null, true);
        return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-APP-TOKEN', 'X-Admin-Token']
}));


// 50mb allows base64-encoded PDF uploads for the admin PDF library (UI caps files at 30MB)
// Large JSON is only for admin PDF/question payloads. Everything else stays small.
const jsonLimit = (req, res, next) => {
    const big = req.path === '/api/flow' || req.path.startsWith('/api/admin');
    return express.json({ limit: big ? '50mb' : '1mb' })(req, res, next);
};
app.use(jsonLimit);
app.use(express.urlencoded({ limit: '1mb', extended: true }));

app.use('/avatars', express.static(uploadDir));
app.use(express.static(profile.webRoot));
app.use('/app', express.static(path.resolve(__dirname, '../../public')));
app.use(express.static(path.resolve(__dirname, '../../../landing-static')));


app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);
// AI Private Teacher module (bootstrap, teachers, chat stream, wallet, settings, …)
app.use('/api/ai-teacher', aiTeacherRoutes);
// Admin panel — independent session (admin_token cookie), not the student JWT
app.use('/api/admin', adminRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/contact', contactRoutes);
app.get('/api/chemball/leaderboard', chemballController.handleGetLeaderboard);
app.post('/api/chemball/score', requireToken, chemballController.handleSaveScore);

// 3. Route updated to just use the fixed multer upload
function avatarUpload(req, res, next) {
    upload.single('avatar')(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: 'فقط تصویر PNG، JPG، WEBP یا GIF پذیرفته می‌شود.',
            });
        }
        if (!req.file || !req.file.buffer) return next();
        const mime = sniffImage(req.file.buffer);
        const ext = mime && IMAGE_EXT[mime];
        if (!ext) {
            return res.status(400).json({
                success: false,
                message: 'فقط تصویر PNG، JPG، WEBP یا GIF پذیرفته می‌شود.',
            });
        }
        try {
            const filename = randomStoredName(ext);
            const dest = assertInside(uploadDir, filename);
            fs.writeFileSync(dest, req.file.buffer);
            req.file.filename = filename;
            req.file.path = dest;
            return next();
        } catch (writeErr) {
            console.error('Avatar store failed:', writeErr.message);
            return res.status(400).json({
                success: false,
                message: 'فقط تصویر PNG، JPG، WEBP یا GIF پذیرفته می‌شود.',
            });
        }
    });
}

app.get('/api/realtime-token', requireToken, userController.handleRealtimeToken);

app.post(
    '/api/upload_avatar',
    requireToken,
    avatarUpload,
    userController.handleUploadAvatar
);
app.post(
    '/api/reset-avatar',
    requireToken,
    userController.handleResetAvatar
);

function mountInternal(method, routePath, ...handlers) {
    // Direct Node: /internal/...
    // Public LiteSpeed /api proxy: /api/internal/...
    app[method](routePath, ...handlers);
    app[method](`/api${routePath}`, ...handlers);
}

mountInternal(
    'get',
    '/internal/quizzes/:quizId/metadata',
    requireInternalService,
    quizWorldController.handleGetQuizMetadata
);

mountInternal(
    'post',
    '/internal/quizzes/:quizId/members',
    requireInternalService,
    quizWorldController.handleAddQuizMember
);

mountInternal(
    'post',
    '/internal/quizzes/:quizId/grade',
    requireInternalService,
    quizWorldController.handleInternalGradeQuiz
);

mountInternal(
    'post',
    '/internal/quizzes/:quizId/finish',
    requireInternalService,
    quizWorldController.handleInternalFinishQuiz
);

mountInternal(
    'post',
    '/internal/results',
    requireInternalService,
    quizWorldController.handleInternalSaveQuizResult
);


// Ensure ONLY POST is allowed (similar to PHP behavior)
app.use('/api/flow', (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'POST') {
        return res.json({ success: false, message: 'Only POST method is allowed' });
    }
    next();
});

// Single Endpoint Routing
app.post('/api/flow', requireToken, async (req, res) => {
    const action = req.body.action || '';

    try {
        switch (action) {
            case 'update_profile':
                await userController.handleUpdateProfile(req, res);
                break;
            // case 'get_dashboard_data':
            //     await userController.handleGetDashboardData(req, res);
            //     break;
            case 'guest_login':
                await userController.handleGuestLogin(req, res);
                break;
            case 'send_otp':
                await userController.handleSendOtp(req, res);
                break;
            case 'send_password_reset_otp':
                await userController.handleSendPasswordResetOtp(req, res);
                break;
            case 'check_password_reset_otp':
                await userController.handleCheckPasswordResetOtp(req, res);
                break;
            case 'reset_password_with_otp':
                await userController.handleResetPasswordWithOtp(req, res);
                break;
            case 'verify_otp':
                await userController.handleVerifyOtp(req, res);
                break;
            case 'password_login':
                await userController.handlePasswordLogin(req, res);
                break;

            case 'get_user_info':
                await userController.handleGetUserInfo(req, res);
                break;
            case 'save_user_activity':
                await userController.saveUserActivity(req, res);
                break;
            case 'views_count':
                await userController.trackViewCount(req, res);
                break;
            case 'get_quiz_history':
                await userController.handleGetQuizHistory(req, res);
                break;
            case 'get_pdfs':
                await userController.handleGetPublicPdfs(req, res);
                break;
            case 'track_pdf_download':
                await userController.handleTrackPdfDownload(req, res);
                break;
            case 'get_payment_history':
                await userController.handleGetPaymentHistory(req, res);
                break;
            case 'get_my_invites':
                await userController.handleGetMyInvites(req, res);
                break;
            case 'get_my_referral_code':
                await walletController.handleGetMyReferralCode(req, res);
                break;
            case 'get_my_wallet':
                await walletController.handleGetMyWallet(req, res);
                break;
            case 'request_withdrawal':
                await walletController.handleRequestWithdrawal(req, res);
                break;
            case 'get_subjects':
                await quizController.handleGetSubjects(req, res);
                break;
            case 'get_grades_by_subject':
                await quizController.handleGetGradesBySubject(req, res);
                break;
            case 'get_chapters_by_subject':
                await quizController.handleGetChaptersBySubject(req, res);
                break;
            case 'get_mabahes_by_chapter':
                await quizController.handleGetMabahesByChapter(req, res);
                break;
            case 'get_quiz_types':
                quizController.handleGetQuizTypes(req, res);
                break;
            case 'start_session':
                await quizController.handleStartSession(req, res);
                break;
            case 'get_practice_question':
                await quizController.handleGetPracticeQuestion(req, res);
                break;
            case 'get_question_display':
                await questionDisplayController.handleGetQuestionDisplay(req, res);
                break;
            case 'get_specific_question':
                await quizController.handleGetSpecificQuestion(req, res);
                break;
            case 'checkAnswer':
                await quizController.handleCheckAnswer(req, res);
                break;
            case 'finish_quiz':
                await quizController.handleFinishQuiz(req, res);
                break;

            // ===================== Favorites ACTIONS =====================

            case 'get_favorites':
                await userController.handleGetFavorites(req, res);
                break;
            case 'add_favorite':
                await userController.handleAddFavorite(req, res);
                break;
            case 'remove_favorite':
                await userController.handleRemoveFavorite(req, res);
                break;
            // =========================================================

            // ===================== NOTES ACTIONS =====================
            case 'get_notes':
                await userController.handleGetNotes(req, res);
                break;
            case 'add_note':
                await userController.handleAddNote(req, res);
                break;
            case 'delete_note':
                await userController.handleDeleteNote(req, res);
                break;
            // =========================================================

            // ===================== Review Box ACTIONS =====================
            case 'get_review_later_questions':
                await userController.handleGetReviewLaterQuestions(req, res);
                break;
            case 'add_to_review_later':
                await userController.handleAddReviewLater(req, res);
                break;
            case 'remove_from_review_later':
                await userController.handleRemoveReviewLater(req, res);
                break;
            // =========================================================

            // ===================== Report ACTIONS =====================

            case 'report_question':
                await userController.handleReportQuestion(req, res);
                break;
            case 'get_reports':
                await userController.handleGetReports(req, res);
                break;
            // ===================== QUIZ WORLD ACTIONS (Multiple Selections) =====================
            case 'get_grades_by_subjects_multi':
                await quizWorldController.handleGetGradesBySubjects(req, res);
                break;
            case 'get_chapters_by_subjects_multi':
                await quizWorldController.handleGetChaptersBySubjects(req, res);
                break;
            case 'get_mabahes_by_chapters_multi':
                await quizWorldController.handleGetMabahesByChapters(req, res);
                break;
            case 'search_bank_questions':
                await quizWorldController.handleSearchBankQuestions(req, res);
                break;
            case 'get_bank_question_answer':
                await quizWorldController.handleGetBankQuestionAnswer(req, res);
                break;
            case 'save_bank_selection':
                await bankSelection.handleSaveBankSelection(req, res);
                break;
            case 'get_bank_selection':
                await bankSelection.handleGetBankSelection(req, res);
                break;
            case 'list_bank_selections':
                await bankSelection.handleListBankSelections(req, res);
                break;
            case 'generate_code':
                await quizWorldController.generateCode(req, res);
                break;
            case 'create_quiz':
                await quizWorldController.handleCreateQuiz(req, res);
                break;
            case 'get_quiz_by_share_code':
                await quizWorldController.handleGetQuizByShareCode(req, res);
                break;
            case 'get_quiz_questions':
                await quizWorldController.handleGetQuizQuestions(req, res);
                break;
            case 'check_user_member':
                await quizWorldController.handleCheckUserMember(req, res);
                break;
            case 'get_quiz_info':
                await quizWorldController.handleGetQuizPreviewState(req, res);
                break;
            case 'submit_quiz_answers':
                await quizWorldController.handleSubmitQuizAnswers(req, res);
                break;

            case 'get_quiz_result_by_id':
                await quizWorldController.handleGetQuizResult(req, res);
                break;

            case 'get_quiz_members':
                await quizWorldController.handleGetQuizMembers(req, res);
                break;

            case 'get_quiz_result_by_user_and_quiz':
                await quizWorldController.handleGetQuizResultByUserAndQuiz(req, res);
                break;
            case 'finishing_quiz':
                await quizWorldController.handleFinishQuiz(req, res);
                break;

            // =================================================================================
            // ===================== Admin ACTIONS =====================

            // case 'Admin_get_questions':
            //     await adminController.handleGetQuestions(req, res);
            //     break;
            case 'Admin_update_question':
                await adminController.handleUpdateQuestion(req, res);
                break;
            case 'admin_login':
                await adminController.handleAdminLogin(req, res);
                break;
            case 'admin_verify': // <-- ADD THIS
                await adminController.handleAdminVerify(req, res);
                break;
            case 'admin_logout': // <-- ADD THIS
                await adminController.handleAdminLogout(req, res);
                break;
            case 'Admin_get_question_for_edit':
                await adminController.handleGetQuestionForEdit(req, res);
                break;
            case 'Admin_full_update_question':
                await adminController.handleFullUpdateQuestion(req, res);
                break;
            case 'Admin_get_subjects':
                await adminController.handleAdminGetSubjects(req, res);
                break;
            case 'Admin_get_grades_by_subject':
                await adminController.handleAdminGetGradesBySubject(req, res);
                break;
            case 'Admin_get_chapters_by_subject':
                await adminController.handleAdminGetChaptersBySubject(req, res);
                break;
            case 'Admin_get_mabahes_by_chapter':
                await adminController.handleAdminGetMabahesByChapter(req, res);
                break;
            case 'Admin_get_question_by_filters':
                await adminController.getQuestionsByFilters(req, res);
                break;

            // ============ Curriculum Manager (Subjects / Grades / Chapters / Mabhas) ============
            case 'Admin_get_curriculum':
                await adminController.handleAdminGetCurriculum(req, res);
                break;
            case 'Admin_save_curriculum_item':
                await adminController.handleAdminSaveCurriculumItem(req, res);
                break;
            case 'Admin_delete_curriculum_item':
                await adminController.handleAdminDeleteCurriculumItem(req, res);
                break;

            // ===================== PDF Library Manager =====================
            case 'Admin_get_pdfs':
                await adminController.handleAdminGetPdfs(req, res);
                break;
            case 'Admin_save_pdf':
                await adminController.handleAdminSavePdf(req, res);
                break;
            case 'Admin_delete_pdf':
                await adminController.handleAdminDeletePdf(req, res);
                break;

            // ===================== Insert Questions (Manual + Word Import) =====================
            case 'Admin_parse_questions_docx':
                await adminController.handleAdminParseQuestionsDocx(req, res);
                break;
            case 'Admin_insert_questions':
                await adminController.handleAdminInsertQuestions(req, res);
                break;
            case 'Admin_preview_question_purge':
                await purgeQuestions.handleAdminPreviewQuestionPurge(req, res);
                break;
            case 'Admin_lookup_question_purge':
                await purgeQuestions.handleAdminLookupQuestionPurge(req, res);
                break;
            case 'Admin_apply_question_purge':
                await purgeQuestions.handleAdminApplyQuestionPurge(req, res);
                break;

            case 'Admin_get_discount_codes':
                await adminController.handleAdminGetDiscountCodes(req, res);
                break;
            case 'Admin_save_discount_code':
                await adminController.handleAdminSaveDiscountCode(req, res);
                break;
            case 'Admin_toggle_discount_code':
                await adminController.handleAdminToggleDiscountCode(req, res);
                break;
            case 'Admin_delete_discount_code':
                await adminController.handleAdminDeleteDiscountCode(req, res);
                break;
            case 'Admin_get_referral_settings':
                await adminController.handleAdminGetReferralSettings(req, res);
                break;
            case 'Admin_update_referral_settings':
                await adminController.handleAdminUpdateReferralSettings(req, res);
                break;
            case 'Admin_get_question_display':
                await questionDisplayController.handleAdminGetQuestionDisplay(req, res);
                break;
            case 'Admin_update_question_display':
                await questionDisplayController.handleAdminUpdateQuestionDisplay(req, res);
                break;
            case 'Admin_get_withdrawal_requests':
                await adminController.handleAdminGetWithdrawalRequests(req, res);
                break;
            case 'Admin_update_withdrawal_status':
                await adminController.handleAdminUpdateWithdrawalStatus(req, res);
                break;
            case 'get_chemball_leaderboard':
                await chemballController.handleGetLeaderboard(req, res);
                break;
            case 'save_chemball_score':
                await chemballController.handleSaveScore(req, res);
                break;
            case 'get_push_config':
                await pushService.handleGetConfig(req, res);
                break;
            case 'save_push_subscription':
                await pushService.handleSaveSubscription(req, res);
                break;
            case 'delete_push_subscription':
                await pushService.handleDeleteSubscription(req, res);
                break;

            // =========================================================

            default:
                res.json({ success: false, message: 'Invalid action' });
                break;
        }
    } catch (error) {
        const detail = reportError(`action ${action || '(none)'}`, error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                code: detail.code || undefined,
                detail: detail.message,
            });
        }
    }
});

process.on('unhandledRejection', (error) => {
    reportError('unhandledRejection', error);
});
process.on('uncaughtException', (error) => {
    reportError('uncaughtException', error);
});

const { installMarketing } = require('./marketingSite');
const siteRoot = path.resolve(__dirname, '../../..');

function portOpen(port) {
    return new Promise((resolve) => {
        const socket = net.connect({ port, host: '127.0.0.1' });
        const done = (open) => {
            socket.removeAllListeners();
            socket.destroy();
            resolve(open);
        };
        socket.once('connect', () => done(true));
        socket.once('error', () => done(false));
    });
}

async function ensureLocalApp() {
    if (!profile.localhost) return;
    if (await portOpen(5173)) {
        console.log('Local app is already on http://localhost:5173/');
        return;
    }
    const appDir = path.resolve(__dirname, '../..');
    console.log('Starting beforMain app on http://localhost:5173/');
    const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
        cwd: appDir,
        stdio: 'inherit',
        shell: true,
    });
    child.on('error', (err) => {
        console.error('Could not start the app. From metatest run: npm install && npm run dev');
        console.error(err.message);
    });
}

// Start the server after the marketing routes are registered.
function startServer() {
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
    console.log(`[runtime] LOCALHOST=${profile.localhost} base=${profile.appBase} socket=${profile.socketUrl}`);
    console.log(`[runtime] avatars ${uploadDir}`);
    console.log(`[runtime] errors ${logFile}`);
    ensureVisitorCountIds()
        .catch((err) => console.error('[db] visitor count repair failed:', err.message));
    ensureAdminSchema()
        .then(() => ensureQuestionImageColumns())
        .then(() => ensureBlogSchema())
        .then(() => ensureContactSchema())
        .then(() => loadRuntimeOverlayFromDb())
        .then(() => ensureDiamondPlanActive())
        .then(() => pushService.ensureSchema())
        .then(() => ensureQuestionDisplaySchema())
        .then(() => console.log('[admin] schema ready, AI runtime overlay loaded'))
        .catch((err) => console.error('[admin] bootstrap failed:', err.message));
    try {
        pushService.startPushScheduler();
    } catch (err) {
        console.error('[push] scheduler failed to start:', err.message);
    }
    ensureLocalApp().catch((err) => console.error(err.message));
});
}

installMarketing(app, { siteRoot, profile })
    .then(startServer)
    .catch((err) => {
        console.error('[site] marketing setup failed:', err);
        process.exit(1);
    });