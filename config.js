'use strict';
const fs = require('fs');
const path = require('path');

// config.local.json is gitignored — same pattern as sitecalmshade's secrets.php.
// Copy config.example.json to config.local.json and fill in real values.
function load() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.local.json'), 'utf8'));
  } catch {
    return {};
  }
}

module.exports = load();
