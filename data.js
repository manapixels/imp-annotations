/* =============================================================================
   data.js — Dummy data for the Annotate Imps demo.
   Everything here is fake. There is no real model: "AI" annotations are just
   pre-seeded objects with source:"ai" that a reviewer accepts / corrects /
   rejects, simulating the dual-input training-data workflow.
   ========================================================================== */

/* Imp elements — each drives an accent colour used on chips & timeline markers. */
const ELEMENTS = {
  fire:   { name: 'Fire',   color: '#ff7a45' },
  water:  { name: 'Water',  color: '#3da9ff' },
  earth:  { name: 'Earth',  color: '#d2a24b' },
  air:    { name: 'Air',    color: '#7fe3d4' },
  shadow: { name: 'Shadow', color: '#a99bff' },
  spark:  { name: 'Spark',  color: '#ffd23d' },
};

/* 22 imp types (the modal advertises "22 imp types"). */
const IMP_TYPES = [
  { id: 'fire-dragon',    name: 'Fire Dragon Imp',    element: 'fire'   },
  { id: 'fire-bazooka',   name: 'Fire Bazooka Imp',   element: 'fire'   },
  { id: 'fire-thrasher',  name: 'Fire Thrasher Imp',  element: 'fire'   },
  { id: 'fire-tortoise',  name: 'Fire Tortoise Imp',  element: 'fire'   },
  { id: 'fire-phoenix',   name: 'Fire Phoenix Imp',   element: 'fire'   },
  { id: 'water-penguin',  name: 'Water Penguin Imp',  element: 'water'  },
  { id: 'water-serpent',  name: 'Water Serpent Imp',  element: 'water'  },
  { id: 'water-jelly',    name: 'Water Jelly Imp',    element: 'water'  },
  { id: 'water-kraken',   name: 'Water Kraken Imp',   element: 'water'  },
  { id: 'earth-golem',    name: 'Earth Golem Imp',    element: 'earth'  },
  { id: 'earth-mole',     name: 'Earth Mole Imp',     element: 'earth'  },
  { id: 'earth-boulder',  name: 'Earth Boulder Imp',  element: 'earth'  },
  { id: 'earth-beetle',   name: 'Earth Beetle Imp',   element: 'earth'  },
  { id: 'air-falcon',     name: 'Air Falcon Imp',     element: 'air'    },
  { id: 'air-wisp',       name: 'Air Wisp Imp',       element: 'air'    },
  { id: 'air-cyclone',    name: 'Air Cyclone Imp',    element: 'air'    },
  { id: 'air-moth',       name: 'Air Moth Imp',       element: 'air'    },
  { id: 'shadow-bat',     name: 'Shadow Bat Imp',     element: 'shadow' },
  { id: 'shadow-wraith',  name: 'Shadow Wraith Imp',  element: 'shadow' },
  { id: 'shadow-panther', name: 'Shadow Panther Imp', element: 'shadow' },
  { id: 'spark-hornet',   name: 'Spark Hornet Imp',   element: 'spark'  },
  { id: 'spark-drone',    name: 'Spark Drone Imp',    element: 'spark'  },
];

/* 8-way compass + a centre "hovering" state.
   Laptop-friendly key grid (no numpad needed):  Q W E / A S D / Z X C
   Numpad alternates:                             7 8 9 / 4 5 6 / 1 2 3      */
const DIRECTIONS = [
  { id: 'NW',    label: 'North-West', key: 'Q', num: '7', arrow: '↖', row: 0, col: 0 },
  { id: 'N',     label: 'North',      key: 'W', num: '8', arrow: '↑', row: 0, col: 1 },
  { id: 'NE',    label: 'North-East', key: 'E', num: '9', arrow: '↗', row: 0, col: 2 },
  { id: 'W',     label: 'West',       key: 'A', num: '4', arrow: '←', row: 1, col: 0 },
  { id: 'HOVER', label: 'Hovering',   key: 'S', num: '5', arrow: '•', row: 1, col: 1 },
  { id: 'E',     label: 'East',       key: 'D', num: '6', arrow: '→', row: 1, col: 2 },
  { id: 'SW',    label: 'South-West', key: 'Z', num: '1', arrow: '↙', row: 2, col: 0 },
  { id: 'S',     label: 'South',      key: 'X', num: '2', arrow: '↓', row: 2, col: 1 },
  { id: 'SE',    label: 'South-East', key: 'C', num: '3', arrow: '↘', row: 2, col: 2 },
];

/* ---- annotation seed helper -------------------------------------------------
   Times are stored as FRACTIONS of the clip duration (0..1) and converted to
   seconds once the real video duration is known (see app.js initTimes).
   source:"ai"   -> needs verifying. status starts "unreviewed".
   source:"human"-> status "added".
   aiLabel keeps the ORIGINAL ai guess so corrections stay recoverable as the
   training-delta signal even after a human edits the live label.            */
