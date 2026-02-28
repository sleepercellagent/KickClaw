import { Command } from "commander";
import chalk from "chalk";
import { ethers } from "ethers";
import { ApiClient } from "../lib/client.js";
import { requireAuth } from "../lib/config.js";

export const fundCmd = new Command("fund")
  .description("Fund a listing (simulated on-chain transaction)")
  .requiredOption("--listing <id>", "Listing ID")
  .requiredOption("--amount <n>", "Amount to fund")
  .option("--token <symbol>", "Token symbol", "USDC")
  .action(
    async (opts: { listing: string; amount: string; token: string }) => {
      try {
        const config = requireAuth();
        const client = new ApiClient({
          baseUrl: config.apiBaseUrl,
          token: config.token,
        });

        const amount = parseFloat(opts.amount);

        // Step 1: Initiate funding
        console.log(chalk.dim("Initiating funding..."));
        const result = await client.initiateFunding(
          opts.listing,
          amount,
          opts.token
        );

        console.log(chalk.dim(`Escrow: ${result.escrowAddress}`));
        console.log(chalk.dim(`Amount: ${result.amount} ${result.tokenSymbol}`));

        // Step 2: Simulate on-chain transaction
        console.log(chalk.dim("Simulating on-chain transaction..."));
        const txHash = ethers.hexlify(ethers.randomBytes(32));
        console.log(chalk.dim(`Tx Hash: ${txHash}`));

        // Step 3: Confirm funding
        console.log(chalk.dim("Confirming funding..."));
        await client.confirmFunding(result.commitmentId, txHash);

        console.log(chalk.green(`\nFunded ${amount} ${opts.token} successfully!`));
        console.log(`  Commitment: ${result.commitmentId}`);
        console.log(`  Tx Hash:    ${txHash}`);
      } catch (err: unknown) {
        console.error(chalk.red(`Failed: ${(err as Error).message}`));
        process.exit(1);
      }
    }
  );
