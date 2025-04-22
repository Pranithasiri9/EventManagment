import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt'; // ✅ Import bcrypt for password hashing
import plan from './plan.js';
import { lstat } from 'fs';

dotenv.config(); // Load environment variables

const app = express();

plan(app);

const port = process.env.PORT || 3000;

// PostgreSQL database connection
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Middleware to parse JSON and form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ Create users table if not exists
pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL
    );
`, (err) => {
    if (err) console.error('Error creating users table:', err);
    else console.log('Users table is ready!');
});

// ✅ Route for Home Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ✅ Route for Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// ✅ Handle User Registration (Hash Password)
app.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'All fields are required!' });
    }

    try {
        // ✅ Hash the password before saving
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // ✅ Store user with hashed password
        const result = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, email, hashedPassword, role.toLowerCase()]
        );

        console.log('User registered:', result.rows[0]);

        res.json({ message: 'Successfully Registered!' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Error registering user' });
    }
});

// ✅ Handle User Login (Check Email, Password, Role)
app.post('/login', async (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ message: 'All fields are required!' });
    }

    try {
        // ✅ Check if email exists
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (userCheck.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = userCheck.rows[0];

        // ✅ Compare hashed password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // ✅ Check if role matches (case-insensitive)
        if (user.role.toLowerCase() !== role.toLowerCase()) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // ✅ Login successful
        res.json({ message: 'Login successful!', redirect: '/dashboard' });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Error logging in' });
    }
});

// ✅ Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});