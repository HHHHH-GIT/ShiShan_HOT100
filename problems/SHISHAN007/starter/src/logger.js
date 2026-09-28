'use strict';
const fs = require('node:fs');
const path = require('node:path');
const directory = path.join(__dirname, '../logs');
fs.mkdirSync(directory, { recursive: true });
module.exports = (level, marker, fields = {}) => {
  fs.appendFileSync(path.join(directory, 'app.log'), `${new Date().toISOString()} ${level} ${marker} ${JSON.stringify(fields)}\n`);
};
