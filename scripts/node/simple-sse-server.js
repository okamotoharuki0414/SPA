/**
 * Simple SSE Server for Shift Updates (without Redis/PostgreSQL dependencies)
 * For testing and development purposes
 */

const express = require('express');
const cors = require('cors');
const EventEmitter = require('events');

class SimpleSSEServer extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            port: config.port || 3002
        };

        this.app = express();
        this.clients = new Map(); // worksetId -> Set of clients

        this.setupExpress();
        this.setupRoutes();
        this.setupHeartbeat();
    }

    /**
     * Setup Express application
     */
    setupExpress() {
        // Enable CORS
        this.app.use(cors({
            origin: ['http://localhost', 'http://localhost:80', 'http://localhost:8080', 'http://localhost:3000'],
            credentials: true
        }));

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
                connections: this.getTotalConnections()
            });
        });
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
                type: 'shift_updated',
                data: data,
                timestamp: new Date().toISOString()
            });

            res.json({ success: true, worksetId, data });
        });

        // Simulate shift update (for testing)
        this.app.post('/simulate/:worksetId', (req, res) => {
            const worksetId = parseInt(req.params.worksetId);

            const simulatedShift = {
                shift_id: Math.floor(Math.random() * 1000),
                employee_id: Math.floor(Math.random() * 10) + 1,
                employee_name: `Employee ${Math.floor(Math.random() * 10) + 1}`,
                shift_date: new Date().toISOString().split('T')[0],
                start_time: '09:00',
                end_time: '17:00',
                status: ['pending', 'active', 'completed'][Math.floor(Math.random() * 3)],
                work_hours: 8,
                notes: 'Simulated shift update'
            };

            this.broadcastToWorkset(worksetId, {
                type: 'shift_updated',
                data: simulatedShift,
                timestamp: new Date().toISOString()
            });

            res.json({ success: true, worksetId, simulatedShift });
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
        console.log(`New SSE connection for workset ${worksetId} from ${req.ip}`);

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
            connectedAt: new Date(),
            ip: req.ip
        };

        // Add client to workset group
        if (!this.clients.has(worksetId)) {
            this.clients.set(worksetId, new Set());
        }
        this.clients.get(worksetId).add(client);

        console.log(`Total connections for workset ${worksetId}: ${this.clients.get(worksetId).size}`);

        // Send initial connection confirmation
        this.sendSSEMessage(client, {
            type: 'connected',
            worksetId: worksetId,
            timestamp: new Date().toISOString(),
            message: 'SSE connection established',
            clientId: client.id
        });

        // Send initial test data after 2 seconds
        setTimeout(() => {
            if (client.connected) {
                this.sendSSEMessage(client, {
                    type: 'shift_updated',
                    data: {
                        shift_id: 1,
                        employee_name: 'Test Employee',
                        shift_date: new Date().toISOString().split('T')[0],
                        start_time: '09:00',
                        end_time: '17:00',
                        status: 'active',
                        work_hours: 8
                    },
                    timestamp: new Date().toISOString(),
                    message: 'Initial test data'
                });
            }
        }, 2000);

        // Handle client disconnect
        req.on('close', () => {
            console.log(`SSE connection closed for workset ${worksetId} (client: ${client.id})`);
            client.connected = false;

            const worksetClients = this.clients.get(worksetId);
            if (worksetClients) {
                worksetClients.delete(client);
                console.log(`Remaining connections for workset ${worksetId}: ${worksetClients.size}`);

                if (worksetClients.size === 0) {
                    this.clients.delete(worksetId);
                    console.log(`No more connections for workset ${worksetId}`);
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
     * Broadcast message to all clients of a specific workset
     */
    broadcastToWorkset(worksetId, data) {
        const clients = this.clients.get(worksetId);

        if (!clients || clients.size === 0) {
            console.log(`No clients connected for workset ${worksetId}`);
            return;
        }

        console.log(`Broadcasting to ${clients.size} clients for workset ${worksetId}:`, data.type);

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
                console.error(`Error sending message to client ${client.id}:`, error);
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

        try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            client.response.write(message);
        } catch (error) {
            console.error(`Failed to send SSE message to client ${client.id}:`, error);
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
                connections: this.getTotalConnections()
            };

            // Send heartbeat to all connected clients
            for (const [worksetId, clients] of this.clients.entries()) {
                if (clients.size > 0) {
                    this.broadcastToWorkset(worksetId, heartbeatData);
                }
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

                console.log(`🚀 Simple SSE Server running on port ${this.config.port}`);
                console.log(`📊 Health check: http://localhost:${this.config.port}/health`);
                console.log(`📈 Stats: http://localhost:${this.config.port}/stats`);
                console.log(`🔗 SSE endpoint: http://localhost:${this.config.port}/sse/{worksetId}`);
                console.log(`🧪 Test trigger: POST http://localhost:${this.config.port}/simulate/{worksetId}`);

                resolve(this.server);
            });
        });
    }

    /**
     * Stop the SSE server
     */
    async stop() {
        console.log('Stopping Simple SSE server...');

        // Close all client connections
        for (const [worksetId, clients] of this.clients.entries()) {
            for (const client of clients) {
                if (client.connected) {
                    try {
                        client.response.end();
                    } catch (error) {
                        console.error(`Error closing client ${client.id}:`, error);
                    }
                }
            }
        }
        this.clients.clear();

        // Close HTTP server
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(resolve);
            });
        }
    }
}

// Export the class
module.exports = SimpleSSEServer;

// If running directly, start the server
if (require.main === module) {
    const config = {
        port: process.env.PORT || 3002
    };

    const server = new SimpleSSEServer(config);

    server.start()
        .then(() => {
            console.log('✅ Simple SSE Server started successfully');
        })
        .catch((error) => {
            console.error('❌ Failed to start Simple SSE server:', error);
            process.exit(1);
        });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });
}