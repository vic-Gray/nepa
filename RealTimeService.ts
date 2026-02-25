import { SocketServer } from '../websocket/SocketServer';

export enum NotificationType {
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  BILL_GENERATED = 'BILL_GENERATED',
  SYSTEM_ALERT = 'SYSTEM_ALERT'
}

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  timestamp: string;
}

export class RealTimeService {
  /**
   * Send a real-time update to a specific user
   */
  static sendUserUpdate(userId: string, type: NotificationType, data: any) {
    try {
      const io = SocketServer.getIO();
      const payload: NotificationPayload = {
        type,
        title: this.getTitleForType(type),
        message: this.getMessageForType(type, data),
        data,
        timestamp: new Date().toISOString()
      };

      io.to(`user_${userId}`).emit('notification', payload);
      
      // Also emit specific event for granular listening
      io.to(`user_${userId}`).emit(type.toLowerCase(), data);
      
      console.log(`📡 Sent ${type} to user ${userId}`);
    } catch (error) {
      console.error(`Failed to send real-time update to user ${userId}:`, error);
    }
  }

  /**
   * Broadcast update to all connected users (Admin use case)
   */
  static broadcast(type: NotificationType, data: any) {
    try {
      const io = SocketServer.getIO();
      io.emit('broadcast', { type, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Failed to broadcast message:', error);
    }
  }

  private static getTitleForType(type: NotificationType): string {
    switch (type) {
      case NotificationType.PAYMENT_SUCCESS: return 'Payment Successful';
      case NotificationType.PAYMENT_FAILED: return 'Payment Failed';
      case NotificationType.PAYMENT_PENDING: return 'Payment Processing';
      case NotificationType.BILL_GENERATED: return 'New Bill Available';
      case NotificationType.SYSTEM_ALERT: return 'System Alert';
      default: return 'Notification';
    }
  }

  private static getMessageForType(type: NotificationType, data: any): string {
    switch (type) {
      case NotificationType.PAYMENT_SUCCESS: 
        return `Your payment of ₦${data.amount} was successful.`;
      case NotificationType.PAYMENT_FAILED: 
        return `Payment failed: ${data.reason || 'Unknown error'}`;
      case NotificationType.BILL_GENERATED: 
        return `A new bill for ${data.utilityName} is ready.`;
      default: 
        return 'You have a new notification.';
    }
  }
}