#!/usr/bin/env npx tsx
import {c as c$1,f,d}from'../chunk-QMU26NIQ.js';import'../chunk-AFDHMGMN.js';import'dotenv/config';async function l(t){console.log(`
Testing ${t}...`);let n=await d(t);if(n){let s=await n.listTools();return console.log(`\u2705 ${t} connected! Tools: ${s.tools?.length||0}`),true}else return console.log(`\u274C ${t} failed to connect`),false}async function c(){c$1(),await l("context7"),await l("gemini"),await f(),console.log(`
Done.`);}c().catch(console.error);//# sourceMappingURL=test-connection.js.map
//# sourceMappingURL=test-connection.js.map