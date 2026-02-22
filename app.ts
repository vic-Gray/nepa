import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { apiLimiter, ddosDetector, checkBlockedIP, ipRestriction, progressiveLimiter, authLimiter } from './middleware/rateLimiter';
import { configureSecurity } from './middleware/security';
import { apiKeyAuth } from './middleware/auth';
import { requestLogger } from './middleware/logger';
import { errorTracker } from './middleware/abuseDetection';
import { swaggerSpec } from './swagger';
import { upload } from './middleware/upload';
import { uploadDocument } from './controllers/DocumentController';
import { getDashboardData, generateReport, exportData } from './controllers/AnalyticsController';
import { applyPaymentSecurity, processPayment, getPaymentHistory, validatePayment } from './controllers/PaymentController';
import { WebhookController } from './controllers/WebhookController';
import { WebhookManagementController, WebhookTestingController } from './controllers/WebhookManagementController';
import { applyWebhookSecurity } from './middleware/webhookSecurity';

const app = express();

// 1. Logging (should be first to capture all requests)
app.use(requestLogger);

// 2. DDoS Protection and IP Blocking
app.use(ddosDetector);
app.use(checkBlockedIP);
app.use(ipRestriction);

// 3. Security Headers & CORS
configureSecurity(app);

// 4. Body Parsing
app.use(express.json({ limit: '10kb' })); // Limit body size for security

// 5. Progressive Rate Limiting
app.use('/api', progressiveLimiter);

// 6. General API Rate Limiting
app.use('/api', apiLimiter);

// 7. Error tracking for abuse detection
app.use(errorTracker);

// 8. API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 9. Public Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// 10. Protected API Routes
app.use('/api', apiKeyAuth);

// Authentication endpoints with stricter rate limiting
app.post('/api/auth/login', authLimiter, (req, res) => {
  // Login logic here
  res.json({ message: 'Login endpoint' });
});

app.post('/api/auth/register', authLimiter, (req, res) => {
  // Registration logic here
  res.json({ message: 'Register endpoint' });
});

// Payment endpoints with enhanced security
app.post('/api/payment/process', ...applyPaymentSecurity, processPayment);
app.get('/api/payment/history', apiKeyAuth, getPaymentHistory);
app.post('/api/payment/validate', ...applyPaymentSecurity, validatePayment);

// Example protected route
/**
 * @openapi
 * /api/test:
 *   get:
 *     summary: Test protected route
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
app.get('/api/test', (req, res) => {
  res.json({ message: 'Authenticated access successful' });
});

// Document Upload Route
/**
 * @openapi
 * /api/documents/upload:
 *   post:
 *     summary: Upload a document
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 */
app.post('/api/documents/upload', apiKeyAuth, upload.single('file'), uploadDocument);

// Analytics Routes
/**
 * @openapi
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get analytics dashboard data
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved
 */
app.get('/api/analytics/dashboard', apiKeyAuth, getDashboardData);

/**
 * @openapi
 * /api/analytics/reports:
 *   post:
 *     summary: Generate and save a custom report
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       201:
 *         description: Report created
 */
app.post('/api/analytics/reports', apiKeyAuth, generateReport);

// Export Route
app.get('/api/analytics/export', apiKeyAuth, exportData);

// ========== WEBHOOK ROUTES ==========

/**
 * @openapi
 * /api/webhooks:
 *   post:
 *     summary: Register a new webhook
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: The webhook endpoint URL (must be HTTPS)
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of event types to listen to
 *               description:
 *                 type: string
 *               retryPolicy:
 *                 type: string
 *                 enum: [EXPONENTIAL, LINEAR, FIXED]
 *               maxRetries:
 *                 type: integer
 *               retryDelaySeconds:
 *                 type: integer
 *               timeoutSeconds:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Webhook registered successfully
 */
app.post('/api/webhooks', apiKeyAuth, WebhookController.registerWebhook);

/**
 * @openapi
 * /api/webhooks:
 *   get:
 *     summary: Get all webhooks for current user
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of webhooks
 */
app.get('/api/webhooks', apiKeyAuth, WebhookController.getUserWebhooks);

/**
 * @openapi
 * /api/webhooks/{webhookId}:
 *   put:
 *     summary: Update webhook configuration
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook updated successfully
 */
app.put('/api/webhooks/:webhookId', apiKeyAuth, WebhookController.updateWebhook);

/**
 * @openapi
 * /api/webhooks/{webhookId}:
 *   delete:
 *     summary: Delete a webhook
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook deleted successfully
 */
app.delete('/api/webhooks/:webhookId', apiKeyAuth, WebhookController.deleteWebhook);

/**
 * @openapi
 * /api/webhooks/{webhookId}/events:
 *   get:
 *     summary: Get webhook event history
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Webhook events retrieved
 */
app.get('/api/webhooks/:webhookId/events', apiKeyAuth, WebhookController.getWebhookEvents);

