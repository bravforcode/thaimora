import {ApiError} from './domain.ts';

export function apiParts(url:URL):string[]{
 const start=url.pathname.lastIndexOf('/v1/');
 if(start<0)return [];
 return url.pathname.slice(start+4).split('/').filter(Boolean).map(segment=>{
  let decoded:string;try{decoded=decodeURIComponent(segment);}catch{throw new ApiError(422,'invalid_path_encoding');}
  if(decoded.length>200||/[\x00-\x1f\x7f]/.test(decoded))throw new ApiError(422,'invalid_path_segment');
  return decoded;
 });
}
