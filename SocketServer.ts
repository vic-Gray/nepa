import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface AuthSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class SocketServer {
  private static instance: SocketServer;
  private io: Server;

  private constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  public static getInstance(httpServer?: HttpServer): SocketServer {
    if (!SocketServer.instance && httpServer) {
      SocketServer.instance = new SocketServer(httpServer);
    }
    return SocketServer.instance;
  }

  public static getIO(): Server {
    if (!SocketServer.instance) {
      throw new Error('SocketServer not initialized. Call getInstance(httpServer) first.');
    }
    return SocketServer.instance.io;
  }

  private setupMiddleware() {
    this.io.use((socket: AuthSocket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        const secret = process.env.JWT_SECRET || 'default_secret';
        const decoded = jwt.verify(token, secret) as any;
        socket.user = decoded;
        next();
      } catch (err) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthSocket) => {
      console.log(`🔌 User connected: ${socket.user?.id} (${socket.id})`);

      // Join user-specific room for private notifications
      if (socket.user?.id) {
        const userRoom = `user_${socket.user.id}`;
        socket.join(userRoom);
        console.log(`👤 User ${socket.user.id} joined room: ${userRoom}`);
      }

      socket.on('disconnect', (reason) => {
        console.log(`❌ User disconnected: ${socket.user?.id} (${reason})`);
      });

      // Handle client-side events if needed
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }
}