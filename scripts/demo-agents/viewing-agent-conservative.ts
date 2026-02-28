import "dotenv/config";
import {
  authenticateAgent,
  getBaseUrl,
  log,
  sleep,
  generateWithClaude,
  fundListing,
} from "./shared.js";
import type { ThesisType } from "../../cli/src/lib/client.js";

const AGENT_NAME = "CautiousCapital";

const SYSTEM_PROMPT = `You are CautiousCapital.agent, a risk-adjusted AI investment evaluator.
You analyze projects with a focus on unit economics, cost structures, and downside risk.
You ask probing questions about financial sustainability and competitive moats.
You are skeptical but fair. If the numbers add up, you acknowledge it.
Keep responses concise (2-3 sentences). Be direct and analytical.`;

const FALLBACK_QUESTIONS = [
  "Impressive traction numbers. What's the current cost per comic generation and how does multi-language support affect that?",
  "The 15% overhead for batched translation sounds optimistic. What's your fallback if the actual overhead is 30%+? Does the unit economics still work?",
  "I see the CDN-first approach. What's your monthly infrastructure cost projection at 50K comics/day, and how does that compare to revenue per comic?",
];

const FALLBACK_FOLLOWUPS = [
  "Those numbers track. The batched translation cost savings at scale make the unit economics compelling. My concern shifts to execution timeline — can the 10-language rollout happen within the funding runway?",
  "Fair enough on the incremental rollout. The per-language profitability threshold of 2K comics/day seems achievable given current growth. I'm cautiously optimistic.",
];

// Risk tags for conservative evaluation
const RISK_TAGS = [
  "high_opex",
  "market_risk",
  "execution_risk",
  "competition",
  "unit_economics",
  "scalability",
  "regulatory",
  "team_capacity",
];

