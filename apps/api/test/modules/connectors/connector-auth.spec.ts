import { OAuth2Auth } from '../../../src/modules/connectors/sdk/auth/oauth2.auth';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('OAuth2Auth', () => {
  let auth: OAuth2Auth;

  beforeEach(() => {
    jest.clearAllMocks();
    auth = new OAuth2Auth({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      tokenUrl: 'https://auth.example.com/token',
      scopes: ['read', 'write'],
      audience: 'https://api.example.com',
    });
  });

  describe('getAccessToken', () => {
    it('should fetch a new token on first call', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-token-123',
          expires_in: 3600,
        }),
      });

      const token = await auth.getAccessToken();

      expect(token).toBe('new-token-123');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
    });

    it('should return cached token on subsequent calls within expiry', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'cached-token',
          expires_in: 3600,
        }),
      });

      const token1 = await auth.getAccessToken();
      const token2 = await auth.getAccessToken();

      expect(token1).toBe('cached-token');
      expect(token2).toBe('cached-token');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on failed token request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(auth.getAccessToken()).rejects.toThrow('OAuth2 token request failed: 401');
    });

    it('should include scopes and audience in request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'token', expires_in: 3600 }),
      });

      await auth.getAccessToken();

      const body = mockFetch.mock.calls[0][1].body;
      expect(body).toContain('scope=read+write');
      expect(body).toContain('audience=https%3A%2F%2Fapi.example.com');
      expect(body).toContain('grant_type=client_credentials');
    });
  });
});
