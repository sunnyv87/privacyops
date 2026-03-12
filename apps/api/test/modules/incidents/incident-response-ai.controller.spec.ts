import { Test, TestingModule } from '@nestjs/testing';
import { IncidentResponseAiController } from '../../../src/modules/incidents/incident-response-ai.controller';
import { IncidentResponseAiService } from '../../../src/modules/incidents/incident-response-ai.service';

describe('IncidentResponseAiController', () => {
  let controller: IncidentResponseAiController;

  const mockAiService = {
    classifyIncident: jest.fn(),
    analyzeImpact: jest.fn(),
    getImpactAnalysis: jest.fn(),
    generatePlaybook: jest.fn(),
    getPlaybook: jest.fn(),
    approvePlaybook: jest.fn(),
    executeContainment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncidentResponseAiController],
      providers: [
        { provide: IncidentResponseAiService, useValue: mockAiService },
      ],
    }).compile();

    controller = module.get<IncidentResponseAiController>(
      IncidentResponseAiController,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('route prefix', () => {
    it('should be defined with incidents/:incidentId/ai prefix', () => {
      const metadata = Reflect.getMetadata('path', IncidentResponseAiController);
      expect(metadata).toBe('incidents/:incidentId/ai');
    });
  });

  describe('classifyIncident', () => {
    it('should call aiService.classifyIncident with tenantId and incidentId', async () => {
      mockAiService.classifyIncident.mockResolvedValue({ classification: 'data_breach' });

      const result = await controller.classifyIncident('tenant-1', 'inc-1');

      expect(mockAiService.classifyIncident).toHaveBeenCalledWith('tenant-1', 'inc-1');
      expect(result).toEqual({ data: { classification: 'data_breach' } });
    });
  });

  describe('analyzeImpact', () => {
    it('should call aiService.analyzeImpact', async () => {
      mockAiService.analyzeImpact.mockResolvedValue({ severity: 'high' });

      const result = await controller.analyzeImpact('tenant-1', 'inc-1');

      expect(mockAiService.analyzeImpact).toHaveBeenCalledWith('tenant-1', 'inc-1');
      expect(result).toEqual({ data: { severity: 'high' } });
    });
  });

  describe('getImpactAnalysis', () => {
    it('should call aiService.getImpactAnalysis', async () => {
      mockAiService.getImpactAnalysis.mockResolvedValue({ impact: 'moderate' });

      const result = await controller.getImpactAnalysis('tenant-1', 'inc-1');

      expect(mockAiService.getImpactAnalysis).toHaveBeenCalledWith('tenant-1', 'inc-1');
      expect(result).toEqual({ data: { impact: 'moderate' } });
    });
  });

  describe('generatePlaybook', () => {
    it('should call aiService.generatePlaybook', async () => {
      mockAiService.generatePlaybook.mockResolvedValue({ playbookId: 'pb-1' });

      const result = await controller.generatePlaybook('tenant-1', 'inc-1');

      expect(mockAiService.generatePlaybook).toHaveBeenCalledWith('tenant-1', 'inc-1');
      expect(result).toEqual({ data: { playbookId: 'pb-1' } });
    });
  });

  describe('getPlaybook', () => {
    it('should call aiService.getPlaybook', async () => {
      mockAiService.getPlaybook.mockResolvedValue({ steps: [] });

      const result = await controller.getPlaybook('tenant-1', 'inc-1');

      expect(mockAiService.getPlaybook).toHaveBeenCalledWith('tenant-1', 'inc-1');
      expect(result).toEqual({ data: { steps: [] } });
    });
  });

  describe('approvePlaybook', () => {
    it('should call aiService.approvePlaybook', async () => {
      mockAiService.approvePlaybook.mockResolvedValue({ approved: true });

      const result = await controller.approvePlaybook('tenant-1', 'user-1', 'inc-1', 'pb-1');

      expect(mockAiService.approvePlaybook).toHaveBeenCalledWith('tenant-1', 'pb-1', 'user-1');
      expect(result).toEqual({ data: { approved: true } });
    });
  });

  describe('executeContainment', () => {
    it('should call aiService.executeContainment', async () => {
      mockAiService.executeContainment.mockResolvedValue({ contained: true });

      const result = await controller.executeContainment('tenant-1', 'user-1', 'inc-1');

      expect(mockAiService.executeContainment).toHaveBeenCalledWith(
        'tenant-1',
        'inc-1',
        'user-1',
      );
      expect(result).toEqual({ data: { contained: true } });
    });
  });

  describe('all 7 endpoints use incidentId param', () => {
    it('should not shadow main IncidentsController routes', () => {
      // The controller prefix is 'incidents/:incidentId/ai' — distinct from
      // the main 'incidents' prefix, preventing route collision.
      const prefix = Reflect.getMetadata('path', IncidentResponseAiController);
      expect(prefix).not.toBe('incidents');
      expect(prefix).toContain('incidentId');
    });
  });
});