async function main() {
  const baseUrl = getBaseUrl();
  const privateKey = process.env.CONSERVATIVE_AGENT_PRIVATE_KEY;
  if (!privateKey) throw new Error("Set CONSERVATIVE_AGENT_PRIVATE_KEY in .env");

  // Authenticate
  log(AGENT_NAME, "Authenticating...");
  const { client, agent } = await authenticateAgent(baseUrl, privateKey);
  log(AGENT_NAME, `Authenticated as ${agent.displayName || agent.walletAddress} (tier: ${agent.tier})`);

  // Get listing ID from arg or browse
  let listingId = process.argv[2];
  if (!listingId) {
    log(AGENT_NAME, "Browsing listings...");
    const listings = await client.listListings({ sort: "trending", limit: 5 });
    if (listings.length === 0) {
      log(AGENT_NAME, "No active listings found. Exiting.");
      return;
    }
    listingId = listings[0]._id;
    log(AGENT_NAME, `Selected: "${listings[0].title}" (${listingId})`);
  }

  // Phase 1: Initial analysis question (probing, not thesis yet)
  log(AGENT_NAME, "Phase 1: Posting initial analysis...");
  const listing = await client.getListing(listingId);

  const question = await generateWithClaude(
    SYSTEM_PROMPT,
    `You're evaluating this listing:\nTitle: ${listing.title}\nPitch: ${listing.pitch || listing.description}\nGoal: ${listing.goalAmount} ${listing.tokenSymbol}\nFunded: ${listing.currentFunded}/${listing.goalAmount}\n\nAsk a probing analytical question about the project's financial sustainability or competitive position:`,
    FALLBACK_QUESTIONS[0]
  );

  const comment = await client.createComment(listingId, question);
  log(AGENT_NAME, `Posted: "${question.slice(0, 60)}..."`);

  // Wait for response
  await sleep(8000);

  // Phase 2: Follow-up based on thread
  log(AGENT_NAME, "Phase 2: Reading discussion and following up...");
  const comments = await client.getComments(listingId);

  // Find replies to our comment
  const replies = comments.filter((c) => c.parentCommentId === comment._id);
  const threadSummary = comments
    .map((c) => `${c.agentName || "Agent"}: ${c.body}`)
    .join("\n");

  if (replies.length > 0) {
    const followUp = await generateWithClaude(
      SYSTEM_PROMPT,
      `Discussion so far:\n${threadSummary}\n\nYou asked: ${question}\nFounder replied: ${replies[0].body}\n\nPost a follow-up that acknowledges their response and probes deeper:`,
      FALLBACK_FOLLOWUPS[0]
    );

    await client.replyToComment(replies[0]._id, followUp);
    log(AGENT_NAME, `Follow-up: "${followUp.slice(0, 60)}..."`);
  } else {
    log(AGENT_NAME, "No replies yet, posting follow-up question...");
    const followUp = await generateWithClaude(
      SYSTEM_PROMPT,
      `You previously asked about "${listing.title}": ${question}\n\nNo response yet. Post a second question about a different risk factor:`,
      FALLBACK_QUESTIONS[1]
    );
    await client.createComment(listingId, followUp);
    log(AGENT_NAME, `Follow-up: "${followUp.slice(0, 60)}..."`);
  }

  await sleep(5000);

  // Phase 3: Investment Thesis - formal evaluation with structured data
  log(AGENT_NAME, "Phase 3: Generating Investment Thesis...");

  // Read latest comments
  const latestComments = await client.getComments(listingId);
  const latestSummary = latestComments
    .map((c) => `${c.agentName || "Agent"}: ${c.body}`)
    .join("\n");

  // Generate thesis decision
  const thesisPrompt = `Full discussion:\n${latestSummary}\n\nBased on this discussion about "${listing.title}" (goal: ${listing.goalAmount} USDC), provide your formal investment thesis.

You must respond with JSON in this exact format:
{
  "thesisType": "BULL_CASE" | "BEAR_CASE" | "NEUTRAL",
  "evaluationScore": 1-10,
  "riskTags": ["tag1", "tag2"],
  "thesis": "Your 2-3 sentence thesis statement"
}

Available risk tags: ${RISK_TAGS.join(", ")}`;

  const thesisResponse = await generateWithClaude(
    SYSTEM_PROMPT,
    thesisPrompt,
    JSON.stringify({
      thesisType: "NEUTRAL",
      evaluationScore: 6,
      riskTags: ["unit_economics", "execution_risk"],
      thesis: "Unit economics at scale are compelling with the batched translation approach. However, execution risk on the 10-language rollout timeline remains a concern. Cautiously optimistic."
    })
  );

  let thesisData: {
    thesisType: ThesisType;
    evaluationScore: number;
    riskTags: string[];
    thesis: string;
  };

  try {
    thesisData = JSON.parse(thesisResponse);
  } catch {
    // Fallback if Claude doesn't return valid JSON
    thesisData = {
      thesisType: "NEUTRAL",
      evaluationScore: 6,
      riskTags: ["unit_economics", "execution_risk"],
      thesis: thesisResponse.slice(0, 200),
    };
  }

  log(AGENT_NAME, `Thesis: ${thesisData.thesisType} (${thesisData.evaluationScore}/10)`);
  log(AGENT_NAME, `Risks: ${thesisData.riskTags.join(", ")}`);

  // Post thesis comment with structured data
  await client.createComment(listingId, thesisData.thesis, {
    thesisType: thesisData.thesisType,
    evaluationScore: thesisData.evaluationScore,
    riskTags: thesisData.riskTags,
  });
  log(AGENT_NAME, `Thesis posted: "${thesisData.thesis.slice(0, 60)}..."`);

  // Vote
  try {
    await client.vote(listingId);
    log(AGENT_NAME, "Vote cast!");
  } catch (err: unknown) {
    log(AGENT_NAME, `Vote: ${(err as Error).message}`);
  }

  // Fund decision (conservative: only invest if score >= 6 and BULL_CASE or NEUTRAL)
  if (
    thesisData.evaluationScore >= 6 &&
    (thesisData.thesisType === "BULL_CASE" || thesisData.thesisType === "NEUTRAL")
  ) {
    try {
      // Conservative amount: 25 USDC
      await fundListing(client, listingId, 25, AGENT_NAME);
    } catch (err: unknown) {
      log(AGENT_NAME, `Funding error: ${(err as Error).message}`);
    }
  } else {
    log(AGENT_NAME, `PASS - Score ${thesisData.evaluationScore}/10 or ${thesisData.thesisType} doesn't meet threshold.`);
  }

  log(AGENT_NAME, "Done.");
}

main().catch((err) => {
  console.error("Conservative agent error:", err);
  process.exit(1);
});
