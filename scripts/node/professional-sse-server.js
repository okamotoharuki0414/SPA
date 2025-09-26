/**
 * Professional SSE Server for Shift Management
 * Integrates with existing Redis pub/sub and PostgreSQL NOTIFY system
 * Provides real-time updates for the advanced shift management SPA
 */

const express = require('express');
const cors = require('cors');
const Redis = require('redis');
const { Client } = require('pg');
const EventEmitter = require('events');

class ProfessionalSSEServer extends EventEmitter {
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
                database: config.postgres?.database || 'kadodb',
                user: config.postgres?.user || 'postgres',
                password: config.postgres?.password || 'bykd8y'
            },
            cors: config.cors || {
                origin: [
                    'http://localhost',
                    'http://localhost:80',
                    'http://localhost:8000',
                    'http://localhost:8080',
                    'http://localhost:3000'
                ],
                credentials: true
            }
        };

        this.app = express();
        this.clients = new Map(); // worksetId -> Set of clients
        this.redisClient = null;
        this.redisSubscriber = null;
        this.pgClient = null;

        // Notification channels from existing system
        this.notificationChannels = [
            'shift_updated',
            'task_updated',
            'kinmupattern_updated',
            'kyujitu_updated',
            'sagyo_updated'
        ];

        this.setupExpress();
        this.setupRedis();
        this.setupPostgreSQL();
        this.setupRoutes();
        this.setupHeartbeat();
    }

    /**
     * Setup Express application with CORS
     */
    setupExpress() {
        this.app.use(cors(this.config.cors));
        this.app.use(express.json());

        // Request logging
        this.app.use((req, res, next) => {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
            next();
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                connections: this.getTotalConnections(),
                worksets: Array.from(this.clients.keys()),
                redis_connected: this.redisClient?.connected || false,
                postgres_connected: this.pgClient && this.pgClient.readyState === 'authenticated'
            });
        });
    }

    /**
     * Setup Redis connections for pub/sub
     */
    async setupRedis() {
        try {
            // Main Redis client
            this.redisClient = Redis.createClient({
                host: this.config.redis.host,
                port: this.config.redis.port,
                db: this.config.redis.db,
                retry_unfulfilled_commands: true
            });

            // Redis subscriber for notifications
            this.redisSubscriber = Redis.createClient({
                host: this.config.redis.host,
                port: this.config.redis.port,
                db: this.config.redis.db,
                retry_unfulfilled_commands: true
            });

            // Redis event handlers
            this.redisClient.on('connect', () => {
                console.log('✅ Redis client connected');
            });

            this.redisClient.on('error', (error) => {
                console.error('❌ Redis client error:', error);
            });

            this.redisSubscriber.on('connect', () => {
                console.log('✅ Redis subscriber connected');
            });

            this.redisSubscriber.on('error', (error) => {
                console.error('❌ Redis subscriber error:', error);
            });

            // Handle Redis messages
            this.redisSubscriber.on('message', (channel, message) => {
                this.handleRedisMessage(channel, message);
            });

            // Subscribe to notification channels
            for (const channel of this.notificationChannels) {
                await this.redisSubscriber.subscribe(channel);
                console.log(`📡 Subscribed to Redis channel: ${channel}`);
            }

        } catch (error) {
            console.error('❌ Redis setup error:', error);
        }
    }

    /**
     * Setup PostgreSQL connection for NOTIFY/LISTEN
     */
    async setupPostgreSQL() {
        try {
            this.pgClient = new Client(this.config.postgres);
            await this.pgClient.connect();

            console.log('✅ PostgreSQL client connected');

            // Listen for PostgreSQL notifications
            this.pgClient.on('notification', (notification) => {
                this.handlePostgresNotification(notification);
            });

            this.pgClient.on('error', (error) => {
                console.error('❌ PostgreSQL client error:', error);
            });

            // Listen to existing notification channels
            const pgChannels = [
                'change_shift',
                'change_kinmupattern',
                'change_kyujitumaster',
                'change_task',
                'change_sagyo'
            ];

            for (const channel of pgChannels) {
                await this.pgClient.query(`LISTEN ${channel}`);
                console.log(`📡 Listening to PostgreSQL channel: ${channel}`);
            }

        } catch (error) {
            console.error('❌ PostgreSQL setup error:', error);
        }
    }

    /**
     * Setup SSE routes
     */
    setupRoutes() {
        // Main SSE endpoint for workset
        this.app.get('/sse/:workSetId', (req, res) => {
            const workSetId = req.params.workSetId;

            // Validate workSetId
            if (!workSetId || isNaN(parseInt(workSetId))) {
                return res.status(400).json({
                    error: 'Valid workSetId is required'
                });
            }

            this.handleSSEConnection(req, res, parseInt(workSetId));
        });

        // Manual trigger for testing
        this.app.post('/trigger/:workSetId', (req, res) => {
            const workSetId = parseInt(req.params.workSetId);
            const data = req.body;

            this.broadcastToWorkset(workSetId, {
                type: 'manual_trigger',
                data: data,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Manual trigger sent',
                workSetId,
                data
            });
        });

        // Simulate shift update for testing
        this.app.post('/simulate/:workSetId', (req, res) => {
            const workSetId = parseInt(req.params.workSetId);

            const simulatedData = {
                workset_id: workSetId,
                syain_id: Math.floor(Math.random() * 100) + 1,
                hiduke: new Date().toISOString().split('T')[0],
                operation: 'UPDATE',
                shift_data: {
                    pattern_id: Math.floor(Math.random() * 10) + 1,
                    kinmu_from: '09:00',
                    kinmu_to: '18:00',
                    kyukei_jikan: 60
                }
            };

            this.broadcastToWorkset(workSetId, {
                type: 'shift_updated',
                data: simulatedData,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Simulation sent',
                data: simulatedData
            });
        });

        // Connection statistics
        this.app.get('/stats', (req, res) => {
            const worksetStats = {};
            for (const [worksetId, clients] of this.clients.entries()) {
                worksetStats[worksetId] = {
                    connections: clients.size,
                    clients: Array.from(clients).map(client => ({
                        id: client.id,
                        connectedAt: client.connectedAt,
                        ip: client.ip
                    }))
                };
            }

            res.json({
                server: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    timestamp: new Date().toISOString()
                },
                connections: {
                    total: this.getTotalConnections(),
                    by_workset: worksetStats
                },
                services: {
                    redis_connected: this.redisClient?.connected || false,
                    postgres_connected: this.pgClient && this.pgClient.readyState === 'authenticated'
                }
            });
        });

        // Workset-specific stats
        this.app.get('/stats/:workSetId', (req, res) => {
            const workSetId = parseInt(req.params.workSetId);
            const clients = this.clients.get(workSetId);

            if (!clients) {
                return res.json({
                    workset_id: workSetId,
                    connections: 0,
                    clients: []
                });
            }

            res.json({
                workset_id: workSetId,
                connections: clients.size,
                clients: Array.from(clients).map(client => ({
                    id: client.id,
                    connectedAt: client.connectedAt,
                    ip: client.ip,
                    connected_duration: Date.now() - client.connectedAt.getTime()
                }))
            });
        });
    }

    /**
     * Handle SSE connection for specific workset
     */
    handleSSEConnection(req, res, workSetId) {
        console.log(`🔌 New SSE connection for workset ${workSetId} from ${req.ip}`);

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
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            workSetId: workSetId,
            response: res,
            connected: true,
            connectedAt: new Date(),
            ip: req.ip,
            lastHeartbeat: Date.now()
        };

        // Add client to workset group
        if (!this.clients.has(workSetId)) {
            this.clients.set(workSetId, new Set());
        }
        this.clients.get(workSetId).add(client);

        const worksetClients = this.clients.get(workSetId);
        console.log(`👥 Total connections for workset ${workSetId}: ${worksetClients.size}`);

        // Send initial connection confirmation
        this.sendSSEMessage(client, {
            type: 'connected',
            workSetId: workSetId,
            timestamp: new Date().toISOString(),
            message: 'SSE接続が確立されました',
            clientId: client.id,
            server_info: {
                redis_available: !!this.redisClient,
                postgres_available: !!this.pgClient
            }
        });

        // Send initial status after 2 seconds
        setTimeout(() => {
            if (client.connected) {
                this.sendSSEMessage(client, {
                    type: 'status',
                    data: {
                        workset_id: workSetId,
                        client_count: worksetClients.size,
                        server_time: new Date().toISOString()
                    },
                    timestamp: new Date().toISOString()
                });
            }
        }, 2000);

        // Handle client disconnect
        req.on('close', () => {
            console.log(`🔌 SSE connection closed for workset ${workSetId} (client: ${client.id})`);
            client.connected = false;

            const clients = this.clients.get(workSetId);
            if (clients) {
                clients.delete(client);
                console.log(`👥 Remaining connections for workset ${workSetId}: ${clients.size}`);

                if (clients.size === 0) {
                    this.clients.delete(workSetId);
                    console.log(`🚫 No more connections for workset ${workSetId}`);
                }
            }
        });

        // Handle connection errors
        res.on('error', (error) => {
            console.error(`❌ SSE connection error for workset ${workSetId}:`, error.message);
            client.connected = false;
        });
    }

    /**
     * Handle Redis messages from existing notification system
     */
    handleRedisMessage(channel, message) {
        try {
            console.log(`📨 Redis message on ${channel}:`, message.substring(0, 200) + '...');

            const data = JSON.parse(message);

            // Extract workset_id from message
            const workSetId = this.extractWorkSetId(data, channel);

            if (workSetId) {
                this.broadcastToWorkset(workSetId, {
                    type: 'redis_update',
                    channel: channel,
                    data: data,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.warn(`⚠️ Could not extract workset_id from Redis message on ${channel}`);
            }

        } catch (error) {
            console.error(`❌ Error handling Redis message on ${channel}:`, error);
        }
    }

    /**
     * Handle PostgreSQL notifications from existing system
     */
    handlePostgresNotification(notification) {
        try {
            const { channel, payload } = notification;
            console.log(`📨 PostgreSQL notification on ${channel}:`, payload.substring(0, 200) + '...');

            const data = JSON.parse(payload);

            // Map PostgreSQL channel to Redis channel format
            const mappedChannel = this.mapPostgresChannelToRedis(channel);

            // Extract workset_id
            const workSetId = this.extractWorkSetId(data, mappedChannel);

            if (workSetId) {
                this.broadcastToWorkset(workSetId, {
                    type: 'postgres_notify',
                    channel: mappedChannel,
                    original_channel: channel,
                    data: data,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.warn(`⚠️ Could not extract workset_id from PostgreSQL notification on ${channel}`);
            }

        } catch (error) {
            console.error(`❌ Error handling PostgreSQL notification on ${notification.channel}:`, error);
        }
    }

    /**
     * Extract workSetId from notification data
     */
    extractWorkSetId(data, channel) {
        // Try various field names used in the system
        return data.workset_id || data.workSetId || data.f3 || null;
    }

    /**
     * Map PostgreSQL channel names to Redis channel names
     */
    mapPostgresChannelToRedis(pgChannel) {
        const mapping = {
            'change_shift': 'shift_updated',
            'change_kinmupattern': 'kinmupattern_updated',
            'change_kyujitumaster': 'kyujitu_updated',
            'change_task': 'task_updated',
            'change_sagyo': 'sagyo_updated'
        };

        return mapping[pgChannel] || pgChannel;
    }

    /**
     * Broadcast message to all clients of a specific workset
     */
    broadcastToWorkset(workSetId, data) {
        const clients = this.clients.get(workSetId);

        if (!clients || clients.size === 0) {
            console.log(`📭 No clients connected for workset ${workSetId}`);
            return;
        }

        console.log(`📢 Broadcasting to ${clients.size} clients for workset ${workSetId}: ${data.type}`);

        const disconnectedClients = [];

        for (const client of clients) {
            if (!client.connected) {
                disconnectedClients.push(client);
                continue;
            }

            try {
                this.sendSSEMessage(client, data);
            } catch (error) {
                console.error(`❌ Error sending message to client ${client.id}:`, error);
                client.connected = false;
                disconnectedClients.push(client);
            }
        }

        // Clean up disconnected clients
        for (const client of disconnectedClients) {
            clients.delete(client);
        }

        if (clients.size === 0) {
            this.clients.delete(workSetId);
        }
    }

    /**
     * Send SSE message to specific client
     */
    sendSSEMessage(client, data) {
        if (!client.connected) {
            return;
        }

        try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            client.response.write(message);
            client.lastHeartbeat = Date.now();
        } catch (error) {
            console.error(`❌ Failed to send SSE message to client ${client.id}:`, error);
            client.connected = false;
            throw error;
        }
    }

    /**
     * Setup heartbeat to keep connections alive
     */
    setupHeartbeat() {
        setInterval(() => {
            const heartbeatData = {
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
                server_info: {
                    total_connections: this.getTotalConnections(),
                    uptime: process.uptime()
                }
            };

            // Send heartbeat to all connected clients
            for (const [workSetId, clients] of this.clients.entries()) {
                if (clients.size > 0) {
                    // Add workset-specific info
                    const worksetHeartbeat = {
                        ...heartbeatData,
                        workset_info: {
                            workset_id: workSetId,
                            client_count: clients.size
                        }
                    };

                    this.broadcastToWorkset(workSetId, worksetHeartbeat);
                }
            }

        }, 30000); // Every 30 seconds
    }

    /**
     * Get total number of connections across all worksets
     */
    getTotalConnections() {
        let total = 0;
        for (const clients of this.clients.values()) {
            total += clients.size;
        }
        return total;
    }

    /**
     * Start the Professional SSE server
     */
    start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.config.port, (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                console.log('\n🚀 Professional SSE Server Started');
                console.log('=======================================');
                console.log(`📡 Server running on port ${this.config.port}`);
                console.log(`🌐 Health check: http://localhost:${this.config.port}/health`);
                console.log(`📊 Statistics: http://localhost:${this.config.port}/stats`);
                console.log(`🔗 SSE endpoint: http://localhost:${this.config.port}/sse/{workSetId}`);
                console.log(`🧪 Test trigger: POST http://localhost:${this.config.port}/simulate/{workSetId}`);
                console.log('=======================================');

                resolve(this.server);
            });
        });
    }

    /**
     * Stop the Professional SSE server
     */
    async stop() {
        console.log('\n🛑 Stopping Professional SSE server...');

        // Close all client connections
        for (const [workSetId, clients] of this.clients.entries()) {
            console.log(`🔌 Closing ${clients.size} connections for workset ${workSetId}`);

            for (const client of clients) {
                if (client.connected) {
                    try {
                        client.response.end();
                    } catch (error) {
                        console.error(`❌ Error closing client ${client.id}:`, error);
                    }
                }
            }
        }
        this.clients.clear();

        // Close Redis connections
        if (this.redisClient) {
            this.redisClient.quit();
            console.log('✅ Redis client disconnected');
        }
        if (this.redisSubscriber) {
            this.redisSubscriber.quit();
            console.log('✅ Redis subscriber disconnected');
        }

        // Close PostgreSQL connection
        if (this.pgClient) {
            await this.pgClient.end();
            console.log('✅ PostgreSQL client disconnected');
        }

        // Close HTTP server
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log('✅ HTTP server stopped');
                    resolve();
                });
            });
        }
    }
}

// Export the class
module.exports = ProfessionalSSEServer;

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
            database: process.env.POSTGRES_DB || 'kadodb',
            user: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'bykd8y'
        }
    };

    const server = new ProfessionalSSEServer(config);

    server.start()
        .then(() => {
            console.log('🎉 Professional SSE Server started successfully');
        })
        .catch((error) => {
            console.error('❌ Failed to start Professional SSE server:', error);
            process.exit(1);
        });

    // Graceful shutdown handlers
    const shutdownHandler = async (signal) => {
        console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
        try {
            await server.stop();
            console.log('👋 Goodbye!');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    };

    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('❌ Uncaught Exception:', error);
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
        process.exit(1);
    });
}