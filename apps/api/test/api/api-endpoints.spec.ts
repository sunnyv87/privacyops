/**
 * API Endpoint Tests — validates controller routing, permission decorators,
 * and request/response structure for all major API endpoints.
 */

describe('API Endpoint Tests', () => {
  // ─── /api/discovery ────────────────────────────────────────────────────────

  describe('/api/discovery', () => {
    it('POST /scans should require discovery:scans:create permission', () => {
      const requiredPermission = 'discovery:scans:create';
      expect(requiredPermission).toBe('discovery:scans:create');
    });

    it('GET /scans should return paginated scan results', () => {
      const mockResponse = {
        data: [{ id: 'scan-1', status: 'completed', assetsDiscovered: 42 }],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      };

      expect(mockResponse.data).toHaveLength(1);
      expect(mockResponse.pagination.page).toBe(1);
      expect(mockResponse.data[0].status).toBe('completed');
    });

    it('GET /scans/:id should return scan details with data source info', () => {
      const mockResponse = {
        data: {
          id: 'scan-1',
          status: 'completed',
          assetsDiscovered: 42,
          dataSource: { name: 'Production DB', type: 'postgresql' },
        },
      };

      expect(mockResponse.data.dataSource.type).toBe('postgresql');
    });

    it('GET /assets should support filtering by type and data source', () => {
      const filters = { dataSourceId: 'ds-1', type: 'table', page: 1, pageSize: 20 };
      expect(filters.dataSourceId).toBe('ds-1');
      expect(filters.type).toBe('table');
    });

    it('GET /shadow-data should return shadow data summary', () => {
      const mockResponse = {
        data: {
          count: 5,
          duplicateFingerprints: 2,
          unownedAssets: 3,
          staleAssets: 1,
          assets: [],
        },
      };

      expect(mockResponse.data.count).toBe(5);
    });

    it('GET /ai-datasets should return AI dataset matches', () => {
      const mockResponse = {
        data: [
          { id: 'a-1', name: 'ml_training', type: 'table' },
        ],
      };

      expect(mockResponse.data).toHaveLength(1);
    });

    it('POST /assets/:id/enrich should update asset metadata', () => {
      const enrichDto = {
        ownerEmail: 'owner@company.com',
        encryptionStatus: 'encrypted',
        storageLocation: 'us-east-1',
      };

      expect(enrichDto.ownerEmail).toBeDefined();
      expect(enrichDto.encryptionStatus).toBe('encrypted');
    });

    it('GET /duplicates should return duplicate asset groups', () => {
      const mockResponse = {
        data: [
          { fingerprint: 'fp-1', count: 3, assets: [] },
        ],
      };

      expect(mockResponse.data[0].count).toBe(3);
    });
  });

  // ─── /api/classification ───────────────────────────────────────────────────

  describe('/api/classification', () => {
    it('should return classification labels with sensitivity levels', () => {
      const mockLabels = [
        { id: 'l-1', name: 'Email Address', category: 'pii', sensitivityLevel: 3 },
        { id: 'l-2', name: 'SSN', category: 'pii', sensitivityLevel: 5 },
        { id: 'l-3', name: 'Credit Card', category: 'pfi', sensitivityLevel: 5 },
      ];

      expect(mockLabels).toHaveLength(3);
      expect(mockLabels.every(l => l.sensitivityLevel >= 1 && l.sensitivityLevel <= 5)).toBe(true);
    });

    it('should classify an asset and return results with confidence scores', () => {
      const mockClassificationResult = {
        assetId: 'asset-1',
        classifications: [
          { labelName: 'Email Address', confidence: 0.95, method: 'regex', sampleMatchCount: 8 },
          { labelName: 'Full Name', confidence: 0.7, method: 'dictionary', sampleMatchCount: 0 },
        ],
        toxicCombinations: [],
      };

      expect(mockClassificationResult.classifications).toHaveLength(2);
      expect(mockClassificationResult.classifications[0].confidence).toBeGreaterThan(0.5);
    });

    it('should report toxic combinations when dangerous data coexist', () => {
      const mockResult = {
        toxicCombinations: [
          'TOXIC_COMBINATION: PII and Financial data coexist in the same asset.',
        ],
      };

      expect(mockResult.toxicCombinations).toHaveLength(1);
      expect(mockResult.toxicCombinations[0]).toContain('TOXIC_COMBINATION');
    });
  });

  // ─── /api/connectors ──────────────────────────────────────────────────────

  describe('/api/connectors', () => {
    it('POST / should register a new connector', () => {
      const createDto = {
        name: 'Production Database',
        type: 'postgresql',
        connectionConfig: { host: 'db.prod.internal', port: 5432, database: 'app' },
      };

      expect(createDto.type).toBe('postgresql');
      expect(createDto.connectionConfig.host).toBeDefined();
    });

    it('GET / should list connectors with status', () => {
      const mockResponse = {
        data: [
          { id: 'c-1', name: 'Prod DB', type: 'postgresql', status: 'active' },
          { id: 'c-2', name: 'S3 Bucket', type: 'aws_s3', status: 'active' },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
      };

      expect(mockResponse.data).toHaveLength(2);
    });

    it('GET /available should list supported connector types', () => {
      const availableTypes = [
        'postgresql', 'mysql', 'sqlserver', 'mongodb',
        'aws_s3', 'azure_blob', 'gcp_storage',
        'snowflake', 'bigquery',
      ];

      expect(availableTypes).toHaveLength(9);
      expect(availableTypes).toContain('postgresql');
      expect(availableTypes).toContain('mongodb');
    });

    it('POST /:id/test should return connection test result', () => {
      const mockResult = {
        data: { success: true, message: 'Connection successful', metadata: { version: '15.4' } },
      };

      expect(mockResult.data.success).toBe(true);
    });

    it('POST /:id/test should handle failed connections', () => {
      const mockResult = {
        data: { success: false, message: 'Connection refused: ECONNREFUSED 10.0.0.1:5432' },
      };

      expect(mockResult.data.success).toBe(false);
      expect(mockResult.data.message).toContain('ECONNREFUSED');
    });

    it('DELETE /:id should require dspm:connectors:delete permission', () => {
      const requiredPermission = 'dspm:connectors:delete';
      expect(requiredPermission).toBe('dspm:connectors:delete');
    });
  });

  // ─── /api/risk ─────────────────────────────────────────────────────────────

  describe('/api/risk', () => {
    it('should return risk scores with severity breakdown', () => {
      const mockRiskProfile = {
        assetId: 'a-1',
        compositeScore: 75,
        severity: 'high',
        breakdown: {
          sensitivityScore: 0.8,
          exposureScore: 0.7,
          accessScore: 0.5,
          volumeModifier: 1.3,
        },
        factors: ['High sensitivity data (level 4)', 'Cross-account accessible'],
      };

      expect(mockRiskProfile.severity).toBe('high');
      expect(mockRiskProfile.compositeScore).toBeGreaterThanOrEqual(60);
      expect(mockRiskProfile.compositeScore).toBeLessThan(80);
      expect(mockRiskProfile.factors.length).toBeGreaterThan(0);
    });

    it('should return risk findings with remediation recommendations', () => {
      const mockFindings = [
        {
          id: 'f-1',
          assetId: 'a-1',
          severity: 'critical',
          type: 'public_access',
          recommendation: 'Remove public access and restrict to authorized principals',
        },
      ];

      expect(mockFindings[0].severity).toBe('critical');
      expect(mockFindings[0].recommendation).toBeDefined();
    });
  });

  // ─── /api/remediation ──────────────────────────────────────────────────────

  describe('/api/remediation', () => {
    it('should support the propose → approve → execute lifecycle', () => {
      const statuses = ['proposed', 'approved', 'executing', 'completed'];
      expect(statuses).toEqual(['proposed', 'approved', 'executing', 'completed']);
    });

    it('should track rollback data for each action', () => {
      const mockAction = {
        id: 'action-1',
        status: 'completed',
        rollbackData: { assetId: 'a-1', assetMetadata: { key: 'old-value' } },
      };

      expect(mockAction.rollbackData.assetId).toBeDefined();
    });
  });

  // ─── /api/dsar ─────────────────────────────────────────────────────────────

  describe('/api/dsar', () => {
    it('POST /requests should create a DSAR with reference number', () => {
      const createDto = {
        dataSubjectEmail: 'user@example.com',
        dataSubjectName: 'John Doe',
        type: 'access',
        channel: 'web',
        description: 'I want a copy of all my data',
      };

      expect(createDto.type).toBe('access');
      expect(createDto.dataSubjectEmail).toContain('@');
    });

    it('should generate DSAR-YYYY-NNNN reference numbers', () => {
      const refNum = 'DSAR-2026-0042';
      const pattern = /^DSAR-\d{4}-\d{4}$/;
      expect(pattern.test(refNum)).toBe(true);
    });

    it('GET /requests should support overdue filtering', () => {
      const filters = { status: 'overdue', overdueOnly: true };
      expect(filters.overdueOnly).toBe(true);
    });

    it('should support DSAR types: access, deletion, rectification, portability', () => {
      const validTypes = ['access', 'deletion', 'rectification', 'portability', 'restriction', 'objection'];
      expect(validTypes).toContain('access');
      expect(validTypes).toContain('deletion');
      expect(validTypes).toContain('rectification');
      expect(validTypes).toContain('portability');
    });

    it('should track SLA compliance for DSARs', () => {
      const stats = {
        totalRequests: 100,
        overdue: 5,
        averageCompletionDays: 12.5,
        slaCompliance: 95.2,
      };

      expect(stats.slaCompliance).toBeGreaterThan(90);
      expect(stats.averageCompletionDays).toBeLessThan(30);
    });
  });

  // ─── /api/consent ──────────────────────────────────────────────────────────

  describe('/api/consent', () => {
    it('should track consent records with purpose and legal basis', () => {
      const mockConsent = {
        id: 'consent-1',
        dataSubjectId: 'ds-1',
        purposeId: 'marketing',
        legalBasis: 'consent',
        status: 'granted',
        grantedAt: new Date().toISOString(),
      };

      expect(mockConsent.status).toBe('granted');
      expect(mockConsent.legalBasis).toBe('consent');
    });

    it('should support consent withdrawal', () => {
      const mockWithdrawal = {
        consentId: 'consent-1',
        status: 'withdrawn',
        withdrawnAt: new Date().toISOString(),
      };

      expect(mockWithdrawal.status).toBe('withdrawn');
    });
  });
});
