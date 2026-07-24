// Same flow as probe, but the presigned S3 upload (step 2) is done with curl.exe
// instead of Node fetch/undici — to test whether undici is corrupting the binary
// PUT (which would make Perfect Corp see a broken image -> "face too small").

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const BASE_URL = process.env.PERFECTCORP_BASE_URL ?? "https://yce-api-01.perfectcorp.com";
const FILE_ENDPOINT = "/s2s/v2.1/file/skin-analysis";
const TASK_ENDPOINT = "/s2s/v2.1/task/skin-analysis";
const DST = ["moisture","redness","oiliness","pore","texture","acne","wrinkle","firmness","radiance","dark_circle_v2","age_spot","skin_type"];

function loadEnv(){for(const n of[".env.local",".env"]){if(!existsSync(n))continue;for(const l of readFileSync(n,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,"");}}}
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

async function main(){
  loadEnv();
  const key=process.env.PERFECTCORP_API_KEY;
  const img=process.argv[2];
  if(!key||!img||!existsSync(img)){console.log("usage: node scripts/probe-curl.mjs <image>");process.exit(1);}
  const path=resolve(img);
  const bytes=readFileSync(path);
  const auth={Authorization:`Bearer ${key}`};

  console.log(`\n▶ ${img} (${bytes.byteLength} bytes) — upload via curl.exe\n`);

  // 1. register
  const fr=await fetch(`${BASE_URL}${FILE_ENDPOINT}`,{method:"POST",headers:{...auth,"Content-Type":"application/json"},body:JSON.stringify({files:[{content_type:"image/jpeg",file_name:"scan.jpg",file_size:bytes.byteLength}]})});
  const fj=await fr.json();
  const fi=fj?.data?.files?.[0];
  const req=fi?.requests?.[0];
  console.log("① registered, file_id ok:", !!fi?.file_id);

  // 2. upload via curl.exe (curl sets Content-Length itself; we pass Content-Type)
  const ct = req.headers?.["Content-Type"] ?? "image/jpeg";
  const args=["-s","-o","NUL","-w","%{http_code}","-X",req.method??"PUT","--upload-file",path,"-H",`Content-Type: ${ct}`,req.url];
  const code=execFileSync("curl.exe",args,{encoding:"utf8"}).trim();
  console.log("② curl upload HTTP:", code);
  if(!/^2\d\d$/.test(code)){console.log("  ✗ upload not 2xx");process.exit(1);}

  // 3. task
  const tr=await fetch(`${BASE_URL}${TASK_ENDPOINT}`,{method:"POST",headers:{...auth,"Content-Type":"application/json"},body:JSON.stringify({src_file_id:fi.file_id,dst_actions:DST,format:"json"})});
  const tj=await tr.json();
  const taskId=tj?.data?.task_id;
  console.log("③ task_id ok:", !!taskId);

  // 4. poll
  console.log("④ polling…");
  for(let i=0;i<40;i++){
    const pr=await fetch(`${BASE_URL}${TASK_ENDPOINT}/${taskId}`,{headers:auth});
    const d=(await pr.json())?.data??{};
    const st=d?.task_status;
    console.log(`   poll ${i+1}: ${st}`);
    if(["success","succeed","completed"].includes(st)){
      writeFileSync("skin-api-raw.json",JSON.stringify(d,null,2));
      console.log("\n✅ SUCCESS — raw result saved to skin-api-raw.json\n");
      dump(d); return;
    }
    if(["error","failed"].includes(st)){console.log("\n✗ still failed:",JSON.stringify(d));return;}
    await sleep(Number(d?.polling_interval)*1000||2000);
  }
}

function flatten(o,p="",out={}){if(o===null||typeof o!=="object"){if(p)out[p]=o;return out;}if(Array.isArray(o)){o.forEach((v,i)=>flatten(v,`${p}[${i}]`,out));return out;}for(const[k,v]of Object.entries(o))flatten(v,p?`${p}.${k}`:k,out);return out;}
function dump(d){const f=flatten(d);console.log("── NUMERIC 0–100 ──");for(const[p,v]of Object.entries(f))if(typeof v==="number"&&v>=0&&v<=100)console.log(`  ${p.padEnd(48)}= ${v}`);console.log("\n── ACTION → PATH ──");for(const a of DST){const h=Object.entries(f).filter(([p,v])=>typeof v==="number"&&p.toLowerCase().includes(a));console.log(h.length?h.map(([p,v])=>`  ${a.padEnd(15)}→ ${p} = ${v}`).join("\n"):`  ${a.padEnd(15)}→ (none)`);}console.log("\n── STRINGS ──");for(const[p,v]of Object.entries(f))if(typeof v==="string"&&v.length<40)console.log(`  ${p.padEnd(48)}= ${v}`);}

main().catch(e=>{console.error("crashed:",e.message);process.exit(1);});
