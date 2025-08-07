import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  snapshot: {
    interval: parseInt(process.env.SNAPSHOT_INTERVAL || '30000'), // 30 seconds
    retention: parseInt(process.env.SNAPSHOT_RETENTION || '100'), // Keep 100 snapshots
  },
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10'),
    attempts: parseInt(process.env.QUEUE_ATTEMPTS || '3'),
  }
};