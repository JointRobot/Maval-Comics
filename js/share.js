// GYANU HUNT · share card. Drawn on a canvas, nothing personal beyond nickname + slogan.
import { CONFIG } from './config.js';

const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

const gameUrl = () => { try { return new URL('./', location.href).href; } catch { return location.href; } };
export async function makeCard({ nick, slogan, finds, score, rank, homeBest }) {
  await document.fonts?.load('80px Bungee').catch(() => {});
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3B2A5C'); g.addColorStop(0.55, '#8C4870'); g.addColorStop(1, '#E86A4A');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.save(); x.translate(W / 2, 520); x.fillStyle = 'rgba(255,212,0,.13)';
  for (let i = 0; i < 24; i++) { x.rotate(Math.PI / 12); x.beginPath(); x.moveTo(0, 0); x.lineTo(1400, -90); x.lineTo(1400, 90); x.fill(); }
  x.restore();
  x.fillStyle = 'rgba(21,19,26,.12)'; for (let yy = 0; yy < H; yy += 14) for (let xx = (yy / 14 % 2) * 7; xx < W; xx += 14) { x.beginPath(); x.arc(xx, yy, 2.2, 0, 7); x.fill(); }
  const F = s => `${s}px Bungee, Impact, sans-serif`;
  const outlined = (t, X, Y, size, fill, rot = 0) => {
    x.save(); x.translate(X, Y); x.rotate(rot); x.font = F(size); x.textAlign = 'center'; x.lineJoin = 'round';
    x.fillStyle = '#15131A'; x.fillText(t, 10, 10); x.lineWidth = size / 9; x.strokeStyle = '#15131A'; x.strokeText(t, 0, 0); x.fillStyle = fill; x.fillText(t, 0, 0); x.restore();
  };
  x.font = F(34); x.fillStyle = '#15131A'; x.fillRect(60, 60, 470, 64); x.fillStyle = '#FFD400'; x.textAlign = 'left'; x.fillText(CONFIG.edition, 80, 106);
  outlined('I FOUND GYANU', W / 2, 250, 112, '#FFD400', -0.05);
  const img = await loadImg('img/gyanu.svg');
  if (img) x.drawImage(img, W / 2 - 190, 300, 380, 393);
  outlined(homeBest && !finds ? `BONKED ${homeBest}×` : `${finds} TIME${finds === 1 ? '' : 'S'}`, W / 2, 800, 120, '#FF2E88', 0.03);
  outlined(`${Number(score).toLocaleString('en-IN')} POINTS`, W / 2, 925, 84, '#FFFFFF', -0.02);
  if (rank) outlined(`RANK #${rank}`, W / 2, 1015, 52, '#FFD400');
  if (slogan) { // placard
    x.save(); x.translate(W / 2, 1120); x.rotate(-0.03);
    x.font = 'bold 40px system-ui, sans-serif'; const tw = Math.min(900, x.measureText(slogan).width + 70);
    x.fillStyle = '#15131A'; x.fillRect(-tw / 2 + 10, -50, tw, 100); x.fillStyle = '#fff'; x.fillRect(-tw / 2, -60, tw, 100); x.lineWidth = 6; x.strokeRect(-tw / 2, -60, tw, 100);
    x.fillStyle = '#15131A'; x.textAlign = 'center'; x.fillText(slogan, 0, 4, tw - 40); x.restore();
  }
  x.font = F(46); x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText(`— ${nick} —`, W / 2, 1255);
  x.font = F(30); x.fillStyle = '#FFD400'; x.fillText('GYANU HUNT', W / 2, 1300);
  x.font = 'bold 26px system-ui, sans-serif'; x.fillStyle = '#fff'; x.fillText('PLAY: ' + gameUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, 1338);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

export async function shareCard(data) {
  const blob = await makeCard(data);
  const file = new File([blob], 'gyanu-hunt.png', { type: 'image/png' });
  const url = gameUrl();
  const text = `I found Gyanu ${data.finds} time${data.finds === 1 ? '' : 's'}: ${data.score} points. Can you spot him? Play: ${url} #GyanuHunt`; // the link rides in the text, because many apps drop a separate url field when a picture is attached
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text, title: 'Gyanu Hunt', url }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; try { await navigator.share({ files: [file], text }); return 'shared'; } catch { return 'cancelled'; } } }
  try { await navigator.clipboard?.writeText(text); } catch {}
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gyanu-hunt.png'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
