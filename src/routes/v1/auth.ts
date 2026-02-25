import { Router } from 'express';
import { AuthenticationController } from '../../controllers/v1/AuthenticationController';
import { ApiResponseMiddleware } from '../../middleware/ApiResponseMiddleware';
import { ApiVersioning } from '../../middleware/ApiVersioning';
import { RequestValidation } from '../../middleware/RequestValidation';
import { RateLimiting } from '../../middleware/RateLimiting';

const router = Router();
const authController = new AuthenticationController();

// Apply API versioning middleware
router.use(ApiVersioning.versionMiddleware);

// Apply response middleware
router.use(ApiResponseMiddleware.attachHelpers);

// Apply rate limiting
router.use('/register', RateLimiting.RateLimiters.auth);
router.use('/login', RateLimiting.RateLimiters.auth);
router.use('/wallet', RateLimiting.RateLimiters.auth);
router.use('/refresh', RateLimiting.RateLimiters.auth);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user
 *     description: Creates a new user account with email verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Authenticate user
 *     description: Authenticates a user and returns JWT tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /auth/wallet:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Authenticate with wallet
 *     description: Authenticates a user using wallet address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress]
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 description: Ethereum wallet address
 *     responses:
 *       200:
 *         description: Wallet authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Invalid wallet address
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/wallet', authController.loginWithWallet);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh JWT token
 *     description: Refreshes an expired JWT token using a refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/refresh', authController.refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout user
 *     description: Invalidates the user JWT token
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get current user profile
 *     description: Retrieves the authenticated user profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/me', authController.getProfile);

/**
 * @swagger
 * /auth/2fa/enable:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Enable two-factor authentication
 *     description: Enables two-factor authentication for the user
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [method]
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [totp, sms, email]
 *                 description: Two-factor authentication method
 *     responses:
 *       200:
 *         description: Two-factor authentication enabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid method or 2FA setup failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/2fa/enable', authController.enableTwoFactor);

/**
 * @swagger
 * /auth/2fa/verify:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify two-factor authentication
 *     description: Verifies a two-factor authentication code
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: Object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 length: 6
 *                 description: Two-factor authentication code
 *     responses:
 *       200:
 *         description: Two-factor authentication verified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/2fa/verify', authController.verifyTwoFactor);

/**
 * @swagger
 * /auth/2fa/disable:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Disable two-factor authentication
 *     description: Disables two-factor authentication for the user
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: Object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password for verification
 *     responses:
 *       200:
 *         description: Two-factor authentication disabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/2fa/disable', authController.disableTwoFactor);

/**
 * @swagger
 * /auth/methods:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get authentication methods
 *     description: Retrieves available authentication methods for the user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Authentication methods retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/methods', authController.getAuthMethods);

/**
 * @swagger
 * /auth/check-email:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Check email availability
 *     description: Checks if an email address is available for registration
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         required: true
 *         description: Email address to check
 *     responses:
 *       200:
 *         description: Email availability status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid email format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/check-email', authController.checkEmailAvailability);

/**
 * @swagger
 * /auth/check-username:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Check username availability
 *     description: Checks if a username is available for registration
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *           minLength: 3
 *           maxLength: 30
 *           pattern: '^[a-zA-Z0-9]+$'
 *         required: true
 *         description: Username to check
 *     responses:
 *       200:
 *         description: Username availability status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Invalid username format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/check-username', authController.checkUsernameAvailability);

export default router;
