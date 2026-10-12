import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// OpenNext copies Next's local env files into its server bundle. Production
// credentials come exclusively from Cloudflare secrets, never that copy.
await writeFile('.open-next/cloudflare/next-env.mjs',
  'export const production = {};\nexport const development = {};\nexport const test = {};\n');

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(filename);
    else if (/\.(?:js|mjs|html|json|txt|map)$/.test(entry.name)) {
      const content = await readFile(filename, 'utf8');
      if (/(?:sk-or-v1-[a-f0-9]{32,}|fal_sk_[a-f0-9]{24,})/.test(content)) {
        throw new Error(`A private API credential was found in public assets: ${filename}`);
      }
    }
  }
}
await inspect('.open-next/assets');
console.log('Cloudflare build prepared: runtime secrets excluded; public assets inspected.');
