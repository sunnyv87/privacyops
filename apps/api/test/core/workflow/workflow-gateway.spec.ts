import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { WorkflowGateway } from '../../../src/core/workflow/workflow.gateway';

describe('WorkflowGateway', () => {
  let gateway: WorkflowGateway;

  const mockJwtService = {
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowGateway,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    gateway = module.get<WorkflowGateway>(WorkflowGateway);
  });

  afterEach(() => jest.clearAllMocks());

  describe('handleConnection', () => {
    it('should disconnect client with no token', async () => {
      const mockClient = {
        id: 'client-1',
        handshake: { auth: {}, headers: {} },
        disconnect: jest.fn(),
        join: jest.fn(),
      } as any;

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });

    it('should join tenant room with valid token', async () => {
      mockJwtService.verify.mockReturnValue({ tenantId: 'tenant-1', sub: 'user-1' });

      const mockClient = {
        id: 'client-2',
        handshake: { auth: { token: 'valid-jwt' }, headers: {} },
        disconnect: jest.fn(),
        join: jest.fn(),
      } as any;

      await gateway.handleConnection(mockClient);

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-jwt');
      expect(mockClient.join).toHaveBeenCalledWith('tenant:tenant-1');
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect client with invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const mockClient = {
        id: 'client-3',
        handshake: { auth: { token: 'bad-jwt' }, headers: {} },
        disconnect: jest.fn(),
        join: jest.fn(),
      } as any;

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });

    it('should extract token from Authorization header', async () => {
      mockJwtService.verify.mockReturnValue({ tenantId: 'tenant-2' });

      const mockClient = {
        id: 'client-4',
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer header-jwt-token' },
        },
        disconnect: jest.fn(),
        join: jest.fn(),
      } as any;

      await gateway.handleConnection(mockClient);

      expect(mockJwtService.verify).toHaveBeenCalledWith('header-jwt-token');
      expect(mockClient.join).toHaveBeenCalledWith('tenant:tenant-2');
    });
  });

  describe('emit methods', () => {
    it('should emit workflow:started to tenant room', () => {
      const mockTo = jest.fn().mockReturnValue({ emit: jest.fn() });
      gateway.server = { to: mockTo } as any;

      gateway.emitWorkflowStarted('tenant-1', {
        workflowId: 'wf-1',
        type: 'scan',
        entityType: 'scanJob',
        entityId: 'sj-1',
      });

      expect(mockTo).toHaveBeenCalledWith('tenant:tenant-1');
    });

    it('should emit workflow:progress to tenant room', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      gateway.server = { to: mockTo } as any;

      gateway.emitWorkflowProgress('tenant-1', {
        workflowId: 'wf-1',
        step: 2,
        totalSteps: 5,
        message: 'Scanning tables...',
      });

      expect(mockEmit).toHaveBeenCalledWith('workflow:progress', {
        workflowId: 'wf-1',
        step: 2,
        totalSteps: 5,
        message: 'Scanning tables...',
      });
    });

    it('should emit workflow:completed to tenant room', () => {
      const mockEmit = jest.fn();
      gateway.server = { to: jest.fn().mockReturnValue({ emit: mockEmit }) } as any;

      gateway.emitWorkflowCompleted('tenant-1', {
        workflowId: 'wf-1',
        result: { status: 'done' },
      });

      expect(mockEmit).toHaveBeenCalledWith('workflow:completed', {
        workflowId: 'wf-1',
        result: { status: 'done' },
      });
    });

    it('should emit workflow:failed to tenant room', () => {
      const mockEmit = jest.fn();
      gateway.server = { to: jest.fn().mockReturnValue({ emit: mockEmit }) } as any;

      gateway.emitWorkflowFailed('tenant-1', {
        workflowId: 'wf-1',
        error: 'Connection timeout',
      });

      expect(mockEmit).toHaveBeenCalledWith('workflow:failed', {
        workflowId: 'wf-1',
        error: 'Connection timeout',
      });
    });

    it('should not throw when server is undefined', () => {
      gateway.server = undefined as any;

      expect(() =>
        gateway.emitWorkflowStarted('tenant-1', {
          workflowId: 'wf-1',
          type: 'scan',
          entityType: 'scanJob',
          entityId: 'sj-1',
        }),
      ).not.toThrow();
    });
  });
});
