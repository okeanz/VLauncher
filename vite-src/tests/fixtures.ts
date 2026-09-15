import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import { archiveNames, type Manifest } from '../extension/src/updater';
export async function temporary() {
  const root = path.resolve('.test-tmp');
  await fs.mkdir(root, { recursive: true });
  return fs.mkdtemp(path.join(root, 'case-'));
}
export async function removeTemporary(dir: string) {
  const root = path.resolve('.test-tmp') + path.sep;
  if (!path.resolve(dir).startsWith(root))
    throw new Error('Refusing cleanup outside test workspace');
  await fs.rm(dir, { recursive: true, force: true });
}
export async function put(root: string, name: string, data = name) {
  const file = path.join(root, name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
  return file;
}
export function zipBytes(files: Record<string, string>) {
  const zip = new AdmZip();
  for (const [name, value] of Object.entries(files)) zip.addFile(name, Buffer.from(value));
  return zip.toBuffer();
}
export function release(id = 'r1') {
  const data: Record<string, Buffer> = {
    BepInEx: zipBytes({ 'BepInEx/core/BepInEx.dll': 'core-' + id, 'winhttp.dll': 'loader-' + id }),
    patchers: zipBytes({ 'patch.dll': 'patch-' + id }),
    config: zipBytes({ 'mod.cfg': 'config-' + id }),
    plugins: zipBytes({ 'mod.dll': 'mod-' + id }),
  };
  const manifest: Manifest = {
    schemaVersion: 1,
    releaseId: id,
    archives: archiveNames.map((name) => ({
      name,
      url: `files/releases/${id}/${name}.zip`,
      size: data[name].length,
      sha256: crypto.createHash('sha256').update(data[name]).digest('hex'),
    })),
  };
  const request = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/launcher-manifest.json')) return Response.json(manifest);
    const entry = manifest.archives.find((a) => url.endsWith(a.url));
    return entry
      ? new Response(new Uint8Array(data[entry.name]))
      : new Response(null, { status: 404 });
  };
  return { data, manifest, request };
}
