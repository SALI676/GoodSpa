// index.js (or app.js) for your Node.js Backend

// Load environment variables from .env file
require('dotenv').config();

// Import necessary modules
const express = require('express');
const { Pool } = require('pg'); // PostgreSQL client
const cors = require('cors'); // Middleware for Cross-Origin Resource Sharing

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000; // Use environment port or default to 3000

// --- Database Configuration ---
// IMPORTANT: Replace these with your actual PostgreSQL credentials.
// For production, use environment variables (e.g., process.env.DB_USER)
// DO NOT hardcode sensitive credentials in production code.

// Conditional SSL configuration based on environment
// If NODE_ENV is 'production' (e.g., on Render), use SSL.
// Otherwise (e.g., local development), do NOT use SSL.
const sslConfig = process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false } // Required for Render's database
    : false; // For local PostgreSQL (which usually doesn't need SSL)

// --- DEBUGGING: Log DB connection parameters ---
console.log('Attempting to connect to DB with:');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_DATABASE:', process.env.DB_DATABASE);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('NODE_ENV:', process.env.NODE_ENV); // Check what NODE_ENV is truly set to
console.log('SSL Config used:', sslConfig); // Check what SSL config is being applied
// Only print first few chars of password for security
console.log('DB_PASSWORD (first 5 chars):', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.substring(0, 5) + '3TEXrlu4o087YHbw3BcUKO4lOik4a2Tn' : 'NOT SET OR EMPTY');
// --- END DEBUGGING ---

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: sslConfig // <--- THIS IS THE CRUCIAL CHANGE TO MAKE SSL CONDITIONAL
});


// Test database connection
pool.connect()
    .then(client => {
        console.log('Connected to PostgreSQL database successfully!');
        client.release(); // Release the client back to the pool
    })
    .catch(err => {
        console.error('Error connecting to PostgreSQL database:', err.message);
        console.error('Please check your database credentials and ensure PostgreSQL is running.');
        // Optionally exit the process if database connection is critical
        // process.exit(1);
    });

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- API Routes for Bookings ---
app.get('/booking_spa12', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM booking_spa12 ORDER BY datetime DESC;');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching bookings from booking_spa12 table:', err);
        res.status(500).json({ error: 'Failed to retrieve bookings from the database.' });
    }
});

app.post('/booking_spa12', async (req, res) => {
    const { service, duration, price, name, phone, datetime } = req.body;

    if (!service || !duration || !price || !name || !phone || !datetime) {
        return res.status(400).json({ error: 'All booking fields are required.' });
    }

    const cleanPrice = parseFloat(String(price).replace(/[^0-9.]/g, ''));

    try {
        const result = await pool.query(
            'INSERT INTO booking_spa12(service, duration, price, name, phone, datetime) VALUES($1, $2, $3, $4, $5, $6) RETURNING *;',
            [service, duration, cleanPrice, name, phone, datetime]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding booking to booking_spa12 table:', err);
        res.status(500).json({ error: 'Failed to add booking to the database.' });
    }
});


app.delete('/booking_spa12/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM booking_spa12 WHERE id = $1 RETURNING id;', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: `Booking with ID ${id} not found.` });
        }
        res.status(200).json({ message: `Booking with ID ${id} deleted successfully.` });
    } catch (err) {
        console.error('Error deleting booking from booking_spa12 table:', err);
        res.status(500).json({ error: 'Failed to delete booking from the database.' });
    }
});

// --- API Route for Simulated Payment Initiation ---
app.post('/api/payments/initiate', (req, res) => {
    const { amount, serviceName, bookingId } = req.body;
    if (!amount || !serviceName || !bookingId) {
        return res.status(400).json({ error: 'Payment amount, service name, and booking ID are required to initiate payment.' });
    }
    console.log(`Simulating payment initiation for Booking ID: ${bookingId}, Service: ${serviceName}, Amount: ${amount}`);
    const simulatedQrCodeUrl = `https://i.postimg.cc/Dz3sgw1N/QR1.jpg?amount=${amount.replace('$', '')}&bookingId=${bookingId}`;
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setTimeout(() => {
        res.status(200).json({
            message: 'Payment initiation successful (simulated). Scan QR to complete.',
            qrCodeUrl: simulatedQrCodeUrl,
            transactionId: transactionId,
            status: 'pending'
        });
    }, 1000);
});

