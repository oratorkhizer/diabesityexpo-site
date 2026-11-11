// Case-insensitive links (Caspian Studio standard, added Nov 2026).
// If someone types a link with capital letters (e.g. /PLEDGE) and that exact
// page does not exist, send them to the lowercase page (/pledge) if it exists.
// Pages or files that really use capital letters keep working, because we only
// redirect when the original address is a 404 and the lowercase one is not.

export const config = {
  matcher: '/((?!_next/|_vercel/|api/|\\.well-known/).*)',
};

const CHECK_HEADER = 'x-case-check';

export default async function middleware(request) {
  const url = new URL(request.url);
  if (!/[A-Z]/.test(url.pathname)) return; // nothing to do, carry on normally
  if (request.headers.get(CHECK_HEADER)) return; // our own check request
  if (request.method !== 'GET' && request.method !== 'HEAD') return;

  const lower = new URL(url);
  lower.pathname = url.pathname.toLowerCase();

  try {
    const probe = (u) =>
      fetch(u, { method: 'HEAD', redirect: 'manual', headers: { [CHECK_HEADER]: '1' } });
    const original = await probe(url);
    if (original.status !== 404) return; // the capitalised page exists, leave it
    const target = await probe(lower);
    if (target.status >= 400) return; // lowercase page missing too, show the normal 404
    return Response.redirect(lower.toString(), 308);
  } catch (e) {
    return; // never break the site because of this check
  }
}
