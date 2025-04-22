import express from 'express';
import { Sequelize, DataTypes } from 'sequelize';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';


dotenv.config(); // Load environment variables

export default (app) => {
    // Add body-parsing middleware
    app.use(express.json()); // Parses JSON payloads
    app.use(express.urlencoded({ extended: true })); // Parses URL-encoded payloads

    // Define database connection
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false
    });

    // Define User Model for Sports table
    const SportsUser = sequelize.define('Sports', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING, allowNull: false },
        email: { type: DataTypes.STRING, unique: true, allowNull: false },
        password: { type: DataTypes.STRING, allowNull: false },
        category: { type: DataTypes.STRING, allowNull: false }
    }, { timestamps: true });

    // Define User Model for culturals table
    const CulturalsUser = sequelize.define('Culturals', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING, allowNull: false },
        email: { type: DataTypes.STRING, unique: true, allowNull: false },
        password: { type: DataTypes.STRING, allowNull: false },
        category: { type: DataTypes.STRING, allowNull: false }
    }, { timestamps: true });

    // Sync database - create tables if they don't exist
    sequelize.sync()
        .then(() => console.log('✅ Database synced!'))
        .catch(err => console.error('❌ Sync error:', err));

    // ========== ROUTES ========== //

    // Signup Route
    app.post('/signup', async (req, res) => {
        try {
            const { name, email, password, category } = req.body;

            if (!name || !email || !password || !category) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            let User;
            if (category === 'Sports') {
                User = SportsUser;
            } else if (category === 'Culturals') {
                User = CulturalsUser;
            } else {
                return res.status(400).json({ error: 'Invalid category' });
            }

            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                return res.status(400).json({ error: 'Email already exists' });
            }

            await User.create({
                name,
                email,
                password: hashedPassword,
                category
            });

            return res.status(201).json({
                message: '✅ User registered successfully!'
            });

        } catch (error) {
            console.error('❌ Signup error:', error);
            return res.status(500).json({
                error: error.name === 'SequelizeUniqueConstraintError'
                    ? 'Email already exists'
                    : 'Registration failed'
            });
        }
    });

    // Login Route
    app.post('/login', async (req, res) => {
        try {
            const { email, password, category } = req.body;

            if (!email || !password || !category) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            let User;
            if (category === 'Sports') {
                User = SportsUser;
            } else if (category === 'Culturals') {
                User = CulturalsUser;
            } else {
                return res.status(400).json({ error: 'Invalid category' });
            }

            const user = await User.findOne({ where: { email } });
            
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Check if category matches
            if (user.category !== category) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            return res.status(200).json({
                message: '✅ Login successful!',
                redirect: '/dashboard'
            });

        } catch (error) {
            console.error('❌ Login error:', error);
            return res.status(500).json({ error: 'Login failed' });
        }
    });

    // Get Sports Data Route
    app.get('/api/sports', async (req, res) => {
        try {
            const sports = await SportsUser.findAll({
                attributes: ['name'],
                where: { category: 'Sports' }
            });
            res.json({ success: true, sports });
        } catch (error) {
            console.error('Error fetching sports:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch sports' });
        }
    });
    // Get Culturals Data
app.get('/api/culturals', async (req, res) => {
    try {
        const culturals = await CulturalsUser.findAll({
            attributes: ['name'],
            where: { category: 'Culturals' }
        });
        res.json({ 
            success: true, 
            culturals: culturals.map(cultural => ({ name: cultural.name }))
        });
    } catch (error) {
        console.error('Culturals fetch error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch cultural events',
            error: error.message 
        });
    }
});
// Generic Event Endpoints
app.get('/api/:type(sports|culturals)/:id/description', async (req, res) => {
    try {
        const { type, id } = req.params;
        // Fetch description from database
        const event = await (type === 'sports' ? SportsUser : CulturalsUser).findOne({
            where: { id },
            attributes: ['description']
        });
        res.json({ description: event?.description || '' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/:type(sports|culturals)/:id/description', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { description } = req.body;
        
        await (type === 'sports' ? SportsUser : CulturalsUser).update(
            { description },
            { where: { id } }
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Activities Endpoints
app.get('/api/:type(sports|culturals)/:id/activities', async (req, res) => {
    try {
        const { type, id } = req.params;
        // In a real app, you would have an Activities model/table
        const activities = await Activities.findAll({
            where: { 
                eventType: type,
                eventId: id 
            },
            order: [['date', 'ASC']]
        });
        res.json({ activities });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/:type(sports|culturals)/:id/activities', async (req, res) => {
    try {
        const { type, id } = req.params;
        const activityData = req.body;
        
        const newActivity = await Activities.create({
            ...activityData,
            eventType: type,
            eventId: id
        });
        
        res.json(newActivity);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/:type(sports|culturals)/:id/activities/:activityId', async (req, res) => {
    try {
        const { activityId } = req.params;
        await Activities.destroy({ where: { id: activityId } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

    // Add this verification endpoint for frontend
    app.get('/api/verify-auth', (req, res) => {
        // Implement your actual session verification here
        // This is a placeholder - replace with your auth logic
        res.json({ authenticated: false });
    });
};









 