import { spawn } from 'node:child_process';

process.loadEnvFile('.env.local');
const names = ['OPENROUTER_API_KEY', 'SESSION_HMAC_SECRET', 'DEMO_ADMIN_TOKEN'];
const secrets = Object.fromEntries(names.map(name => {
  if (!process.env[name]) throw new Error(`Missing required server secret: ${name}`);
  return [name, process.env[name]];
}));
const child = spawn('node', ['node_modules/wrangler/bin/wrangler.js', 'secret', 'bulk'], {
  stdio: ['pipe', 'inherit', 'inherit'],
});
child.stdin.end(JSON.stringify(secrets));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
