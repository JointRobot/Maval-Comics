// GYANU HUNT · every word the player sees. Gen Z, Mumbai Hinglish, self-roasting.
// Edit freely — nothing else needs to change.

// Placards, grouped by language so people across India can wear one that feels like home.
export const SLOGAN_SETS = {
  hinglish: [
    'Soda lemon ginger pop, Gyanu bhai is a flop',
    'Go Gyanu go! (no seriously, go)',
    'Ek do teen chaar, Gyanu ab toh haar',
    'Unemployed? Yes. Undefeated? Also yes.',
    'Chronically online, briefly outside',
    'Lazy legend, Gyanu finder',
    'Kaun Gyanu? Mil gaya Gyanu',
    'Ek Gyanu, hazaar camera',
    'Touching grass, catching Gyanu',
    'Cutting chai, cutting Gyanu’s hiding streak',
    'Hide & seek champion? Not on my watch',
    'Gyanu, log out',
    'It’s giving… found you',
    'My screen time finally paid off',
    'Gyanu bhai, bahar aao, ghar jaana hai',
    'Bas ek photo, Gyanu. Bas ek.',
    'Aaj ka plan: Gyanu hunt. Kal ka plan: neend.',
    'Scroll chhod, Gyanu pakad',
    'Mera dil, mera Gyanu, mera 5% battery',
    'Gyanu, tera time aa gaya'
  ],
  tamil: [
    'ஞானு எங்கே? நாங்க கண்டுபிடிப்போம்!',
    'ஒரு டீ குடிச்சிட்டு ஞானுவைத் தேடுவோம் ☕',
    'ஞானு, ஞானு… வெளியே வா!',
    'ஓடாதீங்க, நடந்தே தேடுங்க, ஞானு எங்கயும் போகல',
    'ஞானுவைப் பிடிச்சா பாயிண்ட்ஸ் தான்!',
    'போனை எடு, ஞானுவைத் தேடு'
  ],
  bengali: [
    'জ্ঞানু কোথায়? খুঁজে বের করবোই!',
    'এক কাপ চা আর জ্ঞানু খোঁজা ☕',
    'জ্ঞানুদা, এবার বেরিয়ে এসো!',
    'দৌড়িও না, হেঁটে খোঁজো, জ্ঞানু কোথাও যাচ্ছে না',
    'জ্ঞানুকে ধরলেই পয়েন্ট!',
    'আড্ডাও চাই, জ্ঞানুও চাই'
  ],
  marathi: [
    'ज्ञानू कुठे आहे? आम्ही शोधणारच!',
    'कटिंग चहा प्या, ज्ञानूला शोधा ☕',
    'ज्ञानूभाऊ, आता बाहेर या!',
    'पळू नका, चालत शोधा, ज्ञानू कुठे जात नाही',
    'ज्ञानू सापडला की पॉइंट्स पक्के!'
  ],
  pan: [
    'Delhi to Chennai, Mumbai to Kolkata: find Gyanu 🪳',
    'Gyanu in every language, found in none (yet)',
    '404: Gyanu not found',
    'Walk, snap, share. Gyanu hates it.',
    'Ctrl + Alt + Gyanu',
    'Chai, chill, catch Gyanu ☕',
    'Gyanu, we have your location. (We don’t.)'
  ]
};
export const SLOGAN_LANGS = [['hinglish', 'Hinglish'], ['tamil', 'தமிழ்'], ['bengali', 'বাংলা'], ['marathi', 'मराठी'], ['pan', 'Pan-India']];
export const SLOGANS = Object.values(SLOGAN_SETS).flat();
export const defaultSloganLang = () => { const l = (navigator.language || '').toLowerCase(); return l.startsWith('ta') ? 'tamil' : l.startsWith('bn') ? 'bengali' : l.startsWith('mr') ? 'marathi' : 'hinglish'; };
// Which script is a placard written in? Used by the Crowd wall filter.
export const scriptOf = t => /[\u0B80-\u0BFF]/.test(t) ? 'tamil' : /[\u0980-\u09FF]/.test(t) ? 'bengali' : /[\u0900-\u097F]/.test(t) ? 'marathi' : 'latin';

