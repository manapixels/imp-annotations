/* =============================================================================
   app.js — Annotate Imps reviewer console (vanilla JS, no build step).
   ========================================================================== */
(function () {
  'use strict';

  const D = window.DEMO;
  const TYPE_BY_ID = Object.fromEntries(D.IMP_TYPES.map(t => [t.id, t]));
  const DIR_BY_ID  = Object.fromEntries(D.DIRECTIONS.map(d => [d.id, d]));
  const DIR_BY_KEY = Object.fromEntries(D.DIRECTIONS.map(d => [d.key, d.id]));
  const DIR_BY_NUM = Object.fromEntries(D.DIRECTIONS.map(d => [d.num, d.id]));
  const ARROW_DIR  = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E' };

  const $ = id => document.getElementById(id);
  const el = {
    video: $('video'), wrap: $('videoWrap'), empty: $('videoEmpty'),
    recBadge: $('recBadge'), armPrompt: $('armPrompt'), keyhints: $('stageKeyhints'),
    vidId: $('vidId'), vidSlot: $('vidSlot'), vidStatus: $('vidStatus'),
    aiProgress: $('aiProgress'), btnFlag: $('btnFlag'), btnDone: $('btnDone'),
    tlTrack: $('tlTrack'), tlProgress: $('tlProgress'), tlPlayhead: $('tlPlayhead'),
    tlRecording: $('tlRecording'), tlCur: $('tlCur'), tlDur: $('tlDur'),
    btnPlay: $('btnPlay'), playIcon: $('playIcon'), curTime: $('curTime'), durTime: $('durTime'),
    btnBack: $('btnBack'), btnFwd: $('btnFwd'), btnSlow: $('btnSlow'), btnStep: $('btnStep'),
    btnMute: $('btnMute'), btnArm: $('btnArm'),
    queueGrid: $('queueGrid'), queueCount: $('queueCount'),
    annList: $('annList'), annCount: $('annCount'),
    dateLabel: $('dateLabel'), datePrev: $('datePrev'), dateNext: $('dateNext'),
    recordSearch: $('recordSearch'),
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
  };

  const state = {
    selectedVideoId: D.DEFAULT_VIDEO_ID,
    selectedAnnId: null,
    duration: 0,
    timesReady: false,
    recording: null,                          // { startSec }
    recentTypeIds: ['fire-dragon', 'water-penguin'],
    activeModal: null,                        // 'annotate' | 'shortcuts'
    draft: null,                              // annotation being created / edited
    armHintHidden: false,
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

  /* Derive the display status (priority: issue > deferred > done > derived). */
  function statusOf(v) {
    if (v.flagged) return 'issue';
    if (v.deferred) return 'deferred';
    if (v.reviewed) return 'done';
    const unrev = v.annotations.some(a => a.source === 'ai' && a.status === 'unreviewed');
    if (unrev) return 'needs_review';
    if (v.annotations.length) return 'in_progress';
    return 'unannotated';
  }
  const STATUS_LABEL = {
    issue: 'Issue', deferred: 'Deferred', done: 'Reviewed',
    needs_review: 'AI to verify', in_progress: 'In progress', unannotated: 'Not annotated',
  };
  const unreviewedAI = v => v.annotations.filter(a => a.source === 'ai' && a.status === 'unreviewed');
  const allAI        = v => v.annotations.filter(a => a.source === 'ai');

  /* Convert seed fractions -> seconds once we know the real clip duration. */
  function initTimes() {
    if (state.timesReady) return;
    D.VIDEOS.forEach(v => v.annotations.forEach(a => {
      if (a.startSec == null) { a.startSec = (a.f0 || 0) * state.duration; }
      if (a.endSec == null)   { a.endSec   = (a.f1 || 0) * state.duration; }
    }));
    state.timesReady = true;
  }

  /* Translate seed statuses into the boolean flags statusOf() expects. */
  function normalizeSeedStatuses() {
    D.VIDEOS.forEach(v => {
      if (v.status === 'issue')    v.flagged = true;
      if (v.status === 'deferred') v.deferred = true;
      if (v.status === 'done')     v.reviewed = true;
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
    el.vidSlot.innerHTML = '<b>' + v.slot + '</b> · ' + v.durationLabel + ' recording';
    el.vidStatus.className = 'status-chip s-' + st;
    el.vidStatus.textContent = STATUS_LABEL[st];

    const ai = allAI(v), left = unreviewedAI(v).length;
    if (ai.length) {
      const done = ai.length - left;
      el.aiProgress.innerHTML =
        '<span>Verify AI&nbsp;&nbsp;<b style="color:var(--txt)">' + done + '/' + ai.length + '</b></span>' +
        '<span class="bar"><i style="width:' + (done / ai.length * 100) + '%"></i></span>';
    } else {
      el.aiProgress.innerHTML = '<span>No AI pre-pass — annotate from scratch</span>';
    }

    el.btnFlag.textContent = v.flagged ? '⚑ Flagged' : '⚑ Flag';
    el.btnFlag.classList.toggle('danger', v.flagged);

    el.btnDone.textContent = v.reviewed ? '✓ Reviewed' : 'Mark reviewed';
    el.btnDone.disabled = left > 0;
    el.btnDone.title = left > 0 ? 'Verify all ' + left + ' AI annotation(s) first' : 'Confirm the clip is fully reviewed';
  }

  function renderQueue() {
    const done = D.VIDEOS.filter(v => statusOf(v) === 'done').length;
    el.queueCount.textContent = done + ' / ' + D.VIDEOS.length + ' done';
    el.queueGrid.innerHTML = '';
    D.VIDEOS.forEach(v => {
      const st = statusOf(v);
      const c = document.createElement('button');
      c.className = 'qcell q-' + st + (v.id === state.selectedVideoId ? ' selected' : '');
      c.dataset.id = v.id;
      const n = v.annotations.length, left = unreviewedAI(v).length;
      let meta = n ? (n + ' imp' + (n > 1 ? 's' : '')) : 'empty';
      if (left) meta = left + ' to verify';
      if (st === 'deferred') meta = 'snoozed';
      if (st === 'issue') meta = 'flagged';
      c.innerHTML =
        '<span class="qdot"></span>' +
        '<span class="qtime">' + v.slot + '</span>' +
        '<span class="qmeta">' + meta + '</span>';
      c.title = v.id + ' · ' + STATUS_LABEL[st];
      el.queueGrid.appendChild(c);
    });
  }

  function srcTag(a) {
    if (a.status === 'rejected')  return '<span class="src-tag rejected">False positive</span>';
    if (a.status === 'corrected') return '<span class="src-tag corrected">Corrected</span>';
    if (a.source === 'ai' && a.status === 'accepted') return '<span class="src-tag human">AI · kept</span>';
    if (a.source === 'ai') return '<span class="src-tag ai">AI</span>';
    return '<span class="src-tag human">You</span>';
  }

  function renderAnnList() {
    const v = currentVideo();
    const anns = v.annotations.slice().sort((a, b) => (a.startSec || 0) - (b.startSec || 0));
    const left = unreviewedAI(v).length;
    el.annCount.textContent = anns.length + (left ? ' · ' + left + ' to verify' : '');

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
      row.innerHTML =
        '<div class="ann-dir" style="background:' + (a.status === 'rejected' ? '#3a3030' : elemColor(a.typeId)) + '">' + (dir.arrow || '?') + '</div>' +
        '<div class="ann-main">' +
          '<div class="ann-type"><span class="edot" style="background:' + elemColor(a.typeId) + '"></span>' + (t ? t.name : '—') + '</div>' +
          '<div class="ann-sub"><span class="tc">' + fmt(a.startSec) + '–' + fmt(a.endSec) + '</span> · ' + (dir.label || '') + ' ' + srcTag(a) + '</div>' +
        '</div>' +
        '<div class="ann-actions">' +
          '<button class="ann-jump" data-act="jump" title="Jump to entry">◎</button>' +
          (isUnrev ? '' :
            '<button class="mini-btn" data-act="edit" title="Edit (E)">✎</button>' +
            '<button class="mini-btn" data-act="del" title="Delete (Del)">🗑</button>') +
          (a.status === 'rejected' ? '<button class="mini-btn ok" data-act="restore" title="Restore">↺</button>' : '') +
        '</div>' +
        (isUnrev ?
          '<div class="ann-verify">' +
            '<span class="lbl">AI says this is real — verify:</span>' +
            '<button class="mini-btn ok" data-act="accept" title="Accept (Y)">✓ Accept</button>' +
            '<button class="btn ghost" data-act="correct" title="Correct (E)">Correct</button>' +
            '<button class="mini-btn no" data-act="reject" title="Reject (N)">✕ Reject</button>' +
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
        typeId: d.typeId, direction: d.direction, source: 'human', status: 'added', aiLabel: null,
      });
      state.selectedAnnId = v.annotations[v.annotations.length - 1].id;
      toast({ text: 'Annotation added', variant: 'good' });
    } else {
      const a = v.annotations.find(x => x.id === d.annId);
      if (a) {
        a.startSec = d.startSec; a.endSec = d.endSec;
        a.typeId = d.typeId; a.direction = d.direction;
        if (a.source === 'ai') a.status = 'corrected';   // keep aiLabel as the original
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
    a.status = 'accepted'; addRecent(a.typeId);
    toast({ text: 'AI annotation accepted', variant: 'good' });
    render();
  }
  function rejectAI(id) {
    const a = findAnn(id); if (!a) return;
    a.status = 'rejected';
    toast({ text: 'Marked false positive — kept as a training signal', variant: 'danger' });
    render();
  }
  function restoreAnn(id) {
    const a = findAnn(id); if (!a) return;
    a.status = a.source === 'ai' ? 'unreviewed' : 'added';
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
    el.video.play().catch(() => {});
    render();
  }
  function toggleFlag() {
    const v = currentVideo();
    v.flagged = !v.flagged;
    toast({ text: v.flagged ? 'Recording flagged as an issue' : 'Flag cleared', variant: v.flagged ? 'danger' : 'good' });
    render();
  }
  function markReviewed() {
    const v = currentVideo();
    if (unreviewedAI(v).length) return;
    if (v.reviewed) {            // toggle back to editing
      v.reviewed = false; render(); return;
    }
    toast({
      text: 'Confirm you watched the full clip and no imps were missed?',
      persist: true, actionLabel: 'Confirm reviewed',
      onAction: () => { v.reviewed = true; v.deferred = false; clearToast(); toast({ text: 'Recording marked reviewed ✓', variant: 'good' }); render(); },
    });
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
      ['Focus record search', ['/']], ['This help', ['?']],
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
    if (state.activeModal === 'annotate')  return onAnnotateKey(e);
    if (state.activeModal === 'shortcuts') {
      if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); closeShortcuts(); }
      return;
    }
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      if (ae === el.recordSearch) {
        if (e.key === 'Enter') doRecordJump();
        if (e.key === 'Escape') ae.blur();
      }
      return;
    }

    switch (e.key) {
      case ' ': case 'Spacebar': e.preventDefault(); togglePlay(); break;
      case 'a': case 'A': e.preventDefault(); armToggle(); break;
      case 'ArrowLeft':  e.preventDefault(); seekBy(-5); break;
      case 'ArrowRight': e.preventDefault(); seekBy(5);  break;
      case ',': e.preventDefault(); frameStep(-1); break;
      case '.': e.preventDefault(); frameStep(1);  break;
      case '[': e.preventDefault(); cycleMarker(-1); break;
      case ']': e.preventDefault(); cycleMarker(1);  break;
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
      if (e.key === 'ArrowUp')   { e.preventDefault(); d.typeIndex = Math.max(d.typeIndex - 1, 0); renderModal(); return; }
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
    if (DIR_BY_KEY[k])      { e.preventDefault(); chooseDir(DIR_BY_KEY[k]); return; }
    if (DIR_BY_NUM[e.key])  { e.preventDefault(); chooseDir(DIR_BY_NUM[e.key]); return; }
    if (ARROW_DIR[e.key])   { e.preventDefault(); chooseDir(ARROW_DIR[e.key]); return; }
    if (e.key === ' ')      { e.preventDefault(); chooseDir('HOVER'); return; }
  }

  /* ============================ SEARCH JUMP ============================== */
  function doRecordJump() {
    const q = el.recordSearch.value.trim().toLowerCase();
    if (!q) return;
    const v = D.VIDEOS.find(x => x.id.toLowerCase().includes(q) || x.slot.includes(q));
    if (v) { selectVideo(v.id); el.recordSearch.blur(); el.recordSearch.value = ''; }
    else toast({ text: 'No recording matches “' + q + '”', variant: 'danger' });
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
    el.btnFwd.onclick  = () => seekBy(5);
    el.btnSlow.onclick = cycleSpeed;
    el.btnStep.onclick = () => frameStep(1);
    el.btnMute.onclick = toggleMute;
    el.btnArm.onclick  = armToggle;
    el.btnFlag.onclick = toggleFlag;
    el.btnDone.onclick = markReviewed;

    el.video.addEventListener('play',  () => setPlayIcon(true));
    el.video.addEventListener('pause', () => setPlayIcon(false));
    el.video.addEventListener('loadedmetadata', () => {
      state.duration = el.video.duration || 0;
      el.durTime.textContent = fmt(state.duration);
      el.tlDur.textContent = fmt(state.duration);
      initTimes();
      render();
      el.video.play().catch(() => {});
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
      if (!btn) { selectAnn(id); return; }
      switch (btn.dataset.act) {
        case 'jump':    jumpToAnn(id); break;
        case 'edit':    editAnn(id); break;
        case 'del':     deleteAnn(id); break;
        case 'accept':  acceptAI(id); break;
        case 'reject':  rejectAI(id); break;
        case 'correct': editAnn(id); break;
        case 'restore': restoreAnn(id); break;
      }
    });

    // date nav (demo has one date)
    const noDate = () => toast({ text: 'This demo only includes 18 Jun 2026' });
    el.datePrev.onclick = noDate; el.dateNext.onclick = noDate;

    // shortcuts modal
    el.btnShortcuts.onclick = openShortcuts;
    el.scClose.onclick = closeShortcuts;
    el.scModal.addEventListener('click', e => { if (e.target === el.scModal) closeShortcuts(); });

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
    el.video.muted = true;
    el.video.loop = true;
    el.anDirpad.tabIndex = 0;
    el.video.src = currentVideo().src;
    wire();
    render();
    requestAnimationFrame(rafLoop);
  }
  boot();
})();
