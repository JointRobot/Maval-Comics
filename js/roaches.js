// GYANU HUNT · ten Gen Z cockroach profile icons. Pure SVG, drawn in code: thick ink outline, flat colours,
// same comic style as Gyanu. One hidden sprite sheet is injected once; every avatar just points at it.
const INK = '#15131A', BODY = '#8B4A22', BODY2 = '#B06A38';

export const ROACHES = [
  { name: 'SHADES',   bg: '#FF2E88' }, { name: 'BASS HEAD', bg: '#00A99D' }, { name: 'BEANIE',  bg: '#FFD400' },
  { name: 'BACKWARDS', bg: '#FF8A1F' }, { name: 'DRIP',      bg: '#6B3FA0' }, { name: 'HOODIE',  bg: '#2B59C3' },
  { name: 'DHOL BAND', bg: '#E0457B' }, { name: 'RIZZ',      bg: '#FFB3D1' }, { name: 'CHAI',    bg: '#7BD3C8' },
  { name: 'PUNK',      bg: '#F4D35E' }
];

const st = (w = 4) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const antIn  = `<path d="M42 33Q36 14 22 15M58 33Q64 14 78 15" fill="none" ${st()}/><circle cx="22" cy="15" r="3.6" fill="${INK}"/><circle cx="78" cy="15" r="3.6" fill="${INK}"/>`;
const antOut = `<path d="M31 42Q16 30 13 14M69 42Q84 30 87 14" fill="none" ${st()}/><circle cx="13" cy="14" r="3.6" fill="${INK}"/><circle cx="87" cy="14" r="3.6" fill="${INK}"/>`;
const legs = `<path d="M25 56L9 50M25 67L8 69M27 78L12 90M75 56L91 50M75 67L92 69M73 78L88 90" fill="none" ${st()}/>`;
const body = (rx = 26) => `<ellipse cx="50" cy="60" rx="${rx}" ry="30" fill="${BODY}" ${st()}/><path d="M50 34V90" stroke="${BODY2}" stroke-width="3" opacity=".55"/><path d="M36 42Q40 36 47 36" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".35"/>`;
const eyes = `<circle cx="39" cy="55" r="9" fill="#fff" ${st(3.5)}/><circle cx="61" cy="55" r="9" fill="#fff" ${st(3.5)}/><circle cx="41" cy="56" r="4" fill="${INK}"/><circle cx="63" cy="56" r="4" fill="${INK}"/><circle cx="42.5" cy="54.5" r="1.4" fill="#fff"/><circle cx="64.5" cy="54.5" r="1.4" fill="#fff"/>`;
const mouth = `<path d="M42 72Q50 79 58 72" fill="none" ${st(3.5)}/>`;
const wrap = (inner) => inner;

