// GYANU HUNT · configuration. The only file you must edit to go live.

export const CONFIG = {
  // 'local' = zero-setup demo: everything lives in this browser (localStorage) and syncs
  //           between tabs on the same device. Perfect for rehearsals and testing.
  // 'supabase' = real multi-player event. Fill in url + anonKey below and run supabase/schema.sql.
  backend: 'local',
  supabase: {
    url: '',        // e.g. https://abcd1234.supabase.co
    anonKey: ''     // the project's public anon key (safe to ship; RLS + RPCs guard the data)
  },

  // Phone OTP: 'off' (recommended for the MVP — see README §3), 'demo' (simulated code on screen),
  // or 'supabase' (real SMS through Supabase Auth's phone provider).
  otp: 'off',

  // Option C verification: a POST endpoint that returns { found, confidence }. Leave empty to skip.
  visionEndpoint: '',

  // Optional real sound clips (CC0). Anything not listed stays synthesised. e.g. { horn: 'audio/horn.mp3', boom: 'audio/boom.mp3' }
  sfxFiles: {},

  eventName: 'GYANU HUNT',
  credit: 'Created by Maval Comics',
  version: '0.3',
  edition: 'COCKROACH EDITION',
  pollMs: 6000,           // how often the leaderboard + hunt state refresh (Supabase mode)
  photoRetentionHours: 24 // thumbnails are wiped after this (control room can wipe sooner)
};

// The event ground, as zones on the isometric map. Plan metres: x east, y south.
// Hero zone (Main Stage) sits at the bottom of the screen (south-east), backdrops at the top.
export const ZONES = [
  { id: 'gate',   name: 'Main Gate',     short: 'GATE',   x: 4,  y: 30, w: 8,  h: 8 },
  { id: 'chai',   name: 'Chai Corner',   short: 'CHAI',   x: 4,  y: 4,  w: 9,  h: 9 },
  { id: 'banyan', name: 'Banyan Lawn',   short: 'LAWN',   x: 17, y: 4,  w: 11, h: 10 },
  { id: 'art',    name: 'Art Wall',      short: 'ART',    x: 32, y: 4,  w: 8,  h: 9 },
  { id: 'food',   name: 'Food Gali',     short: 'FOOD',   x: 16, y: 18, w: 8,  h: 18 },
  { id: 'games',  name: 'Games Alley',   short: 'GAMES',  x: 30, y: 17, w: 10, h: 9 },
  { id: 'stage',  name: 'Main Stage',    short: 'STAGE',  x: 29, y: 29, w: 13, h: 12 }
];
export const MAP = { w: 44, h: 44 };

// The Scene: crowd-sourced live info pins. "crowded" also alerts the control room.
export const SCENE_CATS = [
  { id: 'food',    icon: '🍛', label: 'Food' },
  { id: 'water',   icon: '💧', label: 'Water' },
  { id: 'toilet',  icon: '🚻', label: 'Toilets' },
  { id: 'medic',   icon: '⛑️', label: 'Medic' },
  { id: 'charge',  icon: '🔋', label: 'Charging' },
  { id: 'shade',   icon: '🌳', label: 'Shade / sit' },
  { id: 'exit',    icon: '🚪', label: 'Exit / way out' },
  { id: 'crowded', icon: '⚠️', label: 'Too crowded' }
];
