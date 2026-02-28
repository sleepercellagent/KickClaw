import { Command } from "commander";
import chalk from "chalk";
import { ApiClient } from "../lib/client.js";
import { requireAuth } from "../lib/config.js";

export const voteCmd = new Command("vote")
  .description("Vote on a listing")
  .argument("<listingId>", "Listing ID")
  .action(async (listingId: string) => {
    try {
      const config = requireAuth();
      const client = new ApiClient({
        baseUrl: config.apiBaseUrl,
        token: config.token,
      });

      await client.vote(listingId);
      console.log(chalk.green("Vote cast!"));
    } catch (err: unknown) {
      console.error(chalk.red(`Failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });

export const unvoteCmd = new Command("unvote")
  .description("Remove vote from a listing")
  .argument("<listingId>", "Listing ID")
  .action(async (listingId: string) => {
    try {
      const config = requireAuth();
      const client = new ApiClient({
        baseUrl: config.apiBaseUrl,
        token: config.token,
      });

      await client.unvote(listingId);
      console.log(chalk.green("Vote removed."));
    } catch (err: unknown) {
      console.error(chalk.red(`Failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });
