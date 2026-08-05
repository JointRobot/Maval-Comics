'use strict';
const fs = require('fs');
const path = require('path');

// Real credentials never live inside the app bundle (app.asar is read-only once
// packaged, so a file dropped next to the source only works in `npm start` dev mode).
// The real location is Electron's per-user userData directory:
//   macOS:   ~/Library/Application Support/MyTube/config.json
//   Windows: %APPDATA%/MyTube/config.json
// config.local.json next to the source is still checked as a dev-mode convenience.
function loadConfig(userDataDir) {
  const candidates = [
    path.join(userDataDir, 'config.json'),
    path.join(__dirname, 'config.local.json'),
  ];
  for (const file of candidates) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch { /* try next candidate */ }
  }
  return {};
}

module.exports = loadConfig;
