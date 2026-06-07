#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

const WIKI_API = 'https://en.wikipedia.org/api/rest_v1';
const root = process.cwd();
const driversFile = path.join(root, 'public', 'data', 'drivers.json');
const constructorsFile = path.join(root, 'public', 'data', 'constructors.json');
const outDir = path.join(root, 'public', 'cache', 'images');

function wikiTitleFromUrl(url) {
  if (!url) return null;
  const m = url.match(/wiki\/(.+?)(?:#.*)?$/);
  return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
}

async function wikiGet(pathSuffix) {
  const url = `${WIKI_API}${pathSuffix}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function mediaItemUrl(item) {
  const set = item.srcset;
  if (!set || !set.length) return null;
  const best = set[set.length - 1];
  return best.src.startsWith('//') ? `https:${best.src}` : best.src;
}

async function downloadUrl(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed ${url} ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

async function ensureDir(d) {
  await fs.mkdir(d, { recursive: true });
}

async function processFile(filePath, subdir) {
  const data = JSON.parse(String(await fs.readFile(filePath, 'utf8')));
  const manifest = {};
  await ensureDir(path.join(outDir, subdir));
  const entries = Object.entries(data);
  for (let i = 0; i < entries.length; i += 1) {
    const [id, info] = entries[i];
    const title = wikiTitleFromUrl(info.url);
    if (!title) continue;
    let imageUrl = null;
    // try summary first
    const summary = await wikiGet(`/page/summary/${encodeURIComponent(title)}`);
    imageUrl = summary?.thumbnail?.source ?? summary?.originalimage?.source ?? null;
    // fallback to media list
    if (!imageUrl) {
      const media = await wikiGet(`/page/media-list/${encodeURIComponent(title)}`);
      const images = (media?.items ?? []).filter((it) => it.type === 'image');
      if (images.length) {
        // pick last srcset best item
        const best = images[images.length - 1];
        imageUrl = mediaItemUrl(best) || null;
      }
    }

    if (!imageUrl) continue;
    try {
      const urlPath = new URL(imageUrl).pathname;
      const ext = path.extname(urlPath).split('?')[0] || '.png';
      const filename = `${id}${ext}`;
      const dest = path.join(outDir, subdir, filename);
      // don't re-download if exists
      try {
        await fs.access(dest);
      } catch {
        try {
          await downloadUrl(imageUrl, dest);
          // be kind to wiki
          await new Promise((r) => setTimeout(r, 120));
        } catch (e) {
          // ignore download failures
          continue;
        }
      }
      // manifest maps wiki title -> public path
      manifest[title] = `cache/images/${subdir}/${filename}`;
    } catch (e) {
      // skip failures
      continue;
    }
  }
  return manifest;
}

async function main() {
  console.log('Starting image fetch — this may take a while');
  await ensureDir(outDir);
  const driversManifest = await processFile(driversFile, 'drivers');
  const constructorsManifest = await processFile(constructorsFile, 'constructors');
  await fs.writeFile(path.join(outDir, 'drivers-manifest.json'), JSON.stringify(driversManifest, null, 2));
  await fs.writeFile(path.join(outDir, 'constructors-manifest.json'), JSON.stringify(constructorsManifest, null, 2));
  console.log('Image fetch complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
