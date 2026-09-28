const fs = require('node:fs');
const path = require('node:path');
const directory = path.join(__dirname, '../logs');
fs.mkdirSync(directory, { recursive: true });
module.exports = function log(level, marker, fields = {}) {
  const line = `${new Date().toISOString()} ${level} ${marker} ${JSON.stringify(fields)}\n`;
  fs.appendFileSync(path.join(directory, 'app.log'), line);
};
