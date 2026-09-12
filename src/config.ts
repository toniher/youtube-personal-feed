import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";

export const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

export const PROJECT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function loadEnv(): void {
  const configDir = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  for (const envPath of [
    join(PROJECT_ROOT, ".env"),
    join(configDir, "youtube-personal-mcp", ".env"),
  ]) {
    try {
      loadEnvFile(envPath);
    } catch {}
  }
}

export function tokenFilePath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "youtube-personal-mcp", "token.json");
}
