import {area,validPolygon} from './layout-engine.js';
export const unitScale={m:1,mm:.001,cm:.01,ft:.3048,in:.0254};
export function parseDXF(text){
 if(text.startsWith('AutoCAD Binary DXF'))throw Error('请导出 ASCII DXF；当前不读取二进制 DXF');
 const lines=text.replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n');const pairs=[];
 for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim());if(!Number.isInteger(code))throw Error('DXF组码格式无效，请重新导出ASCII DXF');pairs.push([code,lines[i+1].trim()]);}
 let unitCode=0;for(let i=0;i<pairs.length;i++)if(pairs[i][0]===9&&pairs[i][1]==='$INSUNITS')unitCode=Number(pairs[i+1]?.[1]);
 const units=({1:'in',2:'ft',4:'mm',5:'cm',6:'m'})[unitCode]||'';
 const entities=[],warnings=[],regions=[];let section='',active=false,poly=null,unsupported=0;
 const records=[];for(const [code,value] of pairs){if(code===0)records.push({type:value,data:[]});else if(records.length)records[records.length-1].data.push([code,value]);}
 const number=(rec,k,fallback=0)=>Number(rec.data.find(v=>v[0]===k)?.[1]??fallback),str=(rec,k)=>rec.data.find(v=>v[0]===k)?.[1]||'';
 const addRegion=(pts,layer)=>{if(pts.length>1&&Math.hypot(pts[0].x-pts.at(-1).x,pts[0].y-pts.at(-1).y)<1e-7)pts=pts.slice(0,-1);if(pts.length<=300&&validPolygon(pts))regions.push({points:pts,layer,area:area(pts)});};
 for(const rec of records){if(rec.type==='SECTION'){section=str(rec,2);active=section==='ENTITIES';continue;}if(rec.type==='ENDSEC'){active=false;continue;}if(!active||number(rec,67)===1)continue;
  const layer=str(rec,8)||'0';
  if(number(rec,210)!==0||number(rec,220)!==0||Math.abs(number(rec,230,1)-1)>1e-8||Math.abs(number(rec,38))>1e-8){unsupported++;continue;}
  if(rec.type==='POLYLINE'){poly={points:[],layer,closed:(number(rec,70)&1)===1,curved:false,unsupported:(number(rec,70)&(8|16|64))!==0};continue;}
  if(rec.type==='VERTEX'&&poly){poly.points.push({x:number(rec,10),y:number(rec,20)});if(number(rec,42)!==0||number(rec,30)!==0)poly.curved=true;continue;}
  if(rec.type==='SEQEND'&&poly){if(!poly.unsupported&&!poly.curved){entities.push({type:'path',points:poly.points,layer:poly.layer,closed:poly.closed});if(poly.closed)addRegion(poly.points,poly.layer);}else unsupported++;poly=null;continue;}
  if(rec.type==='LWPOLYLINE'){
   const pts=[];let curved=false;for(const [code,v] of rec.data){if(code===10)pts.push({x:Number(v),y:0});if(code===20&&pts.length)pts.at(-1).y=Number(v);if(code===42&&Number(v)!==0)curved=true;}
   if(curved){unsupported++;continue;}const closed=(number(rec,70)&1)===1;
   if(pts.length>1&&pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))){entities.push({type:'path',points:pts,closed,layer});if(closed)addRegion(pts,layer);}
  }else if(rec.type==='LINE'){if(number(rec,30)!==0||number(rec,31)!==0){unsupported++;continue;}entities.push({type:'path',points:[{x:number(rec,10),y:number(rec,20)},{x:number(rec,11),y:number(rec,21)}],closed:false,layer});}
  else if(rec.type==='CIRCLE'){const x=number(rec,10),y=number(rec,20),radius=number(rec,40);if(radius>0){const pts=Array.from({length:32},(_,i)=>({x:x+radius*Math.cos(i*Math.PI/16),y:y+radius*Math.sin(i*Math.PI/16)}));entities.push({type:'path',points:pts,closed:true,layer});addRegion(pts,layer);}}
  else if(['TEXT','MTEXT'].includes(rec.type))entities.push({type:'text',point:{x:number(rec,10),y:number(rec,20)},text:rec.data.filter(v=>v[0]===1||v[0]===3).map(v=>v[1]).join('').replace(/\\P/g,' ').replace(/\\[^;]*;/g,''),layer});
  else if(!['ENDBLK','ENDTAB'].includes(rec.type))unsupported++;
  if(entities.length>20000)throw Error('图纸实体超过20000个，请只导出屋顶相关图层');
 }
 if(!entities.some(e=>e.points))throw Error('未找到支持的二维线条；请将图块、曲线或3D内容展开成二维直线多段线');
 // Stitch isolated LINE loops on the same layer; junction networks remain as background.
 const lineEntities=entities.filter(e=>e.type==='path'&&!e.closed&&e.points.length===2);
 if(lineEntities.length<=3000){const used=new Set(),key=p=>`${Math.round(p.x*1e6)},${Math.round(p.y*1e6)}`;
  const map=new Map();lineEntities.forEach((e,i)=>{for(const p of e.points){const k=e.layer+':'+key(p);if(!map.has(k))map.set(k,[]);map.get(k).push(i);}});
  for(let start=0;start<lineEntities.length;start++){if(used.has(start))continue;const e=lineEntities[start],loop=[...e.points];let current=start;const trail=new Set([start]);for(let tries=0;tries<300;tries++){const k=e.layer+':'+key(loop.at(-1)),nexts=map.get(k)||[];if(nexts.length!==2)break;const next=nexts.find(i=>i!==current);if(next===undefined)break;if(next===start){if(key(loop[0])===key(loop.at(-1)))addRegion(loop,e.layer);break;}if(trail.has(next))break;trail.add(next);const n=lineEntities[next];loop.push(key(n.points[0])===key(loop.at(-1))?n.points[1]:n.points[0]);current=next;}for(const i of trail)used.add(i);}
 }
 regions.sort((a,b)=>b.area-a.area);if(regions.length>200){regions.length=200;warnings.push('闭合区域超过200个，仅列出面积最大的200个，请简化图纸');}
 if(unsupported)warnings.push(`有 ${unsupported} 个图块、曲线、3D或其他实体未解析，请展开成二维直线轮廓后导入`);
 if(!units)warnings.push('图纸单位未识别，必须手动选择毫米、米等单位');
 const namedRoof=regions.some(r=>/roof|屋顶|屋面/i.test(r.layer));
 regions.forEach((r,i)=>r.role=/obst|exclusion|hvac|skylight|障碍|天窗|设备|通道/i.test(r.layer)?'obstacle':/roof|屋顶|屋面/i.test(r.layer)?'roof':!namedRoof&&i===0?'roof':'none');
 return {entities,regions,units,warnings};
}
export function exportDXF(roofs,obstacles,panels){
 const lines=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','6','0','ENDSEC','0','SECTION','2','ENTITIES'];
 const path=(points,layer)=>{lines.push('0','LWPOLYLINE','100','AcDbEntity','8',layer,'100','AcDbPolyline','90',String(points.length),'70','1');for(const p of points)lines.push('10',p.x.toFixed(6),'20',(-p.y).toFixed(6));};
 roofs.forEach(p=>path(p,'MAXING_ROOF'));obstacles.forEach(p=>path(p,'MAXING_EXCLUSION'));panels.forEach(p=>path(p.corners,'MAXING_PV'));
 lines.push('0','ENDSEC','0','EOF');return lines.join('\r\n');
}
export const demoDXF=()=>exportDXF([[{x:0,y:0},{x:30,y:0},{x:30,y:18},{x:0,y:18}]],[[{x:12,y:7},{x:16,y:7},{x:16,y:10},{x:12,y:10}]],[]).replace(/MAXING_EXCLUSION/g,'OBSTACLE');