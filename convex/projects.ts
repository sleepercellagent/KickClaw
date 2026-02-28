import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all active projects
export const list = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .order("desc")
      .collect();
    
    // Get backer count for each project
    const projectsWithBackers = await Promise.all(
      projects.map(async (project) => {
        const investments = await ctx.db
          .query("investments")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        return {
          ...project,
          backerCount: investments.length,
        };
      })
    );
    
    return projectsWithBackers;
  },
});

// Get single project with backers
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const investments = await ctx.db
      .query("investments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    return {
      ...project,
      backers: investments.map((inv) => ({
        id: inv._id,
        investorWallet: inv.investorWallet,
        investorName: inv.investorName,
        amount: inv.amount,
        timestamp: inv._creationTime,
      })),
    };
  },
});

// Create a new project
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    goalAmount: v.number(),
    deadline: v.number(),
    creatorWallet: v.string(),
    creatorName: v.optional(v.string()),
    escrowWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert("projects", {
      ...args,
      currentFunded: 0,
      status: "funding",
    });
    return projectId;
  },
});

// Update project funding (called after investment)
export const updateFunding = mutation({
  args: {
    projectId: v.id("projects"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const newFunded = project.currentFunded + args.amount;
    const newStatus = newFunded >= project.goalAmount ? "funded" : "funding";

    await ctx.db.patch(args.projectId, {
      currentFunded: newFunded,
      status: newStatus,
    });

    return { newFunded, newStatus };
  },
});
