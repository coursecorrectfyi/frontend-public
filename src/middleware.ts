import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  // Redirect www to non-www (e.g., www.coursecorrect.fyi → coursecorrect.fyi)
  if (hostname.startsWith('www.')) {
    const nonWwwHost = hostname.replace(/^www\./, '');
    const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1');
    const protocol = isLocalhost ? 'http' : 'https';
    const pathname = request.nextUrl.pathname;

    const redirectUrl = new URL(`${protocol}://${nonWwwHost}${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};