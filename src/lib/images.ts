import type { FantasyPool } from '../types';

const WIKI_API = 'https://en.wikipedia.org/api/rest_v1';
const imageCache = new Map<string, string | null>();
let driversManifest: Record<string, string> | null = null;
let constructorsManifest: Record<string, string> | null = null;

// attempt to load local manifests (populated at build time by scripts/fetch-images.mjs)
async function loadLocalManifests() {
  if (driversManifest !== null || constructorsManifest !== null) return;
  try {
    const [d, c] = await Promise.all([
      fetch('/cache/images/drivers-manifest.json').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/cache/images/constructors-manifest.json').then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    driversManifest = d ?? null;
    constructorsManifest = c ?? null;
  } catch {
    // ignore
    driversManifest = null;
    constructorsManifest = null;
  }
}

function findInManifest(man: Record<string, string> | null, title: string): string | null {
  if (!man) return null;
  if (man[title]) return man[title];
  const u = title.replace(/ /g, '_');
  if (man[u]) return man[u];
  const s = title.replace(/_/g, ' ');
  if (man[s]) return man[s];
  const enc = encodeURIComponent(title);
  if (man[enc]) return man[enc];
  // case-insensitive search
  const low = title.toLowerCase();
  for (const k of Object.keys(man)) {
    if (k.toLowerCase() === low) return man[k];
  }
  return null;
}
const layoutCache = new Map<string, string | null>();

function wikiTitleFromUrl(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/wiki\/(.+?)(?:#.*)?$/);
  return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface WikiMediaItem {
  title: string;
  leadImage?: boolean;
  type: string;
  srcset?: { src: string }[];
}

function mediaItemUrl(item: WikiMediaItem): string | null {
  const set = item.srcset;
  if (!set?.length) return null;
  const best = set[set.length - 1];
  return best.src.startsWith('//') ? `https:${best.src}` : best.src;
}

function scoreTrackMedia(title: string, leadImage: boolean): number {
  const t = title.toLowerCase().replace(/^file:/, '');
  let score = 0;
  if (/track[_\s-]?map/.test(t)) score += 120;
  if (/circuit[_\s-]?map/.test(t)) score += 110;
  if (/grand[_\s-]?prix[_\s-]?layout|_layout/.test(t)) score += 100;
  if (/circuit.*20\d{2}/.test(t) && /\.(png|svg)/.test(t)) score += 80;
  if (/_20\d{2}[^/]*\.(png|svg)/.test(t)) score += 70;
  if (/\.svg$/.test(t)) score += 40;
  if (/\.png$/.test(t) && /circuit/.test(t)) score += 30;
  if (leadImage && /\.(png|svg)/.test(t) && !/logo/.test(t)) score += 25;
  if (/logo/.test(t)) score -= 100;
  if (/\.jpe?g$/.test(t)) score -= 60;
  if (
    /skysat|panorama|tower|crowd|paddock|formulae|nascar|rally|motogp|alpine|grand prix at|_gp_/.test(
      t,
    )
  ) {
    score -= 50;
  }
  return score;
}

function scoreConstructorMedia(title: string): number {
  const t = title.toLowerCase().replace(/^file:/, '');
  let score = 0;
  if (/logo|wordmark|emblem/.test(t)) score -= 120;
  if (/transporter|truck|museum|building|factory|headquarters|team principal/.test(t)) {
    score -= 80;
  }
  if (/formula.?one|f1|grand prix|gp |racing car|race car|single.seater/.test(t)) {
    score += 90;
  }
  if (/20(1[5-9]|2[0-5])/.test(t)) score += 50;
  if (/20(0\d|1[0-4])/.test(t)) score += 25;
  if (/\.jpe?g$/.test(t)) score += 30;
  if (/\.png$/.test(t)) score += 15;
  if (/chassis|cockpit|front-wing|rear-wing|sidepod/.test(t)) score += 40;
  return score;
}

async function wikiGet<T>(path: string): Promise<T | null> {
  // fetch with simple retry + exponential backoff
  const maxAttempts = 3;
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      const res = await fetch(`${WIKI_API}${path}`);
      if (!res.ok) {
        attempt += 1;
        await sleep(150 * Math.pow(2, attempt));
        continue;
      }
      return (await res.json()) as T;
  } catch {
      attempt += 1;
      await sleep(150 * Math.pow(2, attempt));
    }
  }
  return null;
}

export async function fetchWikiImage(wikiUrl?: string): Promise<string | null> {
  const title = wikiTitleFromUrl(wikiUrl);
  if (!title) return null;

  const cached = imageCache.get(title);
  if (cached !== undefined) return cached;

  // prefer build-time cached image if available
  await loadLocalManifests();
  const foundDriver = findInManifest(driversManifest, title);
  if (foundDriver) {
    const local = `/${foundDriver}`;
    imageCache.set(title, local);
    return local;
  }

  const data = await wikiGet<{
    thumbnail?: { source: string };
    originalimage?: { source: string };
  }>(`/page/summary/${encodeURIComponent(title)}`);

  const url = data?.thumbnail?.source ?? data?.originalimage?.source ?? null;
  imageCache.set(title, url);
  return url;
}

export async function fetchWikiConstructorImage(
  wikiUrl?: string,
): Promise<string | null> {
  const title = wikiTitleFromUrl(wikiUrl);
  if (!title) return null;

  const cacheKey = `constructor:${title}`;
  const cached = imageCache.get(cacheKey);
  if (cached !== undefined) return cached;

  // prefer build-time cached image if available
  await loadLocalManifests();
  const foundConstructor = findInManifest(constructorsManifest, title);
  if (foundConstructor) {
    const local = `/${foundConstructor}`;
    imageCache.set(cacheKey, local);
    return local;
  }

  const data = await wikiGet<{ items?: WikiMediaItem[] }>(
    `/page/media-list/${encodeURIComponent(title)}`,
  );
  const images = (data?.items ?? []).filter((item) => item.type === 'image');

  let best: WikiMediaItem | null = null;
  let bestScore = 0;
  for (const item of images) {
    const score = scoreConstructorMedia(item.title);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  const url =
    best && bestScore > 0
      ? mediaItemUrl(best)
      : await fetchWikiImage(wikiUrl);
  imageCache.set(cacheKey, url);
  return url;
}

export async function fetchWikiTrackLayout(
  wikiUrl?: string,
): Promise<string | null> {
  const title = wikiTitleFromUrl(wikiUrl);
  if (!title) return null;

  const cacheKey = `layout:${title}`;
  const cached = layoutCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const data = await wikiGet<{ items?: WikiMediaItem[] }>(
    `/page/media-list/${encodeURIComponent(title)}`,
  );
  const images = (data?.items ?? []).filter((item) => item.type === 'image');

  let best: WikiMediaItem | null = null;
  let bestScore = 0;
  for (const item of images) {
    const score = scoreTrackMedia(item.title, item.leadImage ?? false);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  const url = best && bestScore > 0 ? mediaItemUrl(best) : null;
  layoutCache.set(cacheKey, url);
  return url;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize = 4,
  delayMs = 120,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    out.push(...(await Promise.all(batch.map(fn))));
    if (i + batchSize < items.length) await sleep(delayMs);
  }
  return out;
}

export async function prefetchPoolImages(pool: FantasyPool): Promise<FantasyPool> {
  // create shallow clones of drivers/constructors so we don't mutate the original
  const drivers = pool.drivers.map((d) => ({ ...d }));
  const constructors = pool.constructors.map((c) => ({ ...c }));

  await Promise.all([
    mapWithConcurrency(
      drivers.filter((d) => !d.imageUrl),
      async (d) => {
        d.imageUrl = d.driver.imageUrl ?? (await fetchWikiImage(d.driver.url));
        return d.imageUrl;
      },
    ),
    mapWithConcurrency(
      constructors.filter((c) => !c.imageUrl),
      async (c) => {
        c.imageUrl = c.constructor.imageUrl ?? (await fetchWikiConstructorImage(c.constructor.url));
        return c.imageUrl;
      },
    ),
  ]);

  return {
    drivers,
    constructors,
  } as FantasyPool;
}

export function isSvgImage(url?: string | null): boolean {
  return !!url && /\.svg(\?|$)/i.test(url);
}

export function driverPlaceholder(code?: string): string {
  const label = code?.slice(0, 3) ?? 'F1';
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <rect width="120" height="120" fill="#1a1a20"/>
      <text x="60" y="68" text-anchor="middle" fill="#EE4D37" font-family="sans-serif" font-size="28" font-weight="bold">${label}</text>
    </svg>`,
  )}`;
}

export function circuitPlaceholder(name: string): string {
  const label = name.slice(0, 12);
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320" viewBox="0 0 800 320">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1a1a20"/><stop offset="100%" stop-color="#0a0a0c"/></linearGradient></defs>
      <rect width="800" height="320" fill="url(#g)"/>
      <text x="400" y="170" text-anchor="middle" fill="#e10600" font-family="sans-serif" font-size="28" font-weight="bold">${label}</text>
    </svg>`,
  )}`;
}

export function trackLayoutPlaceholder(name: string): string {
  const label = name.length > 18 ? `${name.slice(0, 16)}…` : name;
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="360" viewBox="0 0 800 360">
      <rect width="800" height="360" fill="#0d0d10"/>
      <path d="M120 180 C120 80, 280 60, 400 100 S680 120, 680 180 S520 300, 400 280 S160 280, 120 180 Z" fill="none" stroke="#e10600" stroke-width="6" stroke-linecap="round" opacity="0.55"/>
      <path d="M400 100 L420 140 L460 150 L430 175" fill="none" stroke="#e10600" stroke-width="4" stroke-linecap="round" opacity="0.4"/>
      <text x="400" y="340" text-anchor="middle" fill="#888894" font-family="sans-serif" font-size="14" letter-spacing="2">${label}</text>
    </svg>`,
  )}`;
}

export function constructorPlaceholder(name: string): string {
  const label = name.slice(0, 2).toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
      <rect width="200" height="100" fill="#141418"/>
      <text x="100" y="58" text-anchor="middle" fill="#F08D32" font-family="sans-serif" font-size="24" font-weight="bold">${label}</text>
    </svg>`,
  )}`;
}
