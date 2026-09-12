#!/usr/bin/env node

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { google } from "googleapis";
import { loadEnv, YOUTUBE_SCOPE } from "./config.js";
import { persistTokens } from "./youtube.js";

async function openBrowser(url: string): Promise<void> {
  const cmd =
    platform() === "darwin"
      ? ["open", [url]]
      : platform() === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    const [bin, args] = cmd as [string, string[]];
    const child = spawn(bin, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Browser opening is best-effort; the URL is printed to the terminal.
  }
}

async function main(): Promise<void> {
  loadEnv();
  if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    throw new Error(
      "Missing Google OAuth credentials. 1. Create a Desktop OAuth client in Google Cloud Console (see README.md). 2. Set CLIENT_ID and CLIENT_SECRET in the environment, .env, or ~/.config/youtube-personal-mcp/.env.",
    );
  }

  let redirectUri = "";
  let oauth: InstanceType<typeof google.auth.OAuth2> | null = null;
  let authUrl = "";

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", redirectUri || "http://127.0.0.1");
    if (url.pathname !== "/") {
      res.writeHead(404).end("Not found");
      return;
    }
    const error = url.searchParams.get("error");
    if (error) {
      res
        .writeHead(400)
        .end(`Authorization failed: ${error}\nClose this window and retry.`);
      console.error(`Authorization failed: ${error}`);
      server.close();
      clearTimeout(timeout);
      process.exitCode = 1;
      return;
    }
    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400).end("Missing authorization code");
      return;
    }
    void (async () => {
      try {
        const { tokens } = await oauth!.getToken(code);
        persistTokens(tokens as unknown as Record<string, unknown>);
        res.writeHead(200, { "content-type": "text/html" });
        res.end(
          "<h3>Authorization complete</h3><p>You can close this window and return to your terminal.</p>",
        );
        server.close();
        clearTimeout(timeout);
        console.log("\nAuthorization complete. Tokens saved.");
        process.exit(0);
      } catch (err) {
        res.writeHead(500).end("Failed to exchange authorization code");
        console.error("Token exchange failed:", err);
        server.close();
        clearTimeout(timeout);
        process.exit(1);
      }
    })();
  });

  const timeout = setTimeout(
    () => {
      console.error("Timed out waiting for authorization (5 minutes).");
      server.close();
      process.exit(1);
    },
    5 * 60 * 1000,
  );

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        reject(new Error("Could not bind a loopback port"));
        return;
      }
      redirectUri = `http://127.0.0.1:${address.port}`;
      oauth = new google.auth.OAuth2({
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        redirectUri,
      });
      authUrl = oauth.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [YOUTUBE_SCOPE],
      });
      console.log(
        "\nOpen this URL in your browser and sign in with your YouTube account:\n",
      );
      console.log(`  ${authUrl}\n`);
      void openBrowser(authUrl);
      resolve();
    });
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
