import nextWorker from './.open-next/worker.js';
import { consumeAgentJobs } from './queue-consumer.mjs';

export default {
  fetch(request, env, context) {
    return nextWorker.fetch(request, env, context);
  },
  queue: consumeAgentJobs
};
