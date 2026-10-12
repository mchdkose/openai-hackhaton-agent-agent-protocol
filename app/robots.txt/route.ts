export function GET() {
  return new Response('User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /panel\nDisallow: /t/*/panel\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