export const T = {
  tagline: 'Can you spot Gyanu?',
  sub: 'He’s hiding. You’re chronically online. Use it.',
  play: 'PLAY NOW',
  safety: 'Play smart. Don’t run. Respect people’s privacy. Stay in public/safe areas.',
  safetyShort: 'Walk, don’t sprint · respect people · stay in safe areas',

  joinTitle: 'Pick your hunter name',
  joinHelp: '3–12 letters or numbers. No real names needed — be iconic, not identifiable.',
  sloganTitle: 'Pick your placard',
  sloganHelp: 'Your slogan shows on the leaderboard + your share card. Or write your own.',
  sloganCustom: 'Write my own',
  sloganPh: 'max 60 characters, keep it fun',
  joinGo: 'LOCK IN, NO CAP',
  otpTitle: 'Quick verify',
  otpHelp: 'We text a code once. Your number is never shown to anyone and never on the leaderboard.',
  otpSend: 'SEND CODE', otpVerify: 'VERIFY',
  otpDemo: c => `Demo mode — your code is ${c}`,

  hiding: 'GYANU IS HIDING. FIND HIM.',
  hidingSub: 'Scope the map. Tap a ping. Go find him — at walking speed, bestie.',
  noHunts: 'Gyanu is in his villain era (offline).',
  noHuntsSub: 'Next drop is cooking. Whack, punch, or shout while you wait.',
  scan: 'SNAP HIM, NO CAP',
  takePhoto: 'SNAP IT',
  frameTip: 'Frame Gyanu, not people’s faces.',
  foundAlready: 'Already caught this one. W.',
  pending: 'With the judges',
  tries: n => `${n} tr${n === 1 ? 'y' : 'ies'} left`,

  camTitle: 'Camera time',
  camWhy: 'We need your camera to snap Gyanu. The photo is shrunk on your phone and only a tiny copy is sent for checking — then auto-deleted. No gallery access. No location.',
  camOk: 'OPEN CAMERA, BET', camNo: 'Nah, later',
  camFail: 'Camera said no. Use the button below to snap one instead.',
  camFallback: 'OPEN PHONE CAMERA',

  checking: ['Checking the vibes…', 'Asking the council…', 'Zooming in like a detective…', 'Running the Gyanu-meter…'],
  found: 'GYANU FOUND!',
  foundSub: ['No cap, that’s him.', 'You ate that.', 'Main character behaviour.', 'Certified Gyanu spotter.'],
  moved: 'Gyanu has moved.',
  huntAgain: 'RUN IT BACK',
  sentJudges: 'SENT TO THE JUDGES',
  sentSub: 'Lowkey blurry, so a human is checking. Points drop in a min.',
  dupTitle: 'NAH, SEEN THAT ONE',
  dupSub: 'Same pic as before. Screenshots don’t count, detective. Streak reset.',
  coolTitle: 'EASY, SPEEDRUNNER',
  blockTitle: 'HOLD UP',
  rejected: 'The judges said that’s not Gyanu. Streak reset. Shake it off.',
  approvedLate: p => `The judges approved your pic! +${p}`,

  streak: n => n >= 5 ? `COCKROACH MODE ×${n} — unkillable` : `GYANU STREAK ×${n}`,
  parts: { base: 'Find', speed: 'Speed', quality: 'Clean shot', combo: 'Combo' },

  pausedTitle: 'HUNT PAUSED',
  pausedDefault: 'Crowd’s getting thick. Stay where you are, chill, sip something. We’ll be back.',
  goldenTitle: 'GOLDEN GYANU HAS APPEARED',
  goldenSub: 'Rare drop. First verified pic gets +500. Walk, don’t sprint.',
  finalTitle: 'FINAL GYANU HAS APPEARED',
  finalSub: 'Boss fight. Winner takes +1,000. Calm legs, sharp eyes.',

  endTitle: 'HUNT COMPLETE',
  endWinner: n => `${n} caught the Final Gyanu`,
  share: 'FLEX YOUR SCORE',

  nav: { hunt: 'HUNT', score: 'SCORE', rules: 'RULES', profile: 'PROFILE' },
  boardTitle: 'TOP HUNTERS',
  scopes: { global: 'GLOBAL', today: 'TODAY', nearby: 'NEARBY', home: 'AT HOME', punch: '🥊 PUNCH' },
  nearbyHelp: z => z ? `Hunters whose last find was at ${z}. Based on Gyanu zones only — we never use GPS.` : 'Find one Gyanu and we’ll show the hunters in your zone. No GPS, ever.',
  emptyBoard: 'Nobody’s scored yet. Be the first. Be legendary.',

  deleteBtn: 'DELETE ME FR',
  deleteConfirm: 'This wipes your hunter, score, slogan and photos. For real?',
  deleted: 'Gone. Like it never happened.',
  banned: 'Your account is on hold. Find the Gyanu crew in the orange tees.',

  // Whack-a-Gyanu — the at-home mode
  homeBtn: 'NOT AT THE EVENT? WHACK-A-GYANU',
  homeTitle: 'WHACK-A-GYANU',
  homeSub: '30 seconds. Gyanu pops up all over the ground. Bonk him. +1 each, golden +5. Don’t tap the cockroach — he’s one of us (−3).',
  homeStart: 'LET HIM COOK',
  homeAgain: 'RUN IT BACK',
  homeDone: n => n >= 40 ? 'Cracked. Touch grass after this.' : n >= 20 ? 'Okay you ate.' : n >= 8 ? 'Mid, but we move.' : 'Thumbs warming up, it’s fine.',
  homeBest: n => `Your best: ${n}`,
  homeRoach: 'NOT THE ROACH 😭',
  punchTitle: 'PUNCH',
  punchSub: '15 seconds. Tap the bag as fast as your thumb can. Every punch counts. Highest total wins the board. Only the bag gets hurt, he’s fine.',
  punchStart: 'GLOVES ON, FR',
  punchDone: n => n >= 100 ? 'Thumb of steel. Please hydrate.' : n >= 70 ? 'Okay, gym bro.' : n >= 40 ? 'Solid warm-up.' : 'Gentle. The bag felt a breeze.',
  punchBoardNote: 'Most punches in 15 seconds. Same board for everyone, at the ground or at home.',
  homeBoardNote: 'At-home scores live on their own board, so the ground hunt stays fair.'
};

