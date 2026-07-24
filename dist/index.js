import {a}from'./chunk-D74XZ2RB.js';import {c as c$2}from'./chunk-BXDEY5S5.js';import {c as c$1}from'./chunk-RJF7ESVK.js';import'./chunk-QAJKVWMM.js';import {c as c$3,b as b$1}from'./chunk-4EVNRMIE.js';import {m}from'./chunk-QPTKPAQN.js';import'./chunk-IJKJX4XA.js';import'./chunk-J3LZVY42.js';import {b}from'./chunk-BLPALQLO.js';import I from'dotenv';import {dirname,resolve}from'path';import {fileURLToPath}from'url';import {McpServer}from'@modelcontextprotocol/sdk/server/mcp.js';import {StdioServerTransport}from'@modelcontextprotocol/sdk/server/stdio.js';import {z}from'zod';import {Schema,Effect,SchemaIssue,Option}from'effect';function o(t){return Schema.declareConstructor()([],()=>(m,y,G)=>{let p=t.safeParse(m);return p.success?Effect.succeed(p.data):Effect.fail(new SchemaIssue.InvalidType(y,Option.some(m)))},{title:"ZodSchema",description:"effect.Schema adapter over Zod (full safeParse pipeline)"})}var i=z.object({query:z.string().min(1,"Query cannot be empty").describe("Search query for finding relevant tools"),limit:z.number().int().min(1).max(50).default(5).describe(`Maximum results to return (default: ${5})`),offset:z.number().int().min(0).default(0).describe("Number of results to skip for pagination (default: 0)")}).strict();o(i);var c=z.object({name:z.string().min(1,"Tool name cannot be empty").describe("Tool name (from search_tools results)")}).strict();o(c);var l=z.object({code:z.string().min(1,"Code cannot be empty").describe("TypeScript/JavaScript code to execute"),timeout:z.number().int().min(1e3).max(6e5).default(3e4).describe(`Execution timeout in ms (default: ${3e4})`)}).strict();o(l);var A=dirname(fileURLToPath(import.meta.url));I.config({path:resolve(A,"..",".env")});var r=new McpServer({name:"@claudikins/tool-executor",version:b});r.registerTool("search_tools",{title:"Search MCP Tools",description:`Search for MCP tools across all wrapped servers. Returns slim results (name, server, description, example) for discovery.

Use get_tool_schema(name) to get the full inputSchema when you're ready to call a specific tool.

Available categories: code-nav, graph-analysis, knowledge, ai-models, web, ui, reasoning

Example queries:
- "semantic code search" - Serena code navigation
- "impact analysis" - codebase-memory graph analysis
- "generate diagram" - Gemini image/diagram generation
- "fetch webpage" - HTTP fetch tools`,inputSchema:i,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},c$1);r.registerTool("get_tool_schema",{title:"Get Tool Schema",description:`Get the full inputSchema for a specific tool. Use after search_tools to get parameter details before calling execute_code.

Example: get_tool_schema("gemini-generate-image") - returns full schema with all parameters, types, enums, etc.`,inputSchema:c,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},c$2);var U=c$3().map(t=>`- ${t}`).join(`
`);r.registerTool("execute_code",{title:"Execute Code",description:`Execute TypeScript/JavaScript code with access to MCP clients and workspace.

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
${U}
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

Results are summarised if console.log output exceeds ${500} chars.`,inputSchema:l,annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:true}},a);async function L(){m(),process.stdin.on("close",()=>{console.error("Client disconnected, shutting down"),process.exit(0);});let t=new StdioServerTransport;await r.connect(t),console.error("Claudikins Tool Executor running"),console.error(`Available MCP clients: ${b$1().join(", ")}`);}L().catch(t=>{console.error("Fatal error:",t),process.exit(1);});//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map