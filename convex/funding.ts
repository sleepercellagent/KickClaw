import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { assertTier } from "./auth";

const ESCROW_ADDRESS = process.env.ESCROW_WALLET_ADDRESS ?? "0x_ESCROW_ADDRESS_HERE";

export const byListing = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const commitments = await ctx.db
      .query("fundingCommitments")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .order("desc")
      .collect();

    // Enrich with agent info
    const enriched = await Promise.all(
      commitments.map(async (c) => {
        const agent = await ctx.db.get(c.agentId);
        return {
          ...c,
          agentName: agent?.displayName ?? agent?.walletAddress?.slice(0, 8) + "...",
          agentTier: agent?.tier,
        };
      })
    );

    return enriched;
  },
});

// Step 1: Record intent + return escrow address
export const initiate = mutation({
  args: {
    listingId: v.id("listings"),
    agentId: v.id("agents"),
    amount: v.number(),
    tokenSymbol: v.optional(v.string()),
  },
  handler: async (ctx, { listingId, agentId, amount, tokenSymbol = "USDC" }) => {
    await assertTier(ctx, agentId, "verified");

    const listing = await ctx.db.get(listingId);
    if (!listing) throw new Error("Listing not found.");
    if (listing.status !== "active") throw new Error("Listing is not accepting funding.");
    if (Date.now() > listing.deadline) throw new Error("Listing deadline has passed.");

    const id = await ctx.db.insert("fundingCommitments", {
      listingId,
      agentId,
      amount,
      tokenSymbol,
      status: "pending",
    });

    return {
      commitmentId: id,
      escrowAddress: ESCROW_ADDRESS,
      amount,
      tokenSymbol,
      instructions: `Send ${amount} ${tokenSymbol} to ${ESCROW_ADDRESS} on base-sepolia. Then call /api/funding/confirm with the tx hash.`,
    };
  },
});

// Step 2: Agent submits tx hash after sending funds on-chain
export const confirm = mutation({
  args: {
    commitmentId: v.id("fundingCommitments"),
    agentId: v.id("agents"),
    txHash: v.string(),
  },
  handler: async (ctx, { commitmentId, agentId, txHash }) => {
    const commitment = await ctx.db.get(commitmentId);
    if (!commitment) throw new Error("Commitment not found.");
    if (commitment.agentId !== agentId) throw new Error("Not your commitment.");
    if (commitment.status !== "pending") throw new Error("Commitment already processed.");

    await ctx.db.patch(commitmentId, { txHash, status: "confirmed" });

    // Update listing funded amount
    const listing = await ctx.db.get(commitment.listingId);
    if (listing) {
      const newFunded = listing.currentFunded + commitment.amount;
      const newStatus = newFunded >= listing.goalAmount ? "funded" : listing.status;
      await ctx.db.patch(commitment.listingId, {
        currentFunded: newFunded,
        status: newStatus,
      });
    }

    return { confirmed: true };
  },
});

// ─── Public mutations for demo (no auth required) ─────────────────────────

export const fundPublic = mutation({
  args: {
    listingId: v.id("listings"),
    walletAddress: v.optional(v.string()),
    displayName: v.optional(v.string()),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found.");
    if (listing.status !== "active") throw new Error("Listing is not accepting funding.");

    // Generate a placeholder wallet if not provided
    const wallet = args.walletAddress || `0x${Date.now().toString(16)}`;
    
    // Get or create agent
    let agent = await ctx.db
      .query("agents")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", wallet))
      .first();

    if (!agent) {
      const agentId = await ctx.db.insert("agents", {
        walletAddress: wallet,
        displayName: args.displayName || `Backer-${wallet.slice(0, 8)}`,
        isHuman: false,
        tier: "verified",
      });
      agent = await ctx.db.get(agentId);
    }

    if (!agent) throw new Error("Failed to create agent");

    // Create funding commitment (auto-confirmed for demo)
    const commitmentId = await ctx.db.insert("fundingCommitments", {
      listingId: args.listingId,
      agentId: agent._id,
      amount: args.amount,
      tokenSymbol: "USDC",
      txHash: `0xdemo_${Date.now().toString(16)}`,
      status: "confirmed",
    });

    // Update listing funded amount
    const newFunded = listing.currentFunded + args.amount;
    const newStatus = newFunded >= listing.goalAmount ? "funded" : listing.status;
    await ctx.db.patch(args.listingId, {
      currentFunded: newFunded,
      status: newStatus,
    });

    return {
      commitmentId,
      agentId: agent._id,
      amount: args.amount,
      newTotal: newFunded,
    };
  },
});
