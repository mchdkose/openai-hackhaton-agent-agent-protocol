import { readFile, writeFile } from 'node:fs/promises';

// Next 16.4 moved preview properties into a separate server JSON file.
// OpenNext 1.20.10's manifest glob omits it, causing every dynamic route to
// throw before dispatch. Include the generated file in its existing inliner.
const filename = 'node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js';
const original = '**/{*-manifest,required-server-files,prefetch-hints}.json';
const corrected = '**/{*-manifest,required-server-files,prefetch-hints,preview-props}.json';
const source = await readFile(filename, 'utf8');
if (source.includes(original)) {
  await writeFile(filename, source.replace(original, corrected));
  console.log('Applied OpenNext compatibility fix for Next 16.4 preview properties.');
} else if (!source.includes(corrected) && !source.includes('preview-props')) {
  throw new Error('OpenNext manifest loader changed; review the Next 16.4 compatibility fix.');
}
