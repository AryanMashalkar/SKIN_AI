// Matrix test: {image} x {HD tier, SD tier} to isolate whether the tier of
// dst_actions affects the error_src_face_too_small rejection.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.PERFECTCORP_BASE_URL ?? "https://yce-api-01.perfectcorp.com";
const FILE = "/s2s/v2.1/file/skin-analysis";
const TASK = "/s2s/v2.1/task/skin-analysis";

const SD = ["redness","oiliness","age_spot","radiance","moisture","dark_circle_v2","firmness","texture","acne","pore","wrinkle","skin_type"];
const HD = ["hd_redness","hd_oiliness","hd_age_spot","hd_radiance","hd_moisture","hd_dark_circle","hd_firmness","hd_texture","hd_acne","hd_pore","hd_wrinkle","hd_skin_type"];

function loadEnv(){for(const n of[".env.local",".env"]){if(!existsSync(n))continue;for(const l of readFileSync(n,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,"");}}}
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

async function run(img, actions, key){
  const bytes=readFileSync(resolve(img));
  const auth={Authorization:`Bearer ${key}`};
  const fr=await fetch(`${BASE}${FILE}`,{method:"POST",headers:{...auth,"Content-Type":"application/json"},body:JSON.stringify({files:[{content_type:"image/jpeg",file_name:"s.jpg",file_size:bytes.byteLength}]})});
  const fi=(await fr.json())?.data?.files?.[0]; const req=fi?.requests?.[0];
  const up=await fetch(req.url,{method:req.method??"PUT",headers:req.headers,body:new Blob([bytes],{type:"image/jpeg"})});
  if(!up.ok) return "upload "+up.status;
  const tr=await fetch(`${BASE}${TASK}`,{method:"POST",headers:{...auth,"Content-Type":"application/json"},body:JSON.stringify({src_file_id:fi.file_id,dst_actions:actions,format:"json"})});
  if(!tr.ok) return "task "+tr.status+" "+(await tr.text()).slice(0,80);
  const taskId=(await tr.json())?.data?.task_id;
  for(let i=0;i<40;i++){
    const d=(await (await fetch(`${BASE}${TASK}/${taskId}`,{headers:auth})).json())?.data??{};
    if(["success","succeed","completed"].includes(d.task_status)) return "✅ SUCCESS";
    if(["error","failed"].includes(d.task_status)) return "✗ "+d.error;
    await sleep(Number(d?.polling_interval)*1000||2000);
  }
  return "timeout";
}

loadEnv();
const key=process.env.PERFECTCORP_API_KEY;
const imgs=process.argv.slice(2);
if(!key||imgs.length===0){console.log("usage: node scripts/tier-test.mjs img1.jpg [img2.jpg]");process.exit(1);}
for(const img of imgs){
  if(!existsSync(img)){console.log(img,"missing");continue;}
  process.stdout.write(`${img}  SD … `); console.log(await run(img,SD,key));
  process.stdout.write(`${img}  HD … `); console.log(await run(img,HD,key));
}
