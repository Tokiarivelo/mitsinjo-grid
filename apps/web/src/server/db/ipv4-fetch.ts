import https from 'node:https';
import { neonConfig } from '@neondatabase/serverless';

/**
 * Sends Neon's HTTP queries over IPv4 (some networks have no IPv6 route to Neon). Shared by the
 * app (`neon.ts`) and `scripts/db-migrate.ts`; no `server-only` so the script can load it.
 */
export function preferIpv4Fetch(): void {
  if (typeof https?.request !== 'function') return;
  neonConfig.fetchFunction = (url: string | URL | Request, options: RequestInit = {}) => {
    return new Promise<Response>((resolve, reject) => {
      const targetUrl =
        typeof url === 'string' ? new URL(url) : url instanceof URL ? url : new URL(url.url);

      const headers: Record<string, string> = {};
      if (options.headers) {
        if (typeof (options.headers as Headers).forEach === 'function') {
          (options.headers as Headers).forEach((val: string, key: string) => {
            headers[key] = val;
          });
        } else if (Array.isArray(options.headers)) {
          options.headers.forEach(([k, v]: [string, string]) => {
            headers[k] = v;
          });
        } else {
          Object.assign(headers, options.headers);
        }
      }

      const req = https.request(
        targetUrl,
        {
          method: options.method || 'GET',
          headers,
          family: 4, // Force IPv4 family
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            resolve(
              new Response(body, {
                status: res.statusCode || 200,
                statusText: res.statusMessage || 'OK',
                headers: res.headers as HeadersInit,
              })
            );
          });
        }
      );

      req.on('error', reject);
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  };
}
