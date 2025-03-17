import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();
const app = express();
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

// Create users table if not exists
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

// Route for Home Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Route for Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Secure User Registration with Hashed Passwords
app.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'All fields are required!' });
    }
    try {
        // Hash the password before storing
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert user into database
        const result = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, email, hashedPassword, role]
        );
        
        console.log('User registered:', result.rows[0]);
        res.json({ message: 'Successfully Registered!' });
    } catch (error) {
        console.error('Error registering user:', error);
        if (error.code === '23505') {
            res.status(400).json({ message: 'Email already exists!' });
        } else {
            res.status(500).json({ message: 'Error registering user' });
        }
    }
});

// User Login: Verify Email, Password, and Role
app.post('/login', async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Email, password, and role are required!' });
    }
    try {
        // Check if user exists with provided email & role
        const result = await pool.query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, role]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials!' });
        }
        
        const user = result.rows[0];
        // Compare hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials!' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.json({ message: 'Login successful!', token });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Error logging in' });
    }
});

// Middleware for Authentication
const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(403).json({ message: 'Access denied!' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token!' });
    }
};

// Protected API Route Example
app.get('/profile', authenticateToken, (req, res) => {
    res.json({ message: 'Profile accessed', user: req.user });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
