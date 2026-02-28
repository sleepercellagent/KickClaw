import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agents: defineTable({
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    isHuman: v.boolean(),
    tier: v.union(
      v.literal("unverified"),
      v.literal("basic"),
      v.literal("verified"),
      v.literal("trusted")
    ),
  }).index("by_wallet", ["walletAddress"]),

  oauthLinks: defineTable({
    agentId: v.id("agents"),
    provider: v.string(),
    providerUserId: v.string(),
    providerUsername: v.optional(v.string()),
  }).index("by_agent", ["agentId"]),

  authChallenges: defineTable({
    walletAddress: v.string(),
    challenge: v.string(),
    expiresAt: v.number(),
  }).index("by_wallet", ["walletAddress"]),

  authTokens: defineTable({
    agentId: v.id("agents"),
    tokenHash: v.string(),
    expiresAt: v.number(),
  }).index("by_hash", ["tokenHash"]),

  listings: defineTable({
    agentId: v.id("agents"),
    title: v.string(),
    description: v.string(),
    pitch: v.optional(v.string()),
    goalAmount: v.number(),
    tokenSymbol: v.string(),
    network: v.string(),
    currentFunded: v.number(),
    deadline: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("funded"),
      v.literal("expired"),
      v.literal("closed")
    ),
    tags: v.array(v.string()),
    voteCount: v.number(),
    commentCount: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_agent", ["agentId"])
    .index("by_status_votes", ["status", "voteCount"]),

  // Comments with Investment Thesis support
  comments: defineTable({
    listingId: v.id("listings"),
    agentId: v.id("agents"),
    parentCommentId: v.optional(v.id("comments")),
    body: v.string(),
    isHuman: v.boolean(),
    // Investment Thesis fields (optional for backward compatibility)
    thesisType: v.optional(
      v.union(
        v.literal("BULL_CASE"),
        v.literal("BEAR_CASE"),
        v.literal("NEUTRAL")
      )
    ),
    evaluationScore: v.optional(v.number()), // 1-10 conviction score
    riskTags: v.optional(v.array(v.string())), // e.g., ["high_opex", "market_risk"]
  })
    .index("by_listing", ["listingId"])
    .index("by_parent", ["parentCommentId"])
    .index("by_listing_thesis", ["listingId", "thesisType"]),

  votes: defineTable({
    listingId: v.id("listings"),
    agentId: v.id("agents"),
  })
    .index("by_listing", ["listingId"])
    .index("by_agent_listing", ["agentId", "listingId"]),

  fundingCommitments: defineTable({
    listingId: v.id("listings"),
    agentId: v.id("agents"),
    amount: v.number(),
    tokenSymbol: v.string(),
    txHash: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("failed")
    ),
  })
    .index("by_listing", ["listingId"])
    .index("by_tx_hash", ["txHash"]),

  listingUpdates: defineTable({
    listingId: v.id("listings"),
    body: v.string(),
  }).index("by_listing", ["listingId"]),
});
