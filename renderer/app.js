'use strict';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

class MyTubeApp {
  constructor(root) {
    this.root = root;
    this.audio = null;
    this.nextId = 5;
    this.comps = [
      { name: 'Backdrop', desc: 'Blurred art fill' },
      { name: 'Vinyl', desc: 'Spinning record' },
      { name: 'Waveform', desc: 'Bars front and center' },
      { name: 'Minimal', desc: 'Just the essentials' },
    ];
    this.state = {
      screen: 'library',
      selected: 0, comp: 0, resolution: '1080p',
      variant: 'official-audio', privacy: 'public', captions: false,
      metaTitle: '', metaDesc: '', metaDirty: false,
      upload: 'idle', phase: '', phaseWarn: false, progressPct: 0,
      publishedUrl: '', publishError: '',
      youtubeStatus: { configured: false, signedIn: false },
      youtubeSignInPrompt: null,
      quotaSnapshot: null, remainingToday: null,
      playing: false,
      tracks: [
        { id: 1, title: 'Midnight Drive', artist: 'Neon Harbor', album: 'After Hours', genre: 'synthwave', duration: '3:42', file: 'midnight-drive.flac', status: 'Rendered', composition: 'Backdrop', hue: 32 },
        { id: 2, title: 'Glass Coast', artist: 'Neon Harbor', album: 'After Hours', genre: 'synthwave', duration: '4:05', file: 'glass-coast.flac', status: 'Draft', composition: '—', hue: 210 },
        { id: 3, title: 'Static Bloom', artist: 'Neon Harbor', album: 'After Hours', genre: 'synthwave', duration: '2:58', file: 'static-bloom.flac', status: 'Published', composition: 'Vinyl', hue: 140 },
        { id: 4, title: 'Low Orbit', artist: 'Neon Harbor', album: 'Signals', genre: 'ambient', duration: '5:21', file: 'low-orbit.flac', status: 'Draft', composition: '—', hue: 275 },
      ],
    };

    this.bindEvents();
    window.mytube.publish.onProgress((p) => this.onPublishProgress(p));
    window.mytube.youtube.onSignInPrompt((p) => this.setState({ youtubeSignInPrompt: { ...p, waiting: true } }));

    this.render();
    this.init();
  }

  async init() {
    const [status, remaining] = await Promise.all([
      window.mytube.youtube.status(),
      window.mytube.quota.remaining(this.state.captions),
    ]);
    this.setState({ youtubeStatus: status, remainingToday: remaining });
  }

  async refreshQuota() {
    const remaining = await window.mytube.quota.remaining(this.state.captions);
    this.setState({ remainingToday: remaining });
  }

  // ---- state ----
  setState(patch) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    if (p == null) return;
    Object.assign(this.state, p);
    this.render();
  }

  updateTrack(id, patch) {
    this.setState((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }

  selectedTrack() { return this.state.tracks[this.state.selected] || this.state.tracks[0]; }

  // ---- audio (live in-app preview only — uses blob: URLs, unrelated to the real render path) ----
  attachAudio(t) {
    if (this.audio) this.audio.pause();
    this.audio = t && t.audioUrl ? new Audio(t.audioUrl) : null;
    if (this.audio) this.audio.onended = () => this.setState({ playing: false });
    this.state.playing = false;
  }

  pauseAudio() {
    if (this.audio) this.audio.pause();
    if (this.state.playing) this.setState({ playing: false });
  }

  togglePlay() {
    const t = this.selectedTrack();
    if (!this.audio && t.audioUrl) this.attachAudio(t);
    if (!this.audio) return;
    if (this.state.playing) { this.audio.pause(); this.setState({ playing: false }); }
    else { this.audio.play(); this.setState({ playing: true }); }
  }

  // ---- tracks / files ----
  addTrackFromFile(file) {
    const id = this.nextId++;
    const url = URL.createObjectURL(file);
    const realPath = window.mytube.getFilePath(file);
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    const title = base.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Untitled';
    const track = {
      id, title, artist: 'Your Artist', album: '', genre: '', duration: '—', file: file.name,
      status: 'Draft', composition: '—', hue: Math.floor(Math.random() * 360), audioUrl: url, audioPath: realPath,
    };
    const probe = new Audio(url);
    probe.onloadedmetadata = () => {
      const mm = Math.floor(probe.duration / 60);
      const ss = String(Math.floor(probe.duration % 60)).padStart(2, '0');
      this.updateTrack(id, { duration: `${mm}:${ss}` });
    };
    this.setState((s) => ({ tracks: [track, ...s.tracks], selected: 0, comp: 0, screen: 'editor' }));
    this.attachAudio(track);
  }

  setArt(id, file) {
    this.updateTrack(id, { coverUrl: URL.createObjectURL(file), coverPath: window.mytube.getFilePath(file) });
  }

  handleDropFiles(files, trackId) {
    const audio = files.find((f) => f.type.startsWith('audio/'));
    const image = files.find((f) => f.type.startsWith('image/'));
    if (audio && trackId == null) this.addTrackFromFile(audio);
    else if (audio) this.updateTrack(trackId, { audioUrl: URL.createObjectURL(audio), audioPath: window.mytube.getFilePath(audio), file: audio.name });
    if (image) {
      const cur = this.selectedTrack();
      const id = trackId != null ? trackId : (cur && cur.id);
      if (id != null) this.setArt(id, image);
    }
  }

  // ---- metadata generation ----
  genMeta(t, variant) {
    const suffix = { plain: '', 'official-audio': ' (Official Audio)', lyrics: ' (Lyrics)', visualizer: ' (Visualizer)' }[variant];
    const title = `${t.artist} - ${t.title}${suffix}`;
    const desc = [
      `${t.artist} - ${t.title}`,
      t.album ? `From the album "${t.album}"` : '',
      'Listen everywhere:\nSpotify: https://spotify.link/yourartist\nApple Music: https://music.apple.com/yourartist',
      `Written & performed by ${t.artist}\nReleased 2026-09-01`,
      `© 2026 ${t.artist}. All rights reserved.`,
      'Subscribe: https://youtube.com/@yourchannel',
      ['#' + t.artist.toLowerCase().replace(/ (\w)/g, (m, c) => c.toUpperCase()), t.genre ? '#' + t.genre : '', '#newMusic'].filter(Boolean).join(' '),
    ].filter(Boolean).join('\n\n');
    return { title, desc };
  }

  openMeta(screen) {
    this.pauseAudio();
    const t = this.selectedTrack();
    const gen = this.genMeta(t, this.state.variant);
    this.setState({ screen, metaTitle: gen.title, metaDesc: gen.desc, metaDirty: false, upload: 'idle', publishError: '' });
  }

  // ---- YouTube sign-in ----
  async beginYoutubeSignIn() {
    if (!this.state.youtubeStatus.configured) {
      this.setState({ publishError: "YouTube isn't configured yet — add clientId/clientSecret to config.local.json (see config.example.json)." });
      return false;
    }
    this.setState({ youtubeSignInPrompt: { waiting: true } });
    try {
      await window.mytube.youtube.signIn();
      this.setState({ youtubeStatus: { ...this.state.youtubeStatus, signedIn: true }, youtubeSignInPrompt: null });
      return true;
    } catch (err) {
      this.setState({ youtubeSignInPrompt: null, publishError: err.message });
      return false;
    }
  }

  // ---- real publish: render -> upload -> thumbnail -> quota ----
  async startPublish() {
    const t = this.selectedTrack();
    if (!t.audioPath) {
      this.setState({ publishError: "This track has no real audio file attached (it's a demo entry) — drop an actual audio file onto it first." });
      return;
    }
    if (!this.state.youtubeStatus.signedIn) {
      const ok = await this.beginYoutubeSignIn();
      if (!ok) return;
    }

    const s = this.state;
    const gen = this.genMeta(t, s.variant);
    const metaTitle = s.metaDirty ? s.metaTitle : (s.metaTitle || gen.title);
    const metaDesc = s.metaDirty ? s.metaDesc : (s.metaDesc || gen.desc);
    const tags = [t.artist, t.title, `${t.artist} ${t.title}`, t.album, t.genre, t.genre ? `${t.genre} music` : '', 'official audio', 'new music']
      .filter((x) => x && x.trim()).map((x) => x.toLowerCase());
    const compName = this.comps[s.comp].name;

    this.setState({ upload: 'uploading', phase: 'Starting…', phaseWarn: false, progressPct: 0, publishError: '' });
    try {
      const result = await window.mytube.publish.start({
        audioPath: t.audioPath,
        coverPath: t.coverPath || null,
        title: t.title,
        artist: t.artist,
        composition: compName,
        resolution: s.resolution,
        metaTitle, metaDesc, tags,
        privacy: s.privacy,
        captions: s.captions,
      });
      this.updateTrack(t.id, { status: 'Published', composition: compName });
      await this.refreshQuota();
      this.setState({ upload: 'done', publishedUrl: result.url });
    } catch (err) {
      this.setState({ upload: 'idle', phase: '', publishError: err.message });
    }
  }

  onPublishProgress(p) {
    const pct = p.totalBytes ? Math.min(100, Math.round((p.uploadedBytes / p.totalBytes) * 100)) : this.state.progressPct;
    this.setState({ phase: p.phase, phaseWarn: !!p.phaseWarn, progressPct: pct, publishStage: p.stage });
  }

  cancelPublish() {
    window.mytube.publish.cancel();
    // Best-effort: takes effect at the next render/upload checkpoint, not mid-chunk —
    // see the comment in main.js. The UI resets immediately either way.
    this.setState({ upload: 'idle', phase: '' });
  }

  // ---- nav ----
  goLibrary() { this.pauseAudio(); this.setState({ screen: 'library', upload: 'idle' }); }
  goQueue() { this.pauseAudio(); this.setState({ screen: 'queue' }); }
  goEditor() { this.setState({ screen: 'editor', upload: 'idle' }); }
  openTrack(id) {
    const i = this.state.tracks.findIndex((t) => t.id === id);
    if (i < 0) return;
    const tr = this.state.tracks[i];
    this.setState({ screen: 'editor', selected: i, comp: Math.max(0, this.comps.findIndex((c) => c.name === tr.composition)) });
    this.attachAudio(tr);
  }

  cover(hue, url) {
    return url ? `background-image:url('${url}')` : `background:repeating-linear-gradient(45deg, oklch(0.88 0.02 ${hue}) 0 6px, oklch(0.92 0.015 ${hue}) 6px 12px)`;
  }

  statusStyle(status) {
    const c = { Published: '#3d7a4e', Rendered: '#55524b', Draft: '#8a867e', Rendering: '#8a6a2e', Queued: '#8a867e', Done: '#3d7a4e' }[status] || '#8a867e';
    return `color:${c};border:1px solid ${c}33`;
  }

  // ---- events (delegated once — content is fully rebuilt on render) ----
  bindEvents() {
    this.root.addEventListener('click', (e) => this.handleClick(e));
    this.root.addEventListener('input', (e) => this.handleInput(e));
    this.root.addEventListener('dragover', (e) => { if (e.target.closest('[data-dropzone]')) e.preventDefault(); });
    this.root.addEventListener('drop', (e) => this.handleDrop(e));

    const titlebar = document.getElementById('titlebar');
    titlebar.addEventListener('click', (e) => {
      if (e.target.closest('#tl-close')) window.mytube?.windowClose();
      else if (e.target.closest('#tl-min')) window.mytube?.windowMinimize();
      else if (e.target.closest('#tl-max')) window.mytube?.windowMaximize();
    });
  }

  handleClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const id = el.dataset.id ? Number(el.dataset.id) : null;
    switch (action) {
      case 'nav-library': this.goLibrary(); break;
      case 'nav-queue': this.goQueue(); break;
      case 'browse-audio': document.getElementById('audio-file-input').click(); break;
      case 'open-track': this.openTrack(id); break;
      case 'toggle-play': this.togglePlay(); break;
      case 'select-comp': this.setState({ comp: Number(el.dataset.idx) }); break;
      case 'set-resolution': this.setState({ resolution: el.dataset.value }); break;
      case 'go-editor-back': this.goEditor(); break;
      case 'go-publish': this.openMeta('publish'); break;
      case 'pick-variant': {
        const t = this.selectedTrack();
        const g = this.genMeta(t, el.dataset.value);
        this.setState({ variant: el.dataset.value, metaTitle: g.title, metaDirty: false });
        break;
      }
      case 'pick-privacy': this.setState({ privacy: el.dataset.value }); break;
      case 'toggle-captions':
        this.setState((s) => ({ captions: !s.captions }));
        this.refreshQuota();
        break;
      case 'start-publish': this.startPublish(); break;
      case 'cancel-publish': this.cancelPublish(); break;
      case 'finish-publish': this.setState({ screen: 'library', upload: 'idle', publishedUrl: '' }); break;
      case 'dismiss-error': this.setState({ publishError: '' }); break;
      default: break;
    }
  }

  handleInput(e) {
    if (e.target.id === 'meta-title-input') this.setState({ metaTitle: e.target.value, metaDirty: true });
    else if (e.target.id === 'meta-desc-textarea') this.setState({ metaDesc: e.target.value, metaDirty: true });
    else if (e.target.id === 'audio-file-input') {
      const f = e.target.files && e.target.files[0];
      if (f) this.addTrackFromFile(f);
      e.target.value = '';
    }
  }

  handleDrop(e) {
    const zone = e.target.closest('[data-dropzone]');
    if (!zone) return;
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    const trackId = zone.dataset.trackId ? Number(zone.dataset.trackId) : null;
    this.handleDropFiles(files, trackId);
  }

  // ---- render ----
  render() {
    const active = document.activeElement;
    const activeId = active && active.id;
    let selStart, selEnd;
    if (activeId === 'meta-title-input' || activeId === 'meta-desc-textarea') {
      selStart = active.selectionStart;
      selEnd = active.selectionEnd;
    }

    this.root.innerHTML = this.template();

    if (activeId) {
      const el = document.getElementById(activeId);
      if (el) {
        el.focus();
        if (selStart != null) el.setSelectionRange(selStart, selEnd);
      }
    }
  }

  template() {
    const s = this.state;
    const t = this.selectedTrack();
    const remaining = s.remainingToday;
    const compName = this.comps[s.comp].name;

    return `
      ${this.topbar(remaining)}
      ${s.screen === 'library' ? this.libraryScreen() : ''}
      ${s.screen === 'editor' ? this.editorScreen(t, compName) : ''}
      ${s.screen === 'publish' ? this.publishScreen(t, remaining) : ''}
      ${s.screen === 'queue' ? this.queueScreen() : ''}
      ${this.signInOverlay()}
    `;
  }

  topbar(remaining) {
    const s = this.state;
    const libActive = s.screen !== 'queue';
    const q = s.quotaSnapshot;
    const low = remaining != null && remaining <= 1;
    return `
      <div class="topbar">
        <div class="wordmark">MyTube</div>
        <div class="nav">
          <button class="nav-pill${libActive ? ' active' : ''}" data-action="nav-library">Library</button>
          <button class="nav-pill${!libActive ? ' active' : ''}" data-action="nav-queue">Queue</button>
        </div>
        <div class="spacer"></div>
        <div class="quota">
          <span class="quota-dot${low ? ' low' : ''}"></span>
          <span>${s.youtubeStatus.signedIn ? 'signed in' : 'not signed in'}</span>
          <span class="quota-sep">·</span>
          <span>${remaining == null ? '…' : remaining} publishes left today</span>
        </div>
      </div>
    `;
  }

  libraryScreen() {
    const s = this.state;
    const rows = s.tracks.map((tr) => `
      <div class="track-row" data-action="open-track" data-id="${tr.id}" data-dropzone data-track-id="${tr.id}">
        <div class="cover" style="width:44px;height:44px;border-radius:6px;${this.cover(tr.hue, tr.coverUrl)}">
          ${tr.coverUrl ? '' : '<span class="cover-label">art</span>'}
        </div>
        <div class="track-main">
          <div class="track-title">${esc(tr.title)}</div>
          <div class="track-sub">${esc(tr.artist)} · ${esc(tr.album)}</div>
        </div>
        <div class="track-duration">${esc(tr.duration)}</div>
        <div class="track-comp">${esc(tr.composition)}</div>
        <div class="status-pill" style="${this.statusStyle(tr.status)}">${esc(tr.status)}</div>
      </div>
    `).join('');

    return `
      <div class="screen-library">
        <div class="screen-title-row">
          <h1>Library</h1>
          <span class="count">${s.tracks.length} tracks</span>
        </div>
        <div class="dropzone" data-action="browse-audio" data-dropzone>
          Drop a song here — <code>flac · wav · mp3</code> — or click to browse. Drop an image onto any track to set its cover art.
          <input type="file" id="audio-file-input" accept="audio/*" style="display:none;" />
        </div>
        <div class="track-list">${rows}</div>
      </div>
    `;
  }

  editorScreen(t, compName) {
    const s = this.state;
    const isBackdrop = compName === 'Backdrop';
    const isVinyl = compName === 'Vinyl';
    const coverSize = (compName === 'Waveform' || compName === 'Minimal') ? 96 : 148;
    const barWidth = compName === 'Waveform' ? 9 : 5;
    const barOpacity = compName === 'Minimal' ? 0.25 : 0.85;
    const hasAudio = !!t.audioUrl;
    const playPaused = t.audioUrl && !s.playing;

    const bars = Array.from({ length: 24 }, (_, i) => `
      <div class="eq-bar" style="width:${barWidth}px;height:100%;opacity:${barOpacity};
        animation:eq ${(0.9 + (i % 5) * 0.14).toFixed(2)}s ease-in-out ${(i * 0.07).toFixed(2)}s infinite;
        animation-play-state:${playPaused ? 'paused' : 'running'};"></div>
    `).join('');

    const compCards = this.comps.map((c, i) => {
      const thumbClass = i === 0 ? 'thumb-backdrop' : i === 1 ? 'thumb-vinyl' : i === 2 ? 'thumb-waveform' : '';
      return `
        <div class="comp-card${i === s.comp ? ' active' : ''}" data-action="select-comp" data-idx="${i}">
          <div class="comp-thumb ${thumbClass}"></div>
          <div class="comp-name">${esc(c.name)}</div>
          <div class="comp-desc">${esc(c.desc)}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="screen-editor">
        <div class="editor-main">
          <div class="editor-header">
            <button class="btn-ghost" data-action="nav-library">← Library</button>
            <div class="editor-title">${esc(t.title)}</div>
            <div class="editor-artist">${esc(t.artist)}</div>
          </div>
          <div class="stage">
            ${isBackdrop ? '<div class="stage-backdrop"></div>' : ''}
            ${isVinyl ? '<div class="stage-vinyl"></div>' : ''}
            <div class="stage-center">
              <div class="cover stage-cover" data-dropzone data-track-id="${t.id}"
                   style="width:${coverSize}px;height:${coverSize}px;border-radius:8px;${this.cover(t.hue, t.coverUrl)}">
                ${t.coverUrl ? '' : '<span class="stage-cover-hint">drop cover art</span>'}
              </div>
              <div class="stage-meta">
                <div class="stage-meta-title">${esc(t.title)}</div>
                <div class="stage-meta-artist">${esc(t.artist)}</div>
              </div>
            </div>
            <div class="eq-bars">${bars}</div>
            ${hasAudio ? `<button class="play-btn" data-action="toggle-play">${s.playing ? '❚❚' : '▶'}</button>` : ''}
            <div class="live-badge">live preview · ${s.resolution}</div>
          </div>
          <div class="comp-section">
            <div class="section-label">Composition</div>
            <div class="comp-gallery">${compCards}</div>
          </div>
        </div>
        <div class="rail">
          <div>
            <div class="section-label">Source</div>
            <div class="rail-file">${esc(t.file)}</div>
            <div class="rail-file-sub">${esc(t.duration)} · ${esc((t.file.split('.').pop() || '').toLowerCase())}</div>
            ${!t.audioPath ? '<div class="rail-file-sub" style="color:#b0813a;margin-top:6px;">Demo entry — no real audio file, can\'t actually be rendered/published.</div>' : ''}
          </div>
          <div>
            <div class="section-label">Resolution</div>
            <div class="chip-row">
              <button class="chip${s.resolution === '1080p' ? ' active' : ''}" data-action="set-resolution" data-value="1080p">1080p</button>
              <button class="chip${s.resolution === '4K' ? ' active' : ''}" data-action="set-resolution" data-value="4K">4K</button>
            </div>
          </div>
          <div>
            <div class="section-label">Render time</div>
            <div class="estimate">≈ ${esc(t.duration)} (real-time capture)</div>
            <div class="estimate-sub">The preview is the render — the composition module renders live, the same way it plays here.</div>
          </div>
          <div class="rail-spacer"></div>
          <button class="btn-primary" data-action="go-publish">Continue to publish →</button>
        </div>
      </div>
    `;
  }

  publishScreen(t, remaining) {
    const s = this.state;
    const gen = this.genMeta(t, s.variant);
    const metaTitle = s.metaDirty ? s.metaTitle : (s.metaTitle || gen.title);
    const metaDesc = s.metaDirty ? s.metaDesc : (s.metaDesc || gen.desc);
    const tags = [t.artist, t.title, `${t.artist} ${t.title}`, t.album, t.genre, t.genre ? `${t.genre} music` : '', 'official audio', 'new music']
      .filter((x) => x && x.trim()).map((x) => x.toLowerCase());
    const tagChars = tags.reduce((a, x) => a + x.length + 1, 0);
    const hashtags = gen.desc.split('\n\n').pop();

    const variants = [['plain', 'Plain'], ['official-audio', 'Official Audio'], ['lyrics', 'Lyrics'], ['visualizer', 'Visualizer']];
    const variantChips = variants.map(([id, label]) => `
      <button class="chip${s.variant === id ? ' active' : ''}" data-action="pick-variant" data-value="${id}">${esc(label)}</button>
    `).join('');

    const tagChips = tags.map((x) => `<span class="tag-chip">${esc(x)}</span>`).join('');

    const privacies = [['private', 'Private'], ['unlisted', 'Unlisted'], ['public', 'Public']];
    const privacyChips = privacies.map(([id, label]) => `
      <button class="chip${s.privacy === id ? ' active' : ''}" data-action="pick-privacy" data-value="${id}">${esc(label)}</button>
    `).join('');

    const errorBox = s.publishError ? `
      <div class="warnings-box" style="border-color:#e3b3a8;background:#fbeeea;margin-bottom:12px;">
        <div class="warning-line" style="color:#b0483a;">${esc(s.publishError)}</div>
      </div>
    ` : '';

    let railContent;
    if (s.upload === 'idle') {
      railContent = `
        <div>
          <div class="section-label">Visibility</div>
          <div class="chip-row">${privacyChips}</div>
        </div>
        <div>
          <div class="section-label">This publish costs (real YouTube API units)</div>
          <div class="cost-list">
            <div class="cost-row"><span>Video upload</span><span class="cost-val">1600 units</span></div>
            <div class="cost-row"><span>Thumbnail</span><span class="cost-val">50 units</span></div>
            <div class="cost-row"><span>Playlist item</span><span class="cost-val">50 units</span></div>
            <div class="captions-row" data-action="toggle-captions">
              <span class="captions-left"><span class="checkbox${s.captions ? ' checked' : ''}"></span>Lyrics as captions</span>
              <span class="captions-cost">+400 units</span>
            </div>
          </div>
          <div class="remaining-note">
            After this publish: <strong>${remaining == null ? '…' : Math.max(0, remaining - 1)}</strong> more like it today.
            <div style="margin-top:6px;">Daily project quota is 10,000 units — a real publish costs 1700-2100 units, so only a handful fit per day.</div>
            ${s.captions ? '<div class="remaining-warn">Captions on: costs 2100 units, not 1700.</div>' : ''}
          </div>
        </div>
        <div class="rail-spacer"></div>
        <button class="btn-primary" data-action="start-publish" ${!t.audioPath ? 'disabled style="opacity:.5;cursor:not-allowed;"' : ''}>Publish</button>
      `;
    } else if (s.upload === 'uploading') {
      railContent = `
        <div class="upload-block">
          <div class="section-label">${s.publishStage === 'upload' ? 'Uploading' : 'Rendering'}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${s.progressPct}%"></div></div>
          <div class="progress-row"><span>${s.progressPct}%</span></div>
          <div class="phase-line${s.phaseWarn ? ' warn' : ''}">${esc(s.phase)}</div>
          <button class="btn-cancel" data-action="cancel-publish">Cancel</button>
        </div>
      `;
    } else {
      railContent = `
        <div class="done-block">
          <div class="done-badge">✓</div>
          <div class="done-title">Published</div>
          <div class="done-summary">${esc(metaTitle)} is live as <strong>${esc(s.privacy)}</strong>.</div>
          <div class="done-url"><a href="#" onclick="return false" style="color:inherit;">${esc(s.publishedUrl)}</a></div>
          <button class="btn-secondary" data-action="finish-publish">Back to library</button>
        </div>
      `;
    }

    return `
      <div class="screen-publish">
        <div class="publish-main">
          <div class="publish-header">
            <button class="btn-ghost" data-action="go-editor-back">← Editor</button>
            <div class="publish-header-title">Publish to YouTube</div>
            <div class="publish-header-sub">metadata generated — review before publishing</div>
          </div>
          ${errorBox}
          <div class="publish-form">
            <div>
              <div class="field-label-row">
                <label class="field-label">Title</label>
                <span class="field-counter">${metaTitle.length}/100</span>
              </div>
              <input id="meta-title-input" class="text-input" value="${esc(metaTitle)}" />
              <div class="chip-row" style="margin-top:8px;">${variantChips}</div>
            </div>
            <div>
              <div class="field-label-row">
                <label class="field-label">Description</label>
                <span class="field-counter">${metaDesc.length}/5,000</span>
              </div>
              <textarea id="meta-desc-textarea" class="text-area" rows="9">${esc(metaDesc)}</textarea>
            </div>
            <div>
              <label class="field-label" style="display:block;margin-bottom:8px;">Tags <span class="field-hint">— ${tagChars}/500 chars</span></label>
              <div class="tags-wrap">${tagChips}</div>
            </div>
            <div>
              <label class="field-label" style="display:block;margin-bottom:8px;">Hashtags <span class="field-hint">— first 3 show above the title</span></label>
              <div class="hashtags">${esc(hashtags)}</div>
            </div>
            ${!s.captions ? `
              <div class="warnings-box">
                <div class="warning-line">Lyrics captions are off — turning them on costs 400 more units.</div>
              </div>
            ` : ''}
          </div>
        </div>
        <div class="rail rail-wide">${railContent}</div>
      </div>
    `;
  }

  queueScreen() {
    const s = this.state;
    const active = s.upload === 'uploading' ? this.selectedTrack() : null;
    const rows = s.tracks
      .filter((tr) => tr.status !== 'Draft' || tr.id === (active && active.id))
      .map((tr) => {
        const isActive = active && tr.id === active.id;
        const status = isActive ? (s.publishStage === 'upload' ? 'Uploading' : 'Rendering') : tr.status;
        const prog = isActive ? s.progressPct : (tr.status === 'Published' || tr.status === 'Rendered' ? 100 : 0);
        return `
          <div class="queue-row">
            <div class="cover" style="width:40px;height:40px;border-radius:6px;${this.cover(tr.hue, tr.coverUrl)}"></div>
            <div class="queue-main">
              <div class="track-title">${esc(tr.title)}</div>
              <div class="queue-detail">${esc(tr.composition)} · ${esc(tr.duration)}</div>
            </div>
            <div class="queue-bar-wrap">
              <div class="queue-bar-track">
                <div class="queue-bar-fill" style="width:${prog}%;background:${prog >= 100 ? '#3d7a4e' : '#1a1917'}"></div>
              </div>
            </div>
            <div class="status-pill" style="${this.statusStyle(status)}">${esc(status)}</div>
          </div>
        `;
      }).join('');

    return `
      <div class="screen-queue">
        <div class="screen-title-row">
          <h1>Render queue</h1>
          <span class="count">${rows ? '' : 'nothing rendered yet'}</span>
        </div>
        <div class="track-list">${rows || '<div style="padding:24px 0;color:#8a867e;font-size:13px;">Publish a track to see it here.</div>'}</div>
        <div class="queue-footer">Renders run one at a time in a hidden window — the same composition module as the preview.</div>
      </div>
    `;
  }

  signInOverlay() {
    const p = this.state.youtubeSignInPrompt;
    if (!p) return '';
    const body = p.userCode
      ? `
        <div style="font-size:13px;color:#55524b;margin-bottom:14px;">Go to <strong>${esc(p.verificationUrl)}</strong> and enter this code:</div>
        <div style="font-family:ui-monospace,Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:.08em;text-align:center;background:#efedea;border-radius:8px;padding:14px;margin-bottom:14px;">${esc(p.userCode)}</div>
        <div style="font-size:12px;color:#8a867e;">Waiting for approval…</div>
      `
      : `<div style="font-size:13px;color:#55524b;">Starting sign-in…</div>`;
    return `
      <div style="position:fixed;inset:0;background:rgba(20,19,17,.5);display:flex;align-items:center;justify-content:center;z-index:1000;">
        <div style="width:380px;background:#fdfcfb;border-radius:12px;padding:28px;box-shadow:0 20px 50px rgba(0,0,0,.3);">
          <div style="font-size:15px;font-weight:600;margin-bottom:14px;">Sign in to YouTube</div>
          ${body}
        </div>
      </div>
    `;
  }
}

new MyTubeApp(document.getElementById('app'));
