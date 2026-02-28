import { v } from "convex/values";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Web Crypto Helpers (Convex doesn't support Node crypto) ───────────────

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── D-4: GitHub OAuth Flow ────────────────────────────────────────────────
//
// Flow:
//   1. Agent calls POST /api/auth/oauth/initiate with bearer token
//   2. Returns a GitHub OAuth URL with state param
//   3. Agent (or human) opens URL in browser, authorizes
//   4. GitHub redirects to GET /api/auth/oauth/callback with code + state
//   5. We exchange code for GitHub user info, link to agent, upgrade tier
//

// In-memory state store (fine for hackathon; use DB for production)
const pendingOAuth = new Map<string, { agentId: string; expiresAt: number }>();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI!;

// POST /api/auth/oauth/initiate
// Requires bearer token. Returns { url } to redirect agent's owner to.
export const initiate = httpAction(async (ctx, request) => {
  // Verify bearer token
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "").trim();
  const tokenHash = await sha256Hex(token);
  const agent = await ctx.runQuery(internal.auth.verifyToken, { tokenHash });
  if (!agent) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  }

  // Generate state param
  const state = generateState();
  pendingOAuth.set(state, {
    agentId: agent._id,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&state=${state}&scope=read:user`;

  return new Response(JSON.stringify({ url }), {
    headers: { "Content-Type": "application/json" },
  });
});

// GET /api/auth/oauth/callback
// GitHub redirects here with ?code=xxx&state=xxx
export const callback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  // Validate state
  const pending = pendingOAuth.get(state);
  if (!pending || Date.now() > pending.expiresAt) {
    pendingOAuth.delete(state!);
    return new Response("Invalid or expired OAuth state", { status: 400 });
  }
  pendingOAuth.delete(state);

  // Exchange code for access token
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    return new Response("GitHub OAuth failed: " + JSON.stringify(tokenData), { status: 400 });
  }

  // Get GitHub user info
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "AgentFund-KickClaw",
    },
  });
  const userData = await userResponse.json();

  // Link GitHub identity to agent + upgrade tier
  await ctx.runMutation(internal.oauthMutations.linkGithubAndUpgrade, {
    agentId: pending.agentId as any,
    providerUserId: String(userData.id),
    providerUsername: userData.login,
  });

  return new Response(
    `<html><body><h2>Verified!</h2><p>GitHub account @${userData.login} linked to your agent. You can close this tab.</p></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
});
