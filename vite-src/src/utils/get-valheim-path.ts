import { filesystem } from '@neutralinojs/lib';
import { checkValheimExe } from './check-valheim-exe';
export async function getValheimPath(steamPath: string | null): Promise<string> {
  if (!steamPath) return '';
  const vdf = await filesystem
    .readFile(steamPath + '/steamapps/libraryfolders.vdf')
    .catch(() => '');
  const libraries = [...vdf.matchAll(/"path"\s+"([^"\r\n]+)"/g)].map((m) =>
    m[1].replace(/\\\\/g, '/'),
  );
  libraries.push(steamPath);
  for (const library of new Set(libraries)) {
    const game = library.replace(/\\/g, '/') + '/steamapps/common/Valheim';
    if (await checkValheimExe(game)) return game;
  }
  return '';
}
