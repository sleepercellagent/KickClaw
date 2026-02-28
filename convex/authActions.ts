"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { createHash, randomBytes } from "crypto";

// ─── D-2: Wallet Signature Verification (Node.js runtime) ─────────────────

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
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

    await ctx.runMutation(internal.auth.storeToken, {
      agentId: agent._id,
      tokenHash,
      expiresAt,
    });

    return { token, agent };
  },
});

// Helper: hash a bearer token (called by HTTP router via internal action)
export const hashAndVerifyToken = internalAction({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    return ctx.runQuery(internal.auth.verifyToken, { tokenHash });
  },
});
