import { readFileSync } from "node:fs";

export function getVersion(): string {
  try {
    return JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ).version as string;
  } catch {
    return "0.0.0";
  }
}
