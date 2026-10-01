// GYANU HUNT · sensors for Hype Moments. Everything is measured on the phone:
// audio is never recorded or uploaded — only a 0..1 number leaves the device.

const clamp = v => Math.max(0, Math.min(1, v));

// Loudness from the mic → 0 (quiet) .. 1 (crowd screaming right next to you)
export async function micMeter() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const src = ac.createMediaStreamSource(stream), an = ac.createAnalyser();
  an.fftSize = 1024; src.connect(an);
  const buf = new Float32Array(an.fftSize);
  let level = 0;
  const id = setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let s = 0; for (const v of buf) s += v * v;
    const db = 20 * Math.log10(Math.sqrt(s / buf.length) + 1e-9);
    const now = clamp((db + 48) / 36);
    level = now > level ? now : level * 0.9 + now * 0.1; // fast attack, slow release
  }, 60);
  return { level: () => level, stop() { clearInterval(id); stream.getTracks().forEach(t => t.stop()); ac.close(); } };
}

// Shake / stillness from the accelerometer. mode 'shake' → 0..1 energy, 'still' → 1 when motionless.
export async function motionMeter(mode) {
  if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
    const r = await DeviceMotionEvent.requestPermission(); // iOS asks once, on a tap
    if (r !== 'granted') throw new Error('Motion permission denied');
  }
  let energy = 0, got = false;
  const on = e => {
    const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
    got = true;
    const dev = Math.abs(Math.hypot(a.x || 0, a.y || 0, a.z || 0) - 9.81);
    energy = energy * 0.85 + dev * 0.15;
  };
  addEventListener('devicemotion', on);
  return {
    level: () => mode === 'still' ? (got ? clamp(1 - energy / 1.2) : 0) : clamp(energy / 9),
    hasData: () => got,
    stop() { removeEventListener('devicemotion', on); }
  };
}

// Fallback for laptops / denied permissions: mash the button.
export function tapMeter() {
  let taps = [];
  return {
    tap() { taps.push(performance.now()); },
    level() { const t = performance.now(); taps = taps.filter(x => t - x < 1500); return clamp(taps.length / 9); },
    stop() {}
  };
}
