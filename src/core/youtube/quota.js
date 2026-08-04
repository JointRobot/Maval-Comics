'use strict';
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Real YouTube Data API v3 costs, per Google's published quota table — these are much
// steeper than the design prototype's simulated numbers (100/+400 units). A single
// publish with captions costs 2100 units against the default 10,000/day project
// allocation, i.e. ~4-5 real publishes/day, not ~20 like the mock implied.
const COSTS = {
  videoInsert: 1600,
  thumbnailSet: 50,
  playlistItemInsert: 50,
  captionInsert: 400,
};
const DAILY_UNITS = 10000;

function filePath() {
  return path.join(app.getPath('userData'), 'quota.json');
}

function pacificDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

class QuotaTracker {
  constructor() {
    this.state = this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath(), 'utf8'));
      if (raw.date === pacificDateKey()) return raw;
    } catch { /* first run, or stale — start fresh below */ }
    return { date: pacificDateKey(), unitsUsed: 0, uploadsUsed: 0 };
  }

  save() {
    fs.writeFileSync(filePath(), JSON.stringify(this.state));
  }

  refreshDay() {
    const today = pacificDateKey();
    if (this.state.date !== today) this.state = { date: today, unitsUsed: 0, uploadsUsed: 0 };
  }

  costOf(withCaptions) {
    return COSTS.videoInsert + COSTS.thumbnailSet + COSTS.playlistItemInsert + (withCaptions ? COSTS.captionInsert : 0);
  }

  snapshot() {
    this.refreshDay();
    return { ...this.state, dailyUnits: DAILY_UNITS, costs: COSTS };
  }

  remainingPublishes(withCaptions) {
    this.refreshDay();
    return Math.max(0, Math.floor((DAILY_UNITS - this.state.unitsUsed) / this.costOf(withCaptions)));
  }

  recordPublish({ captions }) {
    this.refreshDay();
    this.state.unitsUsed += this.costOf(captions);
    this.state.uploadsUsed += 1;
    this.save();
  }
}

module.exports = { QuotaTracker, COSTS, DAILY_UNITS };
