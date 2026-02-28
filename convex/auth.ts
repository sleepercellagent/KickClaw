import { v } from "convex/values";
import { mutation, internalMutation, internalQuery } from "./_generated/server";

// ─── D-2: Wallet Auth — Mutations & Queries (Convex runtime) ───────────────

// Step 1: Generate a nonce-based challenge for a wallet to sign
export const createChallenge = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const normalized = walletAddress.toLowerCase();
    // Use Math.random for nonce (no crypto needed in Convex runtime)
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const challenge = `Sign this message to authenticate with AgentFund.\nWallet: ${normalized}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Remove any existing challenges for this wallet
    const existing = await ctx.db
      .query("authChallenges")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", normalized))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    await ctx.db.insert("authChallenges", {
      walletAddress: normalized,
      challenge,
      expiresAt,
    });

    return { challenge };
  },
});

// ─── Internal helpers (used by authActions.ts and http.ts) ─────────────────

export const getChallengeForWallet = internalQuery({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    return ctx.db
      .query("authChallenges")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress))
      .first();
  },
});

export const deleteChallenge = internalMutation({
  args: { id: v.id("authChallenges") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const getOrCreateAgent = internalMutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress))
      .first();
    if (existing) return existing;

    const id = await ctx.db.insert("agents", {
      walletAddress,
      isHuman: false,
      tier: "unverified",
    });
    return (await ctx.db.get(id))!;
  },
});

export const storeToken = internalMutation({
  args: {
    agentId: v.id("agents"),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { agentId, tokenHash, expiresAt }) => {
    await ctx.db.insert("authTokens", { agentId, tokenHash, expiresAt });
  },
});

// Used by HTTP router to validate incoming requests (takes pre-hashed token)
export const verifyToken = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const tokenDoc = await ctx.db
      .query("authTokens")
      .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!tokenDoc) return null;
    if (Date.now() > tokenDoc.expiresAt) return null;
    return ctx.db.get(tokenDoc.agentId);
  },
});

// ─── D-5: Tier-based authorization helper ─────────────────────────────────

const TIER_LEVELS: Record<string, number> = {
  unverified: 0,
  basic: 1,
  verified: 2,
  trusted: 3,
};

export async function assertTier(
  ctx: any,
  agentId: string,
  requiredTier: "unverified" | "basic" | "verified" | "trusted"
) {
  const agent = await ctx.db.get(agentId);
  if (!agent) throw new Error("Agent not found.");
  const agentLevel = TIER_LEVELS[agent.tier] ?? 0;
  const requiredLevel = TIER_LEVELS[requiredTier] ?? 0;
  if (agentLevel < requiredLevel) {
    throw new Error(`Requires ${requiredTier} tier. Your tier: ${agent.tier}.`);
  }
  return agent;
}

export const upgradeTier = internalMutation({
  args: {
    agentId: v.id("agents"),
    tier: v.union(
      v.literal("unverified"),
      v.literal("basic"),
      v.literal("verified"),
      v.literal("trusted")
    ),
  },
  handler: async (ctx, { agentId, tier }) => {
    await ctx.db.patch(agentId, { tier });
  },
});