const FACES = [
  // 0 SHADES
  () => antIn + legs + body() + `<ellipse cx="39" cy="55" rx="11" ry="8.5" fill="${INK}"/><ellipse cx="61" cy="55" rx="11" ry="8.5" fill="${INK}"/><path d="M50 54h0" ${st()}/><path d="M30 50L70 50" stroke="${INK}" stroke-width="3"/><path d="M33 52l6 -2M55 52l6 -2" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>` + `<path d="M42 72Q50 80 58 72" fill="${INK}" ${st(3)}/>`,
  // 1 BASS HEAD: big headphones
  () => antOut + legs + body() + eyes + mouth + `<path d="M24 56Q22 22 50 22Q78 22 76 56" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M24 56Q22 22 50 22Q78 22 76 56" fill="none" stroke="#FF2E88" stroke-width="5" stroke-linecap="round"/><rect x="14" y="48" width="14" height="24" rx="6" fill="#FF2E88" ${st()}/><rect x="72" y="48" width="14" height="24" rx="6" fill="#FF2E88" ${st()}/>`,
  // 2 BEANIE
  () => antOut + legs + body() + eyes + mouth + `<path d="M26 44Q24 18 50 18Q76 18 74 44Z" fill="#FF2E88" ${st()}/><rect x="24" y="40" width="52" height="10" rx="4" fill="#fff" ${st()}/><circle cx="50" cy="14" r="7" fill="#fff" ${st()}/>`,
  // 3 BACKWARDS CAP
  () => antOut + legs + body() + eyes + mouth + `<path d="M27 44Q26 20 50 20Q74 20 73 44Z" fill="#2B59C3" ${st()}/><path d="M71 38L93 40L91 48L71 47Z" fill="#2B59C3" ${st()}/><circle cx="50" cy="18" r="3" fill="#FFD400" ${st(2)}/><path d="M27 44H73" stroke="#fff" stroke-width="3" opacity=".6"/>`,
  // 4 DRIP: crown + gold chain
  () => antOut + legs + body() + eyes + mouth + `<path d="M34 38L37 20L44 30L50 16L56 30L63 20L66 38Z" fill="#FFD400" ${st()}/><path d="M30 80Q50 100 70 80" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M30 80Q50 100 70 80" fill="none" stroke="#FFD400" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="94" r="6" fill="#FFD400" ${st(3)}/>`,
  // 5 HOODIE (hood is drawn behind the face)
  () => `<ellipse cx="50" cy="58" rx="38" ry="38" fill="#FF2E88" ${st()}/>` + antOut.replace(/M31 42Q16 30 13 14M69 42Q84 30 87 14/, 'M33 28Q22 14 18 8M67 28Q78 14 82 8').replace('cx="13" cy="14"', 'cx="18" cy="8"').replace('cx="87" cy="14"', 'cx="82" cy="8"') + `<ellipse cx="50" cy="60" rx="25" ry="28" fill="${BODY}" ${st()}/><path d="M50 34V88" stroke="${BODY2}" stroke-width="3" opacity=".55"/>` + eyes + mouth + `<path d="M42 92v10M58 92v10" ${st(3)}/><circle cx="42" cy="101" r="3" fill="#fff" ${st(2)}/><circle cx="58" cy="101" r="3" fill="#fff" ${st(2)}/>`,
  // 6 DHOL BAND: festival bandana
  () => antOut + legs + body() + eyes + mouth + `<path d="M25 40Q50 28 75 40L75 49Q50 37 25 49Z" fill="#E0242B" ${st()}/><g fill="#fff"><circle cx="38" cy="41" r="2"/><circle cx="50" cy="38" r="2"/><circle cx="62" cy="41" r="2"/></g><path d="M75 44L92 38L90 52Z" fill="#E0242B" ${st(3.5)}/>`,
  // 7 RIZZ: heart eyes + blush
  () => antIn + legs + body() + `<path d="M39 63C28 55 29 46 36 46C38 46 39 48 39 49C39 48 40 46 42 46C49 46 50 55 39 63Z" fill="#FF2E88" ${st(3)}/><path d="M61 63C50 55 51 46 58 46C60 46 61 48 61 49C61 48 62 46 64 46C71 46 72 55 61 63Z" fill="#FF2E88" ${st(3)}/><ellipse cx="29" cy="68" rx="5" ry="3.2" fill="#FF8DB8"/><ellipse cx="71" cy="68" rx="5" ry="3.2" fill="#FF8DB8"/><path d="M43 73Q50 80 57 73Q50 76 43 73Z" fill="#fff" ${st(3)}/>`,
  // 8 CHAI: kulhad cup with steam
  () => antIn + legs + body() + eyes + `<path d="M42 70Q50 76 58 70" fill="none" ${st(3.5)}/><path d="M60 78H84L80 98H64Z" fill="#C26A3A" ${st()}/><path d="M62 84H82" stroke="#fff" stroke-width="2.5" opacity=".5"/><path d="M68 74Q64 68 69 63Q74 58 70 52M77 74Q73 68 78 63" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".9"/>`,
  // 9 PUNK: mohawk + ear ring
  () => antOut + legs + body() + eyes + mouth + `<path d="M34 38L36 14L43 30L47 6L53 30L58 12L64 38Z" fill="#FF2E88" ${st()}/><circle cx="76" cy="62" r="5" fill="none" stroke="#fff" stroke-width="3"/><circle cx="76" cy="62" r="5" fill="none" ${st(1.4)} opacity=".5"/><path d="M33 50l-6 -3M67 50l6 -3" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`
];

export const spriteSheet = () => `<svg id="roachSprite" xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">${
  FACES.map((f, i) => `<symbol id="roach-${i}" viewBox="0 0 100 104">${f()}</symbol>`).join('')}</svg>`;

export const roachSvg = i => `<svg viewBox="0 0 100 104" width="100%" height="100%" aria-hidden="true"><use href="#roach-${((i % FACES.length) + FACES.length) % FACES.length}"/></svg>`;
export function ensureSprite() { if (!document.getElementById('roachSprite')) document.body.insertAdjacentHTML('afterbegin', spriteSheet()); }
