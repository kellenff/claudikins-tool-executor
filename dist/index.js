import {b,e}from'./chunk-GQTRWYMT.js';import {c as c$1,a as a$1,b as b$1}from'./chunk-S56PZ7RM.js';import {l}from'./chunk-QMU26NIQ.js';import'./chunk-AFDHMGMN.js';import'./chunk-JBEMGNZ7.js';import v from'dotenv';import {dirname,resolve}from'path';import {fileURLToPath}from'url';import {McpServer}from'@modelcontextprotocol/sdk/server/mcp.js';import {StdioServerTransport}from'@modelcontextprotocol/sdk/server/stdio.js';import {z}from'zod';var h=z.object({query:z.string().min(1,"Query cannot be empty").describe("Search query for finding relevant tools"),limit:z.number().int().min(1).max(50).default(5).describe("Maximum results to return (default: 5)"),offset:z.number().int().min(0).default(0).describe("Number of results to skip for pagination (default: 0)")}).strict(),g=z.object({name:z.string().min(1,"Tool name cannot be empty").describe("Tool name (from search_tools results)")}).strict(),x=z.object({code:z.string().min(1,"Code cannot be empty").describe("TypeScript/JavaScript code to execute"),timeout:z.number().int().min(1e3).max(6e5).default(3e4).describe("Execution timeout in ms (default: 30000)")}).strict();function y(t){if(!t)return "";let e=t.split(`
`)[0].trim();return e.length>80?e.slice(0,77)+"...":e}async function i(t){let e=await b(t.query,t.limit,t.offset),r={results:e.results.map(s=>({name:s.tool.name,server:s.tool.server,description:y(s.tool.description)})),count:e.results.length,limit:t.limit,offset:t.offset,totalCount:e.totalCount,has_more:t.offset+e.results.length<(e.totalCount||0),source:e.source,...e.fallbackReason&&{fallbackReason:e.fallbackReason},...e.suggestion&&{suggestion:e.suggestion}};return {content:[{type:"text",text:JSON.stringify(r,null,2)}],structuredContent:r}}async function a(t){let e$1=await e(t.name);if(!e$1)return {content:[{type:"text",text:JSON.stringify({error:`Tool not found: ${t.name}`,suggestion:"Use search_tools to find available tools first"})}],isError:true};let r={name:e$1.name,server:e$1.server,description:e$1.description,inputSchema:e$1.inputSchema,example:e$1.example,notes:e$1.notes};return {content:[{type:"text",text:JSON.stringify(r,null,2)}],structuredContent:r}}async function c(t){let e=await a$1(t.code,t.timeout);return {content:[{type:"text",text:JSON.stringify(e,null,2)}],structuredContent:{...e},isError:!!e.error}}var C=dirname(fileURLToPath(import.meta.url));v.config({path:resolve(C,"..",".env")});var n=new McpServer({name:"@claudikins/tool-executor",version:"1.1.0"});n.registerTool("search_tools",{title:"Search MCP Tools",description:`Search for MCP tools across all wrapped servers. Returns slim results (name, server, description, example) for discovery.

Use get_tool_schema(name) to get the full inputSchema when you're ready to call a specific tool.

Available categories: code-nav, graph-analysis, knowledge, ai-models, web, ui, reasoning

Example queries:
- "semantic code search" - Serena code navigation
- "impact analysis" - codebase-memory graph analysis
- "generate diagram" - Gemini image/diagram generation
- "fetch webpage" - HTTP fetch tools`,inputSchema:h,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},i);n.registerTool("get_tool_schema",{title:"Get Tool Schema",description:`Get the full inputSchema for a specific tool. Use after search_tools to get parameter details before calling execute_code.

Example: get_tool_schema("gemini-generate-image") - returns full schema with all parameters, types, enums, etc.`,inputSchema:g,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},a);var I=c$1().map(t=>`- ${t}`).join(`
`);n.registerTool("execute_code",{title:"Execute Code",description:`Execute TypeScript/JavaScript code with access to MCP clients and workspace.

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
${I}
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

Results are summarised if console.log output exceeds ${500} chars.`,inputSchema:x,annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:true}},c);async function E(){l(),process.stdin.on("close",()=>{console.error("Client disconnected, shutting down"),process.exit(0);});let t=new StdioServerTransport;await n.connect(t),console.error("Claudikins Tool Executor running"),console.error(`Available MCP clients: ${b$1().join(", ")}`);}E().catch(t=>{console.error("Fatal error:",t),process.exit(1);});//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map