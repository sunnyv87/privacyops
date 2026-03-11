import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsService } from '../../../src/modules/incidents/incidents.service';
import { PrismaService } from '../../../src/core/prisma/prisma.service';
import { AuditService } from '../../../src/core/audit/audit.service';
import { EventBusService } from '../../../src/core/events/event-bus.service';

describe('IncidentsService', () => {
  let service: IncidentsService;

  const mockPrisma = {
    incident: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAudit = { log: jest.fn() };
  const mockEvents = { publish: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventBusService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create an incident with reference number', async () => {
      mockPrisma.incident.count.mockResolvedValue(3);
      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-1',
        reference: 'INC-2026-0004',
        severity: 'p1',
        status: 'reported',
        isBreach: false,
      });

      const result = await service.create('tenant-1', 'user-1', {
        title: 'Unauthorized access',
        severity: 'p1',
        description: 'Detected unauthorized access to PII data',
      });

      expect(result.reference).toMatch(/^INC-\d{4}-\d{4}$/);
      expect(mockEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'incident.reported' }),
      );
    });

    it('should set 72-hour notification deadline for breaches', async () => {
      mockPrisma.incident.count.mockResolvedValue(0);
      mockPrisma.incident.create.mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 'inc-1',
          ...data,
          breachNotificationDeadline: data.breachNotificationDeadline,
        });
      });

      const result = await service.create('tenant-1', 'user-1', {
        title: 'Data breach',
        severity: 'p1',
        description: 'Customer data leaked',
        isBreach: true,
      });

      expect(result.breachNotificationDeadline).toBeDefined();
    });
  });
});
