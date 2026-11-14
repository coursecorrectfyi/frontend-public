import http from 'http';
import { NextRequest, NextResponse } from 'next/server';

async function handleRequest(
  request: NextRequest,
  params: Promise<{ slug?: string[] }>
) {
  const { slug } = await params;
  const hostingerIp = process.env.NEXT_PUBLIC_HOSTINGER_IP;

  if (!hostingerIp) {
    console.error('[Blog Proxy] NEXT_PUBLIC_HOSTINGER_IP is not set');
    return NextResponse.json(
      { error: 'Blog proxy configuration error' },
      { status: 500 }
    );
  }

  // Get the original path and sanitize it
  let originalPath = request.nextUrl.pathname;

  // URL decode the path to handle encoded characters
  try {
    originalPath = decodeURIComponent(originalPath);
  } catch (e) {
    // If decoding fails, use the original path
    console.warn('[Blog Proxy] Failed to decode path, using original:', originalPath);
  }

  // Clean up any corrupted path that might contain CORS error text
  // This can happen if the URL gets corrupted somehow
  if (originalPath.includes("' from origin '") || originalPath.includes(' from origin ')) {
    // Extract just the valid path part before the corruption
    const match = originalPath.match(/^(\/blog\/[^']+)/);
    if (match) {
      originalPath = match[1];
      console.warn('[Blog Proxy] Cleaned corrupted path to:', originalPath);
    } else {
      console.error('[Blog Proxy] Invalid path detected:', originalPath);
      return NextResponse.json(
        {
          error: 'Invalid request path',
          details: 'Request path contains invalid characters',
          receivedPath: originalPath
        },
        { status: 400 }
      );
    }
  }

  // Additional validation: reject paths with obvious corruption
  if (originalPath.includes('http:/') || originalPath.includes('http://') || originalPath.includes('https://')) {
    console.error('[Blog Proxy] Path contains URL scheme:', originalPath);
    return NextResponse.json(
      {
        error: 'Invalid request path',
        details: 'Request path contains invalid characters',
        receivedPath: originalPath
      },
      { status: 400 }
    );
  }

  // Build the path: /blog or /blog/slug1/slug2/...
  // Use pathname directly for more reliable path handling
  let blogPath = originalPath;

  // Ensure it starts with /blog
  if (!blogPath.startsWith('/blog')) {
    console.error('[Blog Proxy] Path does not start with /blog:', blogPath);
    return NextResponse.json(
      { error: 'Invalid path', details: 'Path must start with /blog' },
      { status: 400 }
    );
  }

  // Ensure trailing slash for WordPress root
  const hasTrailingSlash = blogPath.endsWith('/');
  if (blogPath === '/blog' && !hasTrailingSlash) {
    blogPath = '/blog/';
  }

  const queryString = request.nextUrl.search || '';
  const wordpressPath = `${blogPath}${queryString}`;

  console.log('[Blog Proxy] Request path:', originalPath);
  console.log('[Blog Proxy] Proxying to:', `http://${hostingerIp}${wordpressPath}`);

  return new Promise((resolve) => {
    const makeRequest = (path: string, followRedirects = true): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }> => {
      return new Promise((resolveRequest, rejectRequest) => {
        const options = {
          hostname: hostingerIp,
          port: 80,
          path: path,
          method: request.method,
          headers: {
            'Host': 'coursecorrect.fyi',
            'X-Real-IP': request.headers.get('x-real-ip') ||
              request.headers.get('x-forwarded-for')?.split(',')[0] || '',
            'X-Forwarded-Proto': 'https',
            'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
            'X-Forwarded-Host': request.headers.get('host') || 'coursecorrect.fyi',
            'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
            'Accept': request.headers.get('accept') || '*/*',
            'Accept-Language': request.headers.get('accept-language') || '',
            'Cookie': request.headers.get('cookie') || '',
            'Referer': request.headers.get('referer') || '',
            'Content-Type': request.headers.get('content-type') || '',
          },
        };

        const req = http.request(options, (res) => {
          const chunks: Buffer[] = [];

          res.on('data', (chunk) => {
            chunks.push(chunk);
          });

          res.on('end', () => {
            const body = Buffer.concat(chunks); // Keep as Buffer, don't convert to string!

            // Handle redirects
            if (followRedirects && res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              const location = res.headers.location;
              console.log('[Blog Proxy] Redirect detected:', res.statusCode, 'to', location);

              const locationUrl = new URL(location);
              if (locationUrl.hostname === 'coursecorrect.fyi' || locationUrl.hostname === 'www.coursecorrect.fyi') {
                const redirectPath = locationUrl.pathname + locationUrl.search;
                console.log('[Blog Proxy] Following redirect to IP:', redirectPath);

                makeRequest(redirectPath, true).then(resolveRequest).catch(rejectRequest);
                return;
              } else {
                resolveRequest({ statusCode: res.statusCode || 200, headers: res.headers, body });
                return;
              }
            }

            resolveRequest({ statusCode: res.statusCode || 200, headers: res.headers, body });
          });
        });

        req.on('error', (error) => {
          rejectRequest(error);
        });

        // Send request body for non-GET requests
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          request.text().then(body => {
            if (body) req.write(body);
            req.end();
          }).catch(() => req.end());
        } else {
          req.end();
        }
      });
    };

    makeRequest(wordpressPath, true)
      .then(({ statusCode, headers, body }) => {
        console.log('[Blog Proxy] Final response status:', statusCode);
        console.log('[Blog Proxy] Content-Type:', headers['content-type']);

        const responseHeaders = new Headers();

        // Copy important headers
        const headersToForward = [
          'content-type',
          'content-length',
          'cache-control',
          'set-cookie',
          'x-frame-options',
          'content-security-policy',
          'x-content-type-options',
          'etag',
          'last-modified',
        ];

        for (const headerName of headersToForward) {
          const headerValue = headers[headerName.toLowerCase()];
          if (headerValue) {
            if (Array.isArray(headerValue)) {
              responseHeaders.set(headerName, headerValue[0]);
            } else if (typeof headerValue === 'string' || typeof headerValue === 'number') {
              responseHeaders.set(headerName, String(headerValue));
            }
          }
        }

        // Add CORS headers for fonts and other static assets
        const contentType = responseHeaders.get('content-type') || '';
        const isFont = /\.(ttf|otf|woff|woff2|eot)$/i.test(wordpressPath) ||
          contentType.includes('font') ||
          contentType.includes('application/font');

        if (isFont) {
          responseHeaders.set('Access-Control-Allow-Origin', '*');
          responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
          responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type');

          // Ensure correct content-type for fonts if not set
          if (!contentType || !contentType.includes('font')) {
            if (wordpressPath.endsWith('.ttf')) {
              responseHeaders.set('content-type', 'font/ttf');
            } else if (wordpressPath.endsWith('.woff')) {
              responseHeaders.set('content-type', 'font/woff');
            } else if (wordpressPath.endsWith('.woff2')) {
              responseHeaders.set('content-type', 'font/woff2');
            } else if (wordpressPath.endsWith('.otf')) {
              responseHeaders.set('content-type', 'font/otf');
            } else if (wordpressPath.endsWith('.eot')) {
              responseHeaders.set('content-type', 'application/vnd.ms-fontobject');
            }
          }
        }

        // Handle Location header
        const location = headers.location;
        if (location) {
          try {
            const locationUrl = new URL(location);
            if (locationUrl.hostname === hostingerIp) {
              locationUrl.hostname = 'coursecorrect.fyi';
              locationUrl.protocol = 'https:';
              responseHeaders.set('location', locationUrl.toString());
            } else {
              responseHeaders.set('location', location);
            }
          } catch (e) {
            responseHeaders.set('location', location);
          }
        }

        // Set default content type if not present (only for non-binary content)
        if (!responseHeaders.has('content-type') && !isFont) {
          responseHeaders.set('content-type', 'text/html; charset=utf-8');
        }

        if (!responseHeaders.has('cache-control')) {
          responseHeaders.set('cache-control', 'public, max-age=3600');
        }

        // Return response with Buffer for binary content (images, fonts, etc.)
        // Convert Buffer to Uint8Array for NextResponse compatibility
        resolve(new NextResponse(new Uint8Array(body), {
          status: statusCode,
          headers: responseHeaders,
        }));
      })
      .catch((error) => {
        console.error('[Blog Proxy] Error:', error);
        resolve(NextResponse.json(
          {
            error: 'Failed to proxy to WordPress',
            details: error instanceof Error ? error.message : 'Unknown error',
            attemptedUrl: `http://${hostingerIp}${wordpressPath}`
          },
          { status: 502 }
        ));
      });
  });
}

// Export handlers
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  return handleRequest(request, params);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  return handleRequest(request, params);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  return handleRequest(request, params);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  return handleRequest(request, params);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  return handleRequest(request, params);
}

export async function OPTIONS(request: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}