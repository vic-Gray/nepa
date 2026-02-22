import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export interface NotificationData {
  id?: string;
  userId: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'BILL_CREATED' | 'BILL_OVERDUE' | 'PAYMENT_CONFIRMED' | 'SYSTEM_ALERT';
  title: string;
  message: string;
  data?: any;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category?: 'BILLING' | 'PAYMENT' | 'SYSTEM' | 'USER' | 'SECURITY';
  actionUrl?: string;
  actionText?: string;
  isRead?: boolean;
  expiresAt?: Date;
  sound?: string;
  icon?: string;
}

export interface NotificationPreference {
  userId: string;
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
  };
  categories?: {
    [key: string]: boolean;
  };
}

export interface WebSocketMessage {
  type: 'NOTIFICATION' | 'NOTIFICATION_READ' | 'NOTIFICATION_DELETED' | 'USER_ONLINE' | 'USER_OFFLINE';
  data: any;
  timestamp: Date;
  userId?: string;
}

export class RealTimeNotificationService {
  private static instance: RealTimeNotificationService;
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> socketIds
  private notificationQueue: Map<string, NotificationData[]> = new Map(); // userId -> notifications

  static getInstance(): RealTimeNotificationService {
    if (!RealTimeNotificationService.instance) {
      RealTimeNotificationService.instance = new RealTimeNotificationService();
    }
    return RealTimeNotificationService.instance;
  }

