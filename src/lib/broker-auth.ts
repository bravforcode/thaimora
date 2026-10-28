import { z } from "zod";
const sessionKey="thaimora-broker-session";
const sessionSchema=z.object({accessToken:z.string().min(1),expiresAt:z.number().positive()});
export type BrokerSession=z.infer<typeof sessionSchema>;
const authResult=z.object({access_token:z.string().optional(),expires_in:z.number().positive().optional(),expires_at:z.number().positive().optional()});
export function authConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hpjmttoxomdhxxsourih.supabase.co";
  return Boolean(url && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
export function readBrokerSession():BrokerSession|null {
  if(typeof window==="undefined") return null;
  try {const result=sessionSchema.safeParse(JSON.parse(sessionStorage.getItem(sessionKey)||"null"));if(result.success && result.data.expiresAt>Date.now()+15000) return result.data;}catch{}
  sessionStorage.removeItem(sessionKey); return null;
}
function saveSession(value:unknown):BrokerSession|null {
  const parsed=authResult.parse(value);
  if(!parsed.access_token) return null;
  const expiresAt=parsed.expires_at?parsed.expires_at*1000:Date.now()+(parsed.expires_in||3600)*1000;
  const session=sessionSchema.parse({accessToken:parsed.access_token,expiresAt});
  sessionStorage.setItem(sessionKey,JSON.stringify(session)); return session;
}
async function authRequest(path:string, body?:unknown, token?:string, method=body===undefined?"GET":"POST") {
  if(!authConfigured()) throw new Error("Account authentication is not configured.");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hpjmttoxomdhxxsourih.supabase.co";
  const response=await fetch(`${supabaseUrl}/auth/v1/${path}`,{method,cache:"no-store",redirect:"error",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(15000),headers:{"Content-Type":"application/json",apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value:unknown=response.status===204?{}:await response.json();
  if(!response.ok) { const parsed=z.object({msg:z.string().optional(),message:z.string().optional(),error_description:z.string().optional()}).safeParse(value);throw new Error(parsed.success?parsed.data.msg||parsed.data.message||parsed.data.error_description||"Authentication failed.":"Authentication failed.");}
  return value;
}
export async function brokerSignIn(email:string,password:string) { const session=saveSession(await authRequest("token?grant_type=password",{email,password}));if(!session) throw new Error("A valid account session was not returned.");return session; }
export async function brokerSignUp(email:string,password:string,redirectTo:string) {
  const redirect=new URL(redirectTo);if(redirect.origin!==window.location.origin) throw new Error("Invalid confirmation destination.");
  return saveSession(await authRequest(`signup?redirect_to=${encodeURIComponent(redirect.href)}`,{email,password}));
}
export async function brokerSignOut() {const session=readBrokerSession();sessionStorage.removeItem(sessionKey);if(session) await authRequest("logout",{},session.accessToken);}
export async function brokerRequestPasswordReset(email:string,redirectTo:string){const redirect=new URL(redirectTo);if(redirect.origin!==window.location.origin)throw new Error("Invalid recovery destination.");await authRequest(`recover?redirect_to=${encodeURIComponent(redirect.href)}`,{email});}
export async function brokerUpdatePassword(password:string,token:string){if(password.length<12||password.length>128)throw new Error("Use 12 to 128 characters for your password.");await authRequest("user",{password},token,"PUT");}
export async function acceptBrokerConfirmation():Promise<BrokerSession|null> {
  const hash=new URLSearchParams(window.location.hash.slice(1));const accessToken=hash.get("access_token");
  if(!accessToken) return readBrokerSession();
  const duration=Number(hash.get("expires_in"));window.history.replaceState(null,"",window.location.pathname+window.location.search);
  if(!Number.isFinite(duration)||duration<=0) throw new Error("The confirmation link has expired.");
  await authRequest("user",undefined,accessToken);
  return saveSession({access_token:accessToken,expires_in:Math.min(duration,3600)});
}