/**
 * @openapi
 * /api/webhooks/{webhookId}/stats:
 *   get:
 *     summary: Get webhook statistics
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook statistics retrieved
 */
app.get('/api/webhooks/:webhookId/stats', apiKeyAuth, WebhookController.getWebhookStats);

/**
 * @openapi
 * /api/webhooks/{webhookId}/test:
 *   post:
 *     summary: Test webhook delivery
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook test completed
 */
app.post('/api/webhooks/:webhookId/test', apiKeyAuth, WebhookController.testWebhook);

/**
 * @openapi
 * /api/webhooks/{webhookId}/events/{eventId}/retry:
 *   post:
 *     summary: Retry failed webhook event
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook event retry initiated
 */
app.post('/api/webhooks/:webhookId/events/:eventId/retry', apiKeyAuth, WebhookController.retryWebhookEvent);

/**
 * @openapi
 * /api/webhooks/{webhookId}/logs:
 *   get:
 *     summary: Get webhook logs
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Webhook logs retrieved
 */
app.get('/api/webhooks/:webhookId/logs', apiKeyAuth, WebhookController.getWebhookLogs);

// ========== WEBHOOK MANAGEMENT ROUTES ==========

/**
 * @openapi
 * /api/webhooks/admin/dashboard:
 *   get:
 *     summary: Get webhook management dashboard
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved
 */
app.get('/api/webhooks/admin/dashboard', apiKeyAuth, WebhookManagementController.getDashboard);

/**
 * @openapi
 * /api/webhooks/admin/{webhookId}:
 *   get:
 *     summary: Get webhook details with analytics
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook details retrieved
 */
app.get('/api/webhooks/admin/:webhookId', apiKeyAuth, WebhookManagementController.getWebhookDetails);

/**
 * @openapi
 * /api/webhooks/admin/reports/performance:
 *   get:
 *     summary: Get webhook performance report
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Performance report retrieved
 */
app.get('/api/webhooks/admin/reports/performance', apiKeyAuth, WebhookManagementController.getPerformanceReport);

/**
 * @openapi
 * /api/webhooks/admin/failed-deliveries:
 *   get:
 *     summary: Get failed webhook deliveries
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: webhookId
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Failed deliveries retrieved
 */
app.get('/api/webhooks/admin/failed-deliveries', apiKeyAuth, WebhookManagementController.getFailedDeliveries);

/**
 * @openapi
 * /api/webhooks/admin/bulk-retry:
 *   post:
 *     summary: Bulk retry failed webhook events
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               webhookId:
 *                 type: string
 *               eventIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Bulk retry initiated
 */
app.post('/api/webhooks/admin/bulk-retry', apiKeyAuth, WebhookManagementController.bulkRetryFailedEvents);

/**
 * @openapi
 * /api/webhooks/admin/export:
 *   get:
 *     summary: Export webhook data
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *     responses:
 *       200:
 *         description: Webhook data exported
 */
app.get('/api/webhooks/admin/export', apiKeyAuth, WebhookManagementController.exportWebhookData);

/**
 * @openapi
 * /api/webhooks/admin/analytics:
 *   get:
 *     summary: Get webhook analytics
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Analytics data retrieved
 */
app.get('/api/webhooks/admin/analytics', apiKeyAuth, WebhookManagementController.getAnalytics);

// ========== WEBHOOK TESTING ROUTES ==========

/**
 * @openapi
 * /api/webhooks/testing/create-event:
 *   post:
 *     summary: Create a test webhook event
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               webhookId:
 *                 type: string
 *               eventType:
 *                 type: string
 *               payload:
 *                 type: object
 *     responses:
 *       200:
 *         description: Test event created
 */
app.post('/api/webhooks/testing/create-event', apiKeyAuth, WebhookTestingController.createTestEvent);

/**
 * @openapi
 * /api/webhooks/testing/history/{webhookId}:
 *   get:
 *     summary: Get webhook test history
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Test history retrieved
 */
app.get('/api/webhooks/testing/history/:webhookId', apiKeyAuth, WebhookTestingController.getTestHistory);

/**
 * @openapi
 * /api/webhooks/testing/test-with-payload:
 *   post:
 *     summary: Test webhook with custom payload
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               webhookId:
 *                 type: string
 *               payload:
 *                 type: object
 *     responses:
 *       200:
 *         description: Webhook test completed
 */
app.post('/api/webhooks/testing/test-with-payload', apiKeyAuth, WebhookTestingController.testWithPayload);

/**
 * @openapi
 * /api/webhooks/testing/debug/{eventId}:
 *   get:
 *     summary: Debug webhook delivery attempt
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Debug information retrieved
 */
app.get('/api/webhooks/testing/debug/:eventId', apiKeyAuth, WebhookTestingController.debugDeliveryAttempt);

export default app;