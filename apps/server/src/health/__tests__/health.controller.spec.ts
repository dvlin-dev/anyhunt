/**
 * HealthController 单元测试
 *
 * 测试健康检查端点：
 * - check (主健康检查)
 * - live (liveness probe)
 * - ready (readiness probe)
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { HealthController } from '../health.controller';

// Mock 类型定义
type MockPrismaService = {
  $queryRaw: Mock;
};

type MockRedisService = {
  ping: Mock;
};

type MockQueue = {
  getJobCounts: Mock;
};

describe('HealthController', () => {
  let controller: HealthController;
  let mockPrisma: MockPrismaService;
  let mockRedis: MockRedisService;
  let mockQueues: MockQueue[];

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: vi.fn(),
    };

    mockRedis = {
      ping: vi.fn(),
    };
    mockQueues = Array.from({ length: 4 }, () => ({
      getJobCounts: vi.fn().mockResolvedValue({}),
    }));

    controller = new HealthController(
      mockPrisma as any,
      mockRedis as any,
      mockQueues[0] as any,
      mockQueues[1] as any,
      mockQueues[2] as any,
      mockQueues[3] as any,
    );
  });

  describe('live', () => {
    it('should return ok status', () => {
      const result = controller.live();

      expect(result).toEqual({ status: 'ok' });
    });

    it('should not check database or redis', () => {
      controller.live();

      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      expect(mockRedis.ping).not.toHaveBeenCalled();
      expect(mockQueues[0]?.getJobCounts).not.toHaveBeenCalled();
    });
  });

  describe('check', () => {
    it('should return ok when all services are healthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue(true);

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.services.database).toBe(true);
      expect(result.services.redis).toBe(true);
      expect(result.services.queues).toBe(true);
    });

    it('should include timestamp', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue(true);

      const result = await controller.check();

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });

    it('should include uptime', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue(true);

      const result = await controller.check();

      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should check database connection', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue(true);

      await controller.check();

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should check redis connection', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue(true);

      await controller.check();

      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it('should check every required queue connection', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue(true);

      await controller.check();

      for (const queue of mockQueues) {
        expect(queue.getJobCounts).toHaveBeenCalledWith(
          'waiting',
          'active',
          'delayed',
        );
      }
    });

    it('should report degraded status when database fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      mockRedis.ping.mockResolvedValue(true);

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.services.database).toBe(false);
      expect(result.services.redis).toBe(true);
      expect(result.services.queues).toBe(true);
    });

    it('should report degraded status when redis fails', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue(false);

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.services.database).toBe(true);
      expect(result.services.redis).toBe(false);
      expect(result.services.queues).toBe(true);
    });

    it('should report degraded when both services fail', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB error'));
      mockRedis.ping.mockResolvedValue(false);

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.services.database).toBe(false);
      expect(result.services.redis).toBe(false);
      expect(result.services.queues).toBe(true);
    });

    it('should report degraded when a queue connection fails', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue(true);
      mockQueues[2]?.getJobCounts.mockRejectedValue(
        new Error('Redis unavailable'),
      );

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.services.queues).toBe(false);
    });
  });

  describe('ready', () => {
    it('should return ok status when all services are healthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue(true);

      const result = await controller.ready();

      // Kubernetes readiness probe 期望 200 OK 响应
      expect(result.status).toBe('ok');
      expect(result.services.database).toBe(true);
      expect(result.services.redis).toBe(true);
    });

    it('should return HTTP 503 when dependencies fail', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB error'));
      mockRedis.ping.mockResolvedValue(false);

      await expect(controller.ready()).rejects.toMatchObject({ status: 503 });
    });
  });
});