/* Reviewers who can be the active session user. `by` on an annotation records
   who created / accepted / corrected / rejected it. */
const USERS = [
  { id: 'u-mei',   name: 'Mei Tan',    initials: 'MT', role: 'Lead reviewer' },
  { id: 'u-arjun', name: 'Arjun Rao',  initials: 'AR', role: 'Reviewer' },
  { id: 'u-sofia', name: 'Sofia Lima', initials: 'SL', role: 'Reviewer' },
  { id: 'u-kenji', name: 'Kenji Mori', initials: 'KM', role: 'Reviewer' },
];
const CURRENT_USER_ID = 'u-mei';   // the active reviewer for this dummy session

function ai(f0, f1, typeId, direction) {
  return { f0, f1, typeId, direction, source: 'ai', status: 'unreviewed',
           aiLabel: { typeId, direction }, by: null };
}
function human(f0, f1, typeId, direction) {
  return { f0, f1, typeId, direction, source: 'human', status: 'added', aiLabel: null,
           by: CURRENT_USER_ID };
}

/* Today's curated queue. Every recording arrives already AI-tagged; the stored
   status only seeds the done/issue flags — everything else is a single "to-do"
   bucket (see app.js statusOf). */
const TODAY_SPECS = [
  { slot: '08:00', status: 'done', anns: [
      Object.assign(ai(0.06, 0.13, 'fire-dragon', 'E'),  { status: 'accepted', by: 'u-arjun' }),
      Object.assign(ai(0.40, 0.47, 'water-penguin', 'NE'), { status: 'corrected', typeId: 'water-serpent', direction: 'N', by: 'u-sofia' }),
      human(0.72, 0.80, 'spark-hornet', 'SE'),
  ]},
  { slot: '08:15', status: 'done', anns: [
      Object.assign(ai(0.18, 0.26, 'shadow-bat', 'W'), { status: 'accepted', by: 'u-mei' }),
      Object.assign(ai(0.55, 0.61, 'air-falcon', 'S'), { status: 'rejected', by: 'u-arjun' }),
  ]},
  { slot: '08:30', status: 'issue', flagged: true,
    flagNote: 'Frame freeze around 0:40 — cannot confirm exit direction. Escalated.',
    anns: [
      Object.assign(ai(0.30, 0.44, 'fire-bazooka', 'N'), { status: 'unreviewed' }),
  ]},
  /* default selected: a fresh AI pre-pass to verify */
  { slot: '08:45', status: 'todo', anns: [
      ai(0.05, 0.12, 'fire-dragon', 'E'),
      ai(0.21, 0.29, 'water-penguin', 'NE'),
      ai(0.36, 0.42, 'shadow-bat', 'S'),
      ai(0.58, 0.69, 'air-falcon', 'W'),
      human(0.82, 0.90, 'spark-hornet', 'SE'),
  ]},
  { slot: '09:00', status: 'todo', anns: [
      ai(0.12, 0.20, 'earth-golem', 'HOVER'),
      ai(0.47, 0.54, 'fire-phoenix', 'NE'),
      ai(0.70, 0.78, 'water-jelly', 'SW'),
  ]},
  { slot: '09:15', status: 'todo', anns: [] },
  { slot: '09:30', status: 'todo', anns: [
      Object.assign(ai(0.10, 0.18, 'air-cyclone', 'E'), { status: 'accepted', by: 'u-kenji' }),
      ai(0.44, 0.52, 'shadow-wraith', 'W'),
      ai(0.66, 0.74, 'spark-drone', 'N'),
  ]},
  { slot: '09:45', status: 'todo', anns: [
      ai(0.25, 0.33, 'fire-thrasher', 'SE'),
      ai(0.60, 0.68, 'water-kraken', 'S'),
  ]},
  { slot: '10:00', status: 'todo', anns: [
      ai(0.08, 0.15, 'earth-mole', 'HOVER'),
      ai(0.33, 0.41, 'air-moth', 'NE'),
      ai(0.77, 0.85, 'fire-tortoise', 'W'),
  ]},
  { slot: '10:15', status: 'todo', anns: [] },
  { slot: '10:30', status: 'done', anns: [
      Object.assign(ai(0.20, 0.28, 'shadow-panther', 'E'), { status: 'accepted', by: 'u-sofia' }),
      human(0.55, 0.63, 'spark-hornet', 'N'),
  ]},
  { slot: '10:45', status: 'todo', anns: [] },
  { slot: '11:00', status: 'todo', anns: [
      ai(0.14, 0.22, 'earth-boulder', 'SW'),
      ai(0.50, 0.58, 'fire-dragon', 'NE'),
  ]},
  { slot: '11:15', status: 'todo', anns: [] },
  { slot: '11:30', status: 'issue', flagged: true,
    flagNote: 'Two imps overlap heavily 0:30–0:55 — second opinion requested.',
    anns: [
      Object.assign(ai(0.28, 0.50, 'water-serpent', 'E'), { status: 'unreviewed' }),
      ai(0.34, 0.55, 'fire-phoenix', 'NE'),
  ]},
  { slot: '11:45', status: 'todo', anns: [
      ai(0.18, 0.26, 'air-wisp', 'W'),
      ai(0.62, 0.70, 'earth-beetle', 'S'),
  ]},
  { slot: '12:00', status: 'todo', anns: [] },
  { slot: '12:15', status: 'todo', anns: [] },
];

