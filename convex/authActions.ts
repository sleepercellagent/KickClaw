"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── D-2: Wallet Signature Verification (Node.js runtime) ─────────────────
// TODO (Stream A): implement crypto imports and ethers signature verification

export const verifySignature = action({
  args: {
    walletAddress: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, { walletAddress, signature }) => {
    const normalized = walletAddress.toLowerCase();

    // Get challenge
    const challengeDoc = await ctx.runQuery(internal.auth.getChallengeForWallet, {
      walletAddress: normalized,
    });
    if (!challengeDoc) throw new Error("No challenge found. Request a new one.");
    if (Date.now() > challengeDoc.expiresAt) throw new Error("Challenge expired.");

    // TODO (Stream A): verify signature with ethers.verifyMessage
    // const { ethers } = await import("ethers");
    // const recoveredAddress = ethers.verifyMessage(challengeDoc.challenge, signature).toLowerCase();
    // if (recoveredAddress !== normalized) throw new Error("Signature does not match wallet.");
    const recoveredAddress = normalized; // STUB: skip verification for now

    // Clean up used challenge
    await ctx.runMutation(internal.auth.deleteChallenge, { id: challengeDoc._id });

    // Get or create agent
    const agent = await ctx.runMutation(internal.auth.getOrCreateAgent, {
      walletAddress: normalized,
    });

    // TODO (Stream A): generate secure token with crypto.randomBytes + hash with crypto.createHash
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
    const tokenHash = token + "_hashed"; // STUB: replace with SHA-256 hash
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

    await ctx.runMutation(internal.auth.storeToken, {
      agentId: agent._id,
      tokenHash,
      expiresAt,
    });

    return { token, agent };
  },
});

// Helper: hash a bearer token (called by HTTP router)
// TODO (Stream A): replace stub hash with crypto.createHash("sha256")
export const hashAndVerifyToken = internalAction({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenHash = token + "_hashed"; // STUB: replace with SHA-256 hash
    return ctx.runQuery(internal.auth.verifyToken, { tokenHash });
  },
});
