const { Client } = require('pg');

// Database configuration
const dbConfig = {
  host: 'localhost',
  port: 3000,
  user: 'postgres',      // Replace with your PostgreSQL username
  password: '9848',           // Your password
  database: 'basic',  // Replace with your database name
};

// Create a new client instance
const client = new Client(dbConfig);

// Connect to the database
client.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch((err) => console.error('Connection error', err.stack));

// Example query - creating a table
const createTable = () => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE
    );
  `;

  client.query(query, (err, res) => {
    if (err) {
      console.error('Error creating table', err);
    } else {
      console.log('Users table created successfully.');
    }
  });
};

// Insert a new user
const insertUser = (name, email) => {
  const query = 'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id';

  client.query(query, [name, email], (err, res) => {
    if (err) {
      console.error('Error inserting user', err);
    } else {
      console.log(`User added with ID: ${res.rows[0].id}`);
    }
  });
};

// Get all users
const getUsers = () => {
  const query = 'SELECT * FROM users';

  client.query(query, (err, res) => {
    if (err) {
      console.error('Error fetching users', err);
    } else {
      console.log('All users:', res.rows);
    }
  });
};

// Close the database connection
const closeConnection = () => {
  client.end((err) => {
    if (err) {
      console.error('Error closing connection', err);
    } else {
      console.log('Database connection closed.');
    }
  });
};

// Run the functions
createTable();
insertUser('Alice', 'alice@example.com');
getUsers();
closeConnection();