export const RULES_COPY = [
  ['How it works', 'Gyanu pops up somewhere at the event — a cut-out, a poster, a prop, or a crew member in the Gyanu cap. The map shows which zone he’s pinging in. Find him, snap him, score.'],
  ['Points', 'First to catch a Gyanu: 100. Second: 50. After that: 10. Golden Gyanu: 500 to the first. Final Gyanu: 1,000 to the winner.'],
  ['Speed bonus', 'Caught within 30s of him appearing: +100. Under 1 min: +75. Under 2: +50. Under 5: +25.'],
  ['Clean shot', 'Gyanu clearly in frame: +25. Partly hidden but obviously him: +10.'],
  ['Streaks', '2 in a row: +25 · 3: +50 · 4: +100 · 5+: +200 and you enter COCKROACH MODE. A fake, repeat or wrong pic resets it.'],
  ['No spam', 'One catch per Gyanu. 3 tries max per appearance. 15 seconds between shots. Screenshots and repeat pics get caught.'],
  ['Crowd rules (non-negotiable)', 'Walk, never run. No pushing, climbing or crossing roads. Stay out of barricaded or restricted areas. Never block gates or exits. Don’t follow or photograph strangers — Gyanu is always marked. If the crowd gets thick, we pause the game. Lazy is a lifestyle, use it.'],
  ['Your data', 'We keep a nickname, a slogan, your score and a tiny copy of each photo (deleted within 24h). No phone number on the leaderboard, no GPS, no gallery access. Delete everything anytime from Profile.']
];

