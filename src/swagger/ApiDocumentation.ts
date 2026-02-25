import { SwaggerDefinition } from 'swagger-jsdoc';
import { ApiVersioning } from '../middleware/ApiVersioning';

/**
 * API Documentation Configuration
 */
export class ApiDocumentation {
  /**
   * Generate OpenAPI 3.0 specification
   */
  static generateSpec(): SwaggerDefinition {
    const versions = ApiVersioning.getVersionInfo();
    
    return {
      openapi: '3.0.0',
      info: {
        title: 'NEPA API',
        version: '2.0.0',
        description: `
          ## Overview
          The NEPA API provides standardized REST endpoints for managing users, authentication, documents, payments, and analytics.
          
          ## Key Features
          - **Standardized Responses**: All endpoints follow consistent response format
          - **API Versioning**: Support for multiple API versions with backward compatibility
          - **Rate Limiting**: Intelligent rate limiting based on user tier and system load
          - **Comprehensive Error Handling**: Detailed error codes and messages
          - **Request Validation**: Input validation and sanitization
          - **Security**: JWT authentication, API key support, and security headers
          
          ## Authentication
          The API uses JWT tokens for authentication. Include the token in the Authorization header:
          \`Authorization: Bearer <your-token>\`
          
          ## Rate Limiting
          Rate limits vary by endpoint and user tier. Check the \`X-Rate-Limit-*\` headers for current limits.
          
          ## Error Handling
          All errors follow a standard format with error codes, messages, and optional details.
        `,
        contact: {
          name: 'NEPA Support',
          email: 'support@nepa.com',
          url: 'https://nepa.com/support'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        },
        termsOfService: 'https://nepa.com/terms',
        'x-api-versioning': {
          supported: versions.map(v => v.version),
          default: 'v1',
          deprecationPolicy: 'Versions are deprecated 6 months before sunset'
        }
      },
      servers: [
        {
          url: 'https://api.nepa.com/v1',
          description: 'Production server (v1)'
        },
        {
          url: 'https://api.nepa.com/v2',
          description: 'Production server (v2)'
        },
        {
          url: 'https://staging-api.nepa.com/v1',
          description: 'Staging server (v1)'
        },
        {
          url: 'http://localhost:3000/v1',
          description: 'Development server (v1)'
        }
      ],
      security: [
        {
          BearerAuth: []
        },
        {
          ApiKeyAuth: []
        }
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT authentication token'
          },
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
            description: 'API key for programmatic access'
          }
        },
        schemas: {
          ApiResponse: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Indicates if the request was successful'
              },
              data: {
                type: 'object',
                description: 'Response data (present on success)'
              },
              error: {
                $ref: '#/components/schemas/ApiError'
              },
              meta: {
                $ref: '#/components/schemas/ResponseMeta'
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Response timestamp in ISO 8601 format'
              },
              requestId: {
                type: 'string',
                format: 'uuid',
                description: 'Unique identifier for the request'
              }
            },
            required: ['success', 'timestamp']
          },
          ApiError: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Machine-readable error code'
              },
              message: {
                type: 'string',
                description: 'Human-readable error message'
              },
              details: {
                type: 'object',
                description: 'Additional error details'
              },
              field: {
                type: 'string',
                description: 'Field name for validation errors'
              }
            },
            required: ['code', 'message']
          },
          ResponseMeta: {
            type: 'object',
            properties: {
              pagination: {
                $ref: '#/components/schemas/PaginationMeta'
              },
              version: {
                type: 'string',
                description: 'API version used'
              },
              rateLimit: {
                $ref: '#/components/schemas/RateLimitMeta'
              }
            }
          },
          PaginationMeta: {
            type: 'object',
            properties: {
              page: {
                type: 'integer',
                description: 'Current page number'
              },
              limit: {
                type: 'integer',
                description: 'Items per page'
              },
              total: {
                type: 'integer',
                description: 'Total number of items'
              },
              totalPages: {
                type: 'integer',
                description: 'Total number of pages'
              },
              hasNext: {
                type: 'boolean',
                description: 'Whether there is a next page'
              },
              hasPrev: {
                type: 'boolean',
                description: 'Whether there is a previous page'
              }
            },
            required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev']
          },
          RateLimitMeta: {
            type: 'object',
            properties: {
              limit: {
                type: 'integer',
                description: 'Request limit'
              },
              remaining: {
                type: 'integer',
                description: 'Remaining requests'
              },
              resetTime: {
                type: 'integer',
                description: 'Unix timestamp when limit resets'
              },
              retryAfter: {
                type: 'integer',
                description: 'Seconds to wait before retrying'
              }
            },
            required: ['limit', 'remaining', 'resetTime']
          },
          ValidationError: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                description: 'Field name that failed validation'
              },
              message: {
                type: 'string',
                description: 'Validation error message'
              },
              value: {
                description: 'Value that failed validation'
              },
              code: {
                type: 'string',
                description: 'Validation error type'
              }
            },
            required: ['field', 'message', 'code']
          },
          User: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'User ID'
              },
              email: {
                type: 'string',
                format: 'email',
                description: 'User email'
              },
              username: {
                type: 'string',
                description: 'Username'
              },
              name: {
                type: 'string',
                description: 'Full name'
              },
              role: {
                type: 'string',
                enum: ['user', 'admin', 'moderator'],
                description: 'User role'
              },
              status: {
                type: 'string',
                enum: ['active', 'inactive', 'suspended'],
                description: 'Account status'
              },
              isEmailVerified: {
                type: 'boolean',
                description: 'Email verification status'
              },
              twoFactorEnabled: {
                type: 'boolean',
                description: 'Two-factor authentication status'
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
                description: 'Account creation date'
              },
              lastLoginAt: {
                type: 'string',
                format: 'date-time',
                description: 'Last login date'
              }
            }
          },
          LoginRequest: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: {
                type: 'string',
                format: 'email',
                description: 'User email'
              },
              password: {
                type: 'string',
                format: 'password',
                description: 'User password'
              },
              twoFactorCode: {
                type: 'string',
                description: 'Two-factor authentication code'
              }
            }
          },
          RegisterRequest: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: {
                type: 'string',
                format: 'email',
                description: 'User email'
              },
              password: {
                type: 'string',
                format: 'password',
                minLength: 8,
                description: 'User password'
              },
              username: {
                type: 'string',
                minLength: 3,
                maxLength: 30,
                pattern: '^[a-zA-Z0-9]+$',
                description: 'Username'
              },
              name: {
                type: 'string',
                maxLength: 100,
                description: 'Full name'
              },
              phoneNumber: {
                type: 'string',
                pattern: '^\\+?[1-9]\\d{1,14}$',
                description: 'Phone number in international format'
              }
            }
          }
        }
      },
      paths: {
        // Authentication endpoints
        '/auth/register': {
          post: {
            tags: ['Authentication'],
            summary: 'Register a new user',
            description: 'Creates a new user account with email verification',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/RegisterRequest' }
                }
              }
            },
            responses: {
              201: {
                description: 'User registered successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              },
              400: {
                description: 'Validation error or user already exists',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              },
              429: {
                description: 'Rate limit exceeded',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              }
            }
          }
        },
        '/auth/login': {
          post: {
            tags: ['Authentication'],
            summary: 'Authenticate user',
            description: 'Authenticates a user and returns JWT tokens',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LoginRequest' }
                }
              }
            },
            responses: {
              200: {
                description: 'Authentication successful',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              },
              401: {
                description: 'Invalid credentials',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              },
              429: {
                description: 'Rate limit exceeded',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              }
            }
          }
        },
        '/auth/refresh': {
          post: {
            tags: ['Authentication'],
            summary: 'Refresh JWT token',
            description: 'Refreshes an expired JWT token using a refresh token',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['refreshToken'],
                    properties: {
                      refreshToken: {
                        type: 'string',
                        description: 'Refresh token'
                      }
                    }
                  }
                }
              }
            },
            responses: {
              200: {
                description: 'Token refreshed successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              },
              401: {
                description: 'Invalid refresh token',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              }
            }
          }
        },
        '/auth/logout': {
          post: {
            tags: ['Authentication'],
            summary: 'Logout user',
            description: 'Invalidates the user JWT token',
            security: [{ BearerAuth: [] }],
            responses: {
              200: {
                description: 'Logout successful',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              },
              401: {
                description: 'Invalid token',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              }
            }
          }
        },
        // User endpoints
        '/user/profile': {
          get: {
            tags: ['User'],
            summary: 'Get user profile',
            description: 'Retrieves the authenticated user profile',
            security: [{ BearerAuth: [] }],
            responses: {
              200: {
                description: 'Profile retrieved successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              },
              401: {
                description: 'Unauthorized',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              }
            }
          },
          put: {
            tags: ['User'],
            summary: 'Update user profile',
            description: 'Updates the authenticated user profile',
            security: [{ BearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', maxLength: 100 },
                      username: { type: 'string', minLength: 3, maxLength: 30 },
                      phoneNumber: { type: 'string', pattern: '^\\+?[1-9]\\d{1,14}$' }
                    }
                  }
                }
              }
            },
            responses: {
              200: {
                description: 'Profile updated successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              },
              400: {
                description: 'Validation error',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              },
              401: {
                description: 'Unauthorized',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ApiResponse' }
                  }
                }
              }
            }
          }
        }
      },
      tags: [
        {
          name: 'Authentication',
          description: 'User authentication and authorization endpoints'
        },
        {
          name: 'User',
          description: 'User profile and management endpoints'
        },
        {
          name: 'Documents',
          description: 'Document upload and management endpoints'
        },
        {
          name: 'Payments',
          description: 'Payment processing and management endpoints'
        },
        {
          name: 'Analytics',
          description: 'Analytics and reporting endpoints'
        }
      ]
    };
  }

  /**
   * Generate API documentation HTML
   */
  static generateDocumentationHtml(): string {
    // This would typically use swagger-ui-express
    // For now, return a placeholder
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>NEPA API Documentation</title>
        <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui.css" />
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-bundle.js"></script>
        <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-standalone-preset.js"></script>
        <script>
          window.onload = function() {
            const spec = ${JSON.stringify(ApiDocumentation.generateSpec(), null, 2)};
            SwaggerUIBundle({
              url: '',
              spec: spec,
              dom_id: '#swagger-ui',
              deepLinking: true,
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
              ],
              plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
              ],
              layout: "StandaloneLayout"
            });
          }
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Generate Postman collection
   */
  static generatePostmanCollection(): object {
    return {
      info: {
        name: 'NEPA API Collection',
        description: 'Collection of NEPA API endpoints for testing',
        version: '2.0.0',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{jwt_token}}',
            type: 'string'
          }
        ]
      },
      variable: [
        {
          key: 'base_url',
          value: 'https://api.nepa.com/v1',
          type: 'string'
        },
        {
          key: 'jwt_token',
          value: '',
          type: 'string'
        }
      ],
      item: [
        {
          name: 'Authentication',
          item: [
            {
              name: 'Register',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json'
                  }
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify({
                    email: 'user@example.com',
                    password: 'password123',
                    name: 'Test User'
                  }, null, 2)
                },
                url: {
                  raw: '{{base_url}}/auth/register'
                }
              }
            },
            {
              name: 'Login',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json'
                  }
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify({
                    email: 'user@example.com',
                    password: 'password123'
                  }, null, 2)
                },
                url: {
                  raw: '{{base_url}}/auth/login'
                }
              }
            }
          ]
        }
      ]
    };
  }
}
