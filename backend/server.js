// Local development server. On Vercel the app is run as a serverless
// function via /api/index.js instead (this file is not used there).
const app = require('./app');

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
