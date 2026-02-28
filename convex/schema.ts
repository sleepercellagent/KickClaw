import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Projects seeking funding
  projects: defineTable({
    title: v.string(),
    description: v.string(),
    goalAmount: v.number(), // USDC in cents
    currentFunded: v.number(), // USDC in cents
    deadline: v.number(), // Unix timestamp
    creatorWallet: v.string(),
    creatorName: v.optional(v.string()),
    escrowWallet: v.string(),
    status: v.union(
      v.literal("funding"),
      v.literal("funded"),
      v.literal("failed"),
      v.literal("active")
    ),
  })
    .index("by_status", ["status"])
    .index("by_creator", ["creatorWallet"]),

  // Investments in projects
  investments: defineTable({
    projectId: v.id("projects"),
    investorWallet: v.string(),
    investorName: v.optional(v.string()),
    amount: v.number(), // USDC in cents
    txHash: v.optional(v.string()),
    status: v.union(
      v.literal("committed"),
      v.literal("released"),
      v.literal("refunded")
    ),
  })
    .index("by_project", ["projectId"])
    .index("by_investor", ["investorWallet"]),

  // Comments on projects
  comments: defineTable({
    projectId: v.id("projects"),
    authorWallet: v.string(),
    authorName: v.optional(v.string()),
    content: v.string(),
  }).index("by_project", ["projectId"]),
});