// Narrated intro (auto-plays, ~40s) and the hand-held tour. `say` is what the voice reads.
export const INTRO = [
  { emoji: '🪳', title: 'YO. GYANU IS HIDING.', text: 'He’s somewhere in the crowd. Find him, snap him, stack points.', say: 'Yo! Gyanu is hiding somewhere in the crowd. Find him, snap him, stack points.', sfx: 'horn' },
  { emoji: '📍', title: 'FOLLOW THE PINK PINS', text: 'Pink pins on the map show where he’s hiding. Tap one and read the hint.', say: 'Pink pins on the map show where he is hiding. Tap one, read the hint, and walk there. Calmly.', sfx: 'pop' },
  { emoji: '📸', title: 'SCAN. SNAP. DONE.', text: 'Hit SCAN FOR GYANU and click the Gyanu print. Only the print. Never people’s faces.', say: 'Hit scan for Gyanu and click a photo of the Gyanu print. Only the print. No strangers, no faces. Respect people’s privacy.', sfx: 'whoosh' },
  { emoji: '⚡', title: 'FAST = MORE POINTS', text: 'Quicker finds pay more. Back-to-back finds build a streak combo.', say: 'Faster finds pay more. Back to back finds build a streak combo. Chase the combo.', sfx: 'cash' },
  { emoji: '🎤', title: 'WHEN THE CROWD GETS LOUD', text: 'Sometimes everyone gets a prompt: chant, shake or freeze. Hit the target together and Gyanu pops out for all. Only loudness leaves your phone, never your voice.', say: 'Sometimes everyone gets a prompt. Chant, shake, or freeze together, and Gyanu pops out for the whole crowd. Only the loudness number leaves your phone. Never your voice.', sfx: 'dhol' },
  { emoji: '🍛', title: 'THE SCENE TAB', text: 'Live food stalls, water, toilets, shade, charging. Spot something useful? Drop a pin.', say: 'The scene tab shows live food stalls, water, toilets, shade and charging, shared by everyone. Spot something useful? Drop a pin and earn points.', sfx: 'pop' },
  { emoji: '🚶', title: 'PLAY SMART. DON’T RUN.', text: 'Respect people’s privacy. Stay in public, safe areas. It’s a game, not a stampede.', say: 'Play smart. Don’t run. Respect people’s privacy. Stay in public, safe areas. Ready? Let’s hunt.', sfx: 'whistle' }
];

export const TOUR = (nick, o = {}) => [
  { emoji: '🪳', title: `YO ${nick}! LET’S GO`, text: 'Quick tour, 30 seconds. I’ll show you exactly where to tap.', say: `Yo ${nick}! Quick tour. I will show you exactly where to tap.`, sfx: 'level' },
  { target: o.pin || '#map', title: 'STEP 1 · TAP THE PIN', text: 'See the pulsing pin with Gyanu’s face? That’s where he’s hiding. Tap it.', say: 'Step one. See the pulsing pin with Gyanu’s face? That is where he is hiding. Tap it.', sfx: 'pop' },
  { target: '#sheet', title: 'STEP 2 · READ THE HINT', text: 'Zone, points and a hint live here. Read it, then walk there. No running.', say: 'Step two. Read the hint, then walk to that spot. No running.' },
  { target: '#scanBtn', title: 'STEP 3 · SCAN FOR GYANU', text: 'Found the Gyanu print? Tap this, point the camera at it and shoot. Never people’s faces.', say: 'Step three. Found the Gyanu print? Tap this button, point the camera at it, and shoot. Never people’s faces.', sfx: 'whoosh' },
  { emoji: '🪳', title: 'WILD GYANUS!', text: 'Gyanus pop up all over the map and run between zones. Only 4 people can catch each one. Tap a pin, walk there, and throw!', say: 'Wild Gyanus pop up all over the map and keep moving between zones. Only four people can catch each one. Tap a pin, walk there, and throw!', sfx: 'whoosh' },
  { target: '#wBtn', title: 'WAITING? PLAY!', text: 'WHACK, PUNCH or CALL THE CROWD while you walk. They all hit the leaderboard.', say: 'Waiting around? Whack, punch, or call the crowd while you walk.', sfx: 'pop' },
  { target: '.top .pts', title: 'YOUR POINTS', text: 'Faster finds and streaks = more points. They land up here.', say: 'Faster finds and streaks mean more points. They land up here.', sfx: 'cash' },
  { target: '#nav [data-v=score]', title: 'CLIMB THE BOARD', text: 'Leaderboards: everyone, today, nearby, whack and punch.', say: 'Climb the leaderboard. Everyone, today, nearby, whack and punch.' },
  { target: '#nav [data-v=scene]', title: 'THE SCENE', text: 'Food, water, toilets, shade, charging. Spot something useful? Drop a pin.', say: 'The scene tab. Food, water, toilets, shade, charging. Spot something useful? Drop a pin.' },
  { emoji: '🚶', title: 'GO FIND HIM!', text: 'Tap the pulsing pin to start. Walk, don’t run, and respect people’s privacy.', say: 'Go find him! Tap the pulsing pin to start. Walk, don’t run, and respect people’s privacy.', sfx: 'horn' }
];

