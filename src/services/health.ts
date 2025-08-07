import { dbManager } from '../database/prisma';
import { redisManager } from '../cache/redis';
import { bidQueueManager } from '../queue/bid-queue';
import { logger } from '../utils/logger';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: {
    database: boolean;
    redis: boolean;
    queue: boolean;
  };
  details: Record<string, any>;
}

class HealthService {
  private static instance: HealthService;

  private constructor() {}

  public static getInstance(): HealthService {
    if (!HealthService.instance) {
      HealthService.instance = new HealthService();
    }
    return HealthService.instance;
  }

  public async checkHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueue(),
    ]);

    const [dbResult, redisResult, queueResult] = checks;

    const services = {
      database: dbResult.status === 'fulfilled' && dbResult.value,
      redis: redisResult.status === 'fulfilled' && redisResult.value,
      queue: queueResult.status === 'fulfilled' && queueResult.value,
    };

    const healthyServices = Object.values(services).filter(Boolean).length;
    const totalServices = Object.keys(services).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === totalServices) {
      status = 'healthy';
    } else if (healthyServices > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: new Date(),
      services,
      details: {
        healthyServices,
        totalServices,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      return await dbManager.healthCheck();
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      return await redisManager.healthCheck();
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  private async checkQueue(): Promise<boolean> {
    try {
      const stats = await bidQueueManager.getQueueStats();
      return true;
    } catch (error) {
      logger.error('Queue health check failed:', error);
      return false;
    }
  }
}

export const healthService = HealthService.getInstance();