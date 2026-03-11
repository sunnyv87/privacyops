import { SessionService } from '@/core/auth/services/session.service';

describe('SessionService', () => {
  let service: SessionService;
  let mockRedis: any;
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    mockRedis = {
      set: jest.fn().mockImplementation((key, value, ...args) => {
        store.set(key, value);
        return Promise.resolve('OK');
      }),
      get: jest.fn().mockImplementation((key) => {
        return Promise.resolve(store.get(key) || null);
      }),
      del: jest.fn().mockImplementation((...keys) => {
        keys.forEach((k: string) => store.delete(k));
        return Promise.resolve(keys.length);
      }),
      sadd: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      srem: jest.fn().mockResolvedValue(1),
    };

    service = new SessionService(mockRedis);
  });

  describe('createSession', () => {
    it('should create a session and return session ID', async () => {
      const sessionId = await service.createSession('user-1', 'tenant-1', {
        ip: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        provider: 'local',
      });

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'user_sessions:user-1',
        sessionId,
      );
    });
  });

  describe('getSession', () => {
    it('should return session data for valid session', async () => {
      const sessionId = await service.createSession('user-1', 'tenant-1', {
        ip: '1.2.3.4',
        userAgent: 'test',
        provider: 'local',
      });

      const session = await service.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.userId).toBe('user-1');
      expect(session?.tenantId).toBe('tenant-1');
    });

    it('should return null for invalid session', async () => {
      const session = await service.getSession('nonexistent');
      expect(session).toBeNull();
    });
  });

  describe('revokeSession', () => {
    it('should delete session from Redis', async () => {
      const sessionId = await service.createSession('user-1', 'tenant-1', {
        ip: '1.2.3.4',
        userAgent: 'test',
        provider: 'local',
      });

      await service.revokeSession(sessionId, 'user-1');
      expect(mockRedis.del).toHaveBeenCalledWith(`session:${sessionId}`);
    });
  });

  describe('listUserSessions', () => {
    it('should return all sessions for a user', async () => {
      mockRedis.smembers.mockResolvedValue(['session-1', 'session-2']);
      store.set(
        'session:session-1',
        JSON.stringify({ userId: 'user-1', tenantId: 't-1', ip: '1.2.3.4', userAgent: 'test', provider: 'local', createdAt: new Date().toISOString() }),
      );
      store.set(
        'session:session-2',
        JSON.stringify({ userId: 'user-1', tenantId: 't-1', ip: '5.6.7.8', userAgent: 'test2', provider: 'oidc', createdAt: new Date().toISOString() }),
      );

      const sessions = await service.listUserSessions('user-1');
      expect(sessions).toHaveLength(2);
    });
  });
});
