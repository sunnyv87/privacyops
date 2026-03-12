import { SessionService } from '@/core/auth/services/session.service';

describe('SessionService', () => {
  let service: SessionService;
  let mockRedis: any;
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();

    const createPipeline = () => {
      const commands: Array<{ method: string; args: any[] }> = [];
      const pipe: any = {
        set: (...args: any[]) => { commands.push({ method: 'set', args }); return pipe; },
        get: (...args: any[]) => { commands.push({ method: 'get', args }); return pipe; },
        del: (...args: any[]) => { commands.push({ method: 'del', args }); return pipe; },
        sadd: (...args: any[]) => { commands.push({ method: 'sadd', args }); return pipe; },
        srem: (...args: any[]) => { commands.push({ method: 'srem', args }); return pipe; },
        expire: (...args: any[]) => { commands.push({ method: 'expire', args }); return pipe; },
        exec: async () => {
          const results: Array<[null, any]> = [];
          for (const cmd of commands) {
            if (cmd.method === 'set') {
              store.set(cmd.args[0], cmd.args[1]);
              results.push([null, 'OK']);
            } else if (cmd.method === 'get') {
              results.push([null, store.get(cmd.args[0]) || null]);
            } else if (cmd.method === 'del') {
              store.delete(cmd.args[0]);
              results.push([null, 1]);
            } else {
              results.push([null, 'OK']);
            }
          }
          return results;
        },
      };
      return pipe;
    };

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
      pipeline: jest.fn().mockImplementation(createPipeline),
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
      expect(mockRedis.pipeline).toHaveBeenCalledTimes(1);
      // Session data should be stored in the pipeline
      expect(store.has(`session:${sessionId}`)).toBe(true);
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

      await service.revokeSession(sessionId);
      // Session should be removed from store via pipeline
      expect(store.has(`session:${sessionId}`)).toBe(false);
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
