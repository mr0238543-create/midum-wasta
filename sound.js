// تنبيه صوتي قصير داخل التطبيق (بدون ملفات صوت): نغمتان بـ WebAudio.
// المتصفحات تمنع الصوت قبل أول لمسة من المستخدم، لذلك نفتح الصوت عند أول تفاعل.
const KEY = "midum_sound";
let ctx = null;

export const soundOn = () => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } };
export const setSoundOn = (on) => { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* تجاهل */ } };

function audio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function unlockSound() {
  const unlock = () => { try { audio()?.resume(); } catch { /* تجاهل */ } };
  ["pointerdown", "touchstart", "keydown"].forEach((e) => window.addEventListener(e, unlock, { once: true, passive: true }));
}

function tone(c, freq, start, dur, vol) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = "sine"; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g); g.connect(c.destination);
  o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
}

// kind: "order" نغمة طلب جديد (ثلاث نغمات صاعدة) — وإلا نغمة إشعار عادية قصيرة
export function playNotifySound(kind) {
  if (!soundOn()) return;
  try {
    const c = audio();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    if (kind === "order") { tone(c, 660, 0, 0.22, 0.5); tone(c, 880, 0.2, 0.22, 0.5); tone(c, 1175, 0.4, 0.35, 0.5); }
    else { tone(c, 880, 0, 0.18, 0.3); tone(c, 1175, 0.16, 0.22, 0.3); }
  } catch { /* الصوت اختياري */ }
  try { navigator.vibrate?.(kind === "order" ? [200, 100, 200] : 120); } catch { /* تجاهل */ }
}
