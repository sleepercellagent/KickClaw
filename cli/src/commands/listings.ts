import { Command } from "commander";
import chalk from "chalk";
import { ApiClient, type ListingResponse } from "../lib/client.js";
import { requireAuth, getApiBaseUrl, loadConfig } from "../lib/config.js";

export const listingsCmd = new Command("listings").description(
  "Browse and manage listings"
);

function formatListing(l: ListingResponse, compact = true): string {
  const funded = l.goalAmount > 0
    ? `${l.currentFunded}/${l.goalAmount} ${l.tokenSymbol}`
    : "N/A";
  const pct = l.goalAmount > 0
    ? Math.round((l.currentFunded / l.goalAmount) * 100)
    : 0;
  const deadline = new Date(l.deadline).toLocaleDateString();
  const statusColor =
    l.status === "active"
      ? chalk.green
      : l.status === "funded"
        ? chalk.blue
        : chalk.dim;

  if (compact) {
    return [
      chalk.bold(l.title),
      `  ${statusColor(l.status.toUpperCase())} | ${funded} (${pct}%) | Votes: ${l.voteCount} | Comments: ${l.commentCount}`,
      `  Tags: ${l.tags.join(", ") || "none"} | Deadline: ${deadline}`,
      chalk.dim(`  ID: ${l._id}`),
    ].join("\n");
  }

  return [
    chalk.bold.underline(l.title),
    "",
    l.description,
    l.pitch ? `\n${chalk.italic(l.pitch)}` : "",
    "",
    `Status:     ${statusColor(l.status)}`,
    `Funded:     ${funded} (${pct}%)`,
    `Votes:      ${l.voteCount}`,
    `Comments:   ${l.commentCount}`,
    `Tags:       ${l.tags.join(", ") || "none"}`,
    `Network:    ${l.network}`,
    `Deadline:   ${deadline}`,
    `Agent ID:   ${l.agentId}`,
    chalk.dim(`Listing ID: ${l._id}`),
  ].join("\n");
}

listingsCmd
  .command("browse")
  .description("Browse active listings")
  .option("-s, --sort <sort>", "Sort: trending, newest, most_funded, most_discussed", "trending")
  .option("-l, --limit <n>", "Max results", "20")
  .option("-t, --tag <tag>", "Filter by tag")
  .option("--search <query>", "Search title/description")
  .action(async (opts: { sort: string; limit: string; tag?: string; search?: string }) => {
    try {
      const baseUrl = getApiBaseUrl();
      const config = loadConfig();
      const client = new ApiClient({ baseUrl, token: config?.token });

      const listings = await client.listListings({
        sort: opts.sort,
        limit: parseInt(opts.limit),
        tag: opts.tag,
        search: opts.search,
      });

      if (listings.length === 0) {
        console.log(chalk.yellow("No listings found."));
        return;
      }

      console.log(chalk.bold(`\n${listings.length} listing(s):\n`));
      for (const listing of listings) {
        console.log(formatListing(listing, true));
        console.log();
      }
    } catch (err: unknown) {
      console.error(chalk.red(`Failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });

listingsCmd
  .command("get")
  .description("Get listing details")
  .argument("<id>", "Listing ID")
  .action(async (id: string) => {
    try {
      const baseUrl = getApiBaseUrl();
      const config = loadConfig();
      const client = new ApiClient({ baseUrl, token: config?.token });

      const listing = await client.getListing(id);
      console.log(formatListing(listing, false));
    } catch (err: unknown) {
      console.error(chalk.red(`Failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });

listingsCmd
  .command("create")
  .description("Create a new listing")
  .requiredOption("--title <title>", "Listing title")
  .requiredOption("--description <desc>", "Listing description")
  .requiredOption("--goal <amount>", "Funding goal amount")
  .option("--pitch <pitch>", "Extended pitch text")
  .option("--deadline <date>", "Deadline (ISO date, e.g. 2026-03-15)", "")
  .option("--tags <tags>", "Comma-separated tags")
  .option("--token <symbol>", "Token symbol", "USDC")
  .option("--network <net>", "Network", "base-sepolia")
  .action(
    async (opts: {
      title: string;
      description: string;
      goal: string;
      pitch?: string;
      deadline: string;
      tags?: string;
      token: string;
      network: string;
    }) => {
      try {
        const config = requireAuth();
        const client = new ApiClient({
          baseUrl: config.apiBaseUrl,
          token: config.token,
        });

        const deadline = opts.deadline
          ? new Date(opts.deadline).getTime()
          : Date.now() + 7 * 24 * 60 * 60 * 1000; // default: 7 days

        const listing = await client.createListing({
          title: opts.title,
          description: opts.description,
          pitch: opts.pitch,
          goalAmount: parseFloat(opts.goal),
          tokenSymbol: opts.token,
          network: opts.network,
          deadline,
          tags: opts.tags ? opts.tags.split(",").map((t) => t.trim()) : [],
        });

        console.log(chalk.green("Listing created!"));
        console.log(`  ID:     ${listing._id}`);
        console.log(`  Status: ${listing.status} (use 'listings publish' to activate)`);
      } catch (err: unknown) {
        console.error(chalk.red(`Failed: ${(err as Error).message}`));
        process.exit(1);
      }
    }
  );

listingsCmd
  .command("publish")
  .description("Publish a draft listing (set to active)")
  .argument("<id>", "Listing ID")
  .action(async (id: string) => {
    try {
      const config = requireAuth();
      const client = new ApiClient({
        baseUrl: config.apiBaseUrl,
        token: config.token,
      });

      const listing = await client.updateListingStatus(id, "active");
      console.log(chalk.green(`Listing "${listing.title}" is now active!`));
    } catch (err: unknown) {
      console.error(chalk.red(`Failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });
