// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { requireToken } = require('../middleware/auth');
const {
    handleGetDashboardData,
    handleClaimTaskReward,
    handleSubmitReferrerCode,
    handleGetTourStatus,
    handleMarkTourAsViewed,
    handleUpdateTaskProgress
} = require('../handlers/dashboardHandler');

/**
 * All dashboard routes require authentication.
 */

/** GET  /api/dashboard/data — full dashboard payload */
router.get('/data', requireToken, handleGetDashboardData);

/** POST /api/dashboard/claim-reward — claim XP reward for a completed task. Body: { taskId } */
router.post('/claim-reward', requireToken, handleClaimTaskReward);

/** POST /api/dashboard/referrer-code — submit referrer code (one-time). Body: { referrerCode } */
router.post('/referrer-code', requireToken, handleSubmitReferrerCode);

/** GET  /api/dashboard/tour-status — check if a tour was completed. Query: ?tourKey=... */
router.get('/tour-status', requireToken, handleGetTourStatus);

/** POST /api/dashboard/tour-viewed — mark a tour as viewed. Body: { tourKey } */
router.post('/tour-viewed', requireToken, handleMarkTourAsViewed);

/** POST /api/dashboard/update-task-progress — manual tasks only (IDs 8, 9, 10). Body: { taskId, progressIncrement? } */
router.post('/update-task-progress', requireToken, handleUpdateTaskProgress);

module.exports = router;
