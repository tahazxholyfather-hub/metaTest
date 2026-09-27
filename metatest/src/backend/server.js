//server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
// const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
// const jwt = require('jsonwebtoken');
const { requireToken } = require('./middleware/auth');
const quizController = require('./controllers/quizController');
const userController = require('./controllers/userController');
const adminController = require('./controllers/adminController');
const quizWorldController = require('./controllers/quizWorldController');
const dashboardRoutes = require('./routes/dashboardRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const aiTeacherRoutes = require('./ai-teacher/routes');
const app = express();
const PORT = process.env.PORT || 3000;



function requireInternalService(req, res, next) {
    const configuredKey = process.env.INTERNAL_SERVICE_KEY;

    // Development convenience: if no key is configured, allow internal calls.
    // In production, always set INTERNAL_SERVICE_KEY.
    if (!configuredKey && process.env.NODE_ENV !== 'production') {
        return next();
    }

    const providedKey =
        req.get('x-internal-service-key') ||
        req.get('X-Internal-Service-Key') ||
        req.get('x-app-token') ||
        req.get('X-APP-TOKEN');

    if (!configuredKey || providedKey !== configuredKey) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED_INTERNAL_REQUEST',
                message: 'Unauthorized internal service request'
            }
        });
    }

    next();
}



app.use(cookieParser());


const uploadDir = path.resolve(__dirname, '../../public/avatars');

if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Use diskStorage to save directly to the fixed path
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Keep the original extension (e.g., .jpg, .png)
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit to mitigate lack of compression
});
// ----------------------------

app.use(cors({
    origin: 'http://localhost:5173', // <-- MUST BE YOUR ACTUAL FRONTEND URL (No trailing slash)
    credentials: true,               // <-- REQUIRED FOR COOKIES
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-APP-TOKEN']
}));


// 50mb allows base64-encoded PDF uploads for the admin PDF library (UI caps files at 30MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(express.static('public'));


app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);
// AI Private Teacher module (bootstrap, teachers, chat stream, wallet, settings, …)
app.use('/api/ai-teacher', aiTeacherRoutes);

// 3. Route updated to just use the fixed multer upload
app.post(
    '/api/upload_avatar',
    requireToken,
    upload.single('avatar'),
    userController.handleUploadAvatar
);
app.post(
    '/api/reset-avatar',
    requireToken,
    userController.handleResetAvatar
);

function mountInternal(method, routePath, ...handlers) {
    // Direct Node access: /internal/...
    // Public nginx /api proxy (no strip): /api/internal/...
    app[method](routePath, ...handlers);
    app[method](`/api${routePath}`, ...handlers);
}

mountInternal(
    'get',
    '/internal/quizzes/:quizId/metadata',
    requireInternalService,
    quizWorldController.handleGetQuizMetadata,
);

mountInternal(
    'post',
    '/internal/quizzes/:quizId/members',
    requireInternalService,
    quizWorldController.handleAddQuizMember,
);

mountInternal(
    'post',
    '/internal/quizzes/:quizId/grade',
    requireInternalService,
    quizWorldController.handleInternalGradeQuiz,
);

mountInternal(
    'post',
    '/internal/quizzes/:quizId/finish',
    requireInternalService,
    quizWorldController.handleInternalFinishQuiz,
);

mountInternal(
    'post',
    '/internal/results',
    requireInternalService,
    quizWorldController.handleInternalSaveQuizResult,
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

            // =========================================================

            default:
                res.json({ success: false, message: 'Invalid action' });
                break;
        }
    } catch (error) {
        console.error(`Error in action [${action}]:`, error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});