  initialize(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Handle user authentication
      socket.on('authenticate', async (data: { token: string; userId: string }) => {
        try {
          // Verify token (implement your JWT verification here)
          // const decoded = jwt.verify(data.token, process.env.JWT_SECRET!);
          const userId = data.userId; // Use decoded.userId in production
          
          // Add user to connected users
          if (!this.connectedUsers.has(userId)) {
            this.connectedUsers.set(userId, new Set());
          }
          this.connectedUsers.get(userId)!.add(socket.id);
          
          // Join user's personal room
          socket.join(userId);
          
          // Send queued notifications
          const queued = this.notificationQueue.get(userId) || [];
          if (queued.length > 0) {
            socket.emit('notifications', queued);
            this.notificationQueue.delete(userId);
          }
          
          // Send unread notifications count
          const unreadCount = await this.getUnreadCount(userId);
          socket.emit('unread_count', unreadCount);
          
          console.log(`User ${userId} authenticated with socket ${socket.id}`);
        } catch (error) {
          console.error('Authentication failed:', error);
          socket.emit('error', { message: 'Authentication failed' });
        }
      });

      // Handle mark as read
      socket.on('mark_read', async (notificationId: string) => {
        try {
          await this.markAsRead(notificationId);
          
          // Get userId from socket rooms
          const rooms = Array.from(socket.rooms);
          const userId = rooms.find(room => room !== socket.id);
          
          if (userId) {
            const unreadCount = await this.getUnreadCount(userId);
            this.io.to(userId).emit('unread_count', unreadCount);
          }
        } catch (error) {
          console.error('Mark as read failed:', error);
        }
      });

      // Handle mark all as read
      socket.on('mark_all_read', async () => {
        try {
          const rooms = Array.from(socket.rooms);
          const userId = rooms.find(room => room !== socket.id);
          
          if (userId) {
            await this.markAllAsRead(userId);
            this.io.to(userId).emit('unread_count', 0);
          }
        } catch (error) {
          console.error('Mark all as read failed:', error);
        }
      });

      // Handle delete notification
      socket.on('delete_notification', async (notificationId: string) => {
        try {
          await this.deleteNotification(notificationId);
          
          const rooms = Array.from(socket.rooms);
          const userId = rooms.find(room => room !== socket.id);
          
          if (userId) {
            const unreadCount = await this.getUnreadCount(userId);
            this.io.to(userId).emit('unread_count', unreadCount);
          }
        } catch (error) {
          console.error('Delete notification failed:', error);
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        
        // Remove socket from connected users
        for (const [userId, sockets] of this.connectedUsers.entries()) {
          if (sockets.has(socket.id)) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.connectedUsers.delete(userId);
            }
            break;
          }
        }
      });
    });
  }

  // Send real-time notification
  async sendNotification(notification: Omit<NotificationData, 'id'>): Promise<string> {
    const notificationId = uuidv4();
    const fullNotification: NotificationData = {
      ...notification,
      id: notificationId,
      isRead: false
    };

    // Save to database
    await this.saveNotification(fullNotification);

    // Check user preferences
    const preferences = await this.getUserPreferences(notification.userId);
    if (!preferences.inApp) {
      return notificationId;
    }

    // Check quiet hours
    if (this.isQuietHours(preferences)) {
      return notificationId;
    }

    // Send via WebSocket if user is online
    const userSockets = this.connectedUsers.get(notification.userId);
    if (userSockets && userSockets.size > 0) {
      this.io.to(notification.userId).emit('notification', fullNotification);
      
      // Update unread count
      const unreadCount = await this.getUnreadCount(notification.userId);
      this.io.to(notification.userId).emit('unread_count', unreadCount);
      
      // Play sound if enabled
      if (preferences.soundEnabled && notification.sound) {
        this.io.to(notification.userId).emit('play_sound', notification.sound);
      }
    } else {
      // Queue for when user comes online
      if (!this.notificationQueue.has(notification.userId)) {
        this.notificationQueue.set(notification.userId, []);
      }
      this.notificationQueue.get(notification.userId)!.push(fullNotification);
    }

    // Send push notification if enabled
    if (preferences.push) {
      await this.sendPushNotification(notification);
    }

    // Send desktop notification if enabled
    if (preferences.desktopNotifications) {
      await this.sendDesktopNotification(fullNotification);
    }

    return notificationId;
  }

  // Send bulk notifications
  async sendBulkNotifications(notifications: Omit<NotificationData, 'id'>[]): Promise<string[]> {
    const results = await Promise.all(
      notifications.map(notification => this.sendNotification(notification))
    );
    return results;
  }

  // Get user notifications
  async getUserNotifications(
    userId: string, 
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      category?: string;
    } = {}
  ): Promise<NotificationData[]> {
    const { limit = 50, offset = 0, unreadOnly = false, category } = options;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }
    if (category) {
      where.category = category;
    }

    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  // Get unread count
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    });
  }

  // Mark as read
  async markAsRead(notificationId: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() }
    });
  }

  // Mark all as read for user
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
  }

  // Delete notification
  async deleteNotification(notificationId: string): Promise<void> {
    await prisma.notification.delete({
      where: { id: notificationId }
    });
  }

  // Update user preferences
  async updatePreferences(userId: string, preferences: Partial<NotificationPreference>): Promise<void> {
    await prisma.notificationPreference.upsert({
      where: { userId },
      update: preferences,
      create: { userId, ...preferences }
    });
  }

  // Private helper methods
  private async saveNotification(notification: NotificationData): Promise<void> {
    await prisma.notification.create({
      data: {
        id: notification.id!,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        priority: notification.priority,
        category: notification.category,
        actionUrl: notification.actionUrl,
        actionText: notification.actionText,
        isRead: notification.isRead || false,
        expiresAt: notification.expiresAt,
        sound: notification.sound,
        icon: notification.icon
      }
    });
  }

  private async getUserPreferences(userId: string): Promise<NotificationPreference> {
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId }
    });

    return prefs || {
      userId,
      email: true,
      sms: false,
      push: true,
      inApp: true,
      soundEnabled: true,
      desktopNotifications: true,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      categories: {
        BILLING: true,
        PAYMENT: true,
        SYSTEM: true,
        USER: true,
        SECURITY: true
      }
    };
  }

  private isQuietHours(preferences: NotificationPreference): boolean {
    if (!preferences.quietHours?.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHours.end.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight quiet hours (e.g., 22:00 to 08:00)
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private async sendPushNotification(notification: NotificationData): Promise<void> {
    // Implement push notification service (Firebase, OneSignal, etc.)
    console.log(`[Push Notification] ${notification.title}: ${notification.message}`);
  }

  private async sendDesktopNotification(notification: NotificationData): Promise<void> {
    // This would be handled by the frontend service worker
    console.log(`[Desktop Notification] ${notification.title}: ${notification.message}`);
  }

  // Get online users count
  getOnlineUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}

// Legacy NotificationService for backward compatibility
export class NotificationService {
  private realTimeService = RealTimeNotificationService.getInstance();

  async sendBillCreated(userId: string, bill: any) {
    await this.realTimeService.sendNotification({
      userId,
      type: 'BILL_CREATED',
      title: 'New Bill Generated',
      message: `A new bill of ${bill.amount} has been generated. Due date: ${bill.dueDate}.`,
      priority: 'MEDIUM',
      category: 'BILLING',
      data: bill
    });
  }

  async sendBillOverdue(userId: string, bill: any, lateFee: number) {
    await this.realTimeService.sendNotification({
      userId,
      type: 'BILL_OVERDUE',
      title: 'Bill Overdue Notice',
      message: `Your bill is overdue. A late fee of ${lateFee} has been applied.`,
      priority: 'HIGH',
      category: 'BILLING',
      data: { bill, lateFee }
    });
  }

  async sendPaymentConfirmed(userId: string, payment: any) {
    await this.realTimeService.sendNotification({
      userId,
      type: 'PAYMENT_CONFIRMED',
      title: 'Payment Confirmed',
      message: `Your payment of ${payment.amount} has been confirmed.`,
      priority: 'SUCCESS',
      category: 'PAYMENT',
      data: payment
    });
  }

  async sendSystemAlert(userId: string, message: string, priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM') {
    await this.realTimeService.sendNotification({
      userId,
      type: 'SYSTEM_ALERT',
      title: 'System Alert',
      message,
      priority,
      category: 'SYSTEM'
    });
  }
}