// DOCX generation keeps all package members and edits text tokens only.
const TH_DIGITS=['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
function thaiBlock(n,afterMillion=false){if(n===0)return '';const digits=String(n);let out='';for(let i=0;i<digits.length;i++){const d=Number(digits[i]),pos=digits.length-i-1;if(!d)continue;if(pos===1)out+=(d===1?'':d===2?'ยี่':TH_DIGITS[d])+'สิบ';else if(pos===0)out+=(d===1&&(n>1||afterMillion)?'เอ็ด':TH_DIGITS[d]);else out+=TH_DIGITS[d]+(['','','ร้อย','พัน','หมื่น','แสน'][pos]);}return out;}
export function thaiInteger(n,afterMillion=false){if(n===0)return 'ศูนย์';if(n<1000000)return thaiBlock(n,afterMillion);const high=Math.floor(n/1000000),low=n%1000000;return thaiInteger(high)+'ล้าน'+(low?thaiBlock(low,true):'');}
const CN_DIGITS='零壹贰叁肆伍陆柒捌玖';
function chineseBlock(n){let out='',zero=false;for(let p=3;p>=0;p--){const d=Math.floor(n/10**p)%10;if(d){if(zero)out+='零';out+=CN_DIGITS[d]+(['','拾','佰','仟'][p]);zero=false;}else if(out)zero=true;}return out;}
export function chineseInteger(n){if(n===0)return '零';let out='',gap=false;for(let group=2;group>=0;group--){const unit=10000**group,block=Math.floor(n/unit)%10000;if(block){if(out&&(gap||block<1000))out+='零';out+=chineseBlock(block)+(['','万','亿'][group]);gap=false;}else if(out)gap=true;}return out;}
export function moneyWords(satang){if(!Number.isSafeInteger(satang)||satang<0||satang>99999999999999)throw Error('合同金额超出支持范围');const baht=Math.floor(satang/100),fraction=satang%100;return {th:thaiInteger(baht)+'บาท'+(fraction?thaiInteger(fraction)+'สตางค์':'ถ้วน'),zh:chineseInteger(baht)+'泰铢'+(fraction?chineseInteger(fraction)+'萨当':'整')};}
export function buildContractData(quote,info){
 const required=['projectName','ownerName','projectAddress','date','providerThai','providerChinese','providerAddressThai','providerAddressChinese','account1Name','account1Number','account1Bank','account1Branch','account2Name','account2Number','account2Bank','account2Branch'];
 for(const k of required)if(!String(info[k]??'').trim())throw Error('请补全合同中的项目、主体、地址和收款账户信息');
 for(const v of Object.values(info))if(typeof v==='string'&&(/\{\{|\}\}/.test(v)))throw Error('合同信息不能包含模板标记 {{ 或 }}');
 if(!quote||!Number.isFinite(quote.total)||quote.total<=0||quote.kwp<=0)throw Error('请先生成有效报价');
 if(info.depositPct===''||info.depositPct===null||info.depositPct===undefined)throw Error('请明确填写首款比例，模板未规定固定比例');
 const pct=Number(info.depositPct),filing=Number(info.filingFee),cod=Number(info.codDays),total=Math.round(quote.total*100),fee=Math.round(filing*100);
 if(!Number.isFinite(pct)||pct<0||pct>100)throw Error('首款比例必须介于 0–100%');
 if(!Number.isFinite(filing)||filing<0||fee>total)throw Error('备案费必须在合同总额以内，且不能为负数');
 if(!Number.isInteger(cod)||cod<1||cod>3650)throw Error('请填写 1–3650 天的合同并网期限');
 const deposit=Math.round(total*pct/100),balance=total-deposit;
 const dateMatch=/^(\d{4})-(\d{2})-(\d{2})$/.exec(info.date);if(!dateMatch)throw Error('请填写有效签约日期');
 const [year,month,day]=dateMatch.slice(1).map(Number),check=new Date(Date.UTC(year,month-1,day));if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)throw Error('签约日期无效');
 const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
 const values={CONTRACT_TITLE_ZH:info.projectName.trim()+'光伏系统施工合同',CONTRACT_TITLE_TH:'สัญญาติดตั้งระบบผลิตไฟฟ้าพลังงานแสงอาทิตย์ '+info.projectName.trim(),KWP:String(Number(quote.kwp.toFixed(6))),OWNER_NAME:info.ownerName.trim(),OWNER_ID:info.ownerId?.trim()||'________________',OWNER_ADDRESS:info.ownerAddress?.trim()||info.projectAddress.trim(),PROJECT_ADDRESS:info.projectAddress.trim(),DATE_ZH:`${year}年${month}月${day}日`,DATE_TH:`${day} เดือน ${months[month-1]} พ.ศ. ${year+543}`,PROVIDER_TH:info.providerThai.trim(),PROVIDER_ZH:info.providerChinese.trim(),PROVIDER_ADDRESS_TH:info.providerAddressThai.trim(),PROVIDER_ADDRESS_ZH:info.providerAddressChinese.trim(),DEPOSIT_PCT:String(pct),COD_DAYS:String(cod)};
 for(const [prefix,cents] of Object.entries({TOTAL:total,CONSTRUCTION:total-fee,FILING:fee,DEPOSIT:deposit,BALANCE:balance})){const w=moneyWords(cents);values[prefix]=(cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});values[prefix+'_TH']=w.th;values[prefix+'_ZH']=w.zh;}
 for(const n of [1,2])for(const [suffix,key] of Object.entries({NAME:'Name',NUMBER:'Number',BANK:'Bank',BRANCH:'Branch'}))values[`ACCOUNT${n}_${suffix}`]=info[`account${n}${key}`].trim();
 return {values,totalSatang:total,depositSatang:deposit,balanceSatang:balance,filename:values.CONTRACT_TITLE_ZH.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,100)+'.docx'};
}
export function escapeXML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
export function fillTemplateXML(xml,values){return xml.replace(/\{\{([A-Z0-9_]+)\}\}/g,(_,key)=>{if(!(key in values))throw Error('模板字段缺失：'+key);return escapeXML(values[key]);});}
export async function generateContract(template,quote,info,Zip=globalThis.JSZip){if(!Zip)throw Error('合同组件加载失败，请刷新页面');const data=buildContractData(quote,info),zip=await Zip.loadAsync(template);let replacements=0;for(const name of Object.keys(zip.files)){if(!/^word\/.+\.xml$/.test(name))continue;const before=await zip.file(name).async('string');if(!before.includes('{{'))continue;const after=fillTemplateXML(before,data.values);if(/\{\{[A-Z0-9_]+\}\}/.test(after))throw Error('合同仍含未填字段');zip.file(name,after);replacements++;}if(!replacements)throw Error('合同模板不包含可填字段');return {...data,bytes:await zip.generateAsync({type:'uint8array',compression:'DEFLATE'})};}