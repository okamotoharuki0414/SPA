"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./database");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.API_PORT || 3001;
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
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'API server is running',
        channels: CHANNELS,
        timestamp: new Date().toISOString()
    });
});
// REST API Endpoints for CRUD operations
app.get('/api/shift/:worksetId', async (req, res) => {
    try {
        const worksetId = parseInt(req.params.worksetId);
        const result = await database_1.pgPool.query('SELECT * FROM shift WHERE workset_id = $1 ORDER BY shift_date, employee_id', [worksetId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching shifts:', error);
        res.status(500).json({ error: 'Failed to fetch shifts' });
    }
});
app.post('/api/shift', async (req, res) => {
    try {
        const { workset_id, employee_id, employee_name, shift_date, start_time, end_time, kinmu_pattern_id, work_hours, notes } = req.body;
        const result = await database_1.pgPool.query(`INSERT INTO shift (workset_id, employee_id, employee_name, shift_date, start_time, end_time, kinmu_pattern_id, work_hours, notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
       RETURNING *`, [workset_id, employee_id, employee_name, shift_date, start_time, end_time, kinmu_pattern_id, work_hours, notes]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Error creating shift:', error);
        res.status(500).json({ error: 'Failed to create shift' });
    }
});
app.put('/api/shift/:shiftId', async (req, res) => {
    try {
        const shiftId = parseInt(req.params.shiftId);
        const { employee_name, shift_date, start_time, end_time, kinmu_pattern_id, work_hours, notes } = req.body;
        const result = await database_1.pgPool.query(`UPDATE shift SET employee_name = $1, shift_date = $2, start_time = $3, end_time = $4,
       kinmu_pattern_id = $5, work_hours = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
       WHERE shift_id = $8 RETURNING *`, [employee_name, shift_date, start_time, end_time, kinmu_pattern_id, work_hours, notes, shiftId]);
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error updating shift:', error);
        res.status(500).json({ error: 'Failed to update shift' });
    }
});
app.delete('/api/shift/:shiftId', async (req, res) => {
    try {
        const shiftId = parseInt(req.params.shiftId);
        await database_1.pgPool.query('DELETE FROM shift WHERE shift_id = $1', [shiftId]);
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting shift:', error);
        res.status(500).json({ error: 'Failed to delete shift' });
    }
});
// Kinmu Pattern API
app.get('/api/kinmupattern/:worksetId', async (req, res) => {
    try {
        const worksetId = parseInt(req.params.worksetId);
        const result = await database_1.pgPool.query('SELECT * FROM kinmupattern WHERE workset_id = $1 AND is_active = true ORDER BY display_order', [worksetId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching kinmu patterns:', error);
        res.status(500).json({ error: 'Failed to fetch kinmu patterns' });
    }
});
const listenToNotifications = async () => {
    const client = await database_1.pgPool.connect();
    console.log('PostgreSQL client acquired for LISTEN');
    client.on('notification', (msg) => {
        const { channel, payload } = msg;
        if (payload) {
            console.log(`Received notification on channel ${channel}: ${payload}`);
            // Forward the notification payload to the corresponding Redis channel
            database_1.redisPublisher.publish(channel, payload).catch(console.error);
        }
    });
    client.on('error', (err) => {
        console.error('PostgreSQL client error:', err);
        // It's a good practice to handle reconnection or exit
    });
    try {
        for (const channel of CHANNELS) {
            await client.query(`LISTEN ${channel}`);
            console.log(`Listening for notifications on channel: ${channel}`);
        }
    }
    catch (error) {
        console.error('Failed to start listening to channels', error);
        client.release();
        process.exit(1);
    }
};
const startServer = async () => {
    await (0, database_1.connectDatabases)();
    await listenToNotifications();
    app.listen(port, () => {
        console.log(`🚀 API server started on http://localhost:${port}`);
        console.log(`🔍 Health check: http://localhost:${port}/health`);
    });
};
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    await database_1.redisPublisher.quit();
    await database_1.pgPool.end();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    await database_1.redisPublisher.quit();
    await database_1.pgPool.end();
    process.exit(0);
});
startServer().catch((err) => {
    console.error('Failed to start API server:', err);
    process.exit(1);
});
