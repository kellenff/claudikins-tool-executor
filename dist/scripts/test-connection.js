#!/usr/bin/env npx tsx
import {c as c$1,f,d}from'../chunk-6DSJ6S67.js';import'../chunk-HU3DFO7S.js';import'../chunk-3UK5GFJN.js';import'dotenv/config';async function l(o){console.log(`
Testing ${o}...`);let t=await d(o);if(t){let s=await t.listTools();return console.log(`\u2705 ${o} connected! Tools: ${s.tools?.length||0}`),true}else return console.log(`\u274C ${o} failed to connect`),false}async function c(){c$1(),await l("context7"),await l("gemini"),await f(),console.log(`
Done.`);}c().catch(console.error);//# sourceMappingURL=test-connection.js.map
//# sourceMappingURL=test-connection.js.map