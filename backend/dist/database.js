"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabases = exports.redisSubscriber = exports.redisPublisher = exports.pgPool = void 0;
const pg_1 = require("pg");
const redis_1 = require("redis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// PostgreSQL Connection Pool
exports.pgPool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
exports.pgPool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
});
// Redis Publisher Client
exports.redisPublisher = (0, redis_1.createClient)({
    url: process.env.REDIS_URL,
});
exports.redisPublisher.on('error', (err) => console.error('Redis Publisher Error', err));
// Redis Subscriber Client
// A dedicated client is required for subscriptions
exports.redisSubscriber = exports.redisPublisher.duplicate();
exports.redisSubscriber.on('error', (err) => console.error('Redis Subscriber Error', err));
const connectDatabases = async () => {
    try {
        await exports.pgPool.connect();
        console.log('PostgreSQL connected successfully.');
        await exports.redisPublisher.connect();
        console.log('Redis Publisher connected successfully.');
        await exports.redisSubscriber.connect();
        console.log('Redis Subscriber connected successfully.');
    }
    catch (error) {
        console.error('Failed to connect to databases:', error);
        process.exit(1);
    }
};
exports.connectDatabases = connectDatabases;