// ---- Roaming Gyanus (wild spawns + player drops)
export const ROAM = {
  kindTag: { wild: '🪳 WILD GYANU', golden: '✨ GOLDEN WILD', player: '🎁 PLAYER DROP' },
  nextPts: (pts, n) => `Catch #${n} pays +${pts}. Earlier catchers earn more!`,
  mineNote: 'You hid this one. You earn points every time someone catches it.',
  gotNote: 'You got this one. Look for the next!',
  dropAppear: (by, z) => `🎁 ${by || 'A player'} hid a Gyanu at ${z}! 4 spots only`,
  wildAppear: (z, n) => `🪳 A wild Gyanu appeared at ${z}! First ${n} catchers win`,
  goldenAppear: z => `✨ GOLDEN Gyanu at ${z}! Only 2 can catch him. Go go go!`,
  hopped: (a, b) => `🔀 He ran from ${a} to ${b}! Change of plan`,
  lastSpot: z => `⚠️ Last spot left at ${z}. Quick!`,
  gone: '🪳 He dipped! Eyes on the map for the next one',
  catchTitle: 'SLAP HIM!', catchSub: 'Hit SLAP when his face is in the green. Miss and he gets faster, lol.',
  catchCode: z => `You must be there. Find the Gyanu poster at ${z} and type its code.`,
  catchHint: 'Watch the green zone…', needCodeMsg: 'Type the zone code first (it is on the poster there).',
  miss: ['Bro swung at air 😭', 'He dodged. Embarrassing', 'Too early, calm down', 'Gyanu is laughing at you', 'Aim, bestie, aim'],
  winTitle: n => (n === 1 ? 'FIRST BLOOD!' : `SLAPPED #${n}!`),
  winSub: left => `${left} more spot${left === 1 ? '' : 's'} left. Tell your friends before he is gone`,
  lastCatcher: 'You took the LAST spot. Gyanu is gone from the map. W.', winNext: 'NEXT ONE, LET’S GO',
  dropTitle: 'PLANT A GYANU', dropSub: 'Drop him where you stand. 4 players can catch him. You get +10 each time. Passive income, bro.',
  hints: ['Near the chai stall', 'Behind the big banner', 'Look up!', 'By the water point', 'Near the stage steps'],
  noDrops: 'Three drops an hour is the limit. Go catch some instead!', alreadyOut: 'Your Gyanu is still out there. Wait till he is found.',
  dropped: '🎁 Hidden! Stay nearby and watch the map. You earn +10 per catch',
  dropCaught: (nick, pts, full) => `🎁 ${nick} caught your Gyanu! +${pts}${full ? ' (all 4 found him: bonus!)' : ''}`
};

// ---- Shout-off: keep yelling the chant and Gyanu runs from the dot. Go quiet and he sprints at it.
export const SHOUT = {
  chant: 'VASTA GYANU HAIYA!', chantAlt: ['VASTA GYANU HAIYA', 'HAIYA VASTA GYANU', 'GYANU HAIYA HAIYA'],
  title: 'VASTA GYANU HAIYA', sub: 'Keep shouting the chant and Gyanu runs away from the dot. Go quiet and he sprints at it. Survive 30 seconds and you win. Mic only hears loudness, nothing is recorded.',
  start: 'START SHOUTING', mic: 'Allow the mic when your phone asks. Loud and proud!',
  noMic: 'No mic? No problem. Mash the SHOUT button instead.', go: 'SHOUT!!',
  low: ['LOUDER, BESTIE', 'HE IS COMING 😭', 'DON’T GO QUIET', 'KEEP YELLING', 'SHOUT OR LOSE'], ok: ['HE IS RUNNING!', 'W CHANT', 'KEEP IT UP', 'SCREAM IT', 'GYANU IS SCARED'],
  win: 'YOU HELD THE DOT', winSub: 'Gyanu ran away crying. Your throat did the job.', lose: 'HE REACHED THE DOT', loseSub: 'You went quiet and he walked right in. Rude.',
  again: 'RUN IT BACK', done: n => n >= 30 ? 'Lungs of steel. Chai break, legend.' : n >= 15 ? 'Good run. Hydrate.' : 'He got you. Louder next time.'
};

