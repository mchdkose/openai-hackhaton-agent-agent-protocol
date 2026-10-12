export default {
  async fetch(request, env) {
    // Service bindings reach the full Next.js Worker internally, including
    // static assets and POST requests, without using the workers.dev hostname.
    return env.ASKAGENT_WORKER.fetch(request);
  }
};
