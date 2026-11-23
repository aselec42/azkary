const LISTS = {m: DATA, e: DATA, s: SLEEP};
const L = s => LISTS[s];
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
const pad = n => String(n).padStart(2,'0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
let today = dkey(new Date());
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const WD = ['вс','пн','вт','ср','чт','пт','сб'];

let hist = store.get('azk-hist', {});
let prefs = Object.assign({ce:true, ru:false, tr:true, size:30, theme:'auto'}, store.get('azk-prefs', {}));
if (!['auto','dark','light'].includes(prefs.theme)) prefs.theme = 'auto';

// Время намаза для Сент-Этьена (Фаджр 18°, Аср — по шафиитскому мазхабу)
const LAT = 45.4397, LON = 4.3872;
function prayerTimes(date){
  const rad = Math.PI/180, deg = 180/Math.PI;
  const jd = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12)/86400000 + 2440587.5;
  const D = jd - 2451545;
  const g = (357.529 + 0.98560028*D)*rad, q = 280.459 + 0.98564736*D;
  const Ls = (q + 1.915*Math.sin(g) + 0.020*Math.sin(2*g))*rad, ec = (23.439 - 0.00000036*D)*rad;
  const RA = (Math.atan2(Math.cos(ec)*Math.sin(Ls), Math.cos(Ls))*deg/15 + 24) % 24;
  let eqt = q/15 - RA; eqt = ((eqt + 12) % 24 + 24) % 24 - 12;
  const decl = Math.asin(Math.sin(ec)*Math.sin(Ls)), la = LAT*rad;
  const tz = -date.getTimezoneOffset()/60, dhuhr = 12 + tz - LON/15 - eqt;
  const T = a => Math.acos((Math.sin(a) - Math.sin(decl)*Math.sin(la))/(Math.cos(decl)*Math.cos(la)))*deg/15;
  return {fajr: dhuhr - T(-18*rad), asr: dhuhr + T(Math.atan(1/(1 + Math.tan(Math.abs(la - decl)))))};
}
const fmtH = h => { const m = Math.round(h*60); return pad(Math.floor(m/60) % 24) + ':' + pad(m % 60); };
function autoSession(){
  const n = new Date(), h = n.getHours() + n.getMinutes()/60, pt = prayerTimes(n);
  if (h >= 21 || h < pt.fajr) return 's';
  return h >= pt.asr ? 'e' : 'm';
}
let session = autoSession();
const day = () => { const h = (hist[today] ||= {m:{}, e:{}}); h.s ||= {}; return h; };
const left = (s, z) => Math.max(0, z.c - (day()[s][z.n] || 0));
const doneCount = s => L(s).filter(z => left(s, z) === 0).length;
const save = () => { store.set('azk-hist', hist); store.set('azk-prefs', prefs); };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const timesLabel = c => c + (c % 10 >= 2 && c % 10 <= 4 && (c % 100 < 12 || c % 100 > 14) ? ' раза' : ' раз');

function renderDate(){
  const d0 = new Date();
  document.getElementById('date').textContent = `${d0.getDate()} ${MONTHS[d0.getMonth()]} ${d0.getFullYear()}`;
  const pt = prayerTimes(d0);
  document.getElementById('ptimes').textContent = `Фаджр ${fmtH(pt.fajr)} · Аср ${fmtH(pt.asr)} · Сент-Этьен`;
}

function render(){
  const list = document.getElementById('list');
  list.innerHTML = L(session).map(z => `
  <article class="card" id="z${z.n}">
    <div class="chead"><div class="num">${z.n}</div><div class="cname">${esc(z.name)}</div><div class="times">× ${timesLabel(z.c)}</div></div>
    <div class="ar">${esc(z.ar)}</div>
    <div class="tr-wrap"${prefs.tr?'':' hidden'}><div class="lab">Транскрипция</div><div class="tr">${esc(z.tr)}</div></div>
    <div class="${z.ce?'ce-wrap':'no-ce'}"${prefs.ce&&z.ce?'':' hidden'}><div class="lab">Нохчийн маьӀна</div><div class="mean">${esc(z.ce)}</div></div>
    ${z.ce ? `<div class="ru-wrap"${prefs.ru?'':' hidden'}><div class="lab">Перевод</div><div class="mean">${esc(z.ru)}</div></div>` : `<div class="ru-only"${(prefs.ru||prefs.ce)?'':' hidden'}><div class="lab">Перевод</div><div class="mean">${esc(z.ru)}</div></div>`}
    <details><summary>Хадис о достоинстве</summary><div class="had">${esc(z.h)}<div class="src">Источник: ${esc(z.src)}</div></div></details>
    <button class="tap" data-n="${z.n}"><span class="lbl"></span><span class="n"></span></button>
    <div class="mini">${z.c >= 33 ? `<button class="chip fsbtn" data-f="${z.n}">⛶ Весь экран</button>` : ''}<button class="undo" data-u="${z.n}">отменить одно</button></div>
  </article>`).join('');
  update();
}

function update(){
  const s = session;
  L(s).forEach(z => {
    const card = document.getElementById('z'+z.n);
    const l = left(s, z), done = l === 0;
    card.classList.toggle('done', done);
    card.querySelector('.lbl').textContent = done ? '✓ Прочитано' : (z.c === 1 ? 'Прочитал' : 'Осталось');
    card.querySelector('.n').textContent = done ? '' : (z.c === 1 ? '' : l);
    card.querySelector('.undo').hidden = (day()[s][z.n] || 0) === 0;
  });
  const dc = doneCount(s), N = L(s).length;
  document.getElementById('fill').style.width = (dc/N*100) + '%';
  document.getElementById('ptext').textContent = `${dc} из ${N}`;
  document.getElementById('cm').textContent = `${doneCount('m')}/${DATA.length}`;
  document.getElementById('cev').textContent = `${doneCount('e')}/${DATA.length}`;
  document.getElementById('cs').textContent = `${doneCount('s')}/${SLEEP.length}`;
  document.getElementById('bm').setAttribute('aria-pressed', s === 'm');
  document.getElementById('be').setAttribute('aria-pressed', s === 'e');
  document.getElementById('bs').setAttribute('aria-pressed', s === 's');
  document.getElementById('rlabel').textContent = {m:'утро', e:'вечер', s:'перед сном'}[s];
  document.getElementById('finish').classList.toggle('show', dc === N);
  document.getElementById('fintext').textContent = s === 's'
    ? 'Хастам Аллахна! Азкары перед сном прочитаны. Спокойной ночи.'
    : s === 'm'
    ? 'Хастам Аллахна! Ӏуьйранан азкараш чекхбаьхна. Утренние азкары прочитаны.'
    : 'Хастам Аллахна! Суьйранан азкараш чекхбаьхна. Вечерние азкары прочитаны.';
  renderWeek();
}

function renderWeek(){
  const w = document.getElementById('week'); let html = '';
  for (let i = 6; i >= 0; i--){
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = dkey(d), h = hist[k];
    const full = s => h && h[s] && DATA.every(z => (h[s][z.n] || 0) >= z.c);
    html += `<div class="day${i===0?' today':''}"><b>${WD[d.getDay()]}</b><div class="dot" title="${d.getDate()} ${MONTHS[d.getMonth()]}"><i class="${full('m')?'on':''}"></i><i class="e ${full('e')?'on':''}"></i></div></div>`;
  }
  w.innerHTML = html;
  const any = k => { const h = hist[k]; return h && ['m','e'].some(s => h[s] && DATA.every(z => (h[s][z.n]||0) >= z.c)); };
  let n = 0, d = new Date();
  if (!any(dkey(d))) d.setDate(d.getDate() - 1);
  while (any(dkey(d))) { n++; d.setDate(d.getDate() - 1); }
  document.getElementById('streak').innerHTML = n
    ? `Подряд дней: <strong>${n}</strong> · левая половина — утро, правая — вечер`
    : 'Левая половина кружка — утро, правая — вечер';
}

function tick(z){
  const s = session, dd = day()[s];
  if (left(s, z) === 0) return false;
  dd[z.n] = (dd[z.n] || 0) + 1; save();
  const done = left(s, z) === 0;
  try{ navigator.vibrate && navigator.vibrate(done ? [30,40,30] : 15); }catch(_){}
  update();
  return done;
}
function goNext(z, delay){
  const s = session, list = L(s);
  const next = list.find(x => x.n > z.n && left(s, x) > 0) || list.find(x => left(s, x) > 0);
  setTimeout(() => next ? document.getElementById('z'+next.n).scrollIntoView({behavior:'smooth', block:'start'}) : document.getElementById('finish').scrollIntoView({behavior:'smooth', block:'center'}), delay);
}
document.getElementById('list').addEventListener('click', e => {
  const t = e.target.closest('.tap'), u = e.target.closest('.undo'), f = e.target.closest('.fsbtn');
  if (t){
    const z = L(session).find(x => x.n == t.dataset.n);
    if (tick(z)) goNext(z, 350);
  } else if (f){
    openFocus(f.dataset.f);
  } else if (u){
    const dd = day()[session]; const n = u.dataset.u;
    if (dd[n]) { dd[n]--; save(); update(); }
  }
});