/* ---- dates are relative to the real "today" so the queue is always current -- */
function isoLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dayDate(daysAgo) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - daysAgo); return d;
}
const TODAY_ISO = isoLocal(dayDate(0));

/* ---- generator for past days: mostly reviewed, with a few open issues ------- */
function slotAt(i) {
  const t = 8 * 60 + i * 15;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
const G_TYPES = ['fire-dragon', 'water-penguin', 'shadow-bat', 'air-falcon', 'earth-golem',
                 'spark-hornet', 'fire-phoenix', 'water-serpent', 'air-cyclone', 'earth-mole'];
const G_DIRS  = ['E', 'NE', 'S', 'W', 'N', 'SE', 'SW', 'HOVER', 'NW', 'E'];
const G_USERS = ['u-mei', 'u-arjun', 'u-sofia', 'u-kenji'];

function genDay(count, opts) {
  opts = opts || {};
  const issue = new Set(opts.issueIdx || []);
  const todo = new Set(opts.todoIdx || []);
  const empty = new Set(opts.emptyIdx || []);
  const specs = [];
  for (let i = 0; i < count; i++) {
    const slot = slotAt(i), t1 = G_TYPES[i % G_TYPES.length], d1 = G_DIRS[i % G_DIRS.length];
    if (issue.has(i)) {
      specs.push({ slot: slot, status: 'issue', flagged: true,
        flagNote: opts.note || 'Flagged by an earlier reviewer — still unresolved.',
        anns: [ ai(0.22, 0.32, t1, d1) ] });                  // unreviewed = still open
    } else if (todo.has(i)) {
      specs.push({ slot: slot, status: 'todo', anns: [ ai(0.30, 0.40, t1, d1) ] });   // left to review
    } else if (empty.has(i)) {
      specs.push({ slot: slot, status: 'done', anns: [] });   // AI found nothing; human confirmed
    } else {
      const anns = [ Object.assign(ai(0.10, 0.18, t1, d1), { status: 'accepted', by: G_USERS[i % 4] }) ];
      if (i % 2 === 0) anns.push(Object.assign(
        ai(0.48, 0.57, G_TYPES[(i + 3) % G_TYPES.length], G_DIRS[(i + 2) % G_DIRS.length]),
        { status: 'accepted', by: G_USERS[(i + 2) % 4] }));
      specs.push({ slot: slot, status: 'done', anns: anns });
    }
  }
  return specs;
}

/* Today + recent past days. A couple of past days keep UNRESOLVED issues so the
   reviewer can be sent back through the date picker to clean them up. */
const DAY_BUILD = [
  { daysAgo: 0, specs: TODAY_SPECS },
  { daysAgo: 1, specs: genDay(12, { issueIdx: [7], note: 'Imp lost behind lens glare 0:30–0:50 — confirm the exit.' }) },
  { daysAgo: 2, specs: genDay(10, {}) },                                                  // all clear
  { daysAgo: 3, specs: genDay(11, { issueIdx: [3, 9], todoIdx: [5], note: 'Two imps overlap — needs a second opinion.' }) },
  { daysAgo: 4, specs: genDay(9,  { todoIdx: [2] }) },                                    // no issues
];

/* Flatten into the video list, stamping the real date + stable ids. */
const VIDEOS = [];
var _vc = 0;
DAY_BUILD.forEach(function (day) {
  const date = isoLocal(dayDate(day.daysAgo));
  day.specs.forEach(function (spec) {
    const id = 'imp-rec-' + String(1001 + _vc++);
    const annotations = (spec.anns || []).map(function (a, ai2) {
      return Object.assign({ id: id + '-a' + ai2 }, a);
    });
    VIDEOS.push({
      id: id, date: date, slot: spec.slot,
      durationLabel: '15:00', src: 'public/imp-demo.mp4',
      status: spec.status, flagged: !!spec.flagged, flagNote: spec.flagNote || '',
      reviewed: spec.status === 'done', annotations: annotations,
    });
  });
});

window.DEMO = {
  ELEMENTS: ELEMENTS,
  IMP_TYPES: IMP_TYPES,
  DIRECTIONS: DIRECTIONS,
  VIDEOS: VIDEOS,
  USERS: USERS,
  CURRENT_USER_ID: CURRENT_USER_ID,
  TODAY_ISO: TODAY_ISO,
};
