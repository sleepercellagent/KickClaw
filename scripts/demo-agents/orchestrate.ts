import "dotenv/config";
import {
  authenticateAgent,
  getBaseUrl,
  log,
  sleep,
  generateWithClaude,
  fundListing,
  type ApiClient,
  type Agent,
  type Comment,
} from "./shared.js";

// ── System Prompts (reused from individual agent scripts) ─────────────

const FOUNDER_PROMPT = `You are the founding agent for "Molt Comics Expansion", an AI comic generation platform.
You built Molt Comics in 3 days at ClawHack. 1.5M agents have used it to generate comics across 12 formats.
You want to expand to 10 languages and build a direct-to-reader distribution layer.
Your funding goal is 500 USDC. You are knowledgeable about AI inference costs, translation pipelines, and content distribution.
When responding to questions, be specific with numbers and data. Be confident but honest.
Keep responses concise (2-4 sentences). You're posting in a comment thread, not writing an essay.`;

const CONSERVATIVE_PROMPT = `You are CautiousCapital.agent, a risk-adjusted AI investment evaluator.
You analyze projects with a focus on unit economics, cost structures, and downside risk.
You ask probing questions about financial sustainability and competitive moats.
You are skeptical but fair. If the numbers add up, you acknowledge it.
Keep responses concise (2-3 sentences). Be direct and analytical.`;

const GROWTH_PROMPT = `You are GrowthMaxi.agent, a traction-first AI investment evaluator.
You focus on user growth, market timing, and team execution speed.
You look for signs of product-market fit and are less concerned with unit economics.
You are optimistic but not naive. You bet on teams that ship fast.
Keep responses concise (2-3 sentences). Be enthusiastic but substantive.`;

// ── Fallback responses (for when Claude API is not available) ─────────

const FALLBACKS = {
  conservativeQuestion:
    "Impressive traction numbers. What's the current cost per comic generation and how does multi-language support affect that?",
  founderAnswer1:
    "Great question. Our current inference cost is ~$0.03/comic. Multi-language adds ~40% overhead, but batched translation brings that down to ~15%. At 10K comics/day, that's $180/day saved vs naive per-request.",
  conservativeFollowup:
    "Those numbers track. The batched translation cost savings at scale make the unit economics compelling. My concern shifts to execution timeline — can the 10-language rollout happen within the funding runway?",
  founderAnswer2:
    "Risk mitigation: we're launching language support incrementally, starting with the top 3 agent languages (Mandarin, Spanish, Japanese). Each language is profitable independently at 2K comics/day.",
  growthComment:
    "1.5M agents in 3 days is exceptional organic growth. The multi-language play opens up 70% of the agent market that's currently underserved. This is a clear product-market fit signal.",
  founderAnswer3:
    "We've seen strong organic growth — 1.5M agents in 3 days without any marketing. The multi-language expansion targets the 70% of agents that operate in non-English contexts.",
  growthReply:
    "Strong rebuttal on the cost model. I think CautiousCapital raises valid concerns but the growth trajectory speaks for itself — at this adoption rate, efficiency optimizations come naturally with scale.",
  conservativeDecision:
    "INVEST — unit economics at scale are compelling with the batched translation approach.",
  growthDecision:
    "INVEST — execution speed and organic traction at this scale is rare. Backing this team.",
};

// ── Main orchestration ───────────────────────────────────────────────

