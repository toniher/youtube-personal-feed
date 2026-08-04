import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { OAuth2Client } from 'google-auth-library';
import {
  getClientId,
  getClientSecret,
  hasCredentials,
  loadEnv,
  YOUTUBE_SCOPE,
  credentialsMissingMessage,
} from './config.js';
import { persistTokens } from './youtube.js';

async function openBrowser(url: string): Promise<void> {
  const cmd =
    platform() === 'darwin'
      ? ['open', [url]]
      : platform() === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  try {
    const [bin, args] = cmd as [string, string[]];
    spawn(bin, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    // Browser opening is best-effort; the URL is printed to the terminal.
  }
}

async function main(): Promise<void> {
  loadEnv();
  if (!hasCredentials()) {
    throw new Error(credentialsMissingMessage());
  }

  const port = await new Promise<number>((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address && typeof address === 'object') {
        probe.close(() => resolvePort(address.port));
      } else {
        reject(new Error('Could not bind a loopback port'));
      }
    });
  });

  const redirectUri = `http://127.0.0.1:${port}`;
  const oauth = new OAuth2Client({
    clientId: getClientId(),
    clientSecret: getClientSecret(),
    redirectUri,
  });

  const authUrl = oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [YOUTUBE_SCOPE],
  });

  console.log('\nOpen this URL in your browser and sign in with your YouTube account:\n');
  console.log(`  ${authUrl}\n`);
  await openBrowser(authUrl);

  const timeout = setTimeout(() => {
    console.error('Timed out waiting for authorization (5 minutes).');
    process.exit(1);
  }, 5 * 60 * 1000);

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', redirectUri);
    if (url.pathname !== '/') {
      res.writeHead(404).end('Not found');
      return;
    }
    const error = url.searchParams.get('error');
    if (error) {
      res.writeHead(400).end(`Authorization failed: ${error}\nClose this window and retry.`);
      console.error(`Authorization failed: ${error}`);
      server.close();
      clearTimeout(timeout);
      process.exitCode = 1;
      return;
    }
    const code = url.searchParams.get('code');
    if (!code) {
      res.writeHead(400).end('Missing authorization code');
      return;
    }
    void (async () => {
      try {
        const { tokens } = await oauth.getToken(code);
        persistTokens(tokens as unknown as Record<string, unknown>);
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(
          '<h3>Authorization complete</h3><p>You can close this window and return to your terminal.</p>',
        );
        server.close();
        clearTimeout(timeout);
        console.log('\nAuthorization complete. Tokens saved.');
      } catch (err) {
        res.writeHead(500).end('Failed to exchange authorization code');
        console.error('Token exchange failed:', err);
        server.close();
        clearTimeout(timeout);
        process.exitCode = 1;
      }
    })();
  });

  server.listen(port, '127.0.0.1');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
