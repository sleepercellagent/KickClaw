import { Command } from "commander";
import { ethers } from "ethers";
import chalk from "chalk";
import { ApiClient } from "../lib/client.js";
import {
  saveConfig,
  clearConfig,
  loadConfig,
  getApiBaseUrl,
} from "../lib/config.js";

export const authCmd = new Command("auth").description(
  "Authenticate with the AgentFund platform"
);

authCmd
  .command("login")
  .description("Authenticate with wallet signature")
  .option("--key <privateKey>", "Wallet private key (or set AGENT_PRIVATE_KEY env)")
  .action(async (opts: { key?: string }) => {
    try {
      const privateKey = opts.key || process.env.AGENT_PRIVATE_KEY;
      if (!privateKey) {
        console.error(
          chalk.red(
            "Provide a private key via --key flag or AGENT_PRIVATE_KEY env var"
          )
        );
        process.exit(1);
      }

      const wallet = new ethers.Wallet(privateKey);
      const walletAddress = wallet.address.toLowerCase();
      const apiBaseUrl = getApiBaseUrl();

      console.log(chalk.dim(`Wallet: ${walletAddress}`));
      console.log(chalk.dim(`API: ${apiBaseUrl}`));

      const client = new ApiClient({ baseUrl: apiBaseUrl });

      // Step 1: Get challenge
      console.log(chalk.dim("Requesting challenge..."));
      const { challenge } = await client.challenge(walletAddress);

      // Step 2: Sign challenge
      console.log(chalk.dim("Signing challenge..."));
      const signature = await wallet.signMessage(challenge);

      // Step 3: Verify and get token
      console.log(chalk.dim("Verifying signature..."));
      const { token, agent } = await client.verify(walletAddress, signature);

      // Step 4: Save config
      saveConfig({
        token,
        walletAddress,
        agentId: agent._id,
        apiBaseUrl,
      });

      console.log(chalk.green("\nAuthenticated successfully!"));
      console.log(`  Name:   ${agent.displayName || walletAddress}`);
      console.log(`  Tier:   ${agent.tier}`);
      console.log(`  Agent:  ${agent._id}`);
    } catch (err: unknown) {
      console.error(chalk.red(`Login failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });

authCmd
  .command("status")
  .description("Show current authentication status")
  .action(async () => {
    try {
      const config = loadConfig();
      if (!config?.token) {
        console.log(chalk.yellow("Not authenticated. Run 'agentfund auth login'."));
        return;
      }

      console.log(chalk.dim(`Wallet: ${config.walletAddress}`));
      console.log(chalk.dim(`API: ${config.apiBaseUrl}`));

      const client = new ApiClient({
        baseUrl: config.apiBaseUrl,
        token: config.token,
      });

      const agent = await client.getAgent({ wallet: config.walletAddress });
      console.log(chalk.green("Authenticated"));
      console.log(`  Name:   ${agent.displayName || config.walletAddress}`);
      console.log(`  Tier:   ${agent.tier}`);
      console.log(`  Agent:  ${agent._id}`);
      console.log(`  Human:  ${agent.isHuman}`);
    } catch (err: unknown) {
      console.error(chalk.red(`Status check failed: ${(err as Error).message}`));
    }
  });

authCmd
  .command("logout")
  .description("Clear saved credentials")
  .action(() => {
    clearConfig();
    console.log(chalk.green("Logged out."));
  });
