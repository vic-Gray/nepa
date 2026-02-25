/**
 * Enhanced Security Configuration
 * Production-grade security headers with comprehensive compliance support
 */

import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import { Express } from 'express';
import { securityConfig } from '../security/SecurityConfig';

export const configureSecurity = (app: Express): void => {
  // 1. Set security HTTP headers with custom configuration
  if (securityConfig.compliance.strictHeaders) {
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            ...securityConfig.compliance.cspDirectives,
          },
        },
        hsts: {
          maxAge: securityConfig.compliance.hstsMaxAge,
          includeSubDomains: true,
          preload: true,
        },
        frameguard: {
          action: 'deny',
        },
        xssFilter: true,
        noSniff: true,
        referrerPolicy: {
          policy: 'strict-origin-when-cross-origin',
        },
      })
    );
  } else {
    // Basic helmet configuration
    app.use(helmet());
  }

  // 2. CORS configuration with dynamic origins
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      const allowedOrigins = securityConfig.compliance.corsOrigins;
      
      // Check if origin is in allowed list or if wildcard is allowed
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development, allow all origins
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-mfa-code',
      'x-signature',
      'x-timestamp',
      'x-request-id',
      'Accept',
      'Accept-Language',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-RateLimit-Tier',
      'X-RateLimit-Burst',
    ],
    credentials: securityConfig.compliance.corsCredentials,
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));

  // 3. Trust proxy configuration (required for correct IP detection behind load balancers)
  if (securityConfig.compliance.trustProxy) {
    app.set('trust proxy', 1);
  }

  // 4. Add security headers manually for finer control
  app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // MIME sniffing protection
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
    
    // Cross-Origin policies
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    
    // Cache control for sensitive data
    if (req.path.includes('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
    }
    
    next();
  });

  console.log('✅ Enhanced security configuration applied');
};

export default configureSecurity;
