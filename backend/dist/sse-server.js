"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
const url_1 = require("url");
const database_1 = require("./database");
dotenv_1.default.config();
const port = process.env.SSE_PORT || 3002;
// Using a Map for efficient add/delete operations
const clients = new Map();
const CHANNELS = [
    'shift_updated_1',
    'shift_updated_2',
    'shift_updated_3',
    'kinmupattern_updated_1',
    'kinmupattern_updated_2',
    'kinmupattern_updated_3',
    'kyujitu_updated_1',
    'kyujitu_updated_2',
    'kyujitu_updated_3',
    'task_updated_1',
    'task_updated_2',
    'task_updated_3',
    'sagyo_updated_1',
    'sagyo_updated_2',
    'sagyo_updated_3',
];
const requestListener = (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control');
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    if (req.headers.accept && req.headers.accept === 'text/event-stream') {
        handleSSE(req, res);
    }
    else {
        // Health check endpoint for the SSE server
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            const stats = {
                status: 'SSE server is running',
                connectedClients: clients.size,
                channels: CHANNELS,
                clients: Array.from(clients.values()).map(client => ({
                    id: client.id,
                    workSetId: client.workSetId,
                    connectedAt: client.connectedAt
                })),
                timestamp: new Date().toISOString()
            };
            res.end(JSON.stringify(stats, null, 2));
        }
        else if (req.url === '/stats') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            const worksetStats = {};
            clients.forEach(client => {
                worksetStats[client.workSetId] = (worksetStats[client.workSetId] || 0) + 1;
            });
            res.end(JSON.stringify({
                totalClients: clients.size,
                worksetConnections: worksetStats,
                uptime: process.uptime(),
                memory: process.memoryUsage()
            }, null, 2));
        }
        else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }
};
const handleSSE = (req, res) => {
    const url = new url_1.URL(req.url || '', `http://${req.headers.host}`);
    const workSetId = url.searchParams.get('workSetId') || '1';
    console.log(`📡 New SSE connection request for workSetId: ${workSetId}`);
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
    };
    res.writeHead(200, headers);
    const clientId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newClient = {
        id: clientId,
        workSetId,
        response: res,
        connectedAt: new Date()
    };
    clients.set(clientId, newClient);
    console.log(`✅ Client connected: ${clientId}, workSetId: ${workSetId}. Total clients: ${clients.size}`);
    // Send a connection confirmation message
    const welcomeMessage = {
        type: 'connected',
        workSetId,
        clientId,
        timestamp: new Date().toISOString(),
        message: 'SSE connection established successfully'
    };
    res.write(`data: ${JSON.stringify(welcomeMessage)}\\n\\n`);
    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
        if (clients.has(clientId)) {
            const heartbeat = {
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
                clientId,
                workSetId
            };
            res.write(`data: ${JSON.stringify(heartbeat)}\\n\\n`);
        }
        else {
            clearInterval(heartbeatInterval);
        }
    }, 30000);
    req.on('close', () => {
        clients.delete(clientId);
        clearInterval(heartbeatInterval);
        console.log(`❌ Client disconnected: ${clientId}. Total clients: ${clients.size}`);
    });
    req.on('error', (err) => {
        console.error(`🚨 SSE connection error for client ${clientId}:`, err);
        clients.delete(clientId);
        clearInterval(heartbeatInterval);
    });
};
const broadcast = (channel, message) => {
    try {
        const payload = JSON.parse(message);
        // Extract workSetId from the payload or channel name
        const targetWorkSetId = payload.workset_id || payload.workSetId || extractWorkSetIdFromChannel(channel);
        if (!targetWorkSetId) {
            console.warn(`⚠️ Received message without workSetId on channel ${channel}, broadcasting to all clients.`);
        }
        let broadcastCount = 0;
        const disconnectedClients = [];
        for (const [clientId, client] of clients.entries()) {
            // If we have a specific workSetId, only send to matching clients
            if (targetWorkSetId && client.workSetId !== targetWorkSetId.toString()) {
                continue;
            }
            try {
                const eventData = {
                    ...payload,
                    channel,
                    receivedAt: new Date().toISOString()
                };
                client.response.write(`event: ${channel}\\n`);
                client.response.write(`data: ${JSON.stringify(eventData)}\\n\\n`);
                broadcastCount++;
            }
            catch (error) {
                console.error(`💥 Failed to send to client ${clientId}:`, error);
                disconnectedClients.push(clientId);
            }
        }
        // Clean up disconnected clients
        disconnectedClients.forEach(clientId => {
            clients.delete(clientId);
        });
        console.log(`📢 Broadcasted ${channel} to ${broadcastCount} clients (workSetId: ${targetWorkSetId || 'all'})`);
    }
    catch (error) {
        console.error('🚨 Failed to parse and broadcast message:', error);
    }
};
const extractWorkSetIdFromChannel = (channel) => {
    const match = channel.match(/_(\d+)$/);
    return match ? match[1] : null;
};
const startServer = async () => {
    try {
        // Connect to Redis subscriber
        if (!database_1.redisSubscriber.isOpen) {
            await database_1.redisSubscriber.connect();
            console.log('🔗 Redis Subscriber connected successfully');
        }
        // Subscribe to all channels
        await database_1.redisSubscriber.subscribe(CHANNELS, (message, channel) => {
            console.log(`📥 Received Redis message on channel: ${channel}`);
            broadcast(channel, message);
        });
        console.log(`🎯 Subscribed to Redis channels: ${CHANNELS.join(', ')}`);
        const server = http_1.default.createServer(requestListener);
        server.listen(port, () => {
            console.log(`🚀 SSE server started on http://localhost:${port}`);
            console.log(`🔍 Health check: http://localhost:${port}/health`);
            console.log(`📊 Stats: http://localhost:${port}/stats`);
        });
        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('🛑 Received SIGINT, shutting down SSE server gracefully...');
            // Close all client connections
            for (const [clientId, client] of clients.entries()) {
                try {
                    client.response.end();
                }
                catch (error) {
                    console.error(`Error closing client ${clientId}:`, error);
                }
            }
            clients.clear();
            // Close Redis connection
            if (database_1.redisSubscriber.isOpen) {
                await database_1.redisSubscriber.quit();
            }
            server.close(() => {
                console.log('✅ SSE server shut down complete');
                process.exit(0);
            });
        });
        process.on('SIGTERM', async () => {
            console.log('🛑 Received SIGTERM, shutting down SSE server gracefully...');
            // Close all client connections
            for (const [clientId, client] of clients.entries()) {
                try {
                    client.response.end();
                }
                catch (error) {
                    console.error(`Error closing client ${clientId}:`, error);
                }
            }
            clients.clear();
            // Close Redis connection
            if (database_1.redisSubscriber.isOpen) {
                await database_1.redisSubscriber.quit();
            }
            server.close(() => {
                console.log('✅ SSE server shut down complete');
                process.exit(0);
            });
        });
    }
    catch (error) {
        console.error('🚨 Failed to start SSE server:', error);
        process.exit(1);
    }
};
startServer();
