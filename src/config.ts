import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv(): void {
  const envPath = join(PROJECT_ROOT, '.env');
  let raw: string;
  try {
    raw = readFileSync(envPath, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

export function getClientId(): string {
  return process.env.CLIENT_ID ?? '';
}

export function getClientSecret(): string {
  return process.env.CLIENT_SECRET ?? '';
}

export function hasCredentials(): boolean {
  return Boolean(getClientId() && getClientSecret());
}

export function credentialsMissingMessage(): string {
  return [
    'Missing Google OAuth credentials.',
    '1. Create a Desktop OAuth client in Google Cloud Console (see README.md).',
    '2. Put CLIENT_ID and CLIENT_SECRET in the .env file (copy .env.example).',
  ].join(' ');
}

export function tokenFilePath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'youtube-mcp', 'token.json');
}
