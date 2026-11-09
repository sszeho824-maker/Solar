export const defaults={area:500,usable:75,bill:45000,kwh:0,tariff:4.5,daytime:75,coverage:90,panelW:625,panelArea:2.8,yield:1400,selfUse:90,mode:'auto',manual:50,smallRate:21.5,largeRate:15.5,productivity:12,prep:2,buffer:2,maintenance:1};
export function calculate(raw){
 const p={...defaults,...raw};
 for(const key of Object.keys(defaults)){if(typeof defaults[key]==='number'&&(!Number.isFinite(Number(p[key]))))throw Error('请填写有效数字');if(typeof defaults[key]==='number')p[key]=Number(p[key]);}
 for(const key of ['area','bill','kwh','manual','prep','buffer','maintenance'])if(p[key]<0)throw Error('面积、用电量、费用及工期不能为负数');
 for(const key of ['usable','daytime','coverage','selfUse'])if(p[key]<0||p[key]>100)throw Error('百分比必须介于 0–100%');
 for(const key of ['tariff','panelW','panelArea','yield','smallRate','largeRate','productivity'])if(p[key]<=0)throw Error('单价、组件参数、年发电量和施工效率必须大于零');
 if(!['auto','roof','bill','manual'].includes(p.mode))throw Error('请选择有效的估算方式');
 if(p.mode==='roof'&&p.area<=0)throw Error('请填写屋顶面积');
 if(p.mode==='bill'&&p.bill<=0&&p.kwh<=0)throw Error('请填写电费或用电量');
 if(p.mode==='manual'&&p.manual<=0)throw Error('请填写目标容量');
 if(p.mode==='auto'&&p.area<=0&&p.bill<=0&&p.kwh<=0)throw Error('请至少提供屋顶面积或月度电费 / 用电量');
 const monthlyKwh=p.kwh>0?p.kwh:p.bill/p.tariff;
 const roofPanels=Math.floor(p.area*p.usable/100/p.panelArea+1e-9);
 const roofKwp=roofPanels*p.panelW/1000;
 // Annual average daytime load / expected self-consumed production. No export revenue.
 const loadKwp=p.selfUse>0?monthlyKwh*12*p.daytime/100*p.coverage/100/(p.yield*p.selfUse/100):0;
 let target=p.mode==='manual'?p.manual:p.mode==='roof'?roofKwp:p.mode==='bill'?loadKwp:Math.min(p.area>0?roofKwp:Infinity,monthlyKwh>0?loadKwp:Infinity);
 const panels=Math.max(0,Math.floor(target*1000/p.panelW+1e-8));
 const watts=panels*p.panelW,kwp=watts/1000,rate=kwp>=50?p.largeRate:p.smallRate,total=watts*rate;
 const annual=kwp*p.yield,selfConsumed=Math.min(annual*p.selfUse/100,monthlyKwh*12*p.daytime/100),saving=selfConsumed*p.tariff,net=saving-total*p.maintenance/100;
 const installDays=kwp>0?Math.ceil(kwp/p.productivity):0;
 const warnings=[];
 if(kwp===0)warnings.push('当前条件无法容纳一块组件，或白天用电 / 自用率为零，请调整输入。');
 if(p.area>0&&kwp>roofKwp+1e-8)warnings.push('目标容量超过当前屋顶可容纳容量，需增加屋顶面积或调整方案。');
 if(kwp>0&&kwp<50)warnings.push('实际装机容量低于 50 kWp，适用 21.5 THB/W 档位（单价可在参数中调整）。');
 if(p.kwh<=0&&p.bill>0)warnings.push('用电量由电费 ÷ 估算电价换算，建议用账单上的实际 kWh 替换。');
 if(p.mode==='manual'&&Math.abs(kwp-p.manual)>1e-8)warnings.push('容量已按整块组件向下取整，报价以取整后的实际 Wp 为准。');
 return {p,monthlyKwh,roofPanels,roofKwp,loadKwp,panels,watts,kwp,rate,total,annual,selfConsumed,saving,net,payback:net>0?total/net:null,installDays,days:kwp>0?Math.ceil(p.prep)+installDays+Math.ceil(p.buffer):0,requiredArea:panels*p.panelArea,warnings};
}
export function parseBill(text){
 const clean=text.replace(/，/g,',');
 const patterns={kwh:[/([\d,]+(?:\.\d+)?)\s*k\s*w\s*h\b/i,/(?:用电量|电量|หน่วยที่ใช้|หน่วยใช้ไฟฟ้า|units consumed|energy used)\s*[:：]?\s*([\d,]+(?:\.\d+)?)/i],bill:[/(?:ยอดเงินรวม|รวมเงินทั้งสิ้น|total amount|amount due|应付金额|本期电费|电费合计)\s*[:：]?\s*(?:THB|฿)?\s*([\d,]+(?:\.\d+)?)/i]};
 const result={};for(const [key,list] of Object.entries(patterns)){for(const re of list){const m=clean.match(re);if(m){const n=Number(m[1].replace(/,/g,''));if(n>0){result[key]=n;break;}}}}return result;
}