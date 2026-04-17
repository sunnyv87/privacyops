import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export interface SessionData {
  sessionId: string;
  userId: string;
  tenantId: string;
  ip: string;
  userAgent: string;
  provider: string;
  createdAt: string;
  lastActivityAt: string;
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class SessionService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    @Inject('REDIS_CLIENT') redis: Redis,
  ) {
    this.redis = redis;
  }

  onModuleDestroy() {
    // Redis client lifecycle managed by the provider factory
  }

  async createSession(
    userId: string,
    tenantId: string,
    metadata: { ip: string; userAgent: string; provider: string },
  ): Promise<string> {
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const sessionData: SessionData = {
      sessionId,
      userId,
      tenantId,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      provider: metadata.provider,
      createdAt: now,
      lastActivityAt: now,
    };

    const sessionKey = `session:${sessionId}`;
    const userSessionsKey = `user_sessions:${userId}`;

    const pipeline = this.redis.pipeline();
    pipeline.set(sessionKey, JSON.stringify(sessionData), 'EX', SESSION_TTL_SECONDS);
    pipeline.sadd(userSessionsKey, sessionId);
    pipeline.expire(userSessionsKey, SESSION_TTL_SECONDS);
    await pipeline.exec();

    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const sessionKey = `session:${sessionId}`;
    const data = await this.redis.get(sessionKey);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as SessionData;
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);

    if (session) {
      const pipeline = this.redis.pipeline();
      pipeline.del(`session:${sessionId}`);
      pipeline.srem(`user_sessions:${session.userId}`, sessionId);
      await pipeline.exec();
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const userSessionsKey = `user_sessions:${userId}`;
    const sessionIds = await this.redis.smembers(userSessionsKey);

    if (sessionIds.length === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();
    for (const sessionId of sessionIds) {
      pipeline.del(`session:${sessionId}`);
    }
    pipeline.del(userSessionsKey);
    await pipeline.exec();
  }

  async consumeOneTimeToken(tokenHash: string, ttlSeconds: number): Promise<boolean> {
    const key = `otp_consumed:${tokenHash}`;
    const wasSet = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return wasSet === 'OK';
  }

  async listUserSessions(userId: string): Promise<SessionData[]> {
    const userSessionsKey = `user_sessions:${userId}`;
    const sessionIds = await this.redis.smembers(userSessionsKey);

    if (sessionIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    for (const sessionId of sessionIds) {
      pipeline.get(`session:${sessionId}`);
    }
    const results = await pipeline.exec();

    const sessions: SessionData[] = [];
    const expiredSessionIds: string[] = [];

    if (results) {
      for (let i = 0; i < results.length; i++) {
        const [err, data] = results[i];
        if (!err && data) {
          sessions.push(JSON.parse(data as string) as SessionData);
        } else {
          // Session expired from Redis but still in the set — clean up
          expiredSessionIds.push(sessionIds[i]);
        }
      }
    }

    // Clean up stale references
    if (expiredSessionIds.length > 0) {
      await this.redis.srem(userSessionsKey, ...expiredSessionIds);
    }

    return sessions;
  }
}
