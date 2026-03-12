import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceService } from '../../../src/modules/compliance/compliance.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { AuditService } from '../../../src/core/audit/audit.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';

describe('ComplianceService', () => {
  let service: ComplianceService;

  const mockPrisma = {
    regulation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    obligation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    control: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    obligationControl: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockAudit = { log: jest.fn() };
  const mockEvents = { publish: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getScorecard', () => {
    it('should compute compliance scores per regulation', async () => {
      const tenantId = 'tenant-1';

      // findAllRegulations queries regulation.findMany with include: { obligations: { include: { controls: ... } } }
      mockPrisma.regulation.findMany.mockResolvedValue([
        {
          id: 'reg-1',
          shortName: 'DPDP',
          name: 'Digital Personal Data Protection Act',
          jurisdiction: 'IN',
          version: '1.0',
          effectiveDate: new Date(),
          status: 'active',
          obligations: [
            { id: 'o1', controls: [{ control: { id: 'c1', code: 'CTRL-001', implementationStatus: 'implemented' } }] },
            { id: 'o2', controls: [{ control: { id: 'c2', code: 'CTRL-002', implementationStatus: 'implemented' } }] },
          ],
        },
        {
          id: 'reg-2',
          shortName: 'GDPR',
          name: 'General Data Protection Regulation',
          jurisdiction: 'EU',
          version: '2016',
          effectiveDate: new Date(),
          status: 'active',
          obligations: [
            { id: 'o3', controls: [{ control: { id: 'c3', code: 'CTRL-003', implementationStatus: 'partial' } }] },
            { id: 'o4', controls: [] },
          ],
        },
      ]);

      const result = await service.getScorecard(tenantId);

      expect(result).toBeDefined();
      expect(result.overallScore).toBeDefined();
      expect(typeof result.overallScore).toBe('number');
    });
  });

  describe('findAllControls', () => {
    it('should list controls with pagination', async () => {
      const tenantId = 'tenant-1';
      mockPrisma.control.findMany.mockResolvedValue([
        { id: 'c1', code: 'CTRL-001', title: 'Data Encryption', implementationStatus: 'implemented' },
      ]);
      mockPrisma.control.count.mockResolvedValue(1);

      const result = await service.findAllControls(tenantId, { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].code).toBe('CTRL-001');
    });
  });
});
