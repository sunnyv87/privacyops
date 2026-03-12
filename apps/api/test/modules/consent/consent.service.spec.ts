import { Test, TestingModule } from '@nestjs/testing';
import { ConsentService } from '../../../src/modules/consent/consent.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { AuditService } from '../../../src/core/audit/audit.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';

describe('ConsentService', () => {
  let service: ConsentService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrisma = {
    consentNotice: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    consentRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    processingPurpose: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    dataSubject: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockAudit = { log: jest.fn() };
  const mockEvents = { publish: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<ConsentService>(ConsentService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createNotice', () => {
    it('should create a consent notice with linked purposes', async () => {
      const dto = {
        name: 'Marketing Consent',
        version: '1.0',
        content: 'We collect your data for marketing.',
        purposeIds: ['purpose-1'],
      };

      mockPrisma.consentNotice.create.mockResolvedValue({
        id: 'notice-1',
        ...dto,
        isActive: true,
      });

      const result = await service.createNotice('tenant-1', 'user-1', dto);

      expect(result.id).toBe('notice-1');
      expect(mockPrisma.consentNotice.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'consent_notice.created' }),
      );
    });
  });

  describe('recordConsent', () => {
    it('should record a consent grant and publish event', async () => {
      mockPrisma.dataSubject.findFirst.mockResolvedValue(null);
      mockPrisma.dataSubject.create.mockResolvedValue({ id: 'subject-1' });
      mockPrisma.consentNotice.findFirst.mockResolvedValue({
        id: 'notice-1',
        purposes: ['purpose-1'],
        version: 1,
      });
      mockPrisma.consentRecord.create.mockResolvedValue({
        id: 'record-1',
        status: 'granted',
      });

      const dto = {
        dataSubjectIdentifier: 'user@test.com',
        noticeId: 'notice-1',
        status: 'granted' as const,
        channel: 'web',
      };

      const result = await service.recordConsent('tenant-1', 'user-1', dto);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('granted');
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'consent.granted' }),
      );
    });
  });

  describe('revokeConsent', () => {
    it('should revoke an active consent record', async () => {
      mockPrisma.dataSubject.findFirst.mockResolvedValue({ id: 'subject-1' });
      mockPrisma.consentRecord.findMany.mockResolvedValue([
        { id: 'record-1', status: 'granted', purposeId: 'purpose-1' },
      ]);
      (mockPrisma.consentRecord as any).updateMany = jest.fn().mockResolvedValue({ count: 1 });

      const dto = {
        dataSubjectIdentifier: 'user@test.com',
        noticeId: 'notice-1',
      };

      const result = await service.revokeConsent('tenant-1', 'user-1', dto);

      expect(result.revokedCount).toBe(1);
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'consent.revoked' }),
      );
    });
  });
});