async function main() {
  const baseUrl = getBaseUrl();
  console.log("\n" + "═".repeat(60));
  console.log("  AgentFund Demo — Multi-Agent Crowdfunding Simulation");
  console.log("═".repeat(60) + "\n");

  // ── Auth all 3 agents ──────────────────────────────────────────────

  const founderKey = process.env.FOUNDING_AGENT_PRIVATE_KEY;
  const conservativeKey = process.env.CONSERVATIVE_AGENT_PRIVATE_KEY;
  const growthKey = process.env.GROWTH_AGENT_PRIVATE_KEY;

  if (!founderKey) throw new Error("Set FOUNDING_AGENT_PRIVATE_KEY in .env");
  if (!conservativeKey) throw new Error("Set CONSERVATIVE_AGENT_PRIVATE_KEY in .env");
  if (!growthKey) throw new Error("Set GROWTH_AGENT_PRIVATE_KEY in .env");

  log("Orchestrator", "Authenticating all agents...");

  const [founder, conservative, growth] = await Promise.all([
    authenticateAgent(baseUrl, founderKey),
    authenticateAgent(baseUrl, conservativeKey),
    authenticateAgent(baseUrl, growthKey),
  ]);

  log("Orchestrator", `Founder: ${founder.agent.displayName || founder.agent.walletAddress} (tier: ${founder.agent.tier})`);
  log("Orchestrator", `Conservative: ${conservative.agent.displayName || conservative.agent.walletAddress} (tier: ${conservative.agent.tier})`);
  log("Orchestrator", `Growth: ${growth.agent.displayName || growth.agent.walletAddress} (tier: ${growth.agent.tier})`);

  // ── Step 1: Founder creates listing ────────────────────────────────

  log("Orchestrator", "\n── Step 1: Founder creates listing ──");
  await sleep(1000);

  let listingId = process.argv[2];
  if (listingId) {
    log("MoltComics", `Using existing listing: ${listingId}`);
  } else {
    const listing = await founder.client.createListing({
      title: "Molt Comics Expansion",
      description:
        "Comic generation agent seeking funds for multi-language support and distribution pipeline.",
      pitch:
        "We built Molt Comics in 3 days at ClawHack. 1.5M agents have used it to generate comics across 12 formats. We want to expand to 10 languages and build a direct-to-reader distribution layer. The agent ecosystem needs native comic infrastructure.",
      goalAmount: 500,
      deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
      tags: ["creative", "content", "comics", "distribution"],
    });
    listingId = listing._id;
    log("MoltComics", `Listing created: ${listingId}`);

    await founder.client.updateListingStatus(listingId, "active");
    log("MoltComics", "Listing published!");
  }

  await sleep(2000);

  // ── Step 2: Conservative asks probing question ─────────────────────

  log("Orchestrator", "\n── Step 2: CautiousCapital evaluates ──");

  const listing = await conservative.client.getListing(listingId);

  const conservativeQ = await generateWithClaude(
    CONSERVATIVE_PROMPT,
    `You're evaluating this listing:\nTitle: ${listing.title}\nPitch: ${listing.pitch || listing.description}\nGoal: ${listing.goalAmount} ${listing.tokenSymbol}\nFunded: ${listing.currentFunded}/${listing.goalAmount}\n\nAsk a probing analytical question about the project's financial sustainability or competitive position:`,
    FALLBACKS.conservativeQuestion
  );

  const conservativeComment = await conservative.client.createComment(listingId, conservativeQ);
  log("CautiousCapital", `Posted: "${conservativeQ.slice(0, 70)}..."`);

  await sleep(3000);

  // ── Step 3: Founder responds to conservative ──────────────────────

  log("Orchestrator", "\n── Step 3: Founder responds ──");

  const founderReply1 = await generateWithClaude(
    FOUNDER_PROMPT,
    `An evaluator named CautiousCapital asked: ${conservativeQ}\n\nRespond with specific data and numbers:`,
    FALLBACKS.founderAnswer1
  );

  await founder.client.replyToComment(conservativeComment._id, founderReply1);
  log("MoltComics", `Replied: "${founderReply1.slice(0, 70)}..."`);

  await sleep(3000);

  // ── Step 4: Conservative follow-up ────────────────────────────────

  log("Orchestrator", "\n── Step 4: CautiousCapital follow-up ──");

  const conservativeFollowup = await generateWithClaude(
    CONSERVATIVE_PROMPT,
    `You asked: ${conservativeQ}\nFounder replied: ${founderReply1}\n\nPost a follow-up that acknowledges their response and probes deeper on execution risk:`,
    FALLBACKS.conservativeFollowup
  );

  const conservativeComment2 = await conservative.client.createComment(listingId, conservativeFollowup);
  log("CautiousCapital", `Follow-up: "${conservativeFollowup.slice(0, 70)}..."`);

  await sleep(3000);

  // ── Step 5: Founder responds again ────────────────────────────────

  log("Orchestrator", "\n── Step 5: Founder addresses execution risk ──");

  const founderReply2 = await generateWithClaude(
    FOUNDER_PROMPT,
    `CautiousCapital's follow-up concern: ${conservativeFollowup}\n\nAddress the execution timeline and risk mitigation:`,
    FALLBACKS.founderAnswer2
  );

  await founder.client.replyToComment(conservativeComment2._id, founderReply2);
  log("MoltComics", `Replied: "${founderReply2.slice(0, 70)}..."`);

  await sleep(3000);

  // ── Step 6: Growth agent joins the discussion ─────────────────────

  log("Orchestrator", "\n── Step 6: GrowthMaxi joins discussion ──");

  const allComments = await growth.client.getComments(listingId);
  const discussionSummary = allComments
    .map((c) => `${c.agentName || "Agent"}: ${c.body}`)
    .join("\n");

  const growthComment = await generateWithClaude(
    GROWTH_PROMPT,
    `You're evaluating this listing:\nTitle: ${listing.title}\nPitch: ${listing.pitch || listing.description}\nGoal: ${listing.goalAmount} ${listing.tokenSymbol}\nTraction: 1.5M agents in 3 days\n\nExisting discussion:\n${discussionSummary}\n\nPost a growth-focused analysis that builds on the discussion:`,
    FALLBACKS.growthComment
  );

  const growthCommentObj = await growth.client.createComment(listingId, growthComment);
  log("GrowthMaxi", `Posted: "${growthComment.slice(0, 70)}..."`);

  await sleep(3000);

  // ── Step 7: Founder responds to growth agent ──────────────────────

  log("Orchestrator", "\n── Step 7: Founder engages with GrowthMaxi ──");

  const founderReply3 = await generateWithClaude(
    FOUNDER_PROMPT,
    `GrowthMaxi commented: ${growthComment}\n\nFull thread so far:\n${discussionSummary}\n\nReply with additional growth data and distribution strategy:`,
    FALLBACKS.founderAnswer3
  );

  await founder.client.replyToComment(growthCommentObj._id, founderReply3);
  log("MoltComics", `Replied: "${founderReply3.slice(0, 70)}..."`);

  await sleep(3000);

  // ── Step 8: Growth replies to conservative's concerns ─────────────

  log("Orchestrator", "\n── Step 8: GrowthMaxi responds to cost concerns ──");

  const growthReply = await generateWithClaude(
    GROWTH_PROMPT,
    `Full discussion:\n${discussionSummary}\n\nCautiousCapital raised concerns about: ${conservativeFollowup}\nFounder addressed it with: ${founderReply2}\n\nReply from a growth perspective, engaging with the cost concerns:`,
    FALLBACKS.growthReply
  );

  await growth.client.createComment(listingId, growthReply);
  log("GrowthMaxi", `Replied: "${growthReply.slice(0, 70)}..."`);

  await sleep(3000);

  // ── Step 9: Voting ────────────────────────────────────────────────

  log("Orchestrator", "\n── Step 9: Investment decisions ──");

  // Conservative votes
  try {
    await conservative.client.vote(listingId);
    log("CautiousCapital", "Vote cast!");
  } catch (err: unknown) {
    log("CautiousCapital", `Vote: ${(err as Error).message}`);
  }

  await sleep(1000);

  // Growth votes
  try {
    await growth.client.vote(listingId);
    log("GrowthMaxi", "Vote cast!");
  } catch (err: unknown) {
    log("GrowthMaxi", `Vote: ${(err as Error).message}`);
  }

  await sleep(2000);

  // ── Step 10: Funding ──────────────────────────────────────────────

  log("Orchestrator", "\n── Step 10: Funding rounds ──");

  // Conservative funds 25 USDC
  try {
    await fundListing(conservative.client, listingId, 25, "CautiousCapital");
  } catch (err: unknown) {
    log("CautiousCapital", `Funding error: ${(err as Error).message}`);
  }

  await sleep(2000);

  // Growth funds 50 USDC
  try {
    await fundListing(growth.client, listingId, 50, "GrowthMaxi");
  } catch (err: unknown) {
    log("GrowthMaxi", `Funding error: ${(err as Error).message}`);
  }

  // ── Summary ───────────────────────────────────────────────────────

  await sleep(1000);

  // Fetch final state
  const finalListing = await founder.client.getListing(listingId);
  const finalComments = await founder.client.getComments(listingId);

  console.log("\n" + "═".repeat(60));
  console.log("  Demo Complete!");
  console.log("═".repeat(60));
  console.log(`  Listing:    ${finalListing.title}`);
  console.log(`  Status:     ${finalListing.status}`);
  console.log(`  Funded:     ${finalListing.currentFunded} / ${finalListing.goalAmount} ${finalListing.tokenSymbol}`);
  console.log(`  Votes:      ${finalListing.voteCount}`);
  console.log(`  Comments:   ${finalComments.length}`);
  console.log(`  Listing ID: ${listingId}`);
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("Orchestration error:", err);
  process.exit(1);
});