// --- NEW API Route for Simulated Payment Confirmation (Webhook) ---
app.post('/api/payments/confirm', async (req, res) => {
    const { bookingId } = req.body;
    if (!bookingId) {
        return res.status(400).json({ error: 'Booking ID is required to confirm payment.' });
    }
    try {
        const result = await pool.query(
            'UPDATE booking_spa12 SET payment_status = $1 WHERE id = $2 RETURNING *;',
            ['completed', bookingId]
        );
        if (result.rowCount === 0) {
            console.warn(`Attempted to confirm payment for non-existent booking ID: ${bookingId}`);
            return res.status(404).json({ error: `Booking with ID ${bookingId} not found for payment confirmation.` });
        }
        console.log(`Payment confirmed for Booking ID: ${bookingId}. Status updated to 'completed'.`);
        res.status(200).json({ message: `Payment for booking ID ${bookingId} confirmed successfully.` });
    } catch (err) {
        console.error('Error confirming payment for booking:', err);
        res.status(500).json({ error: 'Failed to update payment status in the database.' });
    }
});

/**
 * @route POST /api/testimonials
 * @description Create a new testimonial and save it to the database.
 * @body {object} testimonial - Testimonial details (reviewerName, reviewerEmail, reviewTitle, reviewText, rating, genuineOpinion)
 * @returns {object} The newly created testimonial object.
 */
app.post('/api/testimonials', async (req, res) => {
    const { reviewerName, reviewerEmail, reviewTitle, reviewText, rating, genuineOpinion } = req.body;
    if (!reviewerName || !reviewerEmail || !reviewText || !rating || genuineOpinion === undefined) {
        return res.status(400).json({ error: 'All testimonial fields (except title) are required.' });
    }
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO testimonials(reviewer_name, reviewer_email, review_title, review_text, rating, genuine_opinion, created_at) VALUES($1, $2, $3, $4, $5, $6, NOW()) RETURNING *;',
            [reviewerName, reviewerEmail, reviewTitle, reviewText, rating, genuineOpinion]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding testimonial to database:', err);
        res.status(500).json({ error: 'Failed to add testimonial to the database.' });
    }
});

/**
 * @route GET /api/testimonials
 * @description Get all existing testimonials from the database, ordered by creation date descending.
 * @returns {Array} An array of testimonial objects.
 */
app.get('/api/testimonials', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM testimonials ORDER BY created_at DESC;');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching testimonials from database:', err);
        res.status(500).json({ error: 'Failed to retrieve testimonials from the database.' });
    }
});

/**
 * @route DELETE /api/testimonials/:id
 * @description Delete a testimonial from the database by its ID.
 * @param {string} id - The unique ID (review_id) of the testimonial to delete.
 * @returns {object} A success message or an error.
 */
app.delete('/api/testimonials/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM testimonials WHERE id = $1 RETURNING id;', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: `Testimonial with ID ${id} not found.` });
        }
        res.status(200).json({ message: `Testimonial with ID ${id} deleted successfully.` });
    } catch (err) {
        console.error('Error deleting testimonial from database:', err.message || err);
        res.status(500).json({ error: `Failed to delete testimonial from the database: ${err.message || 'Unknown database error'}` });
    }
});


// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log('Ensure your frontend BASE_API_URL is set to this backend URL for full functionality.');
    console.log('New payment initiation endpoint available at http://localhost:3000/api/payments/initiate');
    console.log('New payment confirmation endpoint available at http://localhost:3000/api/payments/confirm');
    console.log('New testimonial submission endpoint available at http://localhost:3000/api/testimonials (POST)');
    console.log('New testimonial retrieval endpoint available at http://localhost:3000/api/testimonials (GET)');
    console.log('New testimonial deletion endpoint available at http://localhost:3000/api/testimonials/:id (DELETE)');
});