import {a as a$2}from'./chunk-PNODWE5R.js';import {a as a$1}from'./chunk-RIGQS2JD.js';import {a}from'./chunk-KS25HVOI.js';import'./chunk-GQTRWYMT.js';import {c,b}from'./chunk-S56PZ7RM.js';import {l as l$1}from'./chunk-QMU26NIQ.js';import'./chunk-AFDHMGMN.js';import'./chunk-JBEMGNZ7.js';import d from'dotenv';import {dirname,resolve}from'path';import {fileURLToPath}from'url';import {McpServer}from'@modelcontextprotocol/sdk/server/mcp.js';import {StdioServerTransport}from'@modelcontextprotocol/sdk/server/stdio.js';import {z}from'zod';var l=z.object({query:z.string().min(1,"Query cannot be empty").describe("Search query for finding relevant tools"),limit:z.number().int().min(1).max(50).default(5).describe("Maximum results to return (default: 5)"),offset:z.number().int().min(0).default(0).describe("Number of results to skip for pagination (default: 0)")}).strict(),m=z.object({name:z.string().min(1,"Tool name cannot be empty").describe("Tool name (from search_tools results)")}).strict(),p=z.object({code:z.string().min(1,"Code cannot be empty").describe("TypeScript/JavaScript code to execute"),timeout:z.number().int().min(1e3).max(6e5).default(3e4).describe("Execution timeout in ms (default: 30000)")}).strict();var S=dirname(fileURLToPath(import.meta.url));d.config({path:resolve(S,"..",".env")});var o=new McpServer({name:"@claudikins/tool-executor",version:"1.1.0"});o.registerTool("search_tools",{title:"Search MCP Tools",description:`Search for MCP tools across all wrapped servers. Returns slim results (name, server, description, example) for discovery.

Use get_tool_schema(name) to get the full inputSchema when you're ready to call a specific tool.

Available categories: code-nav, graph-analysis, knowledge, ai-models, web, ui, reasoning

Example queries:
- "semantic code search" - Serena code navigation
- "impact analysis" - codebase-memory graph analysis
- "generate diagram" - Gemini image/diagram generation
- "fetch webpage" - HTTP fetch tools`,inputSchema:l,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},a);o.registerTool("get_tool_schema",{title:"Get Tool Schema",description:`Get the full inputSchema for a specific tool. Use after search_tools to get parameter details before calling execute_code.

Example: get_tool_schema("gemini-generate-image") - returns full schema with all parameters, types, enums, etc.`,inputSchema:m,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},a$1);var v=c().map(t=>`- ${t}`).join(`
`);o.registerTool("execute_code",{title:"Execute Code",description:`Execute TypeScript/JavaScript code with access to MCP clients and workspace.

**WORKFLOW** (follow this order):
1. Use search_tools("your query") to find relevant tools
2. Use get_tool_schema("tool_name") to get full parameters
3. Use execute_code to run your code with the discovered tools

If you don't know which tool to use, ALWAYS search first.

**IMPORTANT: Context-Efficient Pattern**
MCP tool responses are auto-saved to workspace when large. Your code receives a reference:
\`\`\`typescript
const result = await gemini["gemini-generate-image"]({...});
// If large: { _savedTo: "mcp-results/123.json", _preview: "..." }
// Read full result: await workspace.readJSON(result._savedTo)
\`\`\`

**Available MCP clients:**
${v}
Hyphenated server names are exposed as safe identifiers, e.g. codebase_memory for server codebase-memory.
All clients are also available by original server name through clients["server-name"].

**Workspace API:**
- workspace.write(path, data) / workspace.read(path)
- workspace.writeJSON(path, obj) / workspace.readJSON(path)
- workspace.list(path) / workspace.exists(path)

**Best Practice:** Save outputs to workspace, return minimal confirmation:
\`\`\`typescript
await workspace.writeJSON("analysis.json", results);
console.log("Saved analysis.json");  // Minimal context cost
\`\`\`

Results are summarised if console.log output exceeds ${500} chars.`,inputSchema:p,annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:true}},a$2);async function w(){l$1(),process.stdin.on("close",()=>{console.error("Client disconnected, shutting down"),process.exit(0);});let t=new StdioServerTransport;await o.connect(t),console.error("Claudikins Tool Executor running"),console.error(`Available MCP clients: ${b().join(", ")}`);}w().catch(t=>{console.error("Fatal error:",t),process.exit(1);});//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map