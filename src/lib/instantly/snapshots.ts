// Daily send-count snapshots stored in src/data/snapshots.json via GitHub API.
// Enables week-over-week send delta without relying on Instantly's date-filtered analytics.

export type DailySnapshot = {
  date: string;           // YYYY-MM-DD UTC
  by_org: Record<string, {
    sent: number;         // all-time sent total for this org at time of snapshot
    campaigns: Record<string, number>; // campaign_id → all-time sent
  }>;
};

export type SnapshotFile = { snapshots: DailySnapshot[] };

const REPO  = process.env.GITHUB_REPO  ?? 'skulkar8-debug/BD-dashboard-STOC';
const TOKEN = process.env.GITHUB_TOKEN ?? '';
const FILE_PATH = 'src/data/snapshots.json';
const API = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

async function ghGet(): Promise<{ content: string; sha: string } | null> {
  if (!TOKEN) return null;
  try {
    const res = await fetch(API, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github.v3+json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json() as { content: string; sha: string };
    return json;
  } catch { return null; }
}

export async function readSnapshots(): Promise<SnapshotFile> {
  const raw = await ghGet();
  if (!raw) return { snapshots: [] };
  try {
    const decoded = Buffer.from(raw.content, 'base64').toString('utf-8');
    return JSON.parse(decoded) as SnapshotFile;
  } catch { return { snapshots: [] }; }
}

export async function appendSnapshot(snap: DailySnapshot): Promise<boolean> {
  if (!TOKEN) return false;
  const raw = await ghGet();
  if (!raw) return false;

  let file: SnapshotFile;
  try {
    const decoded = Buffer.from(raw.content, 'base64').toString('utf-8');
    file = JSON.parse(decoded) as SnapshotFile;
  } catch {
    file = { snapshots: [] };
  }

  // Upsert by date — replace if same day already exists
  file.snapshots = file.snapshots.filter((s) => s.date !== snap.date);
  file.snapshots.push(snap);
  // Keep last 90 days only
  file.snapshots.sort((a, b) => a.date.localeCompare(b.date));
  file.snapshots = file.snapshots.slice(-90);

  const updated = Buffer.from(JSON.stringify(file, null, 2)).toString('base64');
  try {
    const res = await fetch(API, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `snapshot: ${snap.date}`,
        content: updated,
        sha: raw.sha,
      }),
    });
    return res.ok;
  } catch { return false; }
}

/** Compute sent delta between two snapshots for a given org. Returns null if no baseline. */
export function sentDelta(
  current: DailySnapshot,
  baseline: DailySnapshot | undefined,
  orgId: string
): number | null {
  if (!baseline) return null;
  const cur = current.by_org[orgId]?.sent ?? 0;
  const bas = baseline.by_org[orgId]?.sent ?? 0;
  return Math.max(0, cur - bas);
}

/** Find the snapshot closest to N days ago. */
export function snapshotDaysAgo(snapshots: DailySnapshot[], days: number): DailySnapshot | undefined {
  const target = new Date();
  target.setUTCDate(target.getUTCDate() - days);
  const targetStr = target.toISOString().slice(0, 10);
  // Find the closest snapshot at or before the target date
  return [...snapshots]
    .filter((s) => s.date <= targetStr)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}
