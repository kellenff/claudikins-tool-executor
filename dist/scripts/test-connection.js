#!/usr/bin/env npx tsx
import {d,g,e}from'../chunk-IBKFI3SY.js';import'../chunk-3NTYOWX5.js';import'../chunk-BLPALQLO.js';import'dotenv/config';async function l(o){console.log(`
Testing ${o}...`);let t=await e(o);if(t){let s=await t.listTools();return console.log(`\u2705 ${o} connected! Tools: ${s.tools?.length||0}`),true}else return console.log(`\u274C ${o} failed to connect`),false}async function c(){d(),await l("context7"),await l("gemini"),await g(),console.log(`
Done.`);}c().catch(console.error);//# sourceMappingURL=test-connection.js.map
//# sourceMappingURL=test-connection.js.map