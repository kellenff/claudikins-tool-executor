import {a}from'./chunk-DMNHU74Q.js';import {c as c$2}from'./chunk-BXDEY5S5.js';import {c as c$1}from'./chunk-RJF7ESVK.js';import'./chunk-QAJKVWMM.js';import {c,b as b$1}from'./chunk-IKNVE7AX.js';import {m as m$1}from'./chunk-CP4URSW5.js';import'./chunk-FRGKVHPU.js';import'./chunk-J3LZVY42.js';import {b}from'./chunk-BLPALQLO.js';import G from'dotenv';import {dirname,resolve}from'path';import {fileURLToPath}from'url';import {McpServer}from'@modelcontextprotocol/sdk/server/mcp.js';import {StdioServerTransport}from'@modelcontextprotocol/sdk/server/stdio.js';import {Schema,Effect}from'effect';import {ListToolsRequestSchema,CallToolRequestSchema,McpError,ErrorCode}from'@modelcontextprotocol/sdk/types.js';var m={onExcessProperty:"error"},u=Schema.Struct({query:Schema.String.annotate({description:"Search query for finding relevant tools"}).check(Schema.isNonEmpty({message:"Query cannot be empty"})),limit:Schema.Number.check(Schema.isInt(),Schema.isBetween({minimum:1,maximum:50})).annotate({description:`Maximum results to return (default: ${5})`}).pipe(Schema.withDecodingDefault(Effect.succeed(5))),offset:Schema.Number.check(Schema.isInt(),Schema.isGreaterThanOrEqualTo(0)).annotate({description:"Number of results to skip for pagination (default: 0)"}).pipe(Schema.withDecodingDefault(Effect.succeed(0)))});function I(t){return Schema.decodeUnknownSync(u,m)(t)}var d=Schema.Struct({name:Schema.String.annotate({description:"Tool name (from search_tools results)"}).check(Schema.isNonEmpty({message:"Tool name cannot be empty"}))});function x(t){return Schema.decodeUnknownSync(d,m)(t)}var h=Schema.Struct({code:Schema.String.annotate({description:"TypeScript/JavaScript code to execute"}).check(Schema.isNonEmpty({message:"Code cannot be empty"})),timeout:Schema.Number.check(Schema.isInt(),Schema.isBetween({minimum:1e3,maximum:6e5})).annotate({description:`Execution timeout in ms (default: ${3e4})`}).pipe(Schema.withDecodingDefault(Effect.succeed(3e4)))});function v(t){return Schema.decodeUnknownSync(h,m)(t)}function U(t){return Schema.toJsonSchemaDocument(t,{additionalProperties:false}).schema}function L(t){return {tools:t.map(o=>({name:o.name,title:o.title,description:o.description,inputSchema:U(o.schema),annotations:o.annotations}))}}function C(t,o){let R=new Map(o.map(r=>[r.name,r]));t.server.setRequestHandler(ListToolsRequestSchema,()=>L(o)),t.server.setRequestHandler(CallToolRequestSchema,async r=>{let a=r.params.name,s=R.get(a);if(!s)throw new McpError(ErrorCode.InvalidParams,`Tool ${a} not found`);try{let n=s.parse(r.params.arguments??{});return await s.handler(n)}catch(n){if(n instanceof McpError)throw n;let A=n instanceof Error?n.message:String(n);throw new McpError(ErrorCode.InvalidParams,`Input validation error: Invalid arguments for tool ${a}: ${A}`)}});}var j=dirname(fileURLToPath(import.meta.url));G.config({path:resolve(j,"..",".env")});var k=new McpServer({name:"@claudikins/tool-executor",version:b}),B=c().map(t=>`- ${t}`).join(`
`);C(k,[{name:"search_tools",title:"Search MCP Tools",description:`Search for MCP tools across all wrapped servers. Returns slim results (name, server, description, example) for discovery.

Use get_tool_schema(name) to get the full inputSchema when you're ready to call a specific tool.

Available categories: code-nav, graph-analysis, knowledge, ai-models, web, ui, reasoning

Example queries:
- "semantic code search" - Serena code navigation
- "impact analysis" - codebase-memory graph analysis
- "generate diagram" - Gemini image/diagram generation
- "fetch webpage" - HTTP fetch tools`,schema:u,parse:I,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},handler:c$1},{name:"get_tool_schema",title:"Get Tool Schema",description:`Get the full inputSchema for a specific tool. Use after search_tools to get parameter details before calling execute_code.

Example: get_tool_schema("gemini-generate-image") - returns full schema with all parameters, types, enums, etc.`,schema:d,parse:x,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},handler:c$2},{name:"execute_code",title:"Execute Code",description:`Execute TypeScript/JavaScript code with access to MCP clients and workspace.

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
${B}
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

Results are summarised if console.log output exceeds ${500} chars.`,schema:h,parse:v,annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:true},handler:a}]);async function F(){m$1(),process.stdin.on("close",()=>{console.error("Client disconnected, shutting down"),process.exit(0);});let t=new StdioServerTransport;await k.connect(t),console.error("Claudikins Tool Executor running"),console.error(`Available MCP clients: ${b$1().join(", ")}`);}F().catch(t=>{console.error("Fatal error:",t),process.exit(1);});//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map