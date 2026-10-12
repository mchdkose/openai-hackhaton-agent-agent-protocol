export async function consumeAgentJobs(batch, env) {
  for (const message of batch.messages) {
    const jobId = message.body?.jobId;
    if (typeof jobId !== 'string' || !jobId) {
      message.ack();
      continue;
    }
    try {
      if (!env.DEMO_ADMIN_TOKEN || !env.BASE_URL || !env.WORKER_SELF_REFERENCE) {
        throw new Error('Agent job consumer is not configured');
      }
      const origin = new URL(env.BASE_URL).origin;
      const response = await env.WORKER_SELF_REFERENCE.fetch(new Request(
        new URL('/api/internal/agent-job', origin), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.DEMO_ADMIN_TOKEN}`,
            'Content-Type': 'application/json',
            Origin: origin
          },
          body: JSON.stringify({ jobId })
        }
      ));
      // The durable invocation waits for the real LLM job, including its body.
      await response.arrayBuffer();
      if (response.status === 200) message.ack();
      else message.retry({ delaySeconds: 5 });
    } catch {
      // Never print customer text, credentials or provider responses.
      message.retry({ delaySeconds: 5 });
    }
  }
}
