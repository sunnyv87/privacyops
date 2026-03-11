import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_APPROVAL_KEY,
  RequireApprovalMetadata,
} from '../decorators/require-approval.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ApprovalService } from '../services/approval.service';
import { AuditService } from '@/core/audit/audit.service';

@Injectable()
export class ApprovalGuard implements CanActivate {
  private readonly logger = new Logger(ApprovalGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly approvalService: ApprovalService,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip public endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Read approval metadata from decorator
    const meta = this.reflector.getAllAndOverride<RequireApprovalMetadata>(
      REQUIRE_APPROVAL_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @RequireApproval decorator, pass through
    if (!meta) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Determine action name
    const action =
      meta.action ||
      this.deriveActionName(context);

    // Determine resource ID and type
    const resourceIdParam = meta.resourceIdParam || 'id';
    const resourceId =
      request.params?.[resourceIdParam] ||
      request.body?.[resourceIdParam] ||
      request.query?.[resourceIdParam] ||
      'unknown';

    const resourceType =
      meta.resourceType ||
      context.getClass().name.replace('Controller', '');

    // Check if the request includes an approval ID header
    const approvalId =
      request.headers['x-approval-id'] || request.body?.approvalId;

    if (approvalId) {
      // Validate the existing approval
      return this.validateApproval(
        approvalId,
        action,
        resourceType,
        resourceId,
        user,
        request,
      );
    }

    // No approval ID — create a new approval request and return 202
    await this.createApprovalAndReject(
      meta,
      action,
      resourceType,
      resourceId,
      user,
      request,
    );

    // This line is never reached — createApprovalAndReject always throws
    return false;
  }

  /**
   * Validate an existing approval request.
   */
  private async validateApproval(
    approvalId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    user: any,
    request: any,
  ): Promise<boolean> {
    const isApproved =
      await this.approvalService.executeIfApproved(approvalId);

    if (!isApproved) {
      throw new ForbiddenException(
        'Approval request is not approved, has expired, or does not exist',
      );
    }

    // Verify the approval matches the current request
    const approval = await this.approvalService.findById(approvalId);
    if (!approval) {
      throw new ForbiddenException('Approval request not found');
    }

    // Ensure the approval is for the same action and resource
    if (approval.action !== action) {
      throw new ForbiddenException(
        `Approval action mismatch: expected "${action}", got "${approval.action}"`,
      );
    }

    if (approval.resourceId !== resourceId && resourceId !== 'unknown') {
      throw new ForbiddenException(
        'Approval resource ID does not match the request',
      );
    }

    // Ensure the requester is the same user
    if (approval.requesterId !== user.id) {
      throw new ForbiddenException(
        'Approval was requested by a different user',
      );
    }

    // Ensure the approval is within the same tenant
    if (approval.tenantId !== user.tenantId) {
      throw new ForbiddenException('Approval tenant mismatch');
    }

    // Log the approved execution
    await this.auditService.log({
      tenantId: user.tenantId,
      actorId: user.id,
      actorType: 'user',
      action: 'approval.executed',
      entityType: 'ApprovalRequest',
      entityId: approvalId,
      changes: {
        after: {
          executedAction: action,
          resourceType,
          resourceId,
          approvedBy: approval.approvedBy,
        },
      },
      ipAddress: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers?.['user-agent'],
    });

    this.logger.log(
      `Approved action "${action}" executed by ${user.id} with approval ${approvalId}`,
    );

    // Attach approval to request for downstream reference
    request.approval = approval;

    return true;
  }

  /**
   * Create a new approval request and throw a 202 Accepted response.
   */
  private async createApprovalAndReject(
    meta: RequireApprovalMetadata,
    action: string,
    resourceType: string,
    resourceId: string,
    user: any,
    request: any,
  ): Promise<never> {
    // Extract justification from the request body
    const justification =
      request.body?.justification ||
      request.body?.reason ||
      `Action "${action}" on ${resourceType}:${resourceId} requires approval`;

    const approvalRequest = await this.approvalService.requestApproval({
      tenantId: user.tenantId,
      requesterId: user.id,
      action,
      resourceType,
      resourceId,
      justification,
      approverRoles: meta.approverRoles,
      expiresInMinutes: meta.expiresInMinutes,
    });

    // Throw 202 Accepted with the approval request details
    throw new HttpException(
      {
        statusCode: HttpStatus.ACCEPTED,
        message:
          'Action requires approval. An approval request has been created.',
        approvalRequestId: approvalRequest.id,
        action,
        resourceType,
        resourceId,
        approverRoles: meta.approverRoles,
        expiresAt: approvalRequest.expiresAt,
        status: 'pending',
        instruction:
          'Resubmit the request with the header "x-approval-id" once approved.',
      },
      HttpStatus.ACCEPTED,
    );
  }

  /**
   * Derive an action name from the execution context.
   */
  private deriveActionName(context: ExecutionContext): string {
    const controller = context.getClass().name.replace('Controller', '');
    const handler = context.getHandler().name;
    const request = context.switchToHttp().getRequest();
    const method = (request.method || 'UNKNOWN').toLowerCase();

    return `${controller.toLowerCase()}.${handler}`.replace(
      /^(.+)\.(create|find|update|remove|delete)(.*)$/,
      (_match, resource, verb) => `${resource}.${verb}`,
    ) || `${method}.${controller.toLowerCase()}.${handler}`;
  }
}
