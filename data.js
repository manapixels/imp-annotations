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
function ai(f0, f1, typeId, direction) {
  return { f0, f1, typeId, direction, source: 'ai', status: 'unreviewed',
           aiLabel: { typeId, direction } };
}
function human(f0, f1, typeId, direction) {
  return { f0, f1, typeId, direction, source: 'human', status: 'added', aiLabel: null };
}

/* Per-video specs. status is the *stored* lifecycle state for the demo:
   unannotated | needs_review | in_progress | done | deferred | issue        */
const VIDEO_SPECS = [
  { slot: '08:00', status: 'done', anns: [
      Object.assign(ai(0.06, 0.13, 'fire-dragon', 'E'),  { status: 'accepted' }),
      Object.assign(ai(0.40, 0.47, 'water-penguin', 'NE'), { status: 'corrected', typeId: 'water-serpent', direction: 'N' }),
      human(0.72, 0.80, 'spark-hornet', 'SE'),
  ]},
  { slot: '08:15', status: 'done', anns: [
      Object.assign(ai(0.18, 0.26, 'shadow-bat', 'W'), { status: 'accepted' }),
      Object.assign(ai(0.55, 0.61, 'air-falcon', 'S'), { status: 'rejected' }),
  ]},
  { slot: '08:30', status: 'issue', flagged: true,
    flagNote: 'Frame freeze around 0:40 — cannot confirm exit direction. Escalated.',
    anns: [
      Object.assign(ai(0.30, 0.44, 'fire-bazooka', 'N'), { status: 'unreviewed' }),
  ]},
  /* default selected: a fresh AI pre-pass to verify */
  { slot: '08:45', status: 'needs_review', anns: [
      ai(0.05, 0.12, 'fire-dragon', 'E'),
      ai(0.21, 0.29, 'water-penguin', 'NE'),
      ai(0.36, 0.42, 'shadow-bat', 'S'),
      ai(0.58, 0.69, 'air-falcon', 'W'),
      human(0.82, 0.90, 'spark-hornet', 'SE'),
  ]},
  { slot: '09:00', status: 'needs_review', anns: [
      ai(0.12, 0.20, 'earth-golem', 'HOVER'),
      ai(0.47, 0.54, 'fire-phoenix', 'NE'),
      ai(0.70, 0.78, 'water-jelly', 'SW'),
  ]},
  { slot: '09:15', status: 'unannotated', anns: [] },
  { slot: '09:30', status: 'in_progress', anns: [
      Object.assign(ai(0.10, 0.18, 'air-cyclone', 'E'), { status: 'accepted' }),
      ai(0.44, 0.52, 'shadow-wraith', 'W'),
      ai(0.66, 0.74, 'spark-drone', 'N'),
  ]},
  { slot: '09:45', status: 'deferred', anns: [
      ai(0.25, 0.33, 'fire-thrasher', 'SE'),
      ai(0.60, 0.68, 'water-kraken', 'S'),
  ]},
  { slot: '10:00', status: 'needs_review', anns: [
      ai(0.08, 0.15, 'earth-mole', 'HOVER'),
      ai(0.33, 0.41, 'air-moth', 'NE'),
      ai(0.77, 0.85, 'fire-tortoise', 'W'),
  ]},
  { slot: '10:15', status: 'unannotated', anns: [] },
  { slot: '10:30', status: 'done', anns: [
      Object.assign(ai(0.20, 0.28, 'shadow-panther', 'E'), { status: 'accepted' }),
      human(0.55, 0.63, 'spark-hornet', 'N'),
  ]},
  { slot: '10:45', status: 'deferred', anns: [] },
  { slot: '11:00', status: 'needs_review', anns: [
      ai(0.14, 0.22, 'earth-boulder', 'SW'),
      ai(0.50, 0.58, 'fire-dragon', 'NE'),
  ]},
  { slot: '11:15', status: 'unannotated', anns: [] },
  { slot: '11:30', status: 'issue', flagged: true,
    flagNote: 'Two imps overlap heavily 0:30–0:55 — second opinion requested.',
    anns: [
      Object.assign(ai(0.28, 0.50, 'water-serpent', 'E'), { status: 'unreviewed' }),
      ai(0.34, 0.55, 'fire-phoenix', 'NE'),
  ]},
  { slot: '11:45', status: 'needs_review', anns: [
      ai(0.18, 0.26, 'air-wisp', 'W'),
      ai(0.62, 0.70, 'earth-beetle', 'S'),
  ]},
  { slot: '12:00', status: 'unannotated', anns: [] },
  { slot: '12:15', status: 'unannotated', anns: [] },
];

/* Build the video objects + give every annotation a stable id. */
const VIDEOS = VIDEO_SPECS.map(function (spec, vi) {
  const id = 'imp-rec-' + String(2401 + vi);
  const annotations = (spec.anns || []).map(function (a, ai2) {
    return Object.assign({ id: id + '-a' + ai2 }, a);
  });
  return {
    id: id,
    date: '2026-06-18',
    slot: spec.slot,
    durationLabel: '15:00',          // conceptual length of every recording
    src: 'public/imp-demo.mp4',
    status: spec.status,
    flagged: !!spec.flagged,
    flagNote: spec.flagNote || '',
    reviewed: spec.status === 'done',
    annotations: annotations,
  };
});

window.DEMO = {
  ELEMENTS: ELEMENTS,
  IMP_TYPES: IMP_TYPES,
  DIRECTIONS: DIRECTIONS,
  VIDEOS: VIDEOS,
  DEFAULT_VIDEO_ID: 'imp-rec-2404',  // the 08:45 needs_review clip
  REVIEWER: { name: 'A. Reviewer', handle: 'manapixels' },
};
