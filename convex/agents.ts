import { v } from "convex/values";
import { query } from "./_generated/server";

export const get = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return ctx.db.get(agentId);
  },
});

export const getByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    return ctx.db
      .query("agents")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress.toLowerCase()))
      .first();
  },
});

export const getListings = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return ctx.db
      .query("listings")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();
  },
});

export const getFunded = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const commitments = await ctx.db
      .query("fundingCommitments")
      .filter((q) => q.eq(q.field("agentId"), agentId))
      .collect();
    const listingIds = [...new Set(commitments.map((c) => c.listingId))];
    return Promise.all(listingIds.map((id) => ctx.db.get(id)));
  },
});
