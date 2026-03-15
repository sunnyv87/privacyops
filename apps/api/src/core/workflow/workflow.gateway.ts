import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

/**
 * WebSocket gateway for realtime workflow status updates.
 *
 * Clients connect with a JWT token and are placed in a tenant-specific room.
 * The server broadcasts workflow lifecycle events to all connected clients
 * in the relevant tenant room.
 *
 * Namespace: /workflows
 *
 * Events emitted to clients:
 *   workflow:started    — { workflowId, type, entityType, entityId }
 *   workflow:progress   — { workflowId, step, totalSteps, message }
 *   workflow:completed  — { workflowId, result }
 *   workflow:failed     — { workflowId, error }
 */
@WebSocketGateway({
  namespace: '/workflows',
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
    credentials: true,
  },
})
export class WorkflowGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WorkflowGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  afterInit() {
    this.logger.log('Workflow WebSocket gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ??
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no token`);
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token);
      const tenantId = payload.tenantId;

      if (!tenantId) {
        client.disconnect(true);
        return;
      }

      // Join the tenant room
      client.join(`tenant:${tenantId}`);
      (client as any).tenantId = tenantId;
      this.logger.log(
        `Client ${client.id} connected to tenant:${tenantId}`,
      );
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  // ---------------------------------------------------------------------------
  // Public methods called by WorkflowService to broadcast status
  // ---------------------------------------------------------------------------

  emitWorkflowStarted(
    tenantId: string,
    data: {
      workflowId: string;
      type: string;
      entityType: string;
      entityId: string;
    },
  ) {
    this.server?.to(`tenant:${tenantId}`).emit('workflow:started', data);
  }

  emitWorkflowProgress(
    tenantId: string,
    data: {
      workflowId: string;
      step: number;
      totalSteps: number;
      message: string;
    },
  ) {
    this.server?.to(`tenant:${tenantId}`).emit('workflow:progress', data);
  }

  emitWorkflowCompleted(
    tenantId: string,
    data: { workflowId: string; result?: any },
  ) {
    this.server?.to(`tenant:${tenantId}`).emit('workflow:completed', data);
  }

  emitWorkflowFailed(
    tenantId: string,
    data: { workflowId: string; error: string },
  ) {
    this.server?.to(`tenant:${tenantId}`).emit('workflow:failed', data);
  }
}
