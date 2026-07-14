const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API routes
const notesRouter = require('./routes/notes');
app.use('/api/notes', notesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Vidsyn AI Backend is running' });
});

// Never expose the backend folder (contains source/.env) to the browser.
// (Only reached during local dev; on Vercel static files are served by the CDN.)
app.use('/backend', (req, res) => res.status(403).end());

// Serve the frontend locally (index.html, css/, js/). On Vercel these are
// served by the CDN and this middleware is never hit for non-/api requests.
app.use(express.static(path.join(__dirname, '..')));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

module.exports = app;
