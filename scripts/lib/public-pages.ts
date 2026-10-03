import {rest} from './db';

export async function publicPages(query:string):Promise<any[]>{
 const rows:any[]=[],pageSize=500,maxRows=10000;
 for(let offset=0;offset<=maxRows;offset+=pageSize){
  const page=await rest(query+'&order=id&offset='+offset+'&limit='+Math.min(pageSize,maxRows+1-offset));
  if(!Array.isArray(page))throw new Error('Public content response must be a row array');
  if(rows.length+page.length>maxRows)throw new Error('Public content export exceeds 10000 rows');
  rows.push(...page);
  if(page.length<pageSize){
   if(page.length){
    const next=await rest(query+'&order=id&offset='+(offset+page.length)+'&limit=1');
    if(!Array.isArray(next))throw new Error('Public content response must be a row array');
    if(next.length)throw new Error('Public content export incomplete');
   }
   return rows;
  }
 }
 throw new Error('Public content export exceeds 10000 rows');
}
