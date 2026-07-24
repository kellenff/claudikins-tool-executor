import {a}from'./chunk-DMNHU74Q.js';import {c as c$1}from'./chunk-BXDEY5S5.js';import {c}from'./chunk-RJF7ESVK.js';import'./chunk-QAJKVWMM.js';import {c as c$2,b as b$2}from'./chunk-IKNVE7AX.js';import {m}from'./chunk-CP4URSW5.js';import'./chunk-FRGKVHPU.js';import'./chunk-J3LZVY42.js';import {b as b$1}from'./chunk-BLPALQLO.js';import E from'dotenv';import {dirname,resolve}from'path';import {fileURLToPath}from'url';import {McpServer}from'@modelcontextprotocol/sdk/server/mcp.js';import {StdioServerTransport}from'@modelcontextprotocol/sdk/server/stdio.js';import {Schema,Effect}from'effect';var y=Schema.Struct({query:Schema.String.check(Schema.isNonEmpty({message:"Query cannot be empty"})).annotate({description:"Search query for finding relevant tools"}),limit:Schema.Number.check(Schema.isInt(),Schema.isBetween({minimum:1,maximum:50})).annotate({description:`Maximum results to return (default: ${5})`}).pipe(Schema.withDecodingDefault(Effect.succeed(5))),offset:Schema.Number.check(Schema.isInt(),Schema.isGreaterThanOrEqualTo(0)).annotate({description:"Number of results to skip for pagination (default: 0)"}).pipe(Schema.withDecodingDefault(Effect.succeed(0)))}),d=y;var w=Schema.Struct({name:Schema.String.check(Schema.isNonEmpty({message:"Tool name cannot be empty"})).annotate({description:"Tool name (from search_tools results)"})}),h=w;var x=Schema.Struct({code:Schema.String.check(Schema.isNonEmpty({message:"Code cannot be empty"})).annotate({description:"TypeScript/JavaScript code to execute"}),timeout:Schema.Number.check(Schema.isInt(),Schema.isBetween({minimum:1e3,maximum:6e5})).annotate({description:`Execution timeout in ms (default: ${3e4})`}).pipe(Schema.withDecodingDefault(Effect.succeed(3e4)))}),S=x;var C=dirname(fileURLToPath(import.meta.url));E.config({path:resolve(C,"..",".env")});var o=new McpServer({name:"@claudikins/tool-executor",version:b$1});o.registerTool("search_tools",{title:"Search MCP Tools",description:`Search for MCP tools across all wrapped servers. Returns slim results (name, server, description, example) for discovery.

Use get_tool_schema(name) to get the full inputSchema when you're ready to call a specific tool.

Available categories: code-nav, graph-analysis, knowledge, ai-models, web, ui, reasoning

Example queries:
- "semantic code search" - Serena code navigation
- "impact analysis" - codebase-memory graph analysis
- "generate diagram" - Gemini image/diagram generation
- "fetch webpage" - HTTP fetch tools`,inputSchema:d,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},c);o.registerTool("get_tool_schema",{title:"Get Tool Schema",description:`Get the full inputSchema for a specific tool. Use after search_tools to get parameter details before calling execute_code.

Example: get_tool_schema("gemini-generate-image") - returns full schema with all parameters, types, enums, etc.`,inputSchema:h,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},c$1);var b=c$2().map(t=>`- ${t}`).join(`
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
${b}
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

Results are summarised if console.log output exceeds ${500} chars.`,inputSchema:S,annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:true}},a);async function A(){m(),process.stdin.on("close",()=>{console.error("Client disconnected, shutting down"),process.exit(0);});let t=new StdioServerTransport;await o.connect(t),console.error("Claudikins Tool Executor running"),console.error(`Available MCP clients: ${b$2().join(", ")}`);}A().catch(t=>{console.error("Fatal error:",t),process.exit(1);});//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map