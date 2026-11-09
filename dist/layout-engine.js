const EPS=1e-8;
export const planDefaults={width:1.134,height:2.465,power:625,gap:.03,setback:.5,clearance:.5,aisle:1,groupRows:6,angle:0,orientation:'auto',limit:0};
export function scaleByArea(pixelArea,knownArea){if(!Number.isFinite(pixelArea)||!Number.isFinite(knownArea)||pixelArea<=0||knownArea<=0)throw Error('轮廓面积和已知实际面积必须大于零');return Math.sqrt(knownArea/pixelArea);}
export function scaleByLength(a,b,metres){const px=Math.hypot(a.x-b.x,a.y-b.y);if(!Number.isFinite(metres)||metres<=0||px<5)throw Error('请填写有效长度，并选择距离足够远的两点');return metres/px;}
export const area=poly=>Math.abs(poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p.x*q.y-q.x*p.y;},0)/2);
export function bounds(poly){return {minX:Math.min(...poly.map(p=>p.x)),minY:Math.min(...poly.map(p=>p.y)),maxX:Math.max(...poly.map(p=>p.x)),maxY:Math.max(...poly.map(p=>p.y))};}
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const onSegment=(p,a,b)=>Math.abs(cross(a,b,p))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
export function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(onSegment(p,a,b))return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
export function intersects(a,b,c,d){const c1=cross(a,b,c),c2=cross(a,b,d),c3=cross(c,d,a),c4=cross(c,d,b);return c1*c2<-EPS&&c3*c4<-EPS||onSegment(a,c,d)||onSegment(b,c,d)||onSegment(c,a,b)||onSegment(d,a,b);}
function pointDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function segmentDistance(a,b,c,d){return intersects(a,b,c,d)?0:Math.min(pointDistance(a,c,d),pointDistance(b,c,d),pointDistance(c,a,b),pointDistance(d,a,b));}
export function overlap(a,b){const aa=bounds(a),bb=bounds(b);if(aa.maxX<bb.minX-EPS||aa.minX>bb.maxX+EPS||aa.maxY<bb.minY-EPS||aa.minY>bb.maxY+EPS)return false;for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(intersects(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;return inside(a[0],b)||inside(b[0],a);}
function boundaryDistance(a,b){let min=Infinity;for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)min=Math.min(min,segmentDistance(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]));return min;}
export function validPolygon(poly){if(!Array.isArray(poly)||poly.length<3||poly.length>300||poly.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return false;if(area(poly)<EPS)return false;for(let i=0;i<poly.length;i++){if(Math.hypot(poly[i].x-poly[(i+1)%poly.length].x,poly[i].y-poly[(i+1)%poly.length].y)<EPS)return false;for(let j=i+1;j<poly.length;j++){if(j===i+1||i===0&&j===poly.length-1)continue;if(intersects(poly[i],poly[(i+1)%poly.length],poly[j],poly[(j+1)%poly.length]))return false;}}return true;}
export function rotate(p,deg){const a=deg*Math.PI/180;return{x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)};}
export function edgeAngle(poly){let best=0,angle=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],length=Math.hypot(b.x-a.x,b.y-a.y);if(length>best){best=length;angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;}}return ((angle%180)+180)%180;}
export function fits(rect,roof,obstacles,setback,clearance){
 if(!rect.every(p=>inside(p,roof)))return false;
 // Midpoints and edge intersections prevent a rectangle bridging a concave notch.
 for(let i=0;i<4;i++){const a=rect[i],b=rect[(i+1)%4];if(!inside({x:(a.x+b.x)/2,y:(a.y+b.y)/2},roof))return false;for(let j=0;j<roof.length;j++){const c=roof[j],d=roof[(j+1)%roof.length];if(cross(a,b,c)*cross(a,b,d)<-EPS&&cross(c,d,a)*cross(c,d,b)<-EPS)return false;}}
 if(setback>0&&boundaryDistance(rect,roof)+EPS<setback)return false;
 const box=bounds(rect);
 for(const obstacle of obstacles){const ob=bounds(obstacle);if(ob.minX>box.maxX+clearance||ob.maxX<box.minX-clearance||ob.minY>box.maxY+clearance||ob.maxY<box.minY-clearance)continue;if(overlap(rect,obstacle)||clearance>0&&boundaryDistance(rect,obstacle)+EPS<clearance)return false;}
 return true;
}
export function generateLayout(roofs,obstacles,raw={}){
 const p={...planDefaults,...raw};for(const k of ['width','height','power'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('组件长、宽和功率必须大于零');for(const k of ['gap','setback','clearance','aisle','groupRows','limit'])if(!Number.isFinite(p[k])||p[k]<0)throw Error('间距、退距、通道和数量不能为负数');
 if(p.width<.1||p.height<.1||p.width>10||p.height>10||!Number.isFinite(p.angle)||Math.abs(p.angle)>360)throw Error('请检查组件尺寸和排布角度');
 if(!Number.isInteger(p.groupRows)||!Number.isInteger(p.limit)||p.limit>4000)throw Error('分组排数和目标数量需为整数，单方案最多4000块');
 if(!['auto','portrait','landscape'].includes(p.orientation))throw Error('请选择有效组件方向');
 if(!roofs.length||roofs.length>30)throw Error('请标出1–30个屋顶区域');
 for(const poly of [...roofs,...obstacles])if(!validPolygon(poly))throw Error('轮廓应是无自交的闭合多边形，每个轮廓最多300个点');
 if(obstacles.length>100)throw Error('障碍物过多，请分区设计');
 for(let i=0;i<roofs.length;i++)for(let j=i+1;j<roofs.length;j++)if(overlap(roofs[i],roofs[j]))throw Error('屋顶区域重叠或相接，请合并或调整轮廓');
 const all=[];let tried=0;
 for(let r=0;r<roofs.length;r++){
  const roof=roofs[r].map(v=>rotate(v,-p.angle)),obs=obstacles.map(o=>o.map(v=>rotate(v,-p.angle))),box=bounds(roof);
  if(box.maxX-box.minX>2000||box.maxY-box.minY>2000)throw Error('屋顶尺寸过大，请核对比例或分区设计');
  const orientations=p.orientation==='auto'?['portrait','landscape']:[p.orientation];let best=[];
  for(const orientation of orientations){const w=orientation==='portrait'?p.width:p.height,h=orientation==='portrait'?p.height:p.width;
   for(const fx of [0,1/3,2/3])for(const fy of [0,1/3,2/3]){
    const next=[];let row=0;
    for(let y=box.minY+p.setback+fy*(h+p.gap);y+h<=box.maxY-p.setback+EPS;row++,y=box.minY+p.setback+fy*(h+p.gap)+row*(h+p.gap)+(p.groupRows?Math.floor(row/p.groupRows)*p.aisle:0)){
     for(let x=box.minX+p.setback+fx*(w+p.gap);x+w<=box.maxX-p.setback+EPS;x+=w+p.gap){
      if(++tried>600000)throw Error('搜索范围过大，请提高比例精度或缩小屋顶范围');
      const rect=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
      if(fits(rect,roof,obs,p.setback,p.clearance))next.push({corners:rect.map(v=>rotate(v,p.angle)),roof:r,orientation});
     }
    }
    if(next.length>best.length)best=next;
   }
  }
  all.push(...best);if(all.length>4000)throw Error('可放组件超过4000块，请将项目分区设计');
 }
 const panels=p.limit?all.slice(0,p.limit):all;
 return {panels,maxPanels:all.length,count:panels.length,kwp:panels.length*p.power/1000,roofArea:roofs.reduce((s,o)=>s+area(o),0),panelArea:panels.length*p.width*p.height,params:p,algorithm:'规则网格搜索（横/竖向与九种网格偏移），非全局最优'};
}