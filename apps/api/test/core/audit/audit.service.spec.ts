import { Test } from '@nestjs/testing';
import { AuditService } from '@/core/audit/audit.service';
import { PrismaService } from '@/core/prisma/prisma.service';
import { EventBusService } from '@/core/events/event-bus.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: any;

  const mockAuditLogs: any[] = [];
  let logSequence = 0;

  beforeEach(async () => {
    mockAuditLogs.length = 0;
    logSequence = 0;

    prisma = {
      auditLog: {
        create: jest.fn().mockImplementation(({ data }) => {
          const log = { id: `log-${++logSequence}`, ...data };
          mockAuditLogs.push(log);
          return Promise.resolve(log);
        }),
        findMany: jest.fn().mockResolvedValue(mockAuditLogs),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      auditChainState: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (args) => {
        if (Array.isArray(args)) {
          return Promise.all(args);
        }
        return args(prisma);
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: EventBusService,
          useValue: {
            publish: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  describe('log', () => {
    it('should create an audit log entry with integrity hash', async () => {
      await service.log({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        actorType: 'user',
        action: 'user.created',
        entityType: 'User',
        entityId: 'user-2',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
      const createCall = prisma.auditLog.create.mock.calls[0][0];
      expect(createCall.data.tenantId).toBe('tenant-1');
      expect(createCall.data.action).toBe('user.created');
      expect(createCall.data.integrityHash).toBeDefined();
      expect(createCall.data.integrityHash).toHaveLength(64);
    });

    it('should chain hashes across multiple entries', async () => {
      await service.log({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        actorType: 'user',
        action: 'action.1',
        entityType: 'Test',
        entityId: 'id-1',
      });

      await service.log({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        actorType: 'user',
        action: 'action.2',
        entityType: 'Test',
        entityId: 'id-2',
      });

      const hash1 = prisma.auditLog.create.mock.calls[0][0].data.integrityHash;
      const hash2 = prisma.auditLog.create.mock.calls[1][0].data.integrityHash;
      expect(hash1).not.toBe(hash2);
    });

    it('should accept optional severity and category', async () => {
      await service.log({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        actorType: 'user',
        action: 'config.changed',
        entityType: 'Tenant',
        entityId: 'tenant-1',
        severity: 'critical',
        category: 'admin',
      });

      const createCall = prisma.auditLog.create.mock.calls[0][0];
      expect(createCall.data.severity).toBe('critical');
      expect(createCall.data.category).toBe('admin');
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security events with correct category', async () => {
      await service.logSecurityEvent({
        tenantId: 'tenant-1',
        eventType: 'login_failure',
        actorId: 'user-1',
        metadata: { email: 'test@example.com' },
        ipAddress: '1.2.3.4',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
      const createCall = prisma.auditLog.create.mock.calls[0][0];
      expect(createCall.data.action).toBe('security.login_failure');
      expect(createCall.data.category).toBe('security');
    });
  });

  describe('search', () => {
    it('should support pagination', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(100);

      const result = await service.search('tenant-1', {
        page: 2,
        pageSize: 25,
      });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.pageSize).toBe(25);
      expect(result.pagination.totalItems).toBe(100);
      expect(result.pagination.totalPages).toBe(4);
    });
  });
});