// Gyanu's voice lines (Hindi, spoken by the phone's own voice): the question, and the chant while he's getting hit.
export const GYANU_VOICE = { ask: 'साझा करना चाहिए क्या?', chant: 'साझा साझा साझा' };

const A = ['SODA', 'LEMON', 'GINGER', 'CHAI', 'VADA', 'POP', 'MASALA', 'CUTTING', 'SAMOSA', 'NIMBU', 'JALEBI', 'BHEL'];
const B = ['POP', 'WALA', 'BRO', 'BEAST', 'GANG', 'GOAT', 'PRO', 'KING', 'CHAD', 'ZILLA', 'NINJA', 'FAN'];
export const randomNick = () => (A[Math.floor(Math.random() * A.length)] + B[Math.floor(Math.random() * B.length)] + Math.floor(Math.random() * 90 + 10)).slice(0, 12);

// Gyanu's "share what you know" nudges: Hindi first, a Hinglish twist underneath. Shown on the Scene tab,
// after a find, and as an occasional bubble on the map.
export const GSAYS = [
  ['जानकारी साझा करो, सबकी मदद करो!', 'Info share karo, points bhi milenge.'],
  ['खाना कहाँ मिल रहा है? बताओ, सबका पेट भरो 🍛', 'Short line wala stall? Pin kar do.'],
  ['पानी का स्टॉल दिखा? Scene में डाल दो 💧', 'Pyaas sabko lagti hai.'],
  ['टॉयलेट की लाइन छोटी है? शेयर करो 🚻', 'Duaayein milengi, guaranteed.'],
  ['भीड़ ज़्यादा लगे तो बताओ, सब सुरक्षित रहें ⚠️', 'Ek pin, kai logon ki help.'],
  ['चार्जिंग पॉइंट मिला? साझा करो 🔋', 'Battery low walon ke hero bano.'],
  ['जो पता है, वो बताओ। यही असली हीरो वाला काम है', 'Gyanu bhi yahi kehta hai. Probably.']
];
export const gsay = () => GSAYS[Math.floor(Math.random() * GSAYS.length)];

// ---- Call the crowd: ready-made chants (any language; custom ones must be English letters)
export const CHANTS = [
  'GYANU BAHAR AAO!', 'EK DO TEEN CHAAR, GYANU AB TOH HAAR', 'SODA LEMON GINGER POP!', 'GYANU, LOG OUT!', 'SCROLL CHHOD, GYANU PAKAD',
  'ज्ञानू बाहर आओ!', 'ஞானு, ஞானு… வெளியே வா!', 'জ্ঞানুদা, বেরিয়ে এসো!', 'ज्ञानूभाऊ, बाहेर या!'
];
export const CALL_KINDS = [
  { id: 'chant',  emoji: '🎤', label: 'CHANT', hint: 'Everyone shouts it. Mic loudness fills the meter (audio never leaves the phone).', line: 'GYANU BAHAR AAO!' },
  { id: 'shake',  emoji: '📳', label: 'JUMP', hint: 'Jump or shake in place. Phone motion fills the meter.', line: 'JUMP JUMP JUMP!' },
  { id: 'statue', emoji: '🧍', label: 'FREEZE', hint: 'Everyone freezes. Stillness fills the meter.', line: 'FREEZE. NOBODY MOVES.' },
  { id: 'lights', emoji: '🔦', label: 'LIGHTS', hint: 'Every screen pulses together. Calm, pretty, no points.', line: 'LIGHT IT UP 🔦' }
];
