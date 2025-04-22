require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve event.html and event.css from 'public' folder

// PostgreSQL connection
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'basic',
    password: '9848',
    port: 5432,
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Database connection error:', err);
        return;
    }
    console.log('Database connected successfully');
    release();
});

// Validate table name to prevent SQL injection
const sanitizeTableName = (sportName) => {
    return sportName.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 63);
};

// Helper function to create table if not exists for a sport
async function ensureSportTableExists(sportName) {
    try {
        const tableName = sanitizeTableName(sportName);
        const query = `
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id SERIAL PRIMARY KEY,
                event_name VARCHAR(255) NOT NULL,
                registration_link TEXT NOT NULL,
                date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS sport_descriptions (
                sport_id VARCHAR(255) PRIMARY KEY,
                sport_name VARCHAR(255) NOT NULL,
                description TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await pool.query(query);
        console.log(`Ensured table ${tableName} exists`);
    } catch (err) {
        console.error(`Error creating table for ${sportName}:`, err);
        throw err;
    }
}

// API endpoints
app.get('/api/sports/:sportId/description', async (req, res) => {
    console.log(`GET /api/sports/${req.params.sportId}/description`);
    try {
        const { sportId } = req.params;
        const result = await pool.query(
            'SELECT description FROM sport_descriptions WHERE sport_id = $1',
            [sportId]
        );
        res.json({ description: result.rows[0]?.description || '' });
    } catch (err) {
        console.error(`Error fetching description for sportId ${req.params.sportId}:`, err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sports/:sportId/update-description', async (req, res) => {
    console.log(`POST /api/sports/${req.params.sportId}/update-description with body:`, req.body, 'query:', req.query);
    try {
        const { sportId } = req.params;
        const { description } = req.body;
        const sportName = decodeURIComponent(req.query.name || 'Unknown Sport');
        
        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }

        await pool.query(`
            INSERT INTO sport_descriptions (sport_id, sport_name, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (sport_id) 
            DO UPDATE SET description = EXCLUDED.description, sport_name = EXCLUDED.sport_name, updated_at = CURRENT_TIMESTAMP
        `, [sportId, sportName, description]);
        
        res.json({ message: 'Description updated successfully' });
    } catch (err) {
        console.error(`Error updating description for sportId ${req.params.sportId}:`, err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/sports/:sportId/events', async (req, res) => {
    console.log(`GET /api/sports/${req.params.sportId}/events`);
    try {
        const { sportId } = req.params;
        const sportName = decodeURIComponent(req.query.name || '');
        if (!sportName) {
            return res.status(400).json({ error: 'Sport name is required' });
        }
        
        const tableName = sanitizeTableName(sportName);
        await ensureSportTableExists(sportName);
        
        const result = await pool.query(
            `SELECT * FROM ${tableName} WHERE date >= CURRENT_DATE ORDER BY date ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(`Error fetching events for sportId ${req.params.sportId}:`, err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sports/:sportId/events/add', async (req, res) => {
    console.log(`POST /api/sports/${req.params.sportId}/events/add with body:`, req.body);
    try {
        const { sportId } = req.params;
        const { eventName, registrationLink, date, sportName } = req.body;
        
        if (!eventName || !registrationLink || !date || !sportName) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        const tableName = sanitizeTableName(sportName);
        await ensureSportTableExists(sportName);
        
        const result = await pool.query(
            `INSERT INTO ${tableName} (event_name, registration_link, date)
             VALUES ($1, $2, $3) RETURNING *`,
            [eventName, registrationLink, date]
        );
        
        res.json({ success: true, event: result.rows[0] });
    } catch (err) {
        console.error(`Error adding event for sportId ${req.params.sportId}:`, err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Catch-all route for unmatched requests
app.use((req, res) => {
    console.log(`Unmatched request: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});