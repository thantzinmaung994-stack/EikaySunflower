'use strict';

/* =====================================================================
 * 議事録アプリ（iPhone 向け PWA）
 *  - 録音は 10 秒ごとに端末（IndexedDB）へ保存し、落ちても復元できる
 *  - 録音ファイルは送信が終わるまで端末に残し、圏外でも失われない
 *  - 文字起こし・議事録作成は社内 Mac のサーバーで行う
 * ===================================================================== */

const $app = document.getElementById('app');

// ---------------------------------------------------------------- 小道具

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtDuration(sec) {
  if ((sec || 0) < 60) return `${Math.round(sec || 0)}秒`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}分`;
  return `${Math.floor(min / 60)}時間${min % 60 ? (min % 60) + '分' : ''}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const w = '日月火水木金土'[d.getDay()];
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${w}） ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toLocalInput(date) {
  const d = new Date(date);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtSize(bytes) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`;
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now().toString(16) + Math.random().toString(16).slice(2);
}

let toastTimer;
function toast(msg, ms = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

const STATUS_LABEL = {
  queued: '処理待ち', converting: '変換中', transcribing: '文字起こし中', summarizing: '議事録作成中', done: '完了', error: 'エラー',
};

// ---------------------------------------------------------------- 端末内保存（IndexedDB）

const idb = (() => {
  let dbp;
  function open() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open('minutes-local', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          const chunks = db.createObjectStore('chunks', { keyPath: 'key', autoIncrement: true });
          chunks.createIndex('recId', 'recId');
          db.createObjectStore('recordings', { keyPath: 'id' }); // 録音中の情報
          db.createObjectStore('uploads', { keyPath: 'id' });    // 送信待ちの録音・ファイル
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function run(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const result = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('保存に失敗しました'));
    });
  }
  return {
    put: (store, value) => run(store, 'readwrite', (s) => s.put(value)),
    get: (store, key) => run(store, 'readonly', (s) => s.get(key)),
    all: (store) => run(store, 'readonly', (s) => s.getAll()),
    del: (store, key) => run(store, 'readwrite', (s) => s.delete(key)),
    chunksOf: (recId) => run('chunks', 'readonly', (s) => s.index('recId').getAll(recId)),
    delChunks: async (recId) => {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('chunks', 'readwrite');
        const req = tx.objectStore('chunks').index('recId').openKeyCursor(IDBKeyRange.only(recId));
        req.onsuccess = () => {
          const c = req.result;
          if (c) { tx.objectStore('chunks').delete(c.primaryKey); c.continue(); }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
})();

// ---------------------------------------------------------------- サーバー通信

class AuthError extends Error {}

async function api(path, { method = 'GET', body } = {}) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch (e) {
    throw new Error('サーバーにつながりません（Tailscale が接続中か確認してください）');
  }
  if (res.status === 401 && path !== '/api/login') {
    renderLogin();
    throw new AuthError('ログインが必要です');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `エラー（${res.status}）`);
  return data;
}

// ---------------------------------------------------------------- 送信待ちキュー

const uploading = new Map(); // id -> 進捗(0-1)

function uploadOne(item, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', item.blob, item.filename);
    form.append('title', item.meta.title);
    form.append('held_at', item.meta.held_at);
    form.append('participants', item.meta.participants || '');
    form.append('location', item.meta.location || '');
    form.append('tags', JSON.stringify(item.meta.tags || []));
    form.append('client_id', item.id);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/meetings');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status === 401) { reject(new AuthError('ログインが必要です')); return; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(`送信に失敗しました（${xhr.status}）`));
    };
    xhr.onerror = () => reject(new Error('送信できませんでした。通信状況を確認してください'));
    xhr.send(form);
  });
}

async function sendUpload(id, onProgress) {
  if (uploading.has(id)) return null;
  const item = await idb.get('uploads', id);
  if (!item || item.state !== 'ready') return null;
  uploading.set(id, 0);
  try {
    const meeting = await uploadOne(item, (p) => { uploading.set(id, p); onProgress && onProgress(p); });
    await idb.del('uploads', id); // サーバーに届いてから端末のデータを消す
    return meeting;
  } finally {
    uploading.delete(id);
  }
}

async function flushUploads() {
  if (!navigator.onLine) return;
  const items = (await idb.all('uploads')).filter((u) => u.state === 'ready');
  let sent = 0;
  for (const u of items) {
    try {
      if (await sendUpload(u.id)) sent++;
    } catch (e) {
      if (e instanceof AuthError) { renderLogin(); return; }
      break; // 通信できないときは次の機会に再送
    }
  }
  if (sent) {
    toast(`${sent}件の録音を送信しました`);
    if (currentRoute().name === 'list') render();
  }
}

window.addEventListener('online', flushUploads);

// ---------------------------------------------------------------- 録音

const rec = {
  active: false,
  id: null,
  recorder: null,
  stream: null,
  mimeType: '',
  startedAt: null,
  elapsedBefore: 0,  // 一時停止前までの録音時間(ms)
  resumedAt: 0,
  seq: 0,
  writes: [],
  wakeLock: null,
  audioCtx: null,
  analyser: null,
  raf: 0,
  timer: 0,
  stopping: null,
};

function pickMimeType() {
  const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}

function extFor(mime) {
  return mime.includes('webm') ? 'webm' : 'm4a';
}

function elapsedMs() {
  if (!rec.active) return 0;
  const running = rec.recorder && rec.recorder.state === 'recording' ? Date.now() - rec.resumedAt : 0;
  return rec.elapsedBefore + running;
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      rec.wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) { /* 対応していない端末では何もしない */ }
}

document.addEventListener('visibilitychange', () => {
  if (!rec.active) return;
  if (document.visibilityState === 'visible') {
    requestWakeLock();
    const track = rec.stream && rec.stream.getAudioTracks()[0];
    if (!track || track.readyState === 'ended') {
      finishRecording('interrupted');
    }
  }
});

window.addEventListener('beforeunload', (e) => {
  if (rec.active) { e.preventDefault(); e.returnValue = ''; }
});

async function startRecording() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    alert('この端末・ブラウザでは録音できません。iOS 14.3 以降の Safari をお使いください。');
    return false;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    alert('マイクを使えません。設定アプリ → Safari → マイク で許可してください。');
    return false;
  }
  rec.mimeType = pickMimeType();
  rec.recorder = new MediaRecorder(stream, rec.mimeType ? { mimeType: rec.mimeType, audioBitsPerSecond: 64000 } : undefined);
  rec.mimeType = rec.recorder.mimeType || rec.mimeType || 'audio/mp4';
  rec.stream = stream;
  rec.id = newId();
  rec.seq = 0;
  rec.writes = [];
  rec.startedAt = new Date();
  rec.elapsedBefore = 0;
  rec.resumedAt = Date.now();
  rec.active = true;

  await idb.put('recordings', { id: rec.id, startedAt: rec.startedAt.toISOString(), mimeType: rec.mimeType });

  rec.recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) {
      const seq = rec.seq++;
      rec.writes.push(idb.put('chunks', { recId: rec.id, seq, blob: e.data }).catch(() => {
        toast('端末への保存に失敗しました。空き容量を確認してください', 5000);
      }));
    }
  };
  rec.recorder.onerror = () => finishRecording('interrupted');
  stream.getAudioTracks()[0].addEventListener('ended', () => finishRecording('interrupted'));
  rec.recorder.start(10000); // 10 秒ごとに端末へ保存

  try {
    rec.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = rec.audioCtx.createMediaStreamSource(stream);
    rec.analyser = rec.audioCtx.createAnalyser();
    rec.analyser.fftSize = 512;
    src.connect(rec.analyser);
  } catch (e) { rec.analyser = null; }

  requestWakeLock();
  return true;
}

function togglePause() {
  const r = rec.recorder;
  if (!r) return;
  if (r.state === 'recording') {
    rec.elapsedBefore += Date.now() - rec.resumedAt;
    r.pause();
  } else if (r.state === 'paused') {
    rec.resumedAt = Date.now();
    r.resume();
  }
}

function finishRecording(reason = 'stopped') {
  if (rec.stopping) return rec.stopping;
  if (!rec.active) return Promise.resolve();
  rec.stopping = (async () => {
    const r = rec.recorder;
    if (r && r.state !== 'inactive') {
      await new Promise((resolve) => {
        r.addEventListener('stop', resolve, { once: true });
        try { r.stop(); } catch (e) { resolve(); }
      });
    }
    rec.stream && rec.stream.getTracks().forEach((t) => t.stop());
    try { rec.audioCtx && rec.audioCtx.close(); } catch (e) { /* noop */ }
    try { rec.wakeLock && rec.wakeLock.release(); } catch (e) { /* noop */ }
    cancelAnimationFrame(rec.raf);
    clearInterval(rec.timer);
    await Promise.all(rec.writes);

    const id = rec.id;
    rec.active = false;
    rec.recorder = null;
    rec.stream = null;
    rec.wakeLock = null;
    rec.stopping = null;

    const ok = await assembleRecording(id);
    if (reason === 'interrupted') {
      alert('録音が中断されました（着信や画面ロックなど）。ここまでの録音は保存されています。');
    }
    location.hash = ok ? `#/new/${id}` : '#/';
  })();
  return rec.stopping;
}

/** 端末に保存した録音の断片をひとつのファイルにまとめ、送信待ちに入れる */
async function assembleRecording(recId) {
  const info = await idb.get('recordings', recId);
  const chunks = (await idb.chunksOf(recId)).sort((a, b) => a.seq - b.seq);
  if (!chunks.length) {
    await idb.del('recordings', recId);
    return false;
  }
  const mimeType = (info && info.mimeType) || chunks[0].blob.type || 'audio/mp4';
  const blob = new Blob(chunks.map((c) => c.blob), { type: mimeType.split(';')[0] });
  const startedAt = info ? new Date(info.startedAt) : new Date();
  await idb.put('uploads', {
    id: recId,
    blob,
    filename: `recording.${extFor(mimeType)}`,
    createdAt: new Date().toISOString(),
    state: 'draft',
    meta: { title: `会議 ${fmtDate(startedAt.toISOString())}`, held_at: toLocalInput(startedAt), participants: '', location: '', tags: [] },
  });
  await idb.delChunks(recId);
  await idb.del('recordings', recId);
  return true;
}

/** アプリが落ちたなどで途中になっている録音を復元する */
async function recoverRecordings() {
  const list = await idb.all('recordings');
  let n = 0;
  for (const r of list) {
    if (rec.active && r.id === rec.id) continue;
    if (await assembleRecording(r.id)) n++;
  }
  if (n) toast(`前回の録音（${n}件）を復元しました。送信待ちに入っています`, 5000);
}

// ---------------------------------------------------------------- 画面切り替え

let cleanup = [];
function onLeave(fn) { cleanup.push(fn); }

function currentRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'record') return { name: 'record' };
  if (parts[0] === 'new' && parts[1]) return { name: 'new', id: parts[1] };
  if (parts[0] === 'm' && parts[1] && parts[2] === 'edit') return { name: 'edit', id: parts[1] };
  if (parts[0] === 'm' && parts[1]) return { name: 'detail', id: parts[1] };
  return { name: 'list' };
}

async function render() {
  cleanup.forEach((fn) => fn());
  cleanup = [];
  closeSheet();
  const route = currentRoute();
  if (rec.active && route.name !== 'record') {
    location.hash = '#/record';
    return;
  }
  try {
    if (route.name === 'record') return renderRecord();
    if (route.name === 'new') return await renderNew(route.id);
    if (route.name === 'detail') return await renderDetail(route.id);
    if (route.name === 'edit') return await renderEdit(route.id);
    return await renderList();
  } catch (e) {
    if (e instanceof AuthError) return;
    $app.innerHTML = `
      <header class="bar"><a class="back" href="#/">‹ 一覧</a><h1>エラー</h1><span></span></header>
      <div class="center-msg">${esc(e.message)}<br><br><button class="btn" id="retry">再読み込み</button></div>`;
    document.getElementById('retry').onclick = render;
  }
}

window.addEventListener('hashchange', render);

// ---------------------------------------------------------------- ログイン

function renderLogin() {
  cleanup.forEach((fn) => fn());
  cleanup = [];
  $app.innerHTML = `
    <div class="login">
      <div class="logo">議</div>
      <h1>議事録</h1>
      <form id="login-form">
        <input type="password" id="pw" placeholder="パスワード" autocomplete="current-password" required>
        <button class="btn primary block" type="submit">ログイン</button>
      </form>
      <p class="hint">社内用アプリです。パスワードは管理者に確認してください。</p>
    </div>`;
  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/login', { method: 'POST', body: { password: document.getElementById('pw').value } });
      render();
      flushUploads();
    } catch (err) {
      toast(err.message);
    }
  };
}

// ---------------------------------------------------------------- 一覧

const listState = { q: '', tag: '', from: '', to: '', showFilter: false };

async function renderList() {
  const params = new URLSearchParams();
  if (listState.q) params.set('q', listState.q);
  if (listState.tag) params.set('tag', listState.tag);
  if (listState.from) params.set('date_from', listState.from);
  if (listState.to) params.set('date_to', listState.to);

  const [meetings, tags, pending] = await Promise.all([
    api('/api/meetings?' + params.toString()),
    api('/api/tags'),
    idb.all('uploads'),
  ]);

  pending.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filtering = listState.q || listState.tag || listState.from || listState.to;

  $app.innerHTML = `
    <header class="bar">
      <span></span><h1>議事録</h1>
      <button class="icon-btn" id="menu-btn" aria-label="メニュー">⋯</button>
    </header>
    <div class="search">
      <input type="search" id="q" placeholder="キーワードで検索（本文・文字起こしも対象）" value="${esc(listState.q)}">
      <button class="icon-btn ${listState.showFilter || listState.from || listState.to ? 'on' : ''}" id="filter-btn" aria-label="期間で絞り込み">📅</button>
    </div>
    <div class="filter ${listState.showFilter ? '' : 'hidden'}">
      <label>開始日<input type="date" id="from" value="${esc(listState.from)}"></label>
      <label>終了日<input type="date" id="to" value="${esc(listState.to)}"></label>
      <button class="btn small" id="clear-date">期間をクリア</button>
    </div>
    ${tags.length ? `<div class="chips">${['', ...tags].map((t) => `
      <button class="chip ${listState.tag === t ? 'on' : ''}" data-tag="${esc(t)}">${t ? '#' + esc(t) : 'すべて'}</button>`).join('')}</div>` : ''}
    <main class="list">
      ${pending.length ? `<h2 class="section-title">送信待ち（この端末に保存中）</h2>
        ${pending.map((u) => `
        <div class="card pending" data-upload="${u.id}">
          <div class="card-title">${esc(u.meta.title)}</div>
          <div class="card-meta">${u.state === 'draft' ? '会議情報が未入力' : '送信待ち'} ・ ${fmtSize(u.blob.size)}</div>
          <div class="progress ${uploading.has(u.id) ? '' : 'hidden'}"><div style="width:${Math.round((uploading.get(u.id) || 0) * 100)}%"></div></div>
          <div class="card-actions">
            ${u.state === 'draft'
              ? `<a class="btn small primary" href="#/new/${u.id}">情報を入力して送信</a>`
              : `<button class="btn small primary" data-send="${u.id}">今すぐ送信</button><a class="btn small" href="#/new/${u.id}">編集</a>`}
            <button class="btn small danger" data-discard="${u.id}">削除</button>
          </div>
        </div>`).join('')}` : ''}
      ${pending.length && meetings.length ? '<h2 class="section-title">議事録</h2>' : ''}
      ${meetings.map((m) => `
        <a class="card" href="#/m/${m.id}">
          <div class="card-title">${esc(m.title)}</div>
          <div class="card-meta">${fmtDate(m.held_at)}${m.duration ? ' ・ ' + fmtDuration(m.duration) : ''}${m.location ? ' ・ ' + esc(m.location) : ''}</div>
          ${m.status !== 'done' ? `<span class="badge ${m.status}">${STATUS_LABEL[m.status] || m.status}</span>` : ''}
          ${m.summary ? `<div class="card-summary">${esc(m.summary)}</div>` : ''}
          ${m.tags.length ? `<div class="card-tags">${m.tags.map((t) => '#' + esc(t)).join(' ')}</div>` : ''}
        </a>`).join('')}
      ${!meetings.length && !pending.length ? `<div class="empty">${filtering ? '条件に合う議事録はありません' : '右下の「＋」から録音を始めましょう'}</div>` : ''}
    </main>
    <button class="fab" id="fab" aria-label="新規作成">＋</button>
    <input type="file" id="file-input" accept="audio/*,video/*,.m4a,.mp3,.wav,.mp4,.mov,.webm,.aac" hidden>`;

  const q = document.getElementById('q');
  q.oninput = debounce(() => { listState.q = q.value.trim(); renderList().catch(() => {}).then(() => refocus('q')); }, 400);
  document.getElementById('filter-btn').onclick = () => { listState.showFilter = !listState.showFilter; renderList(); };
  document.getElementById('from').onchange = (e) => { listState.from = e.target.value; renderList(); };
  document.getElementById('to').onchange = (e) => { listState.to = e.target.value; renderList(); };
  document.getElementById('clear-date').onclick = () => { listState.from = ''; listState.to = ''; renderList(); };
  $app.querySelectorAll('.chip').forEach((b) => { b.onclick = () => { listState.tag = b.dataset.tag; renderList(); }; });

  $app.querySelectorAll('[data-send]').forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.send;
      const bar = $app.querySelector(`[data-upload="${id}"] .progress`);
      bar.classList.remove('hidden');
      b.disabled = true;
      try {
        const m = await sendUpload(id, (p) => { bar.firstElementChild.style.width = `${Math.round(p * 100)}%`; });
        if (m) toast('送信しました。文字起こしを開始します');
        renderList();
      } catch (e) {
        toast(e.message, 4000);
        b.disabled = false;
        bar.classList.add('hidden');
      }
    };
  });
  $app.querySelectorAll('[data-discard]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('この録音を端末から削除します。サーバーには送信されていません。よろしいですか？')) return;
      await idb.del('uploads', b.dataset.discard);
      renderList();
    };
  });

  document.getElementById('fab').onclick = () => openSheet([
    { label: '🎙 録音を開始する', action: () => { location.hash = '#/record'; } },
    { label: '📁 音声・動画ファイルを取り込む', action: () => document.getElementById('file-input').click() },
  ], 'ボイスメモで録音した場合は「共有 → “ファイル”に保存」した後、ここから取り込めます。');
  document.getElementById('file-input').onchange = (e) => importFile(e.target.files[0]);
  document.getElementById('menu-btn').onclick = () => openSheet([
    { label: 'サーバーの状態を確認', action: showServerStatus },
    { label: 'ログアウト', action: async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); renderLogin(); } },
  ]);

  if (meetings.some((m) => !['done', 'error'].includes(m.status))) {
    const t = setTimeout(() => { if (currentRoute().name === 'list' && !document.activeElement.matches('input')) renderList(); }, 8000);
    onLeave(() => clearTimeout(t));
  }
}

function refocus(id) {
  const el = document.getElementById(id);
  if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}

async function showServerStatus() {
  try {
    const s = await api('/api/status');
    alert(`サーバー: 接続OK\nAI（Ollama）: ${s.ollama ? '動作中' : '停止中（Mac を確認してください）'}\nモデル: ${s.model}\n処理待ち: ${s.queue}件`);
  } catch (e) {
    alert(e.message);
  }
}

async function importFile(file) {
  if (!file) return;
  const id = newId();
  const held = file.lastModified ? new Date(file.lastModified) : new Date();
  const item = {
    id,
    blob: file,
    filename: file.name || 'audio.m4a',
    createdAt: new Date().toISOString(),
    state: 'draft',
    meta: { title: (file.name || '会議').replace(/\.[^.]+$/, ''), held_at: toLocalInput(held), participants: '', location: '', tags: [] },
  };
  try {
    await idb.put('uploads', item);
  } catch (e) {
    toast('端末に保存できませんでした。空き容量を確認してください', 4000);
    return;
  }
  location.hash = `#/new/${id}`;
}

// ---------------------------------------------------------------- シート（下から出るメニュー）

function openSheet(items, note = '') {
  closeSheet();
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `
    <div class="sheet">
      ${note ? `<p class="sheet-note">${esc(note)}</p>` : ''}
      ${items.map((it, i) => `<button class="sheet-item ${it.danger ? 'danger' : ''}" data-i="${i}">${esc(it.label)}</button>`).join('')}
      <button class="sheet-item cancel">キャンセル</button>
    </div>`;
  el.onclick = (e) => {
    const b = e.target.closest('button');
    if (e.target === el || (b && b.classList.contains('cancel'))) return closeSheet();
    if (b && b.dataset.i !== undefined) {
      closeSheet();
      items[Number(b.dataset.i)].action();
    }
  };
  document.body.appendChild(el);
}

function closeSheet() {
  document.querySelectorAll('.sheet-wrap').forEach((el) => el.remove());
}

// ---------------------------------------------------------------- 録音画面

function renderRecord() {
  $app.innerHTML = `
    <header class="bar">
      ${rec.active ? '<span></span>' : '<a class="back" href="#/">‹ 一覧</a>'}
      <h1>録音</h1><span></span>
    </header>
    <main class="recorder">
      <div class="rec-state" id="rec-state">${rec.active ? '' : 'タップして録音開始'}</div>
      <div class="rec-time" id="rec-time">00:00</div>
      <div class="meter"><div id="meter-bar"></div></div>
      <button class="rec-btn ${rec.active ? 'recording' : ''}" id="rec-btn" aria-label="録音"><span></span></button>
      <div class="rec-controls ${rec.active ? '' : 'hidden'}" id="rec-controls">
        <button class="btn" id="pause-btn">一時停止</button>
        <button class="btn danger" id="stop-btn">終了して保存</button>
      </div>
      <div class="rec-note">
        ・画面を消したり他のアプリに切り替えたりすると、録音が止まります。<br>
        　iPhone を充電器につなぎ、画面をつけたままにしてください。<br>
        ・10秒ごとに端末へ自動保存しています。<br>
        ・画面を消す必要がある場合は、標準の「ボイスメモ」で録音して取り込んでください。
      </div>
    </main>`;

  const btn = document.getElementById('rec-btn');
  const controls = document.getElementById('rec-controls');
  const stateEl = document.getElementById('rec-state');
  const timeEl = document.getElementById('rec-time');
  const pauseBtn = document.getElementById('pause-btn');

  function refresh() {
    timeEl.textContent = fmtTime(elapsedMs() / 1000);
    const paused = rec.recorder && rec.recorder.state === 'paused';
    stateEl.textContent = rec.active ? (paused ? '一時停止中' : '● 録音中') : 'タップして録音開始';
    stateEl.classList.toggle('live', rec.active && !paused);
    pauseBtn.textContent = paused ? '再開' : '一時停止';
    btn.classList.toggle('recording', rec.active && !paused);
  }

  function meterLoop() {
    if (!rec.active) return;
    if (rec.analyser) {
      const data = new Uint8Array(rec.analyser.fftSize);
      rec.analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      document.getElementById('meter-bar').style.width = `${Math.min(100, (peak / 128) * 160)}%`;
    }
    rec.raf = requestAnimationFrame(meterLoop);
  }

  function startUi() {
    controls.classList.remove('hidden');
    clearInterval(rec.timer);
    rec.timer = setInterval(refresh, 500);
    cancelAnimationFrame(rec.raf);
    meterLoop();
    refresh();
  }

  btn.onclick = async () => {
    if (!rec.active) {
      btn.disabled = true;
      const ok = await startRecording();
      btn.disabled = false;
      if (ok) {
        document.querySelector('.bar .back')?.replaceWith(document.createElement('span'));
        startUi();
      }
    } else {
      togglePause();
      refresh();
    }
  };
  pauseBtn.onclick = () => { togglePause(); refresh(); };
  document.getElementById('stop-btn').onclick = async () => {
    if (!confirm('録音を終了しますか？')) return;
    stateEl.textContent = '保存中…';
    await finishRecording('stopped');
  };

  if (rec.active) startUi();
  onLeave(() => { cancelAnimationFrame(rec.raf); clearInterval(rec.timer); });
}

// ---------------------------------------------------------------- 会議情報の入力・送信

async function renderNew(id) {
  const item = await idb.get('uploads', id);
  if (!item) {
    location.hash = '#/';
    return;
  }
  const m = item.meta;
  $app.innerHTML = `
    <header class="bar"><a class="back" href="#/">‹ 一覧</a><h1>会議情報</h1><span></span></header>
    <main class="form">
      <p class="hint">録音（${fmtSize(item.blob.size)}）はこの端末に保存済みです。送信が終わるまで消えません。</p>
      <label>タイトル<input id="f-title" value="${esc(m.title)}" required></label>
      <label>日時<input type="datetime-local" id="f-held" value="${esc(m.held_at)}"></label>
      <label>参加者<input id="f-participants" value="${esc(m.participants)}" placeholder="例：山田、田中、佐藤"></label>
      <label>場所<input id="f-location" value="${esc(m.location)}" placeholder="例：会議室A / Zoom"></label>
      <label>タグ<input id="f-tags" value="${esc((m.tags || []).join('、'))}" placeholder="例：定例、授業（読点・カンマ区切り）"></label>
      <div class="progress hidden" id="up-progress"><div></div></div>
      <button class="btn primary block" id="send-btn">保存して文字起こしを開始</button>
      <button class="btn block" id="later-btn">あとで送信する</button>
    </main>`;

  const readMeta = () => ({
    title: document.getElementById('f-title').value.trim() || '無題の会議',
    held_at: document.getElementById('f-held').value || toLocalInput(new Date()),
    participants: document.getElementById('f-participants').value.trim(),
    location: document.getElementById('f-location').value.trim(),
    tags: document.getElementById('f-tags').value.split(/[,、，]/).map((t) => t.trim()).filter(Boolean),
  });

  document.getElementById('later-btn').onclick = async () => {
    item.meta = readMeta();
    item.state = 'ready';
    await idb.put('uploads', item);
    toast('送信待ちに入れました');
    location.hash = '#/';
  };

  document.getElementById('send-btn').onclick = async (e) => {
    const btn = e.currentTarget;
    item.meta = readMeta();
    item.state = 'ready';
    await idb.put('uploads', item);
    btn.disabled = true;
    btn.textContent = '送信中…';
    const bar = document.getElementById('up-progress');
    bar.classList.remove('hidden');
    try {
      const meeting = await sendUpload(id, (p) => { bar.firstElementChild.style.width = `${Math.round(p * 100)}%`; });
      if (meeting) {
        toast('送信しました。文字起こしを開始します');
        location.hash = `#/m/${meeting.id}`;
      } else {
        location.hash = '#/';
      }
    } catch (err) {
      if (err instanceof AuthError) { renderLogin(); return; }
      alert(`${err.message}\n\n録音は端末に保存されています。通信が回復したら一覧から再送できます。`);
      location.hash = '#/';
    }
  };
}

// ---------------------------------------------------------------- 議事録の表示

function minutesHtml(minutes) {
  const mn = minutes || {};
  const list = (arr) => (arr && arr.length ? `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">なし</p>');
  return `
    <section class="minutes">
      <h3>概要</h3>
      <p class="pre">${esc(mn.summary || '') || '<span class="muted">なし</span>'}</p>
      <h3>決定事項</h3>
      ${list(mn.decisions)}
      <h3>ToDo</h3>
      ${mn.todos && mn.todos.length ? `<ul class="todos">${mn.todos.map((t) => `
        <li><div>${esc(t.task)}</div>
          <div class="todo-meta">${t.owner ? `担当：${esc(t.owner)}` : '担当：未定'}${t.due ? `　期限：${esc(t.due)}` : ''}</div></li>`).join('')}</ul>` : '<p class="muted">なし</p>'}
      <h3>次回の議題</h3>
      ${list(mn.next_agenda)}
    </section>`;
}

function minutesText(m) {
  const mn = m.minutes || {};
  const lines = [
    `【${m.title}】`,
    `日時：${fmtDate(m.held_at)}`,
    m.location ? `場所：${m.location}` : null,
    m.participants ? `参加者：${m.participants}` : null,
    '',
    '■ 概要',
    mn.summary || 'なし',
    '',
    '■ 決定事項',
    ...(mn.decisions && mn.decisions.length ? mn.decisions.map((d) => `・${d}`) : ['なし']),
    '',
    '■ ToDo',
    ...(mn.todos && mn.todos.length
      ? mn.todos.map((t) => `・${t.task}（担当：${t.owner || '未定'}${t.due ? ` / 期限：${t.due}` : ''}）`)
      : ['なし']),
    '',
    '■ 次回の議題',
    ...(mn.next_agenda && mn.next_agenda.length ? mn.next_agenda.map((d) => `・${d}`) : ['なし']),
  ];
  return lines.filter((l) => l !== null).join('\n');
}

async function renderDetail(id) {
  const m = await api(`/api/meetings/${id}`);
  const processing = !['done', 'error'].includes(m.status);
  const tab = sessionStorage.getItem('detail-tab') || 'minutes';

  $app.innerHTML = `
    <header class="bar">
      <a class="back" href="#/">‹ 一覧</a><h1>議事録</h1>
      <button class="icon-btn" id="more-btn" aria-label="その他">⋯</button>
    </header>
    <main class="detail">
      <div class="detail-head">
        <h2>${esc(m.title)}</h2>
        <div class="card-meta">${fmtDate(m.held_at)}${m.duration ? ' ・ ' + fmtDuration(m.duration) : ''}${m.location ? ' ・ ' + esc(m.location) : ''}</div>
        ${m.participants ? `<div class="card-meta">参加者：${esc(m.participants)}</div>` : ''}
        ${m.tags.length ? `<div class="card-tags">${m.tags.map((t) => '#' + esc(t)).join(' ')}</div>` : ''}
      </div>
      ${processing ? `<div class="banner"><span class="spinner"></span>${esc(m.status_detail || STATUS_LABEL[m.status])}…<br><small>Mac で処理中です。この画面を閉じても処理は続きます。</small></div>` : ''}
      ${m.status === 'error' ? `<div class="banner error">処理に失敗しました：${esc(m.error)}<br><button class="btn small" id="retry-btn">もう一度処理する</button></div>` : ''}
      ${m.audio_file ? `<div class="player"><audio id="audio" controls preload="metadata" src="/api/meetings/${m.id}/audio"></audio></div>` : ''}
      <div class="tabs">
        <button class="tab ${tab === 'minutes' ? 'on' : ''}" data-tab="minutes">議事録</button>
        <button class="tab ${tab === 'transcript' ? 'on' : ''}" data-tab="transcript">文字起こし</button>
      </div>
      <div id="tab-minutes" class="${tab === 'minutes' ? '' : 'hidden'}">
        ${m.status === 'done' || m.minutes.summary ? minutesHtml(m.minutes) : '<div class="empty">議事録は作成中です</div>'}
      </div>
      <div id="tab-transcript" class="${tab === 'transcript' ? '' : 'hidden'}">
        ${m.transcript.length ? `<p class="hint">時刻をタップすると、その場面から再生します。</p>
        <ol class="transcript">${m.transcript.map((s, i) => `
          <li data-i="${i}"><button class="ts" data-t="${s.start}">${fmtTime(s.start)}</button><span>${esc(s.text)}</span></li>`).join('')}</ol>`
          : '<div class="empty">文字起こしは処理中です</div>'}
      </div>
    </main>
    <nav class="actionbar">
      <a class="btn" href="#/m/${m.id}/edit">✏️ 編集</a>
      <button class="btn primary" id="share-btn" ${m.status === 'done' ? '' : 'disabled'}>共有・出力</button>
    </nav>`;

  $app.querySelectorAll('.tab').forEach((b) => {
    b.onclick = () => {
      sessionStorage.setItem('detail-tab', b.dataset.tab);
      $app.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
      document.getElementById('tab-minutes').classList.toggle('hidden', b.dataset.tab !== 'minutes');
      document.getElementById('tab-transcript').classList.toggle('hidden', b.dataset.tab !== 'transcript');
    };
  });

  const audio = document.getElementById('audio');
  if (audio && m.transcript.length) {
    $app.querySelectorAll('.ts').forEach((b) => {
      b.onclick = () => { audio.currentTime = Number(b.dataset.t); audio.play(); };
    });
    const rows = [...$app.querySelectorAll('.transcript li')];
    const starts = m.transcript.map((s) => s.start);
    let current = -1;
    audio.addEventListener('timeupdate', () => {
      const t = audio.currentTime;
      let lo = 0, hi = starts.length - 1, idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (starts[mid] <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1;
      }
      if (idx !== current) {
        if (rows[current]) rows[current].classList.remove('now');
        if (rows[idx]) rows[idx].classList.add('now');
        current = idx;
      }
    });
  }

  document.getElementById('retry-btn')?.addEventListener('click', async () => {
    await api(`/api/meetings/${m.id}/reprocess?mode=full`, { method: 'POST' });
    render();
  });

  document.getElementById('share-btn').onclick = () => openSheet([
    { label: '📋 議事録をコピー', action: () => copyText(minutesText(m)) },
    ...(navigator.share ? [{ label: '📤 共有（LINE・メールなど）', action: () => navigator.share({ title: m.title, text: minutesText(m) }).catch(() => {}) }] : []),
    { label: '📄 PDFで保存（議事録）', action: () => printMeeting(m, false) },
    { label: '📄 PDFで保存（文字起こし付き）', action: () => printMeeting(m, true) },
  ]);

  document.getElementById('more-btn').onclick = () => openSheet([
    { label: '議事録を作り直す（文字起こしはそのまま）', action: async () => {
      if (!confirm('現在の議事録（手直しした内容を含む）を、AIが作り直したものに置き換えます。よろしいですか？')) return;
      await api(`/api/meetings/${m.id}/reprocess?mode=summary`, { method: 'POST' });
      render();
    } },
    { label: '文字起こしからやり直す', action: async () => {
      if (!confirm('文字起こしと議事録をすべて作り直します（手直しした内容は消えます）。よろしいですか？')) return;
      await api(`/api/meetings/${m.id}/reprocess?mode=full`, { method: 'POST' });
      render();
    } },
    { label: 'この議事録を削除', danger: true, action: async () => {
      if (!confirm('議事録と音声を完全に削除します。元に戻せません。よろしいですか？')) return;
      await api(`/api/meetings/${m.id}`, { method: 'DELETE' });
      toast('削除しました');
      location.hash = '#/';
    } },
  ]);

  if (processing) {
    // 状態が変わったときだけ描き直す（再生中の音声を止めないため）
    let t;
    const poll = async () => {
      try {
        const latest = await api(`/api/meetings/${id}`);
        const r = currentRoute();
        if (r.name !== 'detail' || r.id !== id) return;
        if (latest.status !== m.status || latest.status_detail !== m.status_detail || latest.audio_file !== m.audio_file) {
          render();
          return;
        }
      } catch (e) { /* 次の確認で再試行 */ }
      t = setTimeout(poll, 5000);
    };
    t = setTimeout(poll, 5000);
    onLeave(() => clearTimeout(t));
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('コピーしました');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('コピーしました');
  }
}

function printMeeting(m, withTranscript) {
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <h1>${esc(m.title)}</h1>
    <p>日時：${fmtDate(m.held_at)}${m.location ? `　場所：${esc(m.location)}` : ''}</p>
    ${m.participants ? `<p>参加者：${esc(m.participants)}</p>` : ''}
    ${minutesHtml(m.minutes)}
    ${withTranscript ? `<h3>文字起こし</h3><ol class="transcript">${m.transcript.map((s) => `
      <li><span class="ts">${fmtTime(s.start)}</span><span>${esc(s.text)}</span></li>`).join('')}</ol>` : ''}`;
  toast('印刷画面の共有ボタンから「PDF」として保存できます', 4000);
  setTimeout(() => window.print(), 300);
}

// ---------------------------------------------------------------- 編集

async function renderEdit(id) {
  const m = await api(`/api/meetings/${id}`);
  const mn = m.minutes || {};
  const todos = (mn.todos || []).map((t) => ({ ...t }));

  $app.innerHTML = `
    <header class="bar">
      <a class="back" href="#/m/${m.id}">‹ 戻る</a><h1>編集</h1>
      <button class="link-btn" id="save-btn">保存</button>
    </header>
    <main class="form">
      <h2 class="section-title">会議情報</h2>
      <label>タイトル<input id="e-title" value="${esc(m.title)}"></label>
      <label>日時<input type="datetime-local" id="e-held" value="${esc(m.held_at.slice(0, 16))}"></label>
      <label>参加者<input id="e-participants" value="${esc(m.participants)}"></label>
      <label>場所<input id="e-location" value="${esc(m.location)}"></label>
      <label>タグ<input id="e-tags" value="${esc(m.tags.join('、'))}" placeholder="読点・カンマ区切り"></label>

      <h2 class="section-title">議事録</h2>
      <label>概要<textarea id="e-summary" rows="6">${esc(mn.summary || '')}</textarea></label>
      <label>決定事項（1行に1つ）<textarea id="e-decisions" rows="4">${esc((mn.decisions || []).join('\n'))}</textarea></label>
      <div class="field-label">ToDo</div>
      <div id="todo-list"></div>
      <button class="btn small" id="add-todo">＋ ToDoを追加</button>
      <label>次回の議題（1行に1つ）<textarea id="e-agenda" rows="3">${esc((mn.next_agenda || []).join('\n'))}</textarea></label>

      ${m.transcript.length ? `
      <h2 class="section-title">文字起こし</h2>
      <button class="btn block" id="show-transcript">文字起こしを編集する（${m.transcript.length}件）</button>
      <div id="transcript-edit" class="hidden"></div>` : ''}
      <button class="btn primary block" id="save-btn2">保存</button>
    </main>`;

  function drawTodos() {
    document.getElementById('todo-list').innerHTML = todos.map((t, i) => `
      <div class="todo-edit" data-i="${i}">
        <input data-k="task" value="${esc(t.task)}" placeholder="やること">
        <div class="row">
          <input data-k="owner" value="${esc(t.owner)}" placeholder="担当">
          <input data-k="due" value="${esc(t.due)}" placeholder="期限">
          <button class="icon-btn danger" data-del="${i}" aria-label="削除">✕</button>
        </div>
      </div>`).join('');
    document.querySelectorAll('.todo-edit input').forEach((inp) => {
      inp.oninput = () => { todos[Number(inp.closest('.todo-edit').dataset.i)][inp.dataset.k] = inp.value; };
    });
    document.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = () => { todos.splice(Number(b.dataset.del), 1); drawTodos(); };
    });
  }
  drawTodos();
  document.getElementById('add-todo').onclick = () => { todos.push({ task: '', owner: '', due: '' }); drawTodos(); };

  let transcriptOpened = false;
  document.getElementById('show-transcript')?.addEventListener('click', (e) => {
    e.currentTarget.remove();
    const box = document.getElementById('transcript-edit');
    box.innerHTML = m.transcript.map((s, i) => `
      <div class="seg-edit"><span class="ts">${fmtTime(s.start)}</span><textarea rows="2" data-seg="${i}">${esc(s.text)}</textarea></div>`).join('');
    box.classList.remove('hidden');
    transcriptOpened = true;
  });

  const save = async () => {
    const lines = (elId) => document.getElementById(elId).value.split('\n').map((x) => x.trim()).filter(Boolean);
    const body = {
      title: document.getElementById('e-title').value.trim() || '無題の会議',
      held_at: document.getElementById('e-held').value || m.held_at,
      participants: document.getElementById('e-participants').value.trim(),
      location: document.getElementById('e-location').value.trim(),
      tags: document.getElementById('e-tags').value.split(/[,、，]/).map((t) => t.trim()).filter(Boolean),
      minutes: {
        summary: document.getElementById('e-summary').value.trim(),
        decisions: lines('e-decisions'),
        todos: todos.filter((t) => t.task.trim()).map((t) => ({ task: t.task.trim(), owner: t.owner.trim(), due: t.due.trim() })),
        next_agenda: lines('e-agenda'),
      },
    };
    if (transcriptOpened) {
      body.transcript = m.transcript.map((s, i) => ({ ...s, text: document.querySelector(`[data-seg="${i}"]`).value.trim() }))
        .filter((s) => s.text);
    }
    try {
      await api(`/api/meetings/${m.id}`, { method: 'PATCH', body });
      toast('保存しました');
      location.hash = `#/m/${m.id}`;
    } catch (e) {
      if (!(e instanceof AuthError)) alert(e.message);
    }
  };
  document.getElementById('save-btn').onclick = save;
  document.getElementById('save-btn2').onclick = save;
}

// ---------------------------------------------------------------- 起動

(async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  try {
    await recoverRecordings();
  } catch (e) { /* 端末保存が使えない環境 */ }
  await render();
  flushUploads();
})();
