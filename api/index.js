// Vercel serverless entry point. All /api/* requests are routed here
// (see vercel.json) and handled by the shared Express app.
module.exports = require('../backend/app');
