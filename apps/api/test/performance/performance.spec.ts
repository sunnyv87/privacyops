/**
 * Performance Tests — simulates large dataset discovery, concurrent connectors,
 * and high-node-count graph queries.
 */

describe('Performance Tests', () => {
  // ─── Large Dataset Discovery ──────────────────────────────────────────────

  describe('Large Dataset Discovery', () => {
    it('should handle discovery of 10,000+ assets efficiently', () => {
      const startTime = Date.now();

      // Simulate building an asset index from large discovery
      const assets = Array.from({ length: 10_000 }, (_, i) => ({
        id: `asset-${i}`,
        name: `table_${i}`,
        type: 'table',
        dataSourceId: `ds-${i % 5}`,
        fingerprint: `fp-${i % 200}`, // some duplicates
        sizeBytes: Math.floor(Math.random() * 1_000_000),
      }));

      // Simulate duplicate fingerprint detection
      const fingerprintMap = new Map<string, typeof assets>();
      for (const asset of assets) {
        const group = fingerprintMap.get(asset.fingerprint) || [];
        group.push(asset);
        fingerprintMap.set(asset.fingerprint, group);
      }

      const duplicates = Array.from(fingerprintMap.values()).filter(g => g.length > 1);

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(5000); // Should complete in under 5s
      expect(assets).toHaveLength(10_000);
      expect(duplicates.length).toBeGreaterThan(0);
    });

    it('should classify 5,000 columns in under 3 seconds', () => {
      const startTime = Date.now();

      // Simulate schema heuristics classification
      const PATTERNS = [
        { pattern: /email/i, label: 'Email' },
        { pattern: /phone/i, label: 'Phone' },
        { pattern: /ssn/i, label: 'SSN' },
        { pattern: /password/i, label: 'Password' },
        { pattern: /address/i, label: 'Address' },
        { pattern: /name/i, label: 'Name' },
        { pattern: /credit_card/i, label: 'Credit Card' },
        { pattern: /salary/i, label: 'Salary' },
        { pattern: /dob/i, label: 'DOB' },
      ];

      const columns = Array.from({ length: 5_000 }, (_, i) => {
        const types = ['email', 'phone', 'ssn', 'user_id', 'created_at', 'name', 'address', 'status', 'count', 'salary'];
        return types[i % types.length] + `_${i}`;
      });

      let classified = 0;
      for (const col of columns) {
        for (const p of PATTERNS) {
          if (p.pattern.test(col)) {
            classified++;
            break;
          }
        }
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(3000);
      expect(classified).toBeGreaterThan(0);
    });

    it('should score risk for 10,000 assets in under 2 seconds', () => {
      const startTime = Date.now();

      const sensitivityMap: Record<number, number> = { 5: 1.0, 4: 0.8, 3: 0.6, 2: 0.3, 1: 0.1 };

      const results = Array.from({ length: 10_000 }, (_, i) => {
        const sensitivity = sensitivityMap[(i % 5) + 1] || 0.1;
        const exposure = i % 100 === 0 ? 1.0 : 0.1; // 1% publicly accessible
        const access = i % 10 === 0 ? 1.0 : 0.3; // 10% unencrypted
        const volume = i % 1000 === 0 ? 1.5 : 1.0;

        const score = Math.min(100, Math.round(sensitivity * exposure * access * volume * 100));
        return { assetId: `asset-${i}`, score };
      });

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(2000);
      expect(results).toHaveLength(10_000);
      expect(results.filter(r => r.score >= 10).length).toBeGreaterThan(0);
    });
  });

  // ─── Concurrent Connector Simulation ──────────────────────────────────────

  describe('Concurrent Connector Simulation', () => {
    it('should handle 10 concurrent connector scans', async () => {
      const startTime = Date.now();

      // Simulate 10 connectors running concurrently
      const connectorScans = Array.from({ length: 10 }, (_, i) =>
        new Promise<{ connectorId: string; assetsFound: number }>((resolve) => {
          // Simulate async scan work
          const assetsFound = Math.floor(Math.random() * 100) + 10;
          setTimeout(() => {
            resolve({ connectorId: `connector-${i}`, assetsFound });
          }, Math.floor(Math.random() * 100));
        }),
      );

      const results = await Promise.all(connectorScans);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(5000);
      expect(results).toHaveLength(10);
      results.forEach(r => {
        expect(r.connectorId).toBeDefined();
        expect(r.assetsFound).toBeGreaterThan(0);
      });

      const totalAssets = results.reduce((sum, r) => sum + r.assetsFound, 0);
      expect(totalAssets).toBeGreaterThan(100);
    });

    it('should handle mixed success/failure in concurrent connectors', async () => {
      const connectorScans = Array.from({ length: 5 }, (_, i) =>
        new Promise<{ connectorId: string; status: string }>((resolve, reject) => {
          setTimeout(() => {
            if (i === 2) {
              resolve({ connectorId: `connector-${i}`, status: 'failed' });
            } else {
              resolve({ connectorId: `connector-${i}`, status: 'completed' });
            }
          }, 10);
        }),
      );

      const results = await Promise.allSettled(connectorScans);

      expect(results).toHaveLength(5);
      const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
      expect(fulfilled.length).toBe(5);
      const failed = fulfilled.filter(r => r.value.status === 'failed');
      expect(failed).toHaveLength(1);
    });
  });

  // ─── Graph Query Performance ──────────────────────────────────────────────

  describe('Graph Query Performance', () => {
    it('should compute centrality for 1,000 nodes in under 2 seconds', () => {
      const startTime = Date.now();

      // Generate large graph
      const nodeCount = 1000;
      const edgeCount = 3000;

      const nodes = Array.from({ length: nodeCount }, (_, i) => ({
        id: `n-${i}`,
        nodeType: i % 3 === 0 ? 'asset' : i % 3 === 1 ? 'user' : 'service',
        label: `Node-${i}`,
      }));

      const edges = Array.from({ length: edgeCount }, (_, i) => ({
        sourceNodeId: `n-${i % nodeCount}`,
        targetNodeId: `n-${(i * 7 + 13) % nodeCount}`,
      }));

      // Compute degree centrality
      const degreeMap = new Map<string, { inDeg: number; outDeg: number }>();
      for (const node of nodes) {
        degreeMap.set(node.id, { inDeg: 0, outDeg: 0 });
      }
      for (const edge of edges) {
        const src = degreeMap.get(edge.sourceNodeId);
        if (src) src.outDeg++;
        const tgt = degreeMap.get(edge.targetNodeId);
        if (tgt) tgt.inDeg++;
      }

      const centralityResults = nodes.map(node => {
        const d = degreeMap.get(node.id)!;
        const total = d.inDeg + d.outDeg;
        return { nodeId: node.id, centrality: nodeCount > 1 ? total / (nodeCount - 1) : 0 };
      });

      centralityResults.sort((a, b) => b.centrality - a.centrality);

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(2000);
      expect(centralityResults).toHaveLength(nodeCount);
      expect(centralityResults[0].centrality).toBeGreaterThanOrEqual(centralityResults[centralityResults.length - 1].centrality);
    });

    it('should perform BFS on 5,000 nodes in under 3 seconds', () => {
      const startTime = Date.now();

      const nodeCount = 5000;
      // Build adjacency list
      const adjacency = new Map<string, string[]>();
      for (let i = 0; i < nodeCount; i++) {
        const neighbors: string[] = [];
        // Each node connects to 2-3 neighbors
        for (let j = 1; j <= 3; j++) {
          neighbors.push(`n-${(i + j * 17) % nodeCount}`);
        }
        adjacency.set(`n-${i}`, neighbors);
      }

      // BFS from node 0
      const visited = new Set<string>(['n-0']);
      const queue = ['n-0'];
      let nodesVisited = 0;

      while (queue.length > 0) {
        const current = queue.shift()!;
        nodesVisited++;

        const neighbors = adjacency.get(current) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(3000);
      expect(nodesVisited).toBeGreaterThan(0);
      // With 3 neighbors per node, BFS should reach most nodes
      expect(visited.size).toBeGreaterThan(nodeCount * 0.5);
    });

    it('should find connected components in 2,000 nodes in under 2 seconds', () => {
      const startTime = Date.now();

      const nodeCount = 2000;
      const adjacency = new Map<string, Set<string>>();

      // Create 10 separate clusters of 200 nodes each
      for (let cluster = 0; cluster < 10; cluster++) {
        for (let i = 0; i < 200; i++) {
          const nodeId = `n-${cluster * 200 + i}`;
          if (!adjacency.has(nodeId)) adjacency.set(nodeId, new Set());

          // Connect to next node in cluster (ring topology)
          const nextId = `n-${cluster * 200 + ((i + 1) % 200)}`;
          if (!adjacency.has(nextId)) adjacency.set(nextId, new Set());

          adjacency.get(nodeId)!.add(nextId);
          adjacency.get(nextId)!.add(nodeId);
        }
      }

      // Find connected components
      const visited = new Set<string>();
      let clusterCount = 0;

      for (const [nodeId] of adjacency) {
        if (visited.has(nodeId)) continue;

        clusterCount++;
        const queue = [nodeId];
        visited.add(nodeId);

        while (queue.length > 0) {
          const current = queue.shift()!;
          const neighbors = adjacency.get(current) || new Set();
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(2000);
      expect(clusterCount).toBe(10);
      expect(visited.size).toBe(nodeCount);
    });
  });

  // ─── Memory / Pagination ──────────────────────────────────────────────────

  describe('Pagination Under Load', () => {
    it('should handle pagination of large result sets correctly', () => {
      const totalItems = 50_000;
      const pageSize = 100;
      const totalPages = Math.ceil(totalItems / pageSize);

      expect(totalPages).toBe(500);

      // Test various page boundaries
      const testPages = [1, 2, 250, 499, 500];
      for (const page of testPages) {
        const skip = (page - 1) * pageSize;
        const take = pageSize;

        expect(skip).toBeGreaterThanOrEqual(0);
        expect(skip).toBeLessThan(totalItems);
        expect(take).toBe(pageSize);
      }
    });

    it('should correctly compute pagination metadata', () => {
      const scenarios = [
        { totalItems: 0, pageSize: 20, expectedPages: 0 },
        { totalItems: 1, pageSize: 20, expectedPages: 1 },
        { totalItems: 20, pageSize: 20, expectedPages: 1 },
        { totalItems: 21, pageSize: 20, expectedPages: 2 },
        { totalItems: 100, pageSize: 25, expectedPages: 4 },
      ];

      for (const s of scenarios) {
        const totalPages = s.totalItems > 0 ? Math.ceil(s.totalItems / s.pageSize) : 0;
        expect(totalPages).toBe(s.expectedPages);
      }
    });
  });
});
