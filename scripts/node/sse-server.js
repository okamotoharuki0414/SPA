/**
 * SSE Server for Real-time Shift Updates
 * Node.js + Express + Redis Pub/Sub + PostgreSQL NOTIFY integration
 */

const express = require('express');
const cors = require('cors');
const redis = require('redis');
const { Client } = require('pg');
const EventEmitter = require('events');

class SSEServer extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            port: config.port || 3001,
            redis: {
                host: config.redis?.host || '127.0.0.1',
                port: config.redis?.port || 6379,
                db: config.redis?.db || 0
            },
            postgres: {
                host: config.postgres?.host || 'localhost',
                port: config.postgres?.port || 5432,
                database: config.postgres?.database || 'shift_db',
                user: config.postgres?.user || 'postgres',
                password: config.postgres?.password || 'password'
            },
            cors: config.cors || {
                origin: ['http://localhost', 'http://localhost:80', 'http://localhost:8080'],
                credentials: true
            }
        };

        this.app = express();
        this.clients = new Map(); // worksetId -> Set of clients
        this.redisClient = null;
        this.redisSubscriber = null;
        this.pgClient = null;

        this.setupExpress();
        this.setupRedis();
        this.setupPostgreSQL();
        this.setupRoutes();
        this.setupHeartbeat();
    }

    /**
     * Setup Express application
     */
    setupExpress() {
        // Enable CORS
        this.app.use(cors(this.config.cors));

        // Parse JSON bodies
        this.app.use(express.json());

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
            next();
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                connections: this.getTotalConnections(),
                redis: this.redisClient?.connected || false,
                postgres: this.pgClient?.readyState === 'authenticated'
            });
        });
    }

    /**
     * Setup Redis connection and subscriber
     */
    async setupRedis() {
        try {
            // Main Redis client for publishing
            this.redisClient = redis.createClient({
                host: this.config.redis.host,
                port: this.config.redis.port,
                db: this.config.redis.db
            });

            // Redis subscriber for receiving notifications
            this.redisSubscriber = redis.createClient({
                host: this.config.redis.host,
                port: this.config.redis.port,
                db: this.config.redis.db
            });

            // Handle Redis events
            this.redisClient.on('connect', () => {
                console.log('Redis client connected');
            });

            this.redisClient.on('error', (error) => {
                console.error('Redis client error:', error);
            });

            this.redisSubscriber.on('connect', () => {
                console.log('Redis subscriber connected');
            });

            this.redisSubscriber.on('error', (error) => {
                console.error('Redis subscriber error:', error);
            });

            // Handle Redis messages
            this.redisSubscriber.on('message', (channel, message) => {
                this.handleRedisMessage(channel, message);
            });

            // Subscribe to shift update channels (pattern matching)
            this.redisSubscriber.psubscribe('shift_updates_*');

        } catch (error) {
            console.error('Redis setup error:', error);
        }
    }

    /**
     * Setup PostgreSQL connection for NOTIFY/LISTEN
     */
    async setupPostgreSQL() {
        try {
            this.pgClient = new Client(this.config.postgres);

            await this.pgClient.connect();
            console.log('PostgreSQL client connected');

            // Listen for PostgreSQL notifications
            this.pgClient.on('notification', (notification) => {
                this.handlePostgresNotification(notification);
            });

            // Listen to shift channels (pattern would be handled by app logic)
            await this.pgClient.query('LISTEN shift_channel_1'); // Example for workset 1
            await this.pgClient.query('LISTEN shift_channel_2'); // Example for workset 2
            // In production, you'd dynamically LISTEN to channels based on active worksets

        } catch (error) {
            console.error('PostgreSQL setup error:', error);
        }
    }

    /**
     * Setup SSE routes
     */
    setupRoutes() {
        // Main SSE endpoint for specific workset
        this.app.get('/sse/:worksetId', (req, res) => {
            const worksetId = parseInt(req.params.worksetId);

            if (!worksetId || worksetId < 1) {
                return res.status(400).json({
                    error: 'Valid worksetId is required'
                });
            }

            this.handleSSEConnection(req, res, worksetId);
        });

        // Trigger manual notification (for testing)
        this.app.post('/trigger/:worksetId', (req, res) => {
            const worksetId = parseInt(req.params.worksetId);
            const data = req.body;

            this.broadcastToWorkset(worksetId, {
                type: 'manual_trigger',
                data: data,
                timestamp: new Date().toISOString()
            });

            res.json({ success: true, worksetId, data });
        });

        // Get connection statistics
        this.app.get('/stats', (req, res) => {
            const stats = {};
            for (const [worksetId, clients] of this.clients.entries()) {
                stats[worksetId] = clients.size;
            }

            res.json({
                totalConnections: this.getTotalConnections(),
                worksetConnections: stats,
                uptime: process.uptime(),
                memory: process.memoryUsage()
            });
        });
    }

    /**
     * Handle SSE connection for specific workset
     */
    handleSSEConnection(req, res, worksetId) {
        console.log(`New SSE connection for workset ${worksetId}`);

        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': req.headers.origin || '*',
            'Access-Control-Allow-Credentials': 'true'
        });

        // Create client object
        const client = {
            id: Date.now() + Math.random(),
            worksetId: worksetId,
            response: res,
            connected: true,
            connectedAt: new Date()
        };

        // Add client to workset group
        if (!this.clients.has(worksetId)) {
            this.clients.set(worksetId, new Set());
        }
        this.clients.get(worksetId).add(client);

        // Send initial connection confirmation
        this.sendSSEMessage(client, {
            type: 'connected',
            worksetId: worksetId,
            timestamp: new Date().toISOString(),
            message: 'SSE connection established'
        });

        // Handle client disconnect
        req.on('close', () => {
            console.log(`SSE connection closed for workset ${worksetId}`);
            client.connected = false;

            const worksetClients = this.clients.get(worksetId);
            if (worksetClients) {
                worksetClients.delete(client);
                if (worksetClients.size === 0) {
                    this.clients.delete(worksetId);
                }
            }
        });

        // Handle connection errors
        res.on('error', (error) => {
            console.error(`SSE connection error for workset ${worksetId}:`, error);
            client.connected = false;
        });
    }

    /**
     * Handle Redis messages
     */
    handleRedisMessage(channel, message) {
        try {
            // Extract workset ID from channel name
            const match = channel.match(/shift_updates_(\d+)/);
            if (!match) {
                console.warn('Unknown Redis channel format:', channel);
                return;
            }

            const worksetId = parseInt(match[1]);
            const data = JSON.parse(message);

            console.log(`Redis message for workset ${worksetId}:`, data);

            // Broadcast to all clients for this workset
            this.broadcastToWorkset(worksetId, data);

        } catch (error) {
            console.error('Error handling Redis message:', error);
        }
    }

    /**
     * Handle PostgreSQL notifications
     */
    handlePostgresNotification(notification) {
        try {
            const { channel, payload } = notification;

            // Extract workset ID from channel name
            const match = channel.match(/shift_channel_(\d+)/);
            if (!match) {
                console.warn('Unknown PostgreSQL channel format:', channel);
                return;
            }

            const worksetId = parseInt(match[1]);
            const data = JSON.parse(payload);

            console.log(`PostgreSQL notification for workset ${worksetId}:`, data);

            // Broadcast to all clients for this workset
            this.broadcastToWorkset(worksetId, data);

        } catch (error) {
            console.error('Error handling PostgreSQL notification:', error);
        }
    }

    /**
     * Broadcast message to all clients of a specific workset
     */
    broadcastToWorkset(worksetId, data) {
        const clients = this.clients.get(worksetId);

        if (!clients || clients.size === 0) {
            console.log(`No clients connected for workset ${worksetId}`);
            return;
        }

        console.log(`Broadcasting to ${clients.size} clients for workset ${worksetId}`);

        // Send to all connected clients
        const disconnectedClients = [];

        for (const client of clients) {
            if (!client.connected) {
                disconnectedClients.push(client);
                continue;
            }

            try {
                this.sendSSEMessage(client, data);
            } catch (error) {
                console.error('Error sending message to client:', error);
                client.connected = false;
                disconnectedClients.push(client);
            }
        }

        // Clean up disconnected clients
        for (const client of disconnectedClients) {
            clients.delete(client);
        }

        if (clients.size === 0) {
            this.clients.delete(worksetId);
        }
    }

    /**
     * Send SSE message to specific client
     */
    sendSSEMessage(client, data) {
        if (!client.connected) {
            return;
        }

        const message = `data: ${JSON.stringify(data)}\n\n`;
        client.response.write(message);
    }

    /**
     * Setup heartbeat to keep connections alive
     */
    setupHeartbeat() {
        setInterval(() => {
            const heartbeatData = {
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
                connections: this.getTotalConnections()
            };

            // Send heartbeat to all connected clients
            for (const [worksetId, clients] of this.clients.entries()) {
                this.broadcastToWorkset(worksetId, heartbeatData);
            }

        }, 30000); // Every 30 seconds
    }

    /**
     * Get total number of connections
     */
    getTotalConnections() {
        let total = 0;
        for (const clients of this.clients.values()) {
            total += clients.size;
        }
        return total;
    }

    /**
     * Start the SSE server
     */
    start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.config.port, (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                console.log(`SSE Server running on port ${this.config.port}`);
                console.log(`Health check: http://localhost:${this.config.port}/health`);
                console.log(`Stats: http://localhost:${this.config.port}/stats`);

                resolve(this.server);
            });
        });
    }

    /**
     * Stop the SSE server
     */
    async stop() {
        console.log('Stopping SSE server...');

        // Close all client connections
        for (const [worksetId, clients] of this.clients.entries()) {
            for (const client of clients) {
                if (client.connected) {
                    client.response.end();
                }
            }
        }
        this.clients.clear();

        // Close Redis connections
        if (this.redisClient) {
            this.redisClient.quit();
        }
        if (this.redisSubscriber) {
            this.redisSubscriber.quit();
        }

        // Close PostgreSQL connection
        if (this.pgClient) {
            await this.pgClient.end();
        }

        // Close HTTP server
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(resolve);
            });
        }
    }
}

// Export the class
module.exports = SSEServer;

// If running directly, start the server
if (require.main === module) {
    const config = {
        port: process.env.PORT || 3001,
        redis: {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: process.env.REDIS_PORT || 6379,
            db: process.env.REDIS_DB || 0
        },
        postgres: {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: process.env.POSTGRES_PORT || 5432,
            database: process.env.POSTGRES_DB || 'shift_db',
            user: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'password'
        }
    };

    const server = new SSEServer(config);

    server.start()
        .then(() => {
            console.log('SSE Server started successfully');
        })
        .catch((error) => {
            console.error('Failed to start SSE server:', error);
            process.exit(1);
        });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });
}