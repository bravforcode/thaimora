import {ApiError,isoDate,bangkokToday,text} from './domain.ts';
export function reportRange(url:URL):{from:string;to:string}{
 const to=isoDate(url.searchParams.get('to')??bangkokToday());
 const d=new Date(to);d.setUTCDate(d.getUTCDate()-29);
 const from=isoDate(url.searchParams.get('from')??d.toISOString().slice(0,10));
 if(from>to||Date.parse(to)-Date.parse(from)>365*86400000)throw new ApiError(422,'invalid_report_range');
 return {from,to};
}
export function capRows<T>(rows:T[],limit:number):{rows:T[];truncated:boolean}{
 return {rows:rows.slice(0,limit),truncated:rows.length>limit};
}
export function homeSettings(value:any,eligibleIds:string[]):any{
 if(!value||typeof value!=='object')return {heading:null,featuredHotelIds:[]};
 const heading=value.heading??value.headline;
 if(!heading||typeof heading.en!=='string'||typeof heading.th!=='string'||!heading.en.trim()||!heading.th.trim()||heading.en.length>300||heading.th.length>300)throw new ApiError(422,'invalid_home_heading');
 if(!Array.isArray(value.featuredHotelIds)||value.featuredHotelIds.length>24||value.featuredHotelIds.some((id:unknown)=>typeof id!=='string'))throw new ApiError(422,'invalid_featured_ids');
 return {heading:{en:heading.en.trim(),th:heading.th.trim()},featuredHotelIds:[...new Set<string>(value.featuredHotelIds)].filter(id=>eligibleIds.includes(id))};
}
export function licensedContent(row:any):boolean{
 return row.demo===false&&row.rights_status==='approved'&&typeof row.source==='string'&&!!row.source.trim()&&typeof row.license==='string'&&!!row.license.trim()&&typeof row.source_url==='string'&&/^https:\/\/\S+$/.test(row.source_url);
}
export async function auditMutation(db:any,actor:string,table:string,id:string,operation:string,fields:string[]):Promise<void>{
 const result=await db.rpc('record_admin_audit',{p_actor:actor,p_table:text(table,1,80),p_id:text(id,1,200),p_operation:operation,p_fields:fields});
 if(result.error)throw new ApiError(503,'audit_not_recorded');
}
