import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { AuditService } from '@/core/audit/audit.service';
import { EventBusService } from '@/core/events/event-bus.service';

// ============================================================================
// Interfaces
// ============================================================================

export interface CreateApprovalRequest {
  tenantId: string;
  requesterId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  justification: string;
  approverRoles: string[];
  expiresInMinutes?: number;
  metadata?: Record<string, any>;
}

export interface ApprovalRequestRecord {
  id: string;
  tenantId: string;
  requesterId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  justification: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approverRoles: string[];
  approvedBy?: string | null;
  rejectedBy?: string | null;
  rejectionReason?: string | null;
  expiresAt: Date;
  resolvedAt?: Date | null;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// ApprovalService
// ============================================================================

/** Default expiration for approval requests (24 hours) */
const DEFAULT_EXPIRY_MINUTES = 24 * 60;

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create a new approval request for a privileged action.
   */
  async requestApproval(
    data: CreateApprovalRequest,
  ): Promise<ApprovalRequestRecord> {
    const expiresInMinutes = data.expiresInMinutes ?? DEFAULT_EXPIRY_MINUTES;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    if (!data.approverRoles || data.approverRoles.length === 0) {
      throw new BadRequestException(
        'At least one approver role must be specified',
      );
    }

    if (!data.justification || data.justification.trim().length === 0) {
      throw new BadRequestException('Justification is required');
    }

    // Check for existing pending request for the same action/resource
    const existing = await this.prisma.approvalRequest.findFirst({
      where: {
        tenantId: data.tenantId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `A pending approval request already exists for this action (id: ${existing.id})`,
      );
    }

    const request = await this.prisma.approvalRequest.create({
      data: {
        tenantId: data.tenantId,
        requesterId: data.requesterId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        justification: data.justification.trim(),
        status: 'pending',
        approverRoles: data.approverRoles,
        expiresAt,
        metadata: data.metadata ?? undefined,
      },
    });

    // Audit log
    await this.auditService.log({
      tenantId: data.tenantId,
      actorId: data.requesterId,
      actorType: 'user',
      action: 'approval.requested',
      entityType: 'ApprovalRequest',
      entityId: request.id,
      changes: {
        after: {
          action: data.action,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          approverRoles: data.approverRoles,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    // Publish event for notifications
    await this.eventBus.publish({
      type: 'approval.requested',
      tenantId: data.tenantId,
      data: {
        approvalRequestId: request.id,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        requesterId: data.requesterId,
        approverRoles: data.approverRoles,
        justification: data.justification,
        expiresAt: expiresAt.toISOString(),
      },
      timestamp: new Date(),
    });

    this.logger.log(
      `Approval request created: ${request.id} for ${data.action} on ${data.resourceType}:${data.resourceId}`,
    );

    return request as ApprovalRequestRecord;
  }

  /**
   * Approve a pending approval request.
   * Validates that the approver has one of the required roles.
   */
  async approve(
    requestId: string,
    approverId: string,
    approverRoles: string[],
  ): Promise<ApprovalRequestRecord> {
    const request = await this.findAndValidate(requestId);

    // Verify the approver cannot approve their own request
    if (request.requesterId === approverId) {
      throw new ForbiddenException('Cannot approve your own request');
    }

    // Verify the approver has one of the required roles
    const requiredRoles = request.approverRoles as string[];
    const hasRole = approverRoles.some((role) => requiredRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(
        'You do not have the required role to approve this request',
      );
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        approvedBy: approverId,
        resolvedAt: new Date(),
      },
    });

    // Audit log
    await this.auditService.log({
      tenantId: request.tenantId,
      actorId: approverId,
      actorType: 'user',
      action: 'approval.approved',
      entityType: 'ApprovalRequest',
      entityId: requestId,
      changes: {
        before: { status: 'pending' },
        after: { status: 'approved', approvedBy: approverId },
      },
    });

    // Publish event
    await this.eventBus.publish({
      type: 'approval.approved',
      tenantId: request.tenantId,
      data: {
        approvalRequestId: requestId,
        action: request.action,
        resourceType: request.resourceType,
        resourceId: request.resourceId,
        requesterId: request.requesterId,
        approvedBy: approverId,
      },
      timestamp: new Date(),
    });

    this.logger.log(`Approval request ${requestId} approved by ${approverId}`);

    return updated as ApprovalRequestRecord;
  }

  /**
   * Reject a pending approval request.
   */
  async reject(
    requestId: string,
    approverId: string,
    approverRoles: string[],
    reason: string,
  ): Promise<ApprovalRequestRecord> {
    const request = await this.findAndValidate(requestId);

    // Verify the rejector has one of the required roles
    const requiredRoles = request.approverRoles as string[];
    const hasRole = approverRoles.some((role) => requiredRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(
        'You do not have the required role to reject this request',
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        rejectedBy: approverId,
        rejectionReason: reason.trim(),
        resolvedAt: new Date(),
      },
    });

    // Audit log
    await this.auditService.log({
      tenantId: request.tenantId,
      actorId: approverId,
      actorType: 'user',
      action: 'approval.rejected',
      entityType: 'ApprovalRequest',
      entityId: requestId,
      changes: {
        before: { status: 'pending' },
        after: {
          status: 'rejected',
          rejectedBy: approverId,
          rejectionReason: reason.trim(),
        },
      },
    });

    // Publish event
    await this.eventBus.publish({
      type: 'approval.rejected',
      tenantId: request.tenantId,
      data: {
        approvalRequestId: requestId,
        action: request.action,
        resourceType: request.resourceType,
        resourceId: request.resourceId,
        requesterId: request.requesterId,
        rejectedBy: approverId,
        reason: reason.trim(),
      },
      timestamp: new Date(),
    });

    this.logger.log(`Approval request ${requestId} rejected by ${approverId}`);

    return updated as ApprovalRequestRecord;
  }

  /**
   * Find pending approval requests that the given user can approve,
   * based on their roles.
   */
  async findPending(
    tenantId: string,
    approverRoles: string[],
  ): Promise<ApprovalRequestRecord[]> {
    // Expire stale requests first
    await this.expireStaleRequests(tenantId);

    // Find all pending requests in this tenant
    const pending = await this.prisma.approvalRequest.findMany({
      where: {
        tenantId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter to only those where the user's roles overlap with approverRoles
    return pending.filter((req) => {
      const requiredRoles = req.approverRoles as string[];
      return approverRoles.some((role) => requiredRoles.includes(role));
    }) as ApprovalRequestRecord[];
  }

  /**
   * Check if a given approval request has been approved.
   * Returns true if the request exists and is in 'approved' status.
   */
  async executeIfApproved(requestId: string): Promise<boolean> {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) return false;

    // Check for expiration
    if (request.status === 'pending' && request.expiresAt < new Date()) {
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: 'expired', resolvedAt: new Date() },
      });
      return false;
    }

    return request.status === 'approved';
  }

  /**
   * Get a single approval request by ID.
   */
  async findById(requestId: string): Promise<ApprovalRequestRecord | null> {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });
    return request as ApprovalRequestRecord | null;
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  /**
   * Find and validate a pending request, throwing on not-found or invalid state.
   */
  private async findAndValidate(requestId: string) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(
        `Approval request ${requestId} not found`,
      );
    }

    // Check for expiration
    if (request.status === 'pending' && request.expiresAt < new Date()) {
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: 'expired', resolvedAt: new Date() },
      });
      throw new BadRequestException('Approval request has expired');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(
        `Approval request is already ${request.status}`,
      );
    }

    return request;
  }

  /**
   * Expire any stale pending requests in a tenant.
   */
  private async expireStaleRequests(tenantId: string): Promise<void> {
    try {
      await this.prisma.approvalRequest.updateMany({
        where: {
          tenantId,
          status: 'pending',
          expiresAt: { lt: new Date() },
        },
        data: {
          status: 'expired',
          resolvedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to expire stale requests: ${(err as Error).message}`,
      );
    }
  }
}
