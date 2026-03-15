import { generateRss } from '$lib/rss.js';

export const prerender = true;

/** @type {import('./$types').RequestHandler} */
export function GET() {
  return new Response(generateRss('en'), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
}
