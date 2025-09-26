import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL Connection Pool
export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pgPool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Redis Publisher Client
export const redisPublisher = createClient({
  url: process.env.REDIS_URL,
});

redisPublisher.on('error', (err) => console.error('Redis Publisher Error', err));

// Redis Subscriber Client
// A dedicated client is required for subscriptions
export const redisSubscriber = redisPublisher.duplicate();

redisSubscriber.on('error', (err) => console.error('Redis Subscriber Error', err));

export const connectDatabases = async (): Promise<void> => {
  try {
    await pgPool.connect();
    console.log('PostgreSQL connected successfully.');
    await redisPublisher.connect();
    console.log('Redis Publisher connected successfully.');
    await redisSubscriber.connect();
    console.log('Redis Subscriber connected successfully.');
  } catch (error) {
    console.error('Failed to connect to databases:', error);
    process.exit(1);
  }
};