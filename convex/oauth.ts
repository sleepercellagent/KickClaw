"use node";

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── D-4: GitHub OAuth Flow (Node.js runtime) ─────────────────────────────
// TODO (Stream A): replace stub crypto with real crypto imports

// In-memory state store (fine for hackathon; use DB for production)
const pendingOAuth = new Map<string, { agentId: string; expiresAt: number }>();

// POST /api/auth/oauth/initiate
export const initiate = httpAction(async (ctx, request) => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "").trim();

  // TODO (Stream A): hash token with crypto.createHash("sha256")
  const tokenHash = token + "_hashed"; // STUB
  const agent = await ctx.runQuery(internal.auth.verifyToken, { tokenHash });
  if (!agent) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  }

  // TODO (Stream A): use crypto.randomBytes for state
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  pendingOAuth.set(state, {
    agentId: agent._id,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
  const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI!;

  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&state=${state}&scope=read:user`;

  return new Response(JSON.stringify({ url }), {
    headers: { "Content-Type": "application/json" },
  });
});

// GET /api/auth/oauth/callback
export const callback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  const pending = pendingOAuth.get(state);
  if (!pending || Date.now() > pending.expiresAt) {
    pendingOAuth.delete(state);
    return new Response("Invalid or expired OAuth state", { status: 400 });
  }
  pendingOAuth.delete(state);

  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;

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

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "AgentFund-KickClaw",
    },
  });
  const userData = await userResponse.json();

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
