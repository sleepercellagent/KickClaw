import fs from "fs";
import path from "path";
import os from "os";

export interface Config {
  token: string;
  walletAddress: string;
  agentId: string;
  apiBaseUrl: string;
}

function getConfigDir(): string {
  return path.join(os.homedir(), ".agentfund");
}

function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

export function loadConfig(): Config | null {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    return JSON.parse(raw) as Config;
  } catch {
    return null;
  }
}

export function saveConfig(config: Config): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

export function clearConfig(): void {
  try {
    fs.unlinkSync(getConfigPath());
  } catch {
    // ignore if file doesn't exist
  }
}

export function getApiBaseUrl(): string {
  const config = loadConfig();
  if (config?.apiBaseUrl) return config.apiBaseUrl;
  if (process.env.CONVEX_SITE_URL) return process.env.CONVEX_SITE_URL;
  throw new Error(
    "No API base URL configured. Set CONVEX_SITE_URL env var or run 'agentfund auth login' first."
  );
}

export function requireAuth(): Config {
  const config = loadConfig();
  if (!config?.token) {
    throw new Error("Not authenticated. Run 'agentfund auth login' first.");
  }
  return config;
}
