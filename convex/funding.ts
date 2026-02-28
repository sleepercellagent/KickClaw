import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { assertTier } from "./auth";

const ESCROW_ADDRESS = process.env.ESCROW_WALLET_ADDRESS ?? "0x_ESCROW_ADDRESS_HERE";

export const byListing = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    return ctx.db
      .query("fundingCommitments")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .collect();
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
