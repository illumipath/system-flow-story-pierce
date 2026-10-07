const BASE = import.meta.env.BASE_URL;

// A cell can carry a suppression_marker for two different reasons: an
// ordinary small-cell mask ("*"/"**" — see the pipeline's suppression.py)
// or this one, meaning the pipeline couldn't safely disaggregate this
// (period, population, dimension, category) combination at all — every
// category in that slice was too small to protect individually, so the
// whole scope was blanked together rather than left as a partially-masked,
// still-derivable set of numbers. Distinct from the small-cell markers so
// the frontend can show a dedicated "population too small" message instead
// of routing it through the ordinary per-cell suppressed-value display.
export const INSUFFICIENT_POPULATION_MARKER = "insufficient_population";

// Matches PRIMARY_SUPPRESSION_MARKER/SECONDARY_SUPPRESSION_MARKER in
// pipeline/suppression.py. Primary ("*") means this cell's own true count
// is small; secondary ("**") means an otherwise-showable cell was hidden
// too, to keep a nearby primary-suppressed cell from being back-calculated
// — see FlowSankeyChart, which renders a node's secondary-suppressed links
// (if any are present at that node) expanded to fill whatever's left of
// its true total, with primary-suppressed links staying at a small fixed
// sliver; when a node has primary-suppressed links but no secondary ones,
// the primary links themselves take on that expanding role instead, so a
// visual gap doesn't reappear just because that particular node didn't
// need secondary suppression.
export const PRIMARY_SUPPRESSION_MARKER = "*";
export const SECONDARY_SUPPRESSION_MARKER = "**";

// Pierce County fork (illumipath/system-flow-story-pierce), modified 2026-10-07: when this page is shown in a frame by a
// page on the same site (Pierce County's C4F0 space shows it that way), that page
// hands over the data files instead of them being fetched from data/. This page
// posts {type: "sfs:ready"} to its parent and takes {type: "sfs:data", files} back,
// where files maps each file name used below to its parsed contents. Opened on its
// own, or with no answer within 10 seconds, it fetches data/ exactly as upstream.
let hostFiles = null;
function filesFromHost() {
  if (typeof window === "undefined" || window.parent === window) return null;
  if (!hostFiles) {
    hostFiles = new Promise((resolve) => {
      const done = (files) => { window.removeEventListener("message", onMessage); clearTimeout(timer); resolve(files); };
      const onMessage = (e) => {
        if (e.source !== window.parent || e.origin !== window.location.origin) return;
        if (e.data?.type !== "sfs:data" || !e.data.files || typeof e.data.files !== "object") return;
        done(e.data.files);
      };
      const timer = setTimeout(() => done(null), 10000);
      window.addEventListener("message", onMessage);
      window.parent.postMessage({ type: "sfs:ready" }, window.location.origin);
    });
  }
  return hostFiles;
}

async function fetchJson(path) {
  const files = await filesFromHost();
  if (files) {
    if (!(path in files)) throw new Error(`Failed to load ${path}: not provided`);
    return files[path];
  }
  const res = await fetch(`${BASE}data/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export async function loadDashboardData() {
  const [flowYearly, flowQuarterly, length, returnCohorts, capacity, capacityQuarterly, capacityYearly] = await Promise.all([
    fetchJson("dashboard_flow_yearly.json"),
    fetchJson("dashboard_flow_quarterly.json"),
    fetchJson("dashboard_length_monthly.json"),
    fetchJson("dashboard_return_cohorts.json"),
    fetchJson("dashboard_capacity_monthly.json"),
    fetchJson("dashboard_capacity_quarterly.json"),
    fetchJson("dashboard_capacity_yearly.json"),
  ]);
  return { flowYearly, flowQuarterly, length, returnCohorts, capacity, capacityQuarterly, capacityYearly };
}

// dashboard_flow_monthly is pre-split by calendar year (see
// pipeline/export.py's _write_monthly_flow_split) — one year's worth of
// rows (~35-45MB) is still a lot to fetch on every year switch, so App.jsx
// caches each year's rows after the first fetch rather than calling this
// again. A year with no export file (outside the pipeline's export window)
// resolves to [] instead of throwing, matching MonthPills' existing
// empty-is-fine rendering.
export async function loadMonthlyFlowForYear(year) {
  return fetchJson(`dashboard_flow_monthly_${year}.json`).catch(() => []);
}

export function filterRows(rows, { populationSegment, dimension, category, month, flowType, projectType }) {
  return rows.filter((row) => {
    if (populationSegment && row.population_segment !== populationSegment) return false;
    if (dimension && row.dimension !== dimension) return false;
    if (category && row.category !== category) return false;
    if (month && row.month !== month) return false;
    if (flowType && row.flow_type !== flowType) return false;
    if (projectType && row.project_type !== projectType) return false;
    return true;
  });
}

export function distinctValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]))];
}

// Suppressed cells carry a "*" (primary) or "**" (secondary/complementary)
// marker instead of a count. Never treat a suppressed cell as 0 — 0 is a
// real, reportable value; suppressed means "we withheld this number."
export function resolveCell(row, countKey = "count") {
  const marker = row?.suppression_marker ?? null;
  return { value: marker ? null : row?.[countKey] ?? 0, marker };
}
