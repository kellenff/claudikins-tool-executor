import {b as b$1}from'./chunk-MI46POJM.js';import {d}from'./chunk-FTQCPAD5.js';import {e,f,g}from'./chunk-65OZHBV5.js';import'./chunk-QAJKVWMM.js';import {e as e$1,d as d$1}from'./chunk-UQSGICPU.js';import {m as m$1}from'./chunk-NLHCLLH7.js';import'./chunk-VWBXAODI.js';import'./chunk-J3LZVY42.js';import {b}from'./chunk-BLPALQLO.js';import A from'dotenv';import {dirname,resolve}from'path';import {fileURLToPath}from'url';import {McpServer}from'@modelcontextprotocol/sdk/server/mcp.js';import {StdioServerTransport}from'@modelcontextprotocol/sdk/server/stdio.js';import {z}from'zod';import {Schema,Effect,SchemaIssue,Option}from'effect';function r(e){return Schema.declareConstructor()([],()=>(o,x,z)=>{let d=e.safeParse(o);return d.success?Effect.succeed(d.data):Effect.fail(new SchemaIssue.InvalidType(x,Option.some(o)))},{title:"ZodSchema",description:"effect.Schema adapter over Zod (full safeParse pipeline)"})}var c=z.object({query:z.string().min(1,"Query cannot be empty").describe("Search query for finding relevant tools"),limit:z.number().int().min(1).max(50).default(5).describe(`Maximum results to return (default: ${5})`),offset:z.number().int().min(0).default(0).describe("Number of results to skip for pagination (default: 0)")}).strict();r(c);var l=z.object({name:z.string().min(1,"Tool name cannot be empty").describe("Tool name (from search_tools results)")}).strict();r(l);var m=z.object({code:z.string().min(1,"Code cannot be empty").describe("TypeScript/JavaScript code to execute"),timeout:z.number().int().min(1e3).max(6e5).default(3e4).describe(`Execution timeout in ms (default: ${3e4})`)}).strict();r(m);var U=dirname(fileURLToPath(import.meta.url));A.config({path:resolve(U,"..",".env"),quiet:true});var a=new McpServer({name:"@claudikins/tool-executor",version:b});a.registerTool("search_tools",{title:"Search MCP Tools",description:`Search for MCP tools across all wrapped servers. Returns slim results (name, server, description, example) for discovery.

Use get_tool_schema(name) to get the full inputSchema when you're ready to call a specific tool.

Available categories: code-nav, graph-analysis, knowledge, ai-models, web, ui, reasoning

Example queries:
- "semantic code search" - Serena code navigation
- "impact analysis" - codebase-memory graph analysis
- "generate diagram" - Gemini image/diagram generation
- "fetch webpage" - HTTP fetch tools`,inputSchema:c,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},d);a.registerTool("get_tool_schema",{title:"Get Tool Schema",description:`Get the full inputSchema for a specific tool. Use after search_tools to get parameter details before calling execute_code.

Example: get_tool_schema("gemini-generate-image") - returns full schema with all parameters, types, enums, etc.`,inputSchema:l,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},e);var N=e$1().map(e=>`- ${e}`).join(`
`);a.registerTool("execute_code",{title:"Execute Code",description:`Execute TypeScript/JavaScript code with access to MCP clients and workspace.

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
${N}
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

Results are summarised if console.log output exceeds ${500} chars.`,inputSchema:m,annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:true}},b$1);var v=false;async function p(e){if(!v){v=true,console.error(e);try{await g();}catch(o){console.error("Error during runtime dispose:",o);}process.exit(0);}}async function j(){m$1(),f(),process.stdin.on("close",()=>{p("Client disconnected, shutting down");}),process.on("SIGINT",()=>{p("SIGINT, shutting down");}),process.on("SIGTERM",()=>{p("SIGTERM, shutting down");});let e=new StdioServerTransport;await a.connect(e),console.error("Claudikins Tool Executor running"),console.error(`Available MCP clients: ${d$1().join(", ")}`);}j().catch(e=>{console.error("Fatal error:",e),process.exit(1);});//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map