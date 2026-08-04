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
    this.uploadTimer = null;
    this.queueTimer = null;
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
      upload: 'idle', uploadedMb: 0, phase: '', phaseWarn: false,
      quota: { upload: 3, general: 230 },
      queueProg: 62, playing: false,
      tracks: [
        { id: 1, title: 'Midnight Drive', artist: 'Neon Harbor', album: 'After Hours', genre: 'synthwave', duration: '3:42', file: 'midnight-drive.flac', status: 'Rendered', composition: 'Backdrop', hue: 32 },
        { id: 2, title: 'Glass Coast', artist: 'Neon Harbor', album: 'After Hours', genre: 'synthwave', duration: '4:05', file: 'glass-coast.flac', status: 'Draft', composition: '—', hue: 210 },
        { id: 3, title: 'Static Bloom', artist: 'Neon Harbor', album: 'After Hours', genre: 'synthwave', duration: '2:58', file: 'static-bloom.flac', status: 'Published', composition: 'Vinyl', hue: 140 },
        { id: 4, title: 'Low Orbit', artist: 'Neon Harbor', album: 'Signals', genre: 'ambient', duration: '5:21', file: 'low-orbit.flac', status: 'Draft', composition: '—', hue: 275 },
      ],
    };

    this.bindEvents();
    this.render();
    this.startQueueTimer();
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

  // ---- audio ----
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
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    const title = base.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Untitled';
    const track = {
      id, title, artist: 'Your Artist', album: '', genre: '', duration: '—', file: file.name,
      status: 'Draft', composition: '—', hue: Math.floor(Math.random() * 360), audioUrl: url,
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

  setArt(id, file) { this.updateTrack(id, { coverUrl: URL.createObjectURL(file) }); }

  handleDropFiles(files, trackId) {
    const audio = files.find((f) => f.type.startsWith('audio/'));
    const image = files.find((f) => f.type.startsWith('image/'));
    if (audio && trackId == null) this.addTrackFromFile(audio);
    else if (audio) this.updateTrack(trackId, { audioUrl: URL.createObjectURL(audio), file: audio.name });
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

  fileSizeMb() { return this.state.resolution === '4K' ? 312.4 : 84.6; }

  openMeta(screen) {
    this.pauseAudio();
    const t = this.selectedTrack();
    const gen = this.genMeta(t, this.state.variant);
    this.setState({ screen, metaTitle: gen.title, metaDesc: gen.desc, metaDirty: false, upload: 'idle' });
  }

  // ---- upload simulation (mocked — see README) ----
  startUpload() {
    const total = this.fileSizeMb();
    this.setState({ upload: 'uploading', uploadedMb: 0, phase: 'Creating upload session…', phaseWarn: false });
    let dropped = false;
    clearInterval(this.uploadTimer);
    this.uploadTimer = setInterval(() => {
      this.setState((s) => {
        if (s.upload !== 'uploading') { clearInterval(this.uploadTimer); return null; }
        let mb = s.uploadedMb;
        if (!dropped && mb > total * 0.45) {
          dropped = true;
          setTimeout(() => this.setState({ phase: `Resumed from ${mb.toFixed(1)} MB — YouTube confirmed the offset`, phaseWarn: false }), 1100);
          return { phase: 'Connection dropped — asking the session where it got to…', phaseWarn: true };
        }
        mb = Math.min(total, mb + 1.6 + Math.random() * 1.4);
        if (mb >= total) {
          clearInterval(this.uploadTimer);
          setTimeout(() => this.setState((s2) => ({
            upload: 'done',
            quota: { upload: s2.quota.upload + 1, general: s2.quota.general + 100 + (s2.captions ? 400 : 0) },
          })), 1200);
          return { uploadedMb: total, phase: 'Processing on YouTube…', phaseWarn: false };
        }
        return { uploadedMb: mb, phase: `Uploading chunk ${Math.floor(mb / 8) + 1} of ${Math.ceil(total / 8)} · 8 MiB chunks`, phaseWarn: false };
      });
    }, 180);
  }

  cancelUpload() { clearInterval(this.uploadTimer); this.setState({ upload: 'idle' }); }

  finishUpload() {
    const t = this.selectedTrack();
    this.updateTrack(t.id, { status: 'Published', composition: this.comps[this.state.comp].name });
    this.setState({ screen: 'library', upload: 'idle' });
  }

  startQueueTimer() {
    this.queueTimer = setInterval(() => {
      this.setState((s) => (s.queueProg >= 100 ? null : { queueProg: Math.min(100, s.queueProg + 0.4) }));
    }, 400);
  }

  // ---- nav ----
  goLibrary() { clearInterval(this.uploadTimer); this.pauseAudio(); this.setState({ screen: 'library', upload: 'idle' }); }
  goQueue() { this.pauseAudio(); this.setState({ screen: 'queue' }); }
  goEditor() { clearInterval(this.uploadTimer); this.setState({ screen: 'editor', upload: 'idle' }); }
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
      case 'toggle-captions': this.setState((s) => ({ captions: !s.captions })); break;
      case 'start-upload': this.startUpload(); break;
      case 'cancel-upload': this.cancelUpload(); break;
      case 'finish-upload': this.finishUpload(); break;
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
    const cost = 100 + (s.captions ? 400 : 0);
    const remaining = Math.max(0, Math.min(100 - s.quota.upload, Math.floor((10000 - s.quota.general) / cost)));
    const compName = this.comps[s.comp].name;

    return `
      ${this.topbar(remaining)}
      ${s.screen === 'library' ? this.libraryScreen() : ''}
      ${s.screen === 'editor' ? this.editorScreen(t, compName) : ''}
      ${s.screen === 'publish' ? this.publishScreen(t, remaining, cost) : ''}
      ${s.screen === 'queue' ? this.queueScreen() : ''}
    `;
  }

  topbar(remaining) {
    const s = this.state;
    const libActive = s.screen !== 'queue';
    return `
      <div class="topbar">
        <div class="wordmark">MyTube</div>
        <div class="nav">
          <button class="nav-pill${libActive ? ' active' : ''}" data-action="nav-library">Library</button>
          <button class="nav-pill${!libActive ? ' active' : ''}" data-action="nav-queue">Queue</button>
        </div>
        <div class="spacer"></div>
        <div class="quota">
          <span class="quota-dot${remaining < 10 ? ' low' : ''}"></span>
          <span>uploads ${s.quota.upload}/100 · api ${Number(s.quota.general).toLocaleString()}/10,000</span>
          <span class="quota-sep">·</span>
          <span>${remaining} publishes left today</span>
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

    const renderEstimate = s.resolution === '4K' ? '~11 min · 312 MB' : '~4 min · 85 MB';

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
          </div>
          <div>
            <div class="section-label">Resolution</div>
            <div class="chip-row">
              <button class="chip${s.resolution === '1080p' ? ' active' : ''}" data-action="set-resolution" data-value="1080p">1080p</button>
              <button class="chip${s.resolution === '4K' ? ' active' : ''}" data-action="set-resolution" data-value="4K">4K</button>
            </div>
          </div>
          <div>
            <div class="section-label">Estimated render</div>
            <div class="estimate">${renderEstimate}</div>
            <div class="estimate-sub">The preview is the render — what you see is the exported file.</div>
          </div>
          <div class="rail-spacer"></div>
          <button class="btn-primary" data-action="go-publish">Continue to publish →</button>
        </div>
      </div>
    `;
  }

  publishScreen(t, remaining, cost) {
    const s = this.state;
    const gen = this.genMeta(t, s.variant);
    const metaTitle = s.metaDirty ? s.metaTitle : (s.metaTitle || gen.title);
    const metaDesc = s.metaDirty ? s.metaDesc : (s.metaDesc || gen.desc);
    const tags = [t.artist, t.title, `${t.artist} ${t.title}`, t.album, t.genre, t.genre ? `${t.genre} music` : '', 'official audio', 'new music']
      .filter((x) => x && x.trim()).map((x) => x.toLowerCase());
    const tagChars = tags.reduce((a, x) => a + x.length + 1, 0);
    const hashtags = gen.desc.split('\n\n').pop();
    const total = this.fileSizeMb();
    const pct = Math.round((s.uploadedMb / total) * 100);

    const variants = [['plain', 'Plain'], ['official-audio', 'Official Audio'], ['lyrics', 'Lyrics'], ['visualizer', 'Visualizer']];
    const variantChips = variants.map(([id, label]) => `
      <button class="chip${s.variant === id ? ' active' : ''}" data-action="pick-variant" data-value="${id}">${esc(label)}</button>
    `).join('');

    const tagChips = tags.map((x) => `<span class="tag-chip">${esc(x)}</span>`).join('');

    const privacies = [['private', 'Private'], ['unlisted', 'Unlisted'], ['public', 'Public']];
    const privacyChips = privacies.map(([id, label]) => `
      <button class="chip${s.privacy === id ? ' active' : ''}" data-action="pick-privacy" data-value="${id}">${esc(label)}</button>
    `).join('');

    let railContent;
    if (s.upload === 'idle') {
      railContent = `
        <div>
          <div class="section-label">Visibility</div>
          <div class="chip-row">${privacyChips}</div>
        </div>
        <div>
          <div class="section-label">This publish costs</div>
          <div class="cost-list">
            <div class="cost-row"><span>Video upload</span><span class="cost-val">1 upload</span></div>
            <div class="cost-row"><span>Thumbnail</span><span class="cost-val">50 units</span></div>
            <div class="cost-row"><span>Playlist item</span><span class="cost-val">50 units</span></div>
            <div class="captions-row" data-action="toggle-captions">
              <span class="captions-left"><span class="checkbox${s.captions ? ' checked' : ''}"></span>Lyrics as captions</span>
              <span class="captions-cost">+400 units</span>
            </div>
          </div>
          <div class="remaining-note">
            After this publish: <strong>${Math.max(0, remaining - 1)}</strong> more like it today.
            ${s.captions ? '<div class="remaining-warn">Captions drop your daily ceiling from ~100 to ~20 publishes.</div>' : ''}
          </div>
        </div>
        <div class="rail-spacer"></div>
        <button class="btn-primary" data-action="start-upload">Publish · ${total.toFixed(1)} MB</button>
      `;
    } else if (s.upload === 'uploading') {
      railContent = `
        <div class="upload-block">
          <div class="section-label">Uploading</div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-row"><span>${s.uploadedMb.toFixed(1)} / ${total.toFixed(1)} MB</span><span>${pct}%</span></div>
          <div class="phase-line${s.phaseWarn ? ' warn' : ''}">${esc(s.phase)}</div>
          <button class="btn-cancel" data-action="cancel-upload">Cancel</button>
        </div>
      `;
    } else {
      railContent = `
        <div class="done-block">
          <div class="done-badge">✓</div>
          <div class="done-title">Published</div>
          <div class="done-summary">${esc(metaTitle)} is live as <strong>${esc(s.privacy)}</strong>.</div>
          <div class="done-url">youtu.be/vid_mt_0413</div>
          <button class="btn-secondary" data-action="finish-upload">Back to library</button>
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
                <div class="warning-line">Lyrics captions are off — turning them on costs 400 units (drops daily ceiling to ~20 publishes).</div>
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
    const queue = [
      { title: 'Midnight Drive', detail: 'Backdrop · 1080p · 3:42', status: 'Done', prog: 100, hue: 32 },
      { title: 'Static Bloom', detail: 'Vinyl · 1080p · 2:58', status: 'Rendering', prog: s.queueProg, hue: 140 },
      { title: 'Low Orbit', detail: 'Waveform · 4K · 5:21', status: 'Queued', prog: 0, hue: 275 },
    ];
    const rows = queue.map((q) => `
      <div class="queue-row">
        <div class="cover" style="width:40px;height:40px;border-radius:6px;${this.cover(q.hue)}"></div>
        <div class="queue-main">
          <div class="track-title">${esc(q.title)}</div>
          <div class="queue-detail">${esc(q.detail)}</div>
        </div>
        <div class="queue-bar-wrap">
          <div class="queue-bar-track">
            <div class="queue-bar-fill" style="width:${q.prog}%;background:${q.status === 'Done' ? '#3d7a4e' : '#1a1917'}"></div>
          </div>
        </div>
        <div class="status-pill" style="${this.statusStyle(q.status)}">${esc(q.status)}</div>
      </div>
    `).join('');

    return `
      <div class="screen-queue">
        <div class="screen-title-row">
          <h1>Render queue</h1>
          <span class="count">1 rendering · 1 queued · 1 done</span>
        </div>
        <div class="track-list">${rows}</div>
        <div class="queue-footer">Renders run one at a time in a hidden window — the same composition module as the preview.</div>
      </div>
    `;
  }
}

new MyTubeApp(document.getElementById('app'));
