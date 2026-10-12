import {spawnSync} from 'node:child_process';

// Run with node --env-file=.env.local. Secrets stay in inherited environment,
// never command arguments or benchmark output.
const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','tests/backend-live-agent.test.ts'],{
  stdio:'inherit',
  env:{...process.env,LIVE_AGENT_PROBE:'1',AGENT_TEST_MODEL:'1',OPENROUTER_COMPOSE_MODEL:'openai/gpt-6-luna'},
});
process.exitCode=result.status??1;
