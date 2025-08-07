import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType;
  private pubClient: RedisClientType;
  private subClient: RedisClientType;
  private isConnected: boolean = false;

  private constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
    });

    this.pubClient = this.client.duplicate();
    this.subClient = this.client.duplicate();

    this.setupEventHandlers();
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('error', (err) => logger.error('Redis Client Error:', err));
    this.client.on('connect', () => logger.info('Redis connected'));
    this.client.on('disconnect', () => logger.warn('Redis disconnected'));
  }

  public async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.pubClient.connect(),
        this.subClient.connect(),
      ]);
      this.isConnected = true;
      logger.info('All Redis clients connected');
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    await Promise.all([
      this.client.disconnect(),
      this.pubClient.disconnect(),
      this.subClient.disconnect(),
    ]);
    this.isConnected = false;
    logger.info('All Redis clients disconnected');
  }

  public getClient(): RedisClientType {
    return this.client;
  }

  public getPubClient(): RedisClientType {
    return this.pubClient;
  }

  public getSubClient(): RedisClientType {
    return this.subClient;
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }
}

export const redisManager = RedisManager.getInstance();