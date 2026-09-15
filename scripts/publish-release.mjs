import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Input must be a completed build, never a directory being rewritten by another process.
export async function publishRelease(source, servedDirectory, releaseId) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(releaseId)) throw new Error('Invalid release id');
  const names = ['BepInEx', 'patchers', 'config', 'plugins'];
  const releases = path.join(servedDirectory, 'releases');
  await fs.mkdir(releases, { recursive: true });
  const staging = await fs.mkdtemp(path.join(releases, '.publish-'));
  const destination = path.join(releases, releaseId);
  const manifest = { schemaVersion: 1, releaseId, archives: [] };
  try {
    for (const name of names) {
      const bytes = await fs.readFile(path.join(source, name + '.zip'));
      if (!bytes.length || bytes.length > 2 * 1024 ** 3) throw new Error('Invalid archive size: ' + name);
      await fs.writeFile(path.join(staging, name + '.zip'), bytes, { flag: 'wx' });
      manifest.archives.push({ name, url: `files/releases/${releaseId}/${name}.zip`, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), size: bytes.length });
    }
    // Renaming a nonempty directory over an existing release fails. Published versions are immutable.
    await fs.rename(staging, destination);
    const temp = path.join(servedDirectory, '.manifest-' + crypto.randomUUID());
    const handle = await fs.open(temp, 'wx');
    try { await handle.writeFile(JSON.stringify(manifest, null, 2)); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(temp, path.join(servedDirectory, 'launcher-manifest.json'));
    return manifest;
  } finally { await fs.rm(staging, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [source, servedDirectory, releaseId] = process.argv.slice(2);
  if (!source || !servedDirectory || !releaseId) {
    console.error('Usage: node scripts/publish-release.mjs <completed-zip-directory> <served-files-directory> <release-id>');
    process.exitCode = 1;
  } else {
    publishRelease(source, servedDirectory, releaseId).then(m => console.log('Published ' + m.releaseId)).catch(e => { console.error(e.message); process.exitCode = 1; });
  }
}
