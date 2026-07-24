import {a}from'./chunk-DMNHU74Q.js';import {c as c$2}from'./chunk-BXDEY5S5.js';import {c as c$1}from'./chunk-RJF7ESVK.js';import'./chunk-QAJKVWMM.js';import {c,b as b$1}from'./chunk-IKNVE7AX.js';import {m as m$1}from'./chunk-CP4URSW5.js';import'./chunk-FRGKVHPU.js';import'./chunk-J3LZVY42.js';import {b}from'./chunk-BLPALQLO.js';import J from'dotenv';import {dirname,resolve}from'path';import {fileURLToPath}from'url';import {McpServer}from'@modelcontextprotocol/sdk/server/mcp.js';import {StdioServerTransport}from'@modelcontextprotocol/sdk/server/stdio.js';import {Schema,Effect}from'effect';import {ListToolsRequestSchema,CallToolRequestSchema,McpError,ErrorCode}from'@modelcontextprotocol/sdk/types.js';var p={onExcessProperty:"error"},m=Schema.Struct({query:Schema.String.annotate({description:"Search query for finding relevant tools"}).check(Schema.isNonEmpty({message:"Query cannot be empty"})),limit:Schema.Number.check(Schema.isInt(),Schema.isBetween({minimum:1,maximum:50})).annotate({description:`Maximum results to return (default: ${5})`}).pipe(Schema.withDecodingDefault(Effect.succeed(5))),offset:Schema.Number.check(Schema.isInt(),Schema.isGreaterThanOrEqualTo(0)).annotate({description:"Number of results to skip for pagination (default: 0)"}).pipe(Schema.withDecodingDefault(Effect.succeed(0)))});function x(e){return Schema.decodeUnknownSync(m,p)(e)}var u=Schema.Struct({name:Schema.String.annotate({description:"Tool name (from search_tools results)"}).check(Schema.isNonEmpty({message:"Tool name cannot be empty"}))});function I(e){return Schema.decodeUnknownSync(u,p)(e)}var d=Schema.Struct({code:Schema.String.annotate({description:"TypeScript/JavaScript code to execute"}).check(Schema.isNonEmpty({message:"Code cannot be empty"})),timeout:Schema.Number.check(Schema.isInt(),Schema.isBetween({minimum:1e3,maximum:6e5})).annotate({description:`Execution timeout in ms (default: ${3e4})`}).pipe(Schema.withDecodingDefault(Effect.succeed(3e4)))});function v(e){return Schema.decodeUnknownSync(d,p)(e)}function H(e){return Schema.toJsonSchemaDocument(e,{additionalProperties:false}).schema}function N(e){return {tools:e.map(o=>({name:o.name,title:o.title,description:o.description,inputSchema:H(o.schema),annotations:o.annotations}))}}function U(e,o){try{return e.parse(o??{})}catch(r){let n=r instanceof Error?r.message:String(r);throw new McpError(ErrorCode.InvalidParams,`Input validation error: ${n}`)}}function L(e){return {content:[{type:"text",text:e}],isError:true}}async function D(e,o){let r=U(e,o);try{return await e.handler(r)}catch(n){if(n instanceof McpError)throw n;let a=n instanceof Error?n.message:String(n);return L(a)}}function k(e,o){let r=new Map(o.map(n=>[n.name,n]));e.server.registerCapabilities({tools:{listChanged:true}}),e.server.setRequestHandler(ListToolsRequestSchema,()=>N(o)),e.server.setRequestHandler(CallToolRequestSchema,async n=>{let a=n.params.name,h=r.get(a);if(!h)throw new McpError(ErrorCode.InvalidParams,`Tool ${a} not found`);return D(h,n.params.arguments)});}var W=dirname(fileURLToPath(import.meta.url));J.config({path:resolve(W,"..",".env")});var R=new McpServer({name:"@claudikins/tool-executor",version:b}),F=c().map(e=>`- ${e}`).join(`
`);k(R,[{name:"search_tools",title:"Search MCP Tools",description:`Search for MCP tools across all wrapped servers. Returns slim results (name, server, description, example) for discovery.

Use get_tool_schema(name) to get the full inputSchema when you're ready to call a specific tool.

Available categories: code-nav, graph-analysis, knowledge, ai-models, web, ui, reasoning

Example queries:
- "semantic code search" - Serena code navigation
- "impact analysis" - codebase-memory graph analysis
- "generate diagram" - Gemini image/diagram generation
- "fetch webpage" - HTTP fetch tools`,schema:m,parse:x,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},handler:c$1},{name:"get_tool_schema",title:"Get Tool Schema",description:`Get the full inputSchema for a specific tool. Use after search_tools to get parameter details before calling execute_code.

Example: get_tool_schema("gemini-generate-image") - returns full schema with all parameters, types, enums, etc.`,schema:u,parse:I,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},handler:c$2},{name:"execute_code",title:"Execute Code",description:`Execute TypeScript/JavaScript code with access to MCP clients and workspace.

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
${F}
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

Results are summarised if console.log output exceeds ${500} chars.`,schema:d,parse:v,annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:true},handler:a}]);async function Y(){m$1(),process.stdin.on("close",()=>{console.error("Client disconnected, shutting down"),process.exit(0);});let e=new StdioServerTransport;await R.connect(e),console.error("Claudikins Tool Executor running"),console.error(`Available MCP clients: ${b$1().join(", ")}`);}Y().catch(e=>{console.error("Fatal error:",e),process.exit(1);});//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map