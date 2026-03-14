import { config as dotenvConfig } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { getConfig } from "./config.js";
import { EnvCredentialsProvider } from "./security/credentials.js";
import { HttpClient } from "./http/httpClient.js";
import { ZebpayAPI } from "./private/ZebpayAPI.js";
import { SpotClient } from "./private/SpotClient.js";
import { FuturesClient } from "./private/FuturesClient.js";
import { PublicClient } from "./public/PublicClient.js";
import { PublicFuturesClient } from "./public/PublicFuturesClient.js";
import { registerSpotTools } from "./mcp/tools_spot.js";
import { registerFuturesTools } from "./mcp/tools_futures.js";
import { registerResources } from "./mcp/resources.js";
import { registerPrompts } from "./mcp/prompts.js";
import { fileLogger } from "./utils/fileLogger.js";

dotenvConfig();

function createServer(): McpServer {
  return new McpServer(
    {
      name: "zebpay",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        logging: {},
        resources: {},
        prompts: {},
      },
    }
  );
}

async function main(): Promise<void> {
  const cfg = getConfig();
  if (cfg.logFile) {
    await fileLogger.initialize(cfg.logFile);
  }

  const creds = new EnvCredentialsProvider();
  const http = new HttpClient(cfg.logLevel);
  const api = new ZebpayAPI(cfg, creds, http);
  const spot = new SpotClient(api);
  const futuresPrivateClient = new FuturesClient(api);
  const publicClient = new PublicClient(cfg, http);
  const futuresPublicClient = new PublicFuturesClient(cfg, http);

  const mcp = createServer();
  registerSpotTools(mcp, spot, publicClient, cfg);
  registerFuturesTools(mcp, futuresPublicClient, futuresPrivateClient, cfg);
  registerResources(mcp, publicClient, spot, cfg);
  registerPrompts(mcp, spot, publicClient, cfg);

  const transport = new StdioServerTransport();
  await mcp.connect(transport);

  process.on("SIGINT", async () => {
    await fileLogger.close();
    process.exit(0);
  });
}

main().catch(async (error) => {
  console.error("FATAL: Failed to start Zebpay MCP stdio server", error);
  await fileLogger.close();
  process.exit(1);
});
