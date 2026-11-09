import {defaults,calculate,parseBill} from './engine.js';
import {initContracts} from './contract-ui.js';
import {initLayout} from './layout-ui.js';
const $=id=>document.getElementById(id),fmt=(n,d=0)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}),money=n=>fmt(n,2),keys=Object.keys(defaults);
let current=null,attachment=null,fileURL=null,pending={},ocrBusy=false;
const readStore=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key));return v??fallback;}catch{return fallback;}};
let history=readStore('solar-quotes-v1',[]);if(!Array.isArray(history))history=[];
function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{toast('浏览器存储不可用，请导出文件保留报价。');return false;}}
let toastTimer;function toast(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',3500);}
function params(){return Object.fromEntries(keys.map(k=>[k,typeof defaults[k]==='number'?($(k).value.trim()===''?NaN:Number($(k).value)):$(k).value]));}
function fill(p){for(const k of keys)$(k).value=p[k]??defaults[k];$('manual-wrap').hidden=$('mode').value!=='manual';$('custom-rate-wrap').hidden=$('priceMode').value!=='custom';}
function put(id,text){$(id).textContent=text;}
function clearResult(message){current=null;for(const id of ['capacity','total','rate','days','annual','saving','payback','config','area-detail','schedule','basis','basis-detail','roof-use'])put(id,'—');put('panel-count','');$('warnings').replaceChildren();$('roof-bar').style.width='0';put('error',message);for(const id of ['save','print','export'])$(id).disabled=true;}
function update(){
 $('custom-rate-wrap').hidden=$('priceMode').value!=='custom';
 $('manual-wrap').hidden=$('mode').value!=='manual';
 try{current=calculate(params());const r=current;put('error','');for(const id of ['save','print','export'])$(id).disabled=r.kwp<=0;
 put('capacity',fmt(r.kwp,3).replace(/\.?0+$/,''));put('panel-count',`${r.panels} 块组件`);put('total',money(r.total));put('rate',String(r.rate));put('days',r.days?`${r.days} 天`:'—');
 put('annual',`${fmt(r.annual)} kWh / 年`);put('saving',`${fmt(r.saving)} THB / 年`);put('payback',r.payback?`${fmt(r.payback,1)} 年`:'需提供有效用电数据');
 const ratio=r.p.area>0?r.requiredArea/r.p.area*100:0;put('roof-use',r.p.area>0?`${fmt(ratio,1)}% / 总面积`:'未提供屋顶面积');$('roof-bar').style.width=`${Math.min(100,ratio)}%`;
 put('config',`${r.panels} 块 × ${fmt(r.p.panelW)} Wp`);put('area-detail',`组件占用 ${fmt(r.requiredArea,1)} m²；可用屋顶 ${fmt(r.p.area*r.p.usable/100,1)} m²`);
 put('schedule',`${Math.ceil(r.p.prep)} 天准备调试 + ${r.installDays} 天安装 + ${Math.ceil(r.p.buffer)} 天缓冲`);
 put('basis',({auto:'屋顶与用电双重约束',roof:'按屋顶可用面积',bill:'按白天用电需求',manual:'指定容量 · 整块取整'})[r.p.mode]);
 put('basis-detail',`屋顶上限 ${fmt(r.roofKwp,3)} kWp；用电需求容量 ${fmt(r.loadKwp,3)} kWp`);
 $('warnings').replaceChildren(...r.warnings.map(w=>{const li=document.createElement('li');li.textContent=w;return li;}));
 document.querySelector('.rule').textContent=r.p.priceMode==='tier'?`本次按容量阶梯计价：≥50 kWp ${r.p.largeRate} THB/W；<50 kWp ${r.p.smallRate} THB/W。价格含税，不含电池。`:`本次采用指定含税单价 ${r.rate} THB/W；总价按实际Wp × 单价计算，不含电池。`;
 }catch(e){clearResult(e.message);}
}
function view(name){for(const el of document.querySelectorAll('.view'))el.hidden=el.id!==`${name}-view`;for(const el of document.querySelectorAll('.nav'))el.classList.toggle('active',el.dataset.view===name);put('breadcrumb',({quote:'新建报价',history:'本机报价记录',settings:'估算参数',contracts:'生成合同',layout:'安装示意图'})[name]);if(name==='history')renderHistory();window.scrollTo({top:0,behavior:'smooth'});}
const contracts=initContracts({getQuote:()=>current,getProject:()=>$('project-name').value.trim(),getClient:()=>$('client').value.trim(),getAddress:()=>$('address').value.trim(),view,toast});
const layout=initLayout({getQuote:()=>current,getProject:()=>$('project-name').value.trim(),getAddress:()=>$('address').value.trim(),applyQuote:r=>{
 if(!current)throw Error('请先修复当前报价中的无效参数，再采用排布');
 if(!r.count)throw Error('排布中没有有效组件');
 $('mode').value='manual';$('manual').value=r.kwp;$('panelW').value=r.params.power;$('panelArea').value=r.params.width*r.params.height;$('area').value=r.roofArea;$('usable').value=100;update();
 if(!current||current.panels!==r.count)throw Error('容量同步失败，请核对组件参数');
},view,toast});
for(const el of document.querySelectorAll('.nav'))el.addEventListener('click',()=>el.dataset.view==='contracts'?contracts.open():el.dataset.view==='layout'?layout.open():view(el.dataset.view));
$('layout-open').onclick=()=>layout.open();
$('contract').onclick=()=>contracts.open();
$('edit-settings').onclick=e=>{e.preventDefault();view('settings');};
$('quote-form').addEventListener('input',update);$('quote-form').addEventListener('submit',e=>e.preventDefault());
$('settings-form').addEventListener('submit',e=>{e.preventDefault();update();if(current){persist('solar-settings-v1',current.p);view('quote');toast('估算参数已应用');}});
function clearFile(){attachment=null;if(fileURL)URL.revokeObjectURL(fileURL);fileURL=null;$('attachment').replaceChildren();$('ocr').hidden=true;$('bill-file').value='';$('bill-text').value='';$('parsed').replaceChildren();put('file-status','文件仅在当前浏览器处理。图片识别需要联网加载识别组件；PDF 请查看后录入关键数据。');}
$('reset').onclick=()=>{fill(defaults);$('project-name').value='';$('client').value='';$('address').value='';clearFile();update();toast('已恢复示例输入');};
function snapshot(){return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),projectName:$('project-name').value.trim(),client:$('client').value.trim(),address:$('address').value.trim(),attachment:attachment?.name??null,inputs:{...current.p},result:{...current},version:2};}
$('save').onclick=()=>{if(!current||!current.kwp)return;const row=snapshot();const next=[row,...history].slice(0,100);if(persist('solar-quotes-v1',next)){history=next;put('count',history.length);toast('报价已保存到当前浏览器');}};
function download(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function downloadQuote(row){download(`solar-quote-${row.id.slice(0,8)}.json`,JSON.stringify(row,null,2));}
$('export').onclick=()=>current&&downloadQuote(snapshot());$('backup').onclick=()=>download('solar-quotes-backup.json',JSON.stringify(history,null,2));
function button(text,fn){const b=document.createElement('button');b.className='button ghost';b.textContent=text;b.onclick=fn;return b;}
function renderHistory(){put('count',history.length);const host=$('history-list');host.replaceChildren();if(!history.length){const d=document.createElement('div');d.className='empty';d.textContent='还没有报价记录。完成一份方案后，点击「保存本机报价」。';host.append(d);return;}
 for(const row of history){const card=document.createElement('article');card.className='history-card';const info=document.createElement('div'),title=document.createElement('h3'),desc=document.createElement('p');title.textContent=row.projectName||row.client||'未命名光伏项目';desc.textContent=`${new Date(row.createdAt).toLocaleString('zh-CN')} · ${fmt(row.result.kwp,3)} kWp · THB ${money(row.result.total)}`;info.append(title,desc);const actions=document.createElement('div');actions.className='history-actions';actions.append(button('恢复方案',()=>{fill(row.inputs);$('project-name').value=row.projectName||'';$('client').value=row.client;$('address').value=row.address;clearFile();update();view('quote');toast('已恢复参数；附件需重新选择');}),button('导出',()=>downloadQuote(row)),button('删除',()=>{const next=history.filter(x=>x.id!==row.id);if(persist('solar-quotes-v1',next)){history=next;renderHistory();}}));card.append(info,actions);host.append(card);}}
function printQuote(){if(!current)return;const old=document.querySelector('.print-meta');old?.remove();const meta=document.createElement('div');meta.className='print-meta';meta.hidden=true;const date=new Date().toLocaleDateString('zh-CN');meta.textContent=`项目：${$('project-name').value||'未填写'} ｜ 甲方：${$('client').value||'未填写'} ｜ 地址：${$('address').value||'未填写'} ｜ 报价日期：${date} ｜ 月用电量：${fmt(current.monthlyKwh)} kWh ｜ 白天占比：${current.p.daytime}% ｜ 年发电假设：${current.p.yield} kWh/kWp ｜ 自用率：${current.p.selfUse}% ｜ 电价：${current.p.tariff} THB/kWh ｜ 运维预留：${current.p.maintenance}%/年`;const style=document.createElement('style');style.textContent='@media print{.print-meta[hidden]{display:block!important}}';meta.append(style);$('results').prepend(meta);window.print();}
$('print').onclick=printQuote;
let fileVersion=0;
$('bill-file').onchange=async()=>{const f=$('bill-file').files[0];if(!f)return;const version=++fileVersion;clearFile();if(f.size>10*1024*1024){toast('文件超过 10 MB，请压缩后重试');return;}const isImage=['image/png','image/jpeg','image/webp'].includes(f.type),isText=f.type==='text/plain'||/\.txt$/i.test(f.name),isPDF=f.type==='application/pdf';if(!isImage&&!isText&&!isPDF){toast('请选择 JPG、PNG、WebP、PDF 或 TXT 文件');return;}attachment=f;fileURL=URL.createObjectURL(f);if(isImage){const img=document.createElement('img');img.src=fileURL;img.alt='所选电费单预览';$('attachment').append(img);$('ocr').hidden=false;}else{const a=document.createElement('a');a.textContent=`查看账单：${f.name}`;a.href=fileURL;a.target='_blank';a.rel='noopener';$('attachment').append(a);}if(isText){const text=await f.text();if(version!==fileVersion)return;$('bill-text').value=text;document.querySelector('.bill-text').open=true;extract();}put('file-status',isPDF?'PDF 已添加为核对凭据，暂不自动识别 PDF；请录入电费和实际用电量，或粘贴账单文字。':isImage?'图片已添加。点击识别后，请核对候选数据，再应用到报价。':'文字账单已读取，请核对待确认数据。');};
function extract(){pending=parseBill($('bill-text').value);const host=$('parsed');host.replaceChildren();if(!Object.keys(pending).length){host.textContent='未找到明确标注的 kWh 或应付金额，请手动填写上方输入框。';return;}const p=document.createElement('p');p.textContent=`待确认：${pending.kwh?`月用电量 ${fmt(pending.kwh,2)} kWh`:'未识别用电量'}；${pending.bill?`电费 ${money(pending.bill)} THB`:'未识别电费'}。请核对是否为本期数据。`;host.append(p,button('确认并应用到报价',()=>{for(const [k,v] of Object.entries(pending))$(k).value=v;if(!pending.kwh)$('kwh').value=0;update();toast('已应用核对后的账单数据');}));}
$('parse').onclick=extract;
$('ocr').onclick=async()=>{if(ocrBusy||!attachment?.type.startsWith('image/'))return;ocrBusy=true;$('ocr').disabled=true;const f=attachment,version=fileVersion;let worker;try{put('file-status','正在加载识别组件及泰文 / 英文模型，首次使用可能需要一分钟…');const {createWorker}=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js');worker=await createWorker('eng+tha',1,{logger:m=>{if(version===fileVersion&&m.status==='recognizing text')put('file-status',`识别中 ${Math.round((m.progress||0)*100)}%…`);}});const {data}=await worker.recognize(f);if(version!==fileVersion)return;$('bill-text').value=data.text;document.querySelector('.bill-text').open=true;extract();put('file-status','文字识别完成，请核对本期金额与用电量。识别结果不会自动覆盖报价。');}catch{if(version===fileVersion)put('file-status','识别组件或语言模型加载失败，请改用粘贴文字或手动输入。');}finally{if(worker)await worker.terminate().catch(()=>{});ocrBusy=false;$('ocr').disabled=false;}};
fill({...defaults,...readStore('solar-settings-v1',{})});put('count',history.length);update();