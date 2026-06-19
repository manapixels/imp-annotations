/* =============================================================================
   app.js — Annotate Imps reviewer console (vanilla JS, no build step).
   ========================================================================== */
(function () {
  'use strict';

  const D = window.DEMO;
  const TYPE_BY_ID = Object.fromEntries(D.IMP_TYPES.map(t => [t.id, t]));
  const DIR_BY_ID = Object.fromEntries(D.DIRECTIONS.map(d => [d.id, d]));
  const DIR_BY_KEY = Object.fromEntries(D.DIRECTIONS.map(d => [d.key, d.id]));
  const DIR_BY_NUM = Object.fromEntries(D.DIRECTIONS.map(d => [d.num, d.id]));
  const ARROW_DIR = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E' };
  const USER_BY_ID = Object.fromEntries(D.USERS.map(u => [u.id, u]));

  const $ = id => document.getElementById(id);
  const el = {
    video: $('video'), wrap: $('videoWrap'), empty: $('videoEmpty'),
    recBadge: $('recBadge'), armPrompt: $('armPrompt'), keyhints: $('stageKeyhints'),
    vidId: $('vidId'), vidStatus: $('vidStatus'),
    aiProgress: $('aiProgress'), btnFlag: $('btnFlag'),
    tlTrack: $('tlTrack'), tlProgress: $('tlProgress'), tlPlayhead: $('tlPlayhead'),
    tlRecording: $('tlRecording'), tlCur: $('tlCur'), tlDur: $('tlDur'),
    btnPlay: $('btnPlay'), playIcon: $('playIcon'), curTime: $('curTime'), durTime: $('durTime'),
    btnBack: $('btnBack'), btnFwd: $('btnFwd'), btnSlow: $('btnSlow'), btnStep: $('btnStep'),
    btnMute: $('btnMute'), btnArm: $('btnArm'),
    queueGrid: $('queueGrid'), issuesToggle: $('issuesToggle'), issuesCount: $('issuesCount'),
    todoToggle: $('todoToggle'), todoCount: $('todoCount'),
    annList: $('annList'),
    dateBtn: $('dateBtn'), dateLabel: $('dateLabel'), todayBadge: $('todayBadge'), dateMeta: $('dateMeta'), calendar: $('calendar'),
    recordSearch: $('recordSearch'), searchResults: $('searchResults'),
    // annotate modal
    anModal: $('annotateModal'), anTitle: $('anTitle'), anClose: $('anClose'),
    anStart: $('anStart'), anEnd: $('anEnd'), anDur: $('anDur'),
    anSearchWrap: $('anSearchWrap'), anSearch: $('anSearch'),
    anRecent: $('anRecent'), anRecentChips: $('anRecentChips'),
    anTypeList: $('anTypeList'), anDirpad: $('anDirpad'), anDirLabel: $('anDirLabel'),
    anAiDiff: $('anAiDiff'), anCancel: $('anCancel'), anCreate: $('anCreate'),
    // shortcuts
    btnShortcuts: $('btnShortcuts'), scModal: $('shortcutsModal'), scClose: $('scClose'), scGrid: $('scGrid'),
    toastWrap: $('toast-wrap'),
    // user menu
    userBtn: $('userBtn'), userName: $('userName'), userAvatar: $('userAvatar'), userDropdown: $('userDropdown'),
  };

  const state = {
    selectedDate: D.TODAY_ISO,
    selectedVideoId: null,                    // set on boot from the day's queue
    selectedAnnId: null,
    currentUserId: D.CURRENT_USER_ID,
    calMonth: null,                           // { y, m } shown in the date picker
    calendarOpen: false,
    queueFilter: 'all',                       // 'all' | 'todo' | 'issue'
    duration: 0,
    timesReady: false,
    recording: null,                          // { startSec }
    recentTypeIds: ['fire-dragon', 'water-penguin'],
    activeModal: null,                        // 'annotate' | 'shortcuts'
    draft: null,                              // annotation being created / edited
    userMenuOpen: false,
    searchOpen: false,
    searchIndex: 0,
    speeds: [1, 0.5, 0.25],
    speedIdx: 0,
  };

  /* ----------------------------- helpers --------------------------------- */
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const currentVideo = () => D.VIDEOS.find(v => v.id === state.selectedVideoId);
  const typeOf = id => TYPE_BY_ID[id];
  const elemColor = typeId => {
    const t = TYPE_BY_ID[typeId];
    return t ? D.ELEMENTS[t.element].color : '#888';
  };
  function fmt(sec) {
    sec = Math.max(0, sec || 0);
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }
  function fmtMs(sec) {
    sec = Math.max(0, sec || 0);
    const m = Math.floor(sec / 60), s = (sec % 60);
    return m + ':' + s.toFixed(1).padStart(4, '0');
  }
  let _uid = 1;
  const uid = () => 'h' + (Date.now()) + '-' + (_uid++);

  /* Every clip is AI-tagged on arrival; status reflects the HUMAN review state.
     Anything not finished and not flagged is simply "to-do" — new, partially
     reviewed, and snoozed all collapse into one actionable bucket. */
  function statusOf(v) {
    if (v.flagged) return 'issue';
    if (v.reviewed) return 'done';
    return 'todo';
  }
  const unresolvedIssue = v => statusOf(v) === 'issue';   // flagged & not yet reviewed
  const STATUS_LABEL = { issue: 'Issue', done: 'Reviewed', todo: 'To-do' };
  /* distinct SHAPE per status so it reads without relying on colour */
  const STATUS_GLYPH = { todo: '○', done: '✓', issue: '⚑' };


  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(iso) {
    const p = iso.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    return WEEKDAYS[d.getDay()] + ' ' + p[2] + ' ' + MONTHS_SHORT[p[1] - 1] + ' ' + p[0];
  }
  const dayVideos = iso => D.VIDEOS.filter(v => v.date === iso);
  const dayHasData = iso => D.VIDEOS.some(v => v.date === iso);
  const dayHasIssue = iso => D.VIDEOS.some(v => v.date === iso && unresolvedIssue(v));
  const unreviewedAI = v => v.annotations.filter(a => a.source === 'ai' && a.status === 'unreviewed');
  const allAI = v => v.annotations.filter(a => a.source === 'ai');

  /* Convert seed fractions -> seconds once we know the real clip duration. */
  function initTimes() {
    if (state.timesReady) return;
    D.VIDEOS.forEach(v => v.annotations.forEach(a => {
      if (a.startSec == null) { a.startSec = (a.f0 || 0) * state.duration; }
      if (a.endSec == null) { a.endSec = (a.f1 || 0) * state.duration; }
    }));
    state.timesReady = true;
  }

  /* Translate seed statuses into the boolean flags statusOf() expects. */
  function normalizeSeedStatuses() {
    D.VIDEOS.forEach(v => {
      if (v.status === 'issue') v.flagged = true;
      if (v.status === 'done') v.reviewed = true;
    });
  }

  /* ============================ RENDERING ================================= */
  function render() {
    renderStageHead();
    renderQueue();
    renderAnnList();
    renderMarkers();
  }

  function renderStageHead() {
    const v = currentVideo();
    const st = statusOf(v);
    el.vidId.textContent = v.id;
    el.vidStatus.className = 'status-chip s-' + st;
    el.vidStatus.textContent = STATUS_LABEL[st];

    el.btnFlag.textContent = v.flagged ? '⚑ Flagged' : '⚑ Flag';
    el.btnFlag.classList.toggle('danger', v.flagged);
  }

  /* AI-verification progress for the current clip — lives in the Annotations header */
  function renderAiProgress(v) {
    const total = allAI(v).length, done = total - unreviewedAI(v).length;
    el.aiProgress.innerHTML = total
      ? '<span>TO-DO&nbsp;&nbsp;<b style="color:var(--txt)">' + done + '/' + total + '</b></span>' +
      '<span class="bar"><i style="width:' + (done / total * 100) + '%"></i></span>'
      : '<span>No AI tags</span>';
  }

  function renderQueue() {
    const day = dayVideos(state.selectedDate);
    const issues = day.filter(unresolvedIssue);
    const todos = day.filter(v => statusOf(v) === 'todo');

    // filter toggles (To-do / Issues) — mutually exclusive, click again to clear
    el.todoCount.textContent = todos.length;
    el.issuesCount.textContent = issues.length;
    if (state.queueFilter === 'issue' && !issues.length) state.queueFilter = 'all';
    if (state.queueFilter === 'todo' && !todos.length) state.queueFilter = 'all';
    el.todoToggle.classList.toggle('active', state.queueFilter === 'todo');
    el.issuesToggle.classList.toggle('active', state.queueFilter === 'issue');
    el.issuesToggle.classList.toggle('has-issues', issues.length > 0);

    const list = state.queueFilter === 'issue' ? issues : state.queueFilter === 'todo' ? todos : day;
    el.queueGrid.innerHTML = '';
    if (!list.length) {
      const msg = state.queueFilter === 'issue' ? 'No open issues on this day.'
        : state.queueFilter === 'todo' ? 'Nothing left to do on this day.'
          : 'No recordings for this day.';
      el.queueGrid.innerHTML = '<div class="queue-empty">' + msg + '</div>';
      return;
    }
    list.forEach(v => {
      const st = statusOf(v);
      const c = document.createElement('button');
      c.className = 'qcell q-' + st + (v.id === state.selectedVideoId ? ' selected' : '');
      c.dataset.id = v.id;
      const n = v.annotations.length;
      let meta = n ? (n + ' imp' + (n > 1 ? 's' : '')) : 'no imps';
      if (st === 'issue') meta = 'needs help';
      c.innerHTML =
        '<span class="qdot">' + STATUS_GLYPH[st] + '</span>' +
        '<span class="qtime">' + v.slot + '</span>' +
        '<span class="qmeta">' + meta + '</span>';
      c.title = v.id + ' · ' + STATUS_LABEL[st];
      el.queueGrid.appendChild(c);
    });
  }

  /* ---- date bar + calendar picker --------------------------------------- */
  function renderDateBar() {
    el.dateLabel.textContent = fmtDate(state.selectedDate);
    el.todayBadge.style.display = state.selectedDate === D.TODAY_ISO ? '' : 'none';
    const n = dayVideos(state.selectedDate).length;
    el.dateMeta.textContent = n + ' recording' + (n === 1 ? '' : 's') + ' · one every 15 min';
    el.dateBtn.classList.toggle('open', state.calendarOpen);
  }

  function renderCalendar() {
    const { y, m } = state.calMonth;
    const first = new Date(y, m, 1), startDow = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let html = '<div class="cal-head">' +
      '<button class="cal-nav" data-cal="prev" title="Previous month">‹</button>' +
      '<span class="cal-title">' + MONTHS[m] + ' ' + y + '</span>' +
      '<button class="cal-nav" data-cal="next" title="Next month">›</button></div>' +
      '<div class="cal-grid">';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => html += '<span class="cal-dow">' + d + '</span>');
    for (let i = 0; i < startDow; i++) html += '<span class="cal-cell empty"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const has = dayHasData(iso), cls = ['cal-cell'];
      if (!has) cls.push('no-data');
      if (dayHasIssue(iso)) cls.push('has-issue');
      if (iso === state.selectedDate) cls.push('selected');
      if (iso === D.TODAY_ISO) cls.push('today');
      html += '<button class="' + cls.join(' ') + '"' + (has ? '' : ' disabled') + ' data-date="' + iso + '">' + d + '</button>';
    }
    html += '</div><div class="cal-foot"><span class="ci"><b>⚑</b> day has unresolved issues</span></div>';
    el.calendar.innerHTML = html;
  }
  function openCalendar() {
    state.calendarOpen = true;
    const p = state.selectedDate.split('-').map(Number);
    state.calMonth = { y: p[0], m: p[1] - 1 };
    renderCalendar();
    el.calendar.classList.add('open');
    renderDateBar();
  }
  function closeCalendar() { state.calendarOpen = false; el.calendar.classList.remove('open'); renderDateBar(); }
  function shiftCalMonth(delta) {
    let { y, m } = state.calMonth; m += delta;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    state.calMonth = { y, m }; renderCalendar();
  }
  function pickDefaultForDate(iso) {
    const day = dayVideos(iso);
    return day.find(unresolvedIssue) || day.find(v => statusOf(v) === 'todo') || day[0] || null;
  }
  function setDate(iso) {
    if (!dayHasData(iso)) return;
    state.selectedDate = iso;
    state.selectedAnnId = null;
    closeCalendar();
    const v = pickDefaultForDate(iso);
    if (v) selectVideo(v.id); else { state.selectedVideoId = null; render(); }
    renderDateBar();
  }

  function srcTag(a) {
    if (a.status === 'rejected') return '<span class="src-tag rejected">Rejected</span>';
    if (a.status === 'corrected') return '<span class="src-tag corrected">Corrected</span>';
    if (a.source === 'ai') return '<span class="src-tag ai">AI</span>';   // accepted & unreviewed both read "AI"
    return '<span class="src-tag human">You</span>';
  }
  /* neutral initials avatar — kept colourless so reviewers don't add a 5th hue */
  function avatar(user, sm) {
    return '<span class="avatar' + (sm ? ' sm' : '') + '">' + user.initials + '</span>';
  }
  /* attribution chip: who accepted / corrected / rejected this annotation */
  function reviewerChip(a) {
    if (!a.by || a.status === 'unreviewed') return '';
    if (!['accepted', 'corrected', 'rejected'].includes(a.status)) return '';
    const u = USER_BY_ID[a.by]; if (!u) return '';
    return '<span class="reviewer" title="' +
      (a.status === 'rejected' ? 'Rejected by ' : a.status === 'corrected' ? 'Corrected by ' : 'Accepted by ') +
      u.name + '">' + avatar(u, true) + '<span class="rv-name">' + u.name + '</span></span>';
  }

  function renderAnnList() {
    const v = currentVideo();
    const anns = v.annotations.slice().sort((a, b) => (a.startSec || 0) - (b.startSec || 0));
    renderAiProgress(v);

    if (!anns.length) {
      el.annList.innerHTML =
        '<div class="ann-empty">No annotations yet.<br>Press <span class="kbd kbd-amber">A</span> when an imp flies in, ' +
        'and <span class="kbd kbd-amber">A</span> again when it leaves.</div>';
      return;
    }
    el.annList.innerHTML = '';
    anns.forEach(a => {
      const t = typeOf(a.typeId), dir = DIR_BY_ID[a.direction] || {};
      const row = document.createElement('div');
      row.className = 'ann-row src-' + a.source + ' st-' + a.status + (a.id === state.selectedAnnId ? ' selected' : '');
      row.dataset.id = a.id;
      const isUnrev = a.source === 'ai' && a.status === 'unreviewed';
      const rejected = a.status === 'rejected';

      // neutral chip everywhere — direction is read from the (bold) arrow shape,
      // so the direction text is dropped from the detail line below
      const dirChip = '<div class="ann-dir" title="Flew ' + (dir.label || '') + '">' + (dir.arrow || '?') + '</div>';

      // the whole card jumps to the entry; only edit/delete/restore live here
      let actions = '';
      if (!isUnrev) {
        if (rejected) {
          // a false positive isn't editable — offer recovery (Restore) + remove
          actions = '<button class="mini-btn ok" data-act="restore" title="Restore as a real imp">↺</button>' +
            '<button class="mini-btn" data-act="del" title="Delete (Del)">🗑</button>';
        } else {
          actions = '<button class="mini-btn" data-act="edit" title="Edit (E)">✎</button>' +
            '<button class="mini-btn" data-act="del" title="Delete (Del)">🗑</button>';
        }
      }

      row.innerHTML =
        dirChip +
        '<div class="ann-main">' +
        '<div class="ann-type">' +
        '<span class="edot" style="background:' + elemColor(a.typeId) + '"></span>' +
        '<span class="nm">' + (t ? t.name : '—') + '</span>' +
        srcTag(a) +
        '</div>' +
        '<div class="ann-sub"><span class="tc">' + fmt(a.startSec) + '–' + fmt(a.endSec) + '</span>' + reviewerChip(a) + '</div>' +
        '</div>' +
        '<div class="ann-actions">' + actions + '</div>' +
        (isUnrev ?
          '<div class="ann-verify">' +
          '<button class="vbtn ok" data-act="accept" title="Accept (Y)">✓ Accept</button>' +
          '<button class="vbtn" data-act="correct" title="Correct (E)">Correct</button>' +
          '<button class="vbtn no" data-act="reject" title="Reject (N)">✕ Reject</button>' +
          '</div>' : '');
      el.annList.appendChild(row);
    });
  }

  function renderMarkers() {
    const v = currentVideo();
    el.tlTrack.querySelectorAll('.tl-marker').forEach(m => m.remove());
    if (!state.duration) return;
    v.annotations.forEach(a => {
      const left = (a.startSec || 0) / state.duration * 100;
      const w = Math.max(0.5, ((a.endSec || 0) - (a.startSec || 0)) / state.duration * 100);
      const m = document.createElement('div');
      m.className = 'tl-marker src-' + a.source + ' st-' + a.status + (a.id === state.selectedAnnId ? ' selected' : '');
      m.style.left = left + '%';
      m.style.width = w + '%';
      m.dataset.id = a.id;
      m.title = (typeOf(a.typeId) || {}).name + ' · ' + fmt(a.startSec) + ' (' + a.source + ')';
      const dir = DIR_BY_ID[a.direction] || {};
      m.innerHTML = '<span class="flag">' + (dir.arrow || '●') + '</span>';
      el.tlTrack.insertBefore(m, el.tlPlayhead);
    });
  }

  /* ============================ PLAYBACK ================================== */
  function rafLoop() {
    const dur = state.duration || el.video.duration || 0;
    const cur = el.video.currentTime || 0;
    if (dur) {
      const pct = cur / dur * 100;
      el.tlPlayhead.style.left = pct + '%';
      el.tlProgress.style.width = pct + '%';
    }
    el.curTime.textContent = fmt(cur);
    el.tlCur.textContent = fmt(cur);
    if (state.recording) {
      const s = state.recording.startSec;
      const a = Math.min(s, cur), b = Math.max(s, cur);
      el.tlRecording.style.left = (a / dur * 100) + '%';
      el.tlRecording.style.width = ((b - a) / dur * 100) + '%';
    }
    requestAnimationFrame(rafLoop);
  }

  function setPlayIcon(playing) {
    el.playIcon.innerHTML = playing
      ? '<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }
  const togglePlay = () => (el.video.paused ? el.video.play() : el.video.pause());
  const seekTo = sec => { el.video.currentTime = clamp(sec, 0, state.duration || el.video.duration || 0); };
  const seekBy = dt => seekTo((el.video.currentTime || 0) + dt);
  const frameStep = dir => { el.video.pause(); seekBy(dir * (1 / 30)); };
  function cycleSpeed() {
    state.speedIdx = (state.speedIdx + 1) % state.speeds.length;
    el.video.playbackRate = state.speeds[state.speedIdx];
    el.btnSlow.innerHTML = state.speeds[state.speedIdx] + '× speed';
  }
  function toggleMute() {
    el.video.muted = !el.video.muted;
    el.btnMute.textContent = el.video.muted ? '🔇 muted' : '🔊 sound';
  }

  /* ====================== RECORD AN ANNOTATION =========================== */
  function armToggle() {
    if (!state.timesReady) { toast({ text: 'Video still loading…' }); return; }
    if (state.recording) stopRecording();
    else startRecording();
  }
  function startRecording() {
    state.recording = { startSec: el.video.currentTime || 0 };
    el.recBadge.classList.add('on');
    el.tlRecording.classList.add('on');
    el.armPrompt.classList.add('hide');
    el.btnArm.innerHTML = '<span class="kbd kbd-amber">A</span> Mark imp exit';
    el.btnArm.classList.add('green'); el.btnArm.classList.remove('primary');
  }
  function clearRecordingUI() {
    state.recording = null;
    el.recBadge.classList.remove('on');
    el.tlRecording.classList.remove('on');
    el.btnArm.innerHTML = '<span class="kbd kbd-amber">A</span> Mark imp entry';
    el.btnArm.classList.add('primary'); el.btnArm.classList.remove('green');
  }
  function cancelRecording() {
    if (!state.recording) return;
    clearRecordingUI();
    toast({ text: 'Marking cancelled', variant: 'danger' });
  }
  function stopRecording() {
    let start = state.recording.startSec;
    let end = el.video.currentTime || 0;
    if (end < start) end = state.duration;             // playhead looped past the start
    if (end - start < 0.3) end = Math.min(start + 0.3, state.duration); // reacted too fast
    el.video.pause();
    clearRecordingUI();
    openAnnotate({ mode: 'create', startSec: start, endSec: end });
  }

  /* ============================ ANNOTATE MODAL =========================== */
  function openAnnotate(opts) {
    el.video.pause();
    state.activeModal = 'annotate';
    state.draft = {
      mode: opts.mode, annId: opts.annId || null,
      startSec: opts.startSec, endSec: opts.endSec,
      typeId: opts.typeId || null, direction: opts.direction || null,
      aiLabel: opts.aiLabel || null,
      zone: 'type', query: '', typeIndex: 0, filtered: D.IMP_TYPES,
    };
    el.anTitle.textContent =
      opts.mode === 'create' ? 'New annotation' :
        opts.mode === 'correct' ? 'Correct AI annotation' : 'Edit annotation';
    el.anSearch.value = '';
    el.anModal.classList.add('open');
    renderModal();
    setTimeout(() => { el.anSearch.focus(); }, 30);
  }
  function closeAnnotate() {
    el.anModal.classList.remove('open');
    state.activeModal = null;
    state.draft = null;
  }

  function renderModal() {
    const d = state.draft;
    el.anStart.textContent = fmtMs(d.startSec);
    el.anEnd.textContent = fmtMs(d.endSec);
    el.anDur.textContent = (d.endSec - d.startSec).toFixed(1) + 's';

    // recent quick-pick
    const rec = state.recentTypeIds.filter(id => TYPE_BY_ID[id]).slice(0, 5);
    if (!rec.length) { el.anRecent.classList.add('empty'); }
    else {
      el.anRecent.classList.remove('empty');
      el.anRecentChips.innerHTML = rec.map((id, i) => {
        const t = typeOf(id);
        return '<button class="recent-chip' + (id === d.typeId ? ' active' : '') + '" data-recent="' + id + '">' +
          '<span class="kbd num">' + (i + 1) + '</span>' +
          '<span class="edot" style="background:' + elemColor(id) + '"></span>' + t.name + '</button>';
      }).join('');
    }

    // type list (filtered)
    d.filtered = filterTypes(d.query);
    d.typeIndex = clamp(d.typeIndex, 0, Math.max(0, d.filtered.length - 1));
    if (!d.filtered.length) {
      el.anTypeList.innerHTML = '<div class="type-empty">No imp type matches “' + d.query + '”</div>';
    } else {
      el.anTypeList.innerHTML = d.filtered.map((t, i) => {
        const sel = i === d.typeIndex && d.zone === 'type';
        return '<div class="type-row' + (sel ? ' active' : '') + (t.id === d.typeId ? ' chosen' : '') + '" data-type="' + t.id + '">' +
          '<span class="edot" style="background:' + D.ELEMENTS[t.element].color + '"></span>' +
          '<span>' + t.name + '</span><span class="el">' + D.ELEMENTS[t.element].name + '</span></div>';
      }).join('');
      const active = el.anTypeList.querySelector('.type-row.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }

    // direction pad
    el.anDirpad.innerHTML = D.DIRECTIONS.map(dir =>
      '<button class="dir-cell' + (dir.id === d.direction ? ' selected' : '') + (dir.id === 'HOVER' ? ' center' : '') + '" data-dir="' + dir.id + '">' +
      '<span class="k">' + dir.key + '</span><span class="ar">' + dir.arrow + '</span>' +
      '</button>').join('');
    el.anDirLabel.innerHTML = d.direction ? 'Flew <b>' + DIR_BY_ID[d.direction].label + '</b>' : 'Pick a direction';

    // focus zone styling
    el.anSearchWrap.classList.toggle('focus', d.zone === 'type');
    el.anDirpad.classList.toggle('focus', d.zone === 'dir');

    // AI diff banner (when correcting)
    if (d.mode === 'correct' && d.aiLabel) {
      const at = typeOf(d.aiLabel.typeId), ad = DIR_BY_ID[d.aiLabel.direction] || {};
      const changed = d.typeId !== d.aiLabel.typeId || d.direction !== d.aiLabel.direction;
      el.anAiDiff.style.display = 'block';
      el.anAiDiff.innerHTML = '<b>AI originally suggested:</b> ' + (at ? at.name : '?') + ' · flew ' + (ad.label || '?') +
        (changed ? ' &nbsp;—&nbsp; your correction is kept as a training signal.' : ' &nbsp;—&nbsp; matches your pick.');
    } else {
      el.anAiDiff.style.display = 'none';
    }

    el.anCreate.disabled = !(d.typeId && d.direction);
    el.anCreate.firstChild && (el.anCreate.childNodes[0].nodeValue =
      (d.mode === 'create' ? 'Create ' : 'Save '));
  }

  function filterTypes(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return D.IMP_TYPES;
    return D.IMP_TYPES.filter(t => t.name.toLowerCase().includes(q) || t.element.includes(q));
  }
  function chooseType(id) {
    state.draft.typeId = id;
    state.draft.zone = 'dir';
    el.anSearch.blur();
    el.anDirpad.focus();
    renderModal();
  }
  function chooseDir(id) {
    state.draft.direction = id;
    renderModal();
  }
  function nudge(which, dt) {
    const d = state.draft;
    if (which === 'start') d.startSec = clamp(d.startSec + dt, 0, d.endSec - 0.1);
    else d.endSec = clamp(d.endSec + dt, d.startSec + 0.1, state.duration);
    seekTo(which === 'start' ? d.startSec : d.endSec);
    renderModal();
  }

  function commitDraft() {
    const d = state.draft, v = currentVideo();
    if (!(d.typeId && d.direction)) return;
    addRecent(d.typeId);
    if (d.mode === 'create') {
      v.annotations.push({
        id: uid(), startSec: d.startSec, endSec: d.endSec,
        typeId: d.typeId, direction: d.direction, source: 'human', status: 'added',
        aiLabel: null, by: state.currentUserId,
      });
      state.selectedAnnId = v.annotations[v.annotations.length - 1].id;
      toast({ text: 'Annotation added', variant: 'good' });
    } else {
      const a = v.annotations.find(x => x.id === d.annId);
      if (a) {
        a.startSec = d.startSec; a.endSec = d.endSec;
        a.typeId = d.typeId; a.direction = d.direction;
        if (a.source === 'ai') a.status = 'corrected';   // keep aiLabel as the original
        a.by = state.currentUserId;
        state.selectedAnnId = a.id;
      }
      toast({ text: d.mode === 'correct' ? 'AI annotation corrected' : 'Annotation updated', variant: 'good' });
    }
    closeAnnotate();
    render();
  }
  function addRecent(id) {
    state.recentTypeIds = [id].concat(state.recentTypeIds.filter(x => x !== id)).slice(0, 5);
  }

  /* ====================== AI VERIFY ACTIONS ============================== */
  function findAnn(id) { return currentVideo().annotations.find(a => a.id === id); }
  function acceptAI(id) {
    const a = findAnn(id); if (!a) return;
    a.status = 'accepted'; a.by = state.currentUserId; addRecent(a.typeId);
    toast({ text: 'AI annotation accepted', variant: 'good' });
    render();
  }
  function rejectAI(id) {
    const a = findAnn(id); if (!a) return;
    a.status = 'rejected'; a.by = state.currentUserId;
    toast({ text: 'Marked false positive — kept as a training signal', variant: 'danger' });
    render();
  }
  function restoreAnn(id) {
    const a = findAnn(id); if (!a) return;
    if (a.source === 'ai') { a.status = 'unreviewed'; a.by = null; }
    else a.status = 'added';
    render();
  }
  function editAnn(id) {
    const a = findAnn(id); if (!a) return;
    selectAnn(id);
    openAnnotate({
      mode: a.source === 'ai' ? 'correct' : 'edit', annId: a.id,
      startSec: a.startSec, endSec: a.endSec, typeId: a.typeId, direction: a.direction,
      aiLabel: a.aiLabel,
    });
  }
  function deleteAnn(id) {
    const v = currentVideo();
    const idx = v.annotations.findIndex(a => a.id === id);
    if (idx < 0) return;
    const removed = v.annotations.splice(idx, 1)[0];
    if (state.selectedAnnId === id) state.selectedAnnId = null;
    render();
    toast({
      text: 'Annotation deleted', variant: 'danger', persist: true, actionLabel: 'Undo',
      onAction: () => { v.annotations.splice(Math.min(idx, v.annotations.length), 0, removed); clearToast(); render(); },
    });
  }

  function selectAnn(id) {
    state.selectedAnnId = id;
    renderAnnList(); renderMarkers();
    const row = el.annList.querySelector('.ann-row[data-id="' + id + '"]');
    if (row) row.scrollIntoView({ block: 'nearest' });
  }
  function jumpToAnn(id) {
    const a = findAnn(id); if (!a) return;
    selectAnn(id); seekTo(a.startSec);
  }
  function cycleMarker(dir) {
    const v = currentVideo();
    const anns = v.annotations.slice().sort((a, b) => a.startSec - b.startSec);
    if (!anns.length) return;
    let i = anns.findIndex(a => a.id === state.selectedAnnId);
    i = i < 0 ? (dir > 0 ? 0 : anns.length - 1) : (i + dir + anns.length) % anns.length;
    jumpToAnn(anns[i].id);
  }

  /* ====================== VIDEO / STATUS ACTIONS ========================= */
  function selectVideo(id) {
    if (state.recording) cancelRecording();
    state.selectedVideoId = id;
    state.selectedAnnId = null;
    el.video.currentTime = 0;
    el.video.play().catch(() => { });
    render();
  }
  function toggleFlag() {
    const v = currentVideo();
    v.flagged = !v.flagged;
    toast({ text: v.flagged ? 'Recording flagged as an issue' : 'Flag cleared', variant: v.flagged ? 'danger' : 'good' });
    render();
  }

  /* ============================ USER MENU ================================ */
  function renderUser() {
    const u = USER_BY_ID[state.currentUserId];
    el.userAvatar.textContent = u.initials;
    el.userName.textContent = u.name;
    el.userDropdown.innerHTML =
      '<div class="ud-head">Reviewing as</div>' +
      D.USERS.map(x =>
        '<button class="user-item' + (x.id === state.currentUserId ? ' current' : '') + '" data-user="' + x.id + '">' +
        avatar(x) +
        '<span class="ui-meta"><span class="ui-name">' + x.name + '</span><span class="ui-role">' + x.role + '</span></span>' +
        (x.id === state.currentUserId ? '<span class="ui-check">✓</span>' : '') +
        '</button>').join('');
  }
  function openUserMenu() { state.userMenuOpen = true; el.userDropdown.classList.add('open'); }
  function closeUserMenu() { state.userMenuOpen = false; el.userDropdown.classList.remove('open'); }
  function selectUser(id) {
    state.currentUserId = id;
    closeUserMenu(); renderUser();
    toast({ text: 'Now reviewing as ' + USER_BY_ID[id].name });
  }

  /* ============================ SHORTCUTS MODAL ========================== */
  const SHORTCUTS = [
    ['Playback', [
      ['Play / pause', ['Space']], ['Seek ±5s', ['←', '→']],
      ['Step one frame', [',', '.']], ['Cycle playback speed', ['speed btn']],
    ]],
    ['Annotating', [
      ['Mark imp entry, then exit', ['A']], ['Cancel current marking', ['Esc']],
      ['Open type + direction', ['(auto on exit)']],
    ]],
    ['In the annotate dialog', [
      ['Filter imp types', ['type…']], ['Move through list', ['↑', '↓']],
      ['Quick-pick a recent type', ['1', '–', '5']], ['Choose / confirm', ['↵']],
      ['Set direction', ['Q', 'W', 'E', 'A', 'S', 'D', 'Z', 'X', 'C']],
      ['Switch type / direction', ['Tab']], ['Close', ['Esc']],
    ]],
    ['Annotations', [
      ['Cycle markers + jump', ['[', ']']], ['Jump to selected', ['↵']],
      ['Accept AI suggestion', ['Y']], ['Reject AI (false positive)', ['N']],
      ['Edit / correct selected', ['E']], ['Delete selected', ['Del']],
    ]],
    ['General', [
      ['Find an imp type', ['/']], ['This help', ['?']],
    ]],
  ];
  function buildShortcuts() {
    el.scGrid.innerHTML = SHORTCUTS.map(sec =>
      '<h3>' + sec[0] + '</h3>' + sec[1].map(row =>
        '<div class="sc-row"><span class="desc">' + row[0] + '</span><span class="keys">' +
        row[1].map(k => k.length > 2 ? '<span class="hint">' + k + '</span>' : '<span class="kbd">' + k + '</span>').join('') +
        '</span></div>').join('')
    ).join('');
  }
  const openShortcuts = () => { state.activeModal = 'shortcuts'; el.scModal.classList.add('open'); };
  const closeShortcuts = () => { state.activeModal = null; el.scModal.classList.remove('open'); };

  /* ============================== TOAST ================================== */
  let toastEl = null;
  function clearToast() { if (toastEl) { toastEl.remove(); toastEl = null; } }
  function toast(opts) {
    clearToast();
    const t = document.createElement('div');
    t.className = 'toast' + (opts.variant ? ' ' + opts.variant : '');
    t.innerHTML = '<span>' + opts.text + '</span>';
    if (opts.actionLabel) {
      const b = document.createElement('button');
      b.className = 'toast-btn'; b.textContent = opts.actionLabel;
      b.onclick = opts.onAction; t.appendChild(b);
    }
    if (opts.persist) {
      const x = document.createElement('button');
      x.className = 'toast-btn'; x.style.color = 'var(--muted)'; x.textContent = '✕';
      x.onclick = clearToast; t.appendChild(x);
    }
    el.toastWrap.appendChild(t); toastEl = t;
    if (!opts.persist) setTimeout(() => { if (toastEl === t) clearToast(); }, opts.timeout || 3800);
  }

  /* ============================ KEYBOARD ================================= */
  function onKeyDown(e) {
    if (state.activeModal === 'annotate') return onAnnotateKey(e);
    if (state.activeModal === 'shortcuts') {
      if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); closeShortcuts(); }
      return;
    }
    if (state.userMenuOpen && e.key === 'Escape') { e.preventDefault(); closeUserMenu(); return; }
    if (state.calendarOpen && e.key === 'Escape') { e.preventDefault(); closeCalendar(); return; }
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      if (ae === el.recordSearch) onSearchKey(e);
      return;
    }

    switch (e.key) {
      case ' ': case 'Spacebar': e.preventDefault(); togglePlay(); break;
      case 'a': case 'A': e.preventDefault(); armToggle(); break;
      case 'ArrowLeft': e.preventDefault(); seekBy(-5); break;
      case 'ArrowRight': e.preventDefault(); seekBy(5); break;
      case ',': e.preventDefault(); frameStep(-1); break;
      case '.': e.preventDefault(); frameStep(1); break;
      case '[': e.preventDefault(); cycleMarker(-1); break;
      case ']': e.preventDefault(); cycleMarker(1); break;
      case 'Enter': if (state.selectedAnnId) { e.preventDefault(); jumpToAnn(state.selectedAnnId); } break;
      case 'y': case 'Y': verifyKey('accept'); break;
      case 'n': case 'N': verifyKey('reject'); break;
      case 'e': case 'E': if (state.selectedAnnId) { e.preventDefault(); editAnn(state.selectedAnnId); } break;
      case 'Delete': case 'Backspace': if (state.selectedAnnId) { e.preventDefault(); deleteAnn(state.selectedAnnId); } break;
      case 'Escape': if (state.recording) cancelRecording(); else if (state.selectedAnnId) { state.selectedAnnId = null; render(); } break;
      case '/': e.preventDefault(); el.recordSearch.focus(); break;
      case '?': e.preventDefault(); openShortcuts(); break;
    }
  }
  function verifyKey(act) {
    const a = state.selectedAnnId && findAnn(state.selectedAnnId);
    if (a && a.source === 'ai' && a.status === 'unreviewed') {
      act === 'accept' ? acceptAI(a.id) : rejectAI(a.id);
    }
  }

  function onAnnotateKey(e) {
    const d = state.draft;
    if (e.key === 'Escape') { e.preventDefault(); closeAnnotate(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      d.zone = d.zone === 'type' ? 'dir' : 'type';
      if (d.zone === 'type') el.anSearch.focus(); else { el.anSearch.blur(); el.anDirpad.focus(); }
      renderModal();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (d.typeId && d.direction) { commitDraft(); return; }
      if (d.zone === 'type' && d.filtered.length) chooseType(d.filtered[d.typeIndex].id);
      return;
    }

    if (d.zone === 'type') {
      if (e.key === 'ArrowDown') { e.preventDefault(); d.typeIndex = Math.min(d.typeIndex + 1, d.filtered.length - 1); renderModal(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); d.typeIndex = Math.max(d.typeIndex - 1, 0); renderModal(); return; }
      if (el.anSearch.value === '' && /^[1-5]$/.test(e.key)) {
        const id = state.recentTypeIds[+e.key - 1];
        if (id) { e.preventDefault(); chooseType(id); }
        return;
      }
      return; // let other keys type into the search field
    }

    // direction zone
    if (e.key === 'Backspace') { e.preventDefault(); d.zone = 'type'; el.anSearch.focus(); renderModal(); return; }
    const k = e.key.toUpperCase();
    if (DIR_BY_KEY[k]) { e.preventDefault(); chooseDir(DIR_BY_KEY[k]); return; }
    if (DIR_BY_NUM[e.key]) { e.preventDefault(); chooseDir(DIR_BY_NUM[e.key]); return; }
    if (ARROW_DIR[e.key]) { e.preventDefault(); chooseDir(ARROW_DIR[e.key]); return; }
    if (e.key === ' ') { e.preventDefault(); chooseDir('HOVER'); return; }
  }

  /* ===================== FIND BY IMP TYPE (header search) =============== */
  function whenLabel(iso) {
    return iso === D.TODAY_ISO ? 'Today' : MONTHS_SHORT[+iso.slice(5, 7) - 1] + ' ' + (+iso.slice(8, 10));
  }
  function renderSearch() {
    const q = el.recordSearch.value.trim().toLowerCase();
    if (!q) { closeSearch(); return; }
    const matchIds = new Set(D.IMP_TYPES
      .filter(t => t.name.toLowerCase().includes(q) || t.element.includes(q))
      .map(t => t.id));

    // recordings (across every day) that contain a matching imp type
    const results = [];
    D.VIDEOS.forEach(v => {
      const hits = v.annotations.filter(a => matchIds.has(a.typeId));
      if (hits.length) results.push({ v: v, hits: hits });
    });
    results.sort((a, b) => a.v.date === b.v.date ? (a.v.slot < b.v.slot ? -1 : 1) : (a.v.date < b.v.date ? 1 : -1));

    state.searchOpen = true;
    state.searchIndex = 0;
    el.searchResults.classList.add('open');

    if (!results.length) {
      el.searchResults.innerHTML = '<div class="sr-empty">No imps tagged that match “' + q + '”.</div>';
      return;
    }
    const totalHits = results.reduce((s, r) => s + r.hits.length, 0);
    let html = '<div class="sr-head">' + totalHits + ' tagged in ' + results.length + ' recording' + (results.length === 1 ? '' : 's') + '</div>';
    html += results.map(r => {
      const names = [...new Set(r.hits.map(h => (typeOf(h.typeId) || {}).name))];
      const summary = names.length === 1 ? names[0] : names.slice(0, 2).join(', ') + (names.length > 2 ? ' +' + (names.length - 2) : '');
      const unrev = r.hits.filter(h => h.status === 'unreviewed').length;
      const st = statusOf(r.v);
      return '<button class="sr-row" data-vid="' + r.v.id + '" data-ann="' + r.hits[0].id + '">' +
        '<span class="sr-status" style="color:' + (st === 'issue' ? 'var(--red)' : st === 'done' ? 'var(--green)' : '#8693a4') + '">' + STATUS_GLYPH[st] + '</span>' +
        '<span class="sr-when">' + whenLabel(r.v.date) + ' · ' + r.v.slot + '</span>' +
        '<span class="sr-types">' + summary + '</span>' +
        '<span class="sr-count' + (unrev ? ' unv' : '') + '"' + (unrev ? ' title="' + unrev + ' still to verify"' : '') + '>×' + r.hits.length + '</span>' +
        '</button>';
    }).join('');
    el.searchResults.innerHTML = html;
    highlightSearch();
  }
  function highlightSearch() {
    const rows = el.searchResults.querySelectorAll('.sr-row');
    rows.forEach((r, i) => r.classList.toggle('active', i === state.searchIndex));
    const active = rows[state.searchIndex];
    if (active) active.scrollIntoView({ block: 'nearest' });
  }
  function closeSearch() { state.searchOpen = false; el.searchResults.classList.remove('open'); el.searchResults.innerHTML = ''; }
  function goToResult(vid, annId) {
    const v = D.VIDEOS.find(x => x.id === vid); if (!v) return;
    state.selectedDate = v.date;
    const p = v.date.split('-').map(Number); state.calMonth = { y: p[0], m: p[1] - 1 };
    state.queueFilter = 'all';            // ensure the recording shows in the queue
    selectVideo(vid);                     // selects + plays + renders (clears selectedAnnId)
    const a = annId && v.annotations.find(x => x.id === annId);
    if (a) { state.selectedAnnId = annId; seekTo(a.startSec); renderAnnList(); renderMarkers(); }
    renderDateBar();
    el.recordSearch.value = ''; el.recordSearch.blur(); closeSearch();
  }
  function onSearchKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); el.recordSearch.value = ''; closeSearch(); el.recordSearch.blur(); return; }
    if (!state.searchOpen) return;
    const rows = el.searchResults.querySelectorAll('.sr-row');
    if (!rows.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); state.searchIndex = Math.min(state.searchIndex + 1, rows.length - 1); highlightSearch(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); state.searchIndex = Math.max(state.searchIndex - 1, 0); highlightSearch(); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = rows[state.searchIndex]; if (r) goToResult(r.dataset.vid, r.dataset.ann); }
  }

  /* ============================ SIZE GUARD =============================== */
  function checkSize() {
    document.body.classList.toggle('too-small', window.innerWidth < 1180 || window.innerHeight < 640);
  }

  /* ============================ WIRING =================================== */
  function wire() {
    // transport
    el.btnPlay.onclick = togglePlay;
    el.btnBack.onclick = () => seekBy(-5);
    el.btnFwd.onclick = () => seekBy(5);
    el.btnSlow.onclick = cycleSpeed;
    el.btnStep.onclick = () => frameStep(1);
    el.btnMute.onclick = toggleMute;
    el.btnArm.onclick = armToggle;
    el.btnFlag.onclick = toggleFlag;

    el.video.addEventListener('play', () => setPlayIcon(true));
    el.video.addEventListener('pause', () => setPlayIcon(false));
    el.video.addEventListener('loadedmetadata', () => {
      state.duration = el.video.duration || 0;
      el.durTime.textContent = fmt(state.duration);
      el.tlDur.textContent = fmt(state.duration);
      initTimes();
      render();
      el.video.play().catch(() => { });
      setTimeout(() => el.armPrompt.classList.add('hide'), 6000);
    });
    el.video.addEventListener('error', () => { el.empty.style.display = 'grid'; });

    // timeline: click track to seek, click marker to jump
    el.tlTrack.addEventListener('click', e => {
      const m = e.target.closest('.tl-marker');
      if (m) { jumpToAnn(m.dataset.id); return; }
      const r = el.tlTrack.getBoundingClientRect();
      seekTo((e.clientX - r.left) / r.width * state.duration);
    });

    // queue
    el.queueGrid.addEventListener('click', e => {
      const c = e.target.closest('.qcell'); if (c) selectVideo(c.dataset.id);
    });

    // annotation list (event delegation)
    el.annList.addEventListener('click', e => {
      const row = e.target.closest('.ann-row'); if (!row) return;
      const id = row.dataset.id;
      const btn = e.target.closest('[data-act]');
      if (!btn) { jumpToAnn(id); return; }   // the whole card is the jump target
      switch (btn.dataset.act) {
        case 'edit': editAnn(id); break;
        case 'del': deleteAnn(id); break;
        case 'accept': acceptAI(id); break;
        case 'reject': rejectAI(id); break;
        case 'correct': editAnn(id); break;
        case 'restore': restoreAnn(id); break;
      }
    });

    // date picker
    el.dateBtn.onclick = e => { e.stopPropagation(); state.calendarOpen ? closeCalendar() : openCalendar(); };
    el.calendar.addEventListener('click', e => {
      e.stopPropagation();
      const nav = e.target.closest('[data-cal]'); if (nav) { shiftCalMonth(nav.dataset.cal === 'next' ? 1 : -1); return; }
      const cell = e.target.closest('[data-date]'); if (cell && !cell.disabled) setDate(cell.dataset.date);
    });

    // queue filters (mutually exclusive; click an active one to clear back to all)
    el.todoToggle.onclick = () => { state.queueFilter = state.queueFilter === 'todo' ? 'all' : 'todo'; renderQueue(); };
    el.issuesToggle.onclick = () => { state.queueFilter = state.queueFilter === 'issue' ? 'all' : 'issue'; renderQueue(); };

    // header search: find recordings by imp type
    el.recordSearch.addEventListener('input', renderSearch);
    el.recordSearch.addEventListener('focus', () => { if (el.recordSearch.value.trim()) renderSearch(); });
    el.searchResults.addEventListener('click', e => {
      const r = e.target.closest('.sr-row'); if (r) goToResult(r.dataset.vid, r.dataset.ann);
    });

    // shortcuts modal
    el.btnShortcuts.onclick = openShortcuts;
    el.scClose.onclick = closeShortcuts;
    el.scModal.addEventListener('click', e => { if (e.target === el.scModal) closeShortcuts(); });

    // user menu
    el.userBtn.onclick = e => { e.stopPropagation(); state.userMenuOpen ? closeUserMenu() : openUserMenu(); };
    el.userDropdown.addEventListener('click', e => {
      const it = e.target.closest('[data-user]'); if (it) selectUser(it.dataset.user);
    });
    document.addEventListener('click', e => {
      if (state.userMenuOpen && !e.target.closest('.user-menu')) closeUserMenu();
      if (state.calendarOpen && !e.target.closest('.date-bar')) closeCalendar();
      if (state.searchOpen && !e.target.closest('.search-wrap')) closeSearch();
    });

    // annotate modal interactions
    el.anClose.onclick = closeAnnotate;
    el.anCancel.onclick = closeAnnotate;
    el.anCreate.onclick = commitDraft;
    el.anModal.addEventListener('click', e => { if (e.target === el.anModal) closeAnnotate(); });
    el.anSearch.addEventListener('input', () => {
      state.draft.query = el.anSearch.value; state.draft.typeIndex = 0; renderModal();
    });
    el.anTypeList.addEventListener('click', e => {
      const r = e.target.closest('.type-row'); if (r) chooseType(r.dataset.type);
    });
    el.anRecentChips.addEventListener('click', e => {
      const c = e.target.closest('[data-recent]'); if (c) chooseType(c.dataset.recent);
    });
    el.anDirpad.addEventListener('click', e => {
      const c = e.target.closest('[data-dir]'); if (c) chooseDir(c.dataset.dir);
    });
    el.anModal.querySelectorAll('[data-nudge]').forEach(b =>
      b.onclick = () => nudge(b.dataset.nudge, parseFloat(b.dataset.dt)));

    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', checkSize);
  }

  /* ============================== BOOT ================================== */
  function boot() {
    normalizeSeedStatuses();
    buildShortcuts();
    checkSize();
    const p = state.selectedDate.split('-').map(Number);
    state.calMonth = { y: p[0], m: p[1] - 1 };
    const def = pickDefaultForDate(state.selectedDate);
    state.selectedVideoId = def ? def.id : (D.VIDEOS[0] || {}).id;
    el.video.muted = true;
    el.video.loop = true;
    el.anDirpad.tabIndex = 0;
    el.video.src = currentVideo().src;
    wire();
    renderUser();
    renderDateBar();
    render();
    requestAnimationFrame(rafLoop);
  }
  boot();
})();