// Полноэкранный счётчик
const focusEl = document.getElementById('focus');
let fz = null;
function refreshFocus(){ const l = left(session, fz); document.getElementById('fn').textContent = l === 0 ? '✓' : l; }
function openFocus(n){
  fz = L(session).find(x => x.n == n);
  document.getElementById('fname').textContent = fz.name;
  document.getElementById('far').textContent = fz.ar;
  refreshFocus(); focusEl.hidden = false;
}
function closeFocus(){ focusEl.hidden = true; if (fz) document.getElementById('z'+fz.n).scrollIntoView({block:'start'}); fz = null; }
focusEl.addEventListener('click', e => {
  if (!fz) return;
  if (e.target.closest('#fclose') || left(session, fz) === 0){ closeFocus(); return; }
  const z = fz;
  const done = tick(z); refreshFocus();
  if (done) setTimeout(() => { if (fz === z){ focusEl.hidden = true; fz = null; goNext(z, 0); } }, 900);
});
document.addEventListener('keydown', e => { if (fz && e.key === 'Escape') closeFocus(); });

let manual = false;
function setSession(s, quiet){ session = s; render(); if (!quiet) window.scrollTo({top: document.querySelector('.bar').offsetTop - 4, behavior:'smooth'}); }
document.getElementById('bm').onclick = () => { manual = true; setSession('m'); };
document.getElementById('be').onclick = () => { manual = true; setSession('e'); };
document.getElementById('bs').onclick = () => { manual = true; setSession('s'); };

// Новый день / смена времени, когда приложение открыто или возвращается из фона
function refreshClock(){
  const k = dkey(new Date());
  const newDay = k !== today;
  if (newDay){ today = k; manual = false; renderDate(); }
  if (!fz){ const s = manual ? session : autoSession(); if (s !== session || newDay) setSession(s, true); }
}
setInterval(refreshClock, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshClock(); });

// Тема
const themeBtn = document.getElementById('theme');
const THEMES = {auto:'◐ Авто', dark:'☾ Тёмная', light:'☀ Светлая'};
function applyTheme(){
  if (prefs.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', prefs.theme);
  themeBtn.textContent = THEMES[prefs.theme];
}
themeBtn.onclick = () => { prefs.theme = {auto:'dark', dark:'light', light:'auto'}[prefs.theme]; save(); applyTheme(); };
applyTheme();

function toggle(id, key, cls){
  const b = document.getElementById(id);
  const apply = () => { b.setAttribute('aria-pressed', prefs[key]); document.querySelectorAll('.'+cls).forEach(el => el.hidden = !prefs[key]); document.querySelectorAll('.ru-only').forEach(el => el.hidden = !(prefs.ru || prefs.ce)); };
  b.onclick = () => { prefs[key] = !prefs[key]; save(); apply(); };
  apply();
}
function setSize(){ document.documentElement.style.setProperty('--ar-size', prefs.size + 'px'); }
document.getElementById('fminus').onclick = () => { prefs.size = Math.max(20, prefs.size - 3); setSize(); save(); };
document.getElementById('fplus').onclick = () => { prefs.size = Math.min(48, prefs.size + 3); setSize(); save(); };

let armed = false;
document.getElementById('reset').onclick = e => {
  const b = e.currentTarget;
  if (!armed){ armed = true; b.firstChild.textContent = 'Нажмите ещё раз, чтобы сбросить '; setTimeout(() => { armed = false; b.firstChild.textContent = 'Сбросить сегодняшнее '; }, 3000); return; }
  armed = false; b.firstChild.textContent = 'Сбросить сегодняшнее ';
  day()[session] = {}; save(); update();
};

Object.keys(hist).sort().slice(0, -60).forEach(k => delete hist[k]);

renderDate(); render(); setSize();
toggle('lce','ce','ce-wrap'); toggle('lru','ru','ru-wrap'); toggle('ltr','tr','tr-wrap');
try{ navigator.wakeLock && navigator.wakeLock.request('screen').catch(()=>{}); }catch(_){}

// Работа без интернета
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
