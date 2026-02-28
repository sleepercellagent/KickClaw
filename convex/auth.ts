import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { createHash, randomBytes } from "crypto";

// ─── Helpers ───────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

// ─── D-2: Wallet Challenge-Response Auth ───────────────────────────────────

// Step 1: Generate a nonce-based challenge for a wallet to sign
export const createChallenge = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const normalized = walletAddress.toLowerCase();
    const nonce = randomBytes(16).toString("hex");
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

// Step 2: Verify wallet signature and issue bearer token
export const verifySignature = action({
  args: {
    walletAddress: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, { walletAddress, signature }) => {
    const { ethers } = await import("ethers");
    const normalized = walletAddress.toLowerCase();

    // Get challenge
    const challengeDoc = await ctx.runQuery(internal.auth.getChallengeForWallet, {
      walletAddress: normalized,
    });
    if (!challengeDoc) throw new Error("No challenge found. Request a new one.");
    if (Date.now() > challengeDoc.expiresAt) throw new Error("Challenge expired.");

    // Verify signature
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(challengeDoc.challenge, signature).toLowerCase();
    } catch {
      throw new Error("Invalid signature.");
    }
    if (recoveredAddress !== normalized) throw new Error("Signature does not match wallet.");

    // Clean up used challenge
    await ctx.runMutation(internal.auth.deleteChallenge, { id: challengeDoc._id });

    // Get or create agent
    const agent = await ctx.runMutation(internal.auth.getOrCreateAgent, {
      walletAddress: normalized,
    });

    // Issue bearer token
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

    await ctx.runMutation(internal.auth.storeToken, {
      agentId: agent._id,
      tokenHash,
      expiresAt,
    });

    return { token, agent };
  },
});

// ─── Internal helpers ──────────────────────────────────────────────────────

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

// Used by HTTP router to validate incoming requests
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

// Upgrade agent tier (called after OAuth verification)
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
