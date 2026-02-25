import { auditService, AuditAction, AuditSeverity, AuditStatus } from '../../../services/AuditService';
import { logger } from '../../../services/logger';

/**
 * Audit event handlers for the event-driven architecture
 * These handlers listen to domain events and create audit trails
 */

export const auditHandlers = {
  // Payment Events
  'payment.success': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.PAYMENT_SUCCESS,
        resource: 'payment',
        resourceId: event.paymentId,
        description: `Payment successful - Amount: ${event.amount}, Bill: ${event.billId}`,
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.SUCCESS,
        metadata: {
          amount: event.amount,
          billId: event.billId,
          method: event.method,
          transactionId: event.transactionId
        },
        context: {
          userId: event.userId,
          correlationId: event.correlationId
        }
      });

      // Also log as event sourcing event
      await auditService.logEvent({
        eventType: 'PaymentCompleted',
        aggregateId: event.paymentId,
        aggregateType: 'Payment',
        eventData: {
          amount: event.amount,
          billId: event.billId,
          method: event.method,
          transactionId: event.transactionId,
          completedAt: new Date()
        }
      }, {
        userId: event.userId,
        correlationId: event.correlationId
      });

    } catch (error) {
      logger.error('Failed to audit payment success event:', error);
    }
  },

  'payment.failed': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.PAYMENT_FAILED,
        resource: 'payment',
        resourceId: event.paymentId,
        description: `Payment failed - Amount: ${event.amount}, Reason: ${event.reason}`,
        severity: AuditSeverity.HIGH,
        status: AuditStatus.FAILURE,
        errorMessage: event.reason,
        metadata: {
          amount: event.amount,
          billId: event.billId,
          method: event.method,
          reason: event.reason,
          errorCode: event.errorCode
        },
        context: {
          userId: event.userId,
          correlationId: event.correlationId
        }
      });

      await auditService.logEvent({
        eventType: 'PaymentFailed',
        aggregateId: event.paymentId,
        aggregateType: 'Payment',
        eventData: {
          amount: event.amount,
          billId: event.billId,
          method: event.method,
          reason: event.reason,
          errorCode: event.errorCode,
          failedAt: new Date()
        }
      }, {
        userId: event.userId,
        correlationId: event.correlationId
      });

    } catch (error) {
      logger.error('Failed to audit payment failed event:', error);
    }
  },

  'payment.retry': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.PAYMENT_RETRY,
        resource: 'payment',
        resourceId: event.paymentId,
        description: `Payment retry attempt ${event.attemptNumber}`,
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.SUCCESS,
        metadata: {
          attemptNumber: event.attemptNumber,
          previousError: event.previousError,
          retryReason: event.retryReason
        },
        context: {
          userId: event.userId,
          correlationId: event.correlationId
        }
      });

    } catch (error) {
      logger.error('Failed to audit payment retry event:', error);
    }
  },

  // Bill Events
  'bill.created': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.BILL_CREATE,
        resource: 'bill',
        resourceId: event.billId,
        description: `New bill created - Amount: ${event.amount}, Due: ${event.dueDate}`,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        metadata: {
          amount: event.amount,
          dueDate: event.dueDate,
          utilityProvider: event.utilityProvider,
          billType: event.billType
        },
        context: {
          userId: event.userId,
          correlationId: event.correlationId
        }
      });

      await auditService.logEvent({
        eventType: 'BillCreated',
        aggregateId: event.billId,
        aggregateType: 'Bill',
        eventData: {
          amount: event.amount,
          dueDate: event.dueDate,
          utilityProvider: event.utilityProvider,
          billType: event.billType,
          createdAt: new Date()
        }
      }, {
        userId: event.userId,
        correlationId: event.correlationId
      });

    } catch (error) {
      logger.error('Failed to audit bill created event:', error);
    }
  },

  'bill.paid': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.BILL_PAY,
        resource: 'bill',
        resourceId: event.billId,
        description: `Bill marked as paid - Payment: ${event.paymentId}`,
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.SUCCESS,
        metadata: {
          paymentId: event.paymentId,
          paidAmount: event.paidAmount,
          paidAt: event.paidAt
        },
        context: {
          userId: event.userId,
          correlationId: event.correlationId
        }
      });

      await auditService.logEvent({
        eventType: 'BillPaid',
        aggregateId: event.billId,
        aggregateType: 'Bill',
        eventData: {
          paymentId: event.paymentId,
          paidAmount: event.paidAmount,
          paidAt: event.paidAt
        }
      }, {
        userId: event.userId,
        correlationId: event.correlationId
      });

    } catch (error) {
      logger.error('Failed to audit bill paid event:', error);
    }
  },

  // User Events
  'user.created': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.USER_REGISTER,
        resource: 'user',
        resourceId: event.userId,
        description: `New user registered - ${event.email}`,
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.SUCCESS,
        metadata: {
          email: event.email,
          username: event.username,
          registrationMethod: event.registrationMethod || 'email'
        },
        context: {
          userId: event.userId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          correlationId: event.correlationId
        }
      });

      await auditService.logEvent({
        eventType: 'UserRegistered',
        aggregateId: event.userId,
        aggregateType: 'User',
        eventData: {
          email: event.email,
          username: event.username,
          registrationMethod: event.registrationMethod,
          registeredAt: new Date()
        }
      }, {
        userId: event.userId,
        correlationId: event.correlationId
      });

    } catch (error) {
      logger.error('Failed to audit user created event:', error);
    }
  },

  'user.updated': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.USER_UPDATE_PROFILE,
        resource: 'user',
        resourceId: event.userId,
        description: `User profile updated`,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        beforeState: event.beforeState,
        afterState: event.afterState,
        metadata: {
          updatedFields: event.updatedFields
        },
        context: {
          userId: event.userId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          correlationId: event.correlationId
        }
      });

      await auditService.logEvent({
        eventType: 'UserProfileUpdated',
        aggregateId: event.userId,
        aggregateType: 'User',
        eventData: {
          updatedFields: event.updatedFields,
          beforeState: event.beforeState,
          afterState: event.afterState,
          updatedAt: new Date()
        }
      }, {
        userId: event.userId,
        correlationId: event.correlationId
      });

    } catch (error) {
      logger.error('Failed to audit user updated event:', error);
    }
  },

  'user.login': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.USER_LOGIN,
        resource: 'user',
        resourceId: event.userId,
        description: `User login successful`,
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.SUCCESS,
        metadata: {
          loginMethod: event.loginMethod || 'email',
          sessionId: event.sessionId,
          twoFactorUsed: event.twoFactorUsed || false
        },
        context: {
          userId: event.userId,
          sessionId: event.sessionId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          correlationId: event.correlationId
        }
      });

    } catch (error) {
      logger.error('Failed to audit user login event:', error);
    }
  },

  'user.logout': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.USER_LOGOUT,
        resource: 'user',
        resourceId: event.userId,
        description: `User logout`,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        metadata: {
          sessionId: event.sessionId,
          logoutReason: event.logoutReason || 'user_initiated'
        },
        context: {
          userId: event.userId,
          sessionId: event.sessionId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          correlationId: event.correlationId
        }
      });

    } catch (error) {
      logger.error('Failed to audit user logout event:', error);
    }
  },

  // Document Events
  'document.uploaded': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.DOCUMENT_UPLOAD,
        resource: 'document',
        resourceId: event.documentId,
        description: `Document uploaded - ${event.filename}`,
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.SUCCESS,
        metadata: {
          filename: event.filename,
          fileSize: event.fileSize,
          mimeType: event.mimeType,
          uploadPath: event.uploadPath
        },
        context: {
          userId: event.userId,
          correlationId: event.correlationId
        }
      });

      await auditService.logEvent({
        eventType: 'DocumentUploaded',
        aggregateId: event.documentId,
        aggregateType: 'Document',
        eventData: {
          filename: event.filename,
          fileSize: event.fileSize,
          mimeType: event.mimeType,
          uploadPath: event.uploadPath,
          uploadedAt: new Date()
        }
      }, {
        userId: event.userId,
        correlationId: event.correlationId
      });

    } catch (error) {
      logger.error('Failed to audit document uploaded event:', error);
    }
  },

  // Webhook Events
  'webhook.created': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.WEBHOOK_CREATE,
        resource: 'webhook',
        resourceId: event.webhookId,
        description: `Webhook created - ${event.url}`,
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.SUCCESS,
        metadata: {
          url: event.url,
          events: event.events,
          description: event.description
        },
        context: {
          userId: event.userId,
          correlationId: event.correlationId
        }
      });

    } catch (error) {
      logger.error('Failed to audit webhook created event:', error);
    }
  },

  'webhook.triggered': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.WEBHOOK_TRIGGER,
        resource: 'webhook',
        resourceId: event.webhookId,
        description: `Webhook triggered - ${event.eventType}`,
        severity: AuditSeverity.LOW,
        status: event.success ? AuditStatus.SUCCESS : AuditStatus.FAILURE,
        errorMessage: event.error,
        metadata: {
          eventType: event.eventType,
          url: event.url,
          statusCode: event.statusCode,
          responseTime: event.responseTime,
          attemptNumber: event.attemptNumber
        },
        context: {
          correlationId: event.correlationId
        }
      });

    } catch (error) {
      logger.error('Failed to audit webhook triggered event:', error);
    }
  },

  // System Events
  'system.error': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.SYSTEM_ERROR,
        resource: 'system',
        description: `System error - ${event.error}`,
        severity: AuditSeverity.HIGH,
        status: AuditStatus.FAILURE,
        errorMessage: event.error,
        metadata: {
          errorType: event.errorType,
          stackTrace: event.stackTrace,
          endpoint: event.endpoint,
          method: event.method
        },
        context: {
          userId: event.userId,
          ipAddress: event.ipAddress,
          correlationId: event.correlationId
        }
      });

    } catch (error) {
      logger.error('Failed to audit system error event:', error);
    }
  },

  // Admin Events
  'admin.user_role_updated': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.ADMIN_UPDATE_USER_ROLE,
        resource: 'user',
        resourceId: event.targetUserId,
        description: `Admin updated user role from ${event.oldRole} to ${event.newRole}`,
        severity: AuditSeverity.HIGH,
        status: AuditStatus.SUCCESS,
        beforeState: { role: event.oldRole },
        afterState: { role: event.newRole },
        metadata: {
          oldRole: event.oldRole,
          newRole: event.newRole,
          reason: event.reason
        },
        context: {
          userId: event.adminId,
          adminId: event.adminId,
          correlationId: event.correlationId
        }
      });

      await auditService.logEvent({
        eventType: 'UserRoleUpdated',
        aggregateId: event.targetUserId,
        aggregateType: 'User',
        eventData: {
          oldRole: event.oldRole,
          newRole: event.newRole,
          updatedBy: event.adminId,
          reason: event.reason,
          updatedAt: new Date()
        }
      }, {
        userId: event.adminId,
        correlationId: event.correlationId
      });

    } catch (error) {
      logger.error('Failed to audit admin user role updated event:', error);
    }
  },

  'admin.user_suspended': async (event: any) => {
    try {
      await auditService.logAudit({
        action: AuditAction.ADMIN_SUSPEND_USER,
        resource: 'user',
        resourceId: event.targetUserId,
        description: `Admin suspended user account`,
        severity: AuditSeverity.HIGH,
        status: AuditStatus.SUCCESS,
        metadata: {
          reason: event.reason,
          suspensionDuration: event.suspensionDuration,
          suspendedUntil: event.suspendedUntil
        },
        context: {
          userId: event.adminId,
          adminId: event.adminId,
          correlationId: event.correlationId
        }
      });

      await auditService.logEvent({
        eventType: 'UserSuspended',
        aggregateId: event.targetUserId,
        aggregateType: 'User',
        eventData: {
          suspendedBy: event.adminId,
          reason: event.reason,
          suspensionDuration: event.suspensionDuration,
          suspendedUntil: event.suspendedUntil,
          suspendedAt: new Date()
        }
      }, {
        userId: event.adminId,
        correlationId: event.correlationId
      });

    } catch (error) {
      logger.error('Failed to audit admin user suspended event:', error);
    }
  }
};

// Register all audit handlers
export const registerAuditHandlers = (eventBus: any) => {
  Object.entries(auditHandlers).forEach(([eventType, handler]) => {
    eventBus.subscribe(eventType, handler);
  });

  logger.info('Audit event handlers registered');
};