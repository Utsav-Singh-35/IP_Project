const server = require('../server');

// Wrap the Express app as a Vercel Serverless Function handler
module.exports = (req, res) => {
  return server(req, res);
};
