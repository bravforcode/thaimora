import { z } from "zod";
import { propertySchema } from "./property";

export const brokerConfigSchema = z.object({
  billingEnabled: z.boolean(),
  monthlyPrice: z.object({ amountMinor: z.number().int().positive(), currency: z.string().length(3), interval: z.literal("month") }).nullable(),
  approvalRequired: z.boolean(), contactDeliveryEnabled: z.boolean(), lineLinkEnabled: z.boolean(),
  registrationEnabled: z.boolean().default(false), termsVersion: z.string().nullable().default(null),
  lineFriendUrl: z.string().nullable().optional(),
});
export const brokerProfileSchema = z.object({
  id: z.string().uuid(), displayName: z.string(), company: z.string().nullable().optional(),
  phone: z.string().nullable().optional(), approvalStatus: z.string(),
  approvedAt: z.string().nullable().optional(), createdAt: z.string(), accountKind: z.enum(["broker","owner"]).default("broker"),
});
export const brokerMeSchema = z.object({
  profile: brokerProfileSchema.nullable(),
  subscription: z.object({ status: z.string(), currentPeriodEnd: z.string().nullable(), cancelAtPeriodEnd: z.boolean() }),
  entitlement: z.object({ active: z.boolean(), reason: z.string() }), billingEnabled: z.boolean(),
});
const galleryImage = z.object({ url: z.string(), alt: z.object({en:z.string(),th:z.string()}), credit:z.string().nullish().transform(v=>v??undefined), sourceUrl:z.string().nullish().transform(v=>v??undefined), rightsEvidence:z.string().nullish().transform(v=>v??"") });
export const brokerListingSchema = propertySchema.extend({
  publication: z.object({ published:z.boolean(), rightsStatus:z.string(), reviewStatus:z.string(), ownershipEvidence:z.string().nullish().transform(v=>v??undefined),sourceUrl:z.string().nullable().optional() }),
  privateLocation: z.object({lat:z.number(),lng:z.number(),exactPublicationConsent:z.boolean()}).nullable(),
  gallery:z.array(galleryImage),
});
export const brokerLeadSchema = z.object({id:z.uuid(),propertyId:z.uuid(),name:z.string(),email:z.email(),country:z.string(),message:z.string(),status:z.enum(["new","contacted","closed"]),createdAt:z.string(),firstResponseAt:z.string().nullish()});
export const brokerDashboardSchema = z.object({stats:z.object({listings:z.number().int().nonnegative(),publishedListings:z.number().int().nonnegative(),newLeads:z.number().int().nonnegative()}),listings:z.array(brokerListingSchema),leads:z.array(brokerLeadSchema)});
const count = z.number().int().nonnegative();
export const brokerReportSchema = z.object({
  totals: z.object({ views: count, inquiries: count, contactClicks: count, leads: count, newLeads: count, contactedLeads: count, closedLeads: count, respondedLeads: count, medianResponseSeconds: z.number().nonnegative().nullable() }),
  daily: z.array(z.object({ day: z.iso.date(), views: count, inquiries: count, contactClicks: count })),
  listings: z.array(z.object({ propertyId: z.uuid(), title: z.object({ en: z.string(), th: z.string() }), slug: z.string(), published: z.boolean(), views: count, inquiries: count, contactClicks: count })),
});
export const contactPreferencesSchema = z.object({emailEnabled:z.boolean(),lineEnabled:z.boolean(),lineLinked:z.boolean(),consentVersion:z.literal("contact-relay-v1")});
export type BrokerConfig = z.infer<typeof brokerConfigSchema>;
export type BrokerMe = z.infer<typeof brokerMeSchema>;
export type BrokerListing = z.infer<typeof brokerListingSchema>;
export type BrokerDashboard = z.infer<typeof brokerDashboardSchema>;
export type ContactPreferences = z.infer<typeof contactPreferencesSchema>;
export type BrokerLead = z.infer<typeof brokerLeadSchema>;
export type BrokerReport = z.infer<typeof brokerReportSchema>;
export const pendingBrokerConfig:BrokerConfig={billingEnabled:false,monthlyPrice:{amountMinor:2500,currency:"usd",interval:"month"},approvalRequired:false,contactDeliveryEnabled:false,lineLinkEnabled:false,registrationEnabled:false,termsVersion:null,lineFriendUrl:null};

export class BrokerApiError extends Error {
  constructor(public status:number, public code:string, message:string) {super(message);}
}
function brokerBase():string {
  const base=process.env.NEXT_PUBLIC_API_URL;
  if(process.env.NEXT_PUBLIC_DATA_MODE!=="live" || !base) throw new BrokerApiError(503,"configuration_pending","Account services are not connected yet.");
  return base;
}
export async function brokerApi<T>(path:string, schema:z.ZodType<T>, token?:string, body?:unknown, method=body === undefined ? "GET" : "POST"):Promise<T> {
  const response=await fetch(`${brokerBase()}${path}`,{method,cache:"no-store",redirect:"error",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(20000),headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value:unknown=await response.json();
  if(!response.ok) { const error=z.object({error:z.object({code:z.string().optional(),message:z.string().optional()}).optional(),message:z.string().optional()}).safeParse(value); throw new BrokerApiError(response.status,error.success?error.data.error?.code||"request_failed":"request_failed",error.success?error.data.error?.message||error.data.message||"Request failed.":"Request failed."); }
  return schema.parse(value);
}
export async function brokerDownload(path:string, token:string):Promise<Blob> {
  const response=await fetch(`${brokerBase()}${path}`,{cache:"no-store",redirect:"error",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`}});
  if(!response.ok) { const error=z.object({error:z.object({code:z.string().optional()}).optional()}).safeParse(await response.json().catch(()=>null)); throw new BrokerApiError(response.status,error.success?error.data.error?.code||"request_failed":"request_failed","Export failed."); }
  return response.blob();
}
export function safeProviderUrl(value:string, provider:"stripe"|"line") {
  const url=new URL(value);
  const hosts=provider==="stripe"?["checkout.stripe.com","billing.stripe.com"]:["access.line.me"];
  if(url.protocol!=="https:" || url.username || url.password || url.port || !hosts.includes(url.hostname)) throw new Error("The provider returned an invalid destination.");
  if(provider==="line" && url.pathname!=="/dialog/bot/accountLink") throw new Error("The provider returned an invalid destination.");
  return url.href;
}
export function monthlyPriceLabel(config:BrokerConfig, locale:"en"|"th") {
  if(!config.monthlyPrice) return locale==="th"?"รอประกาศค่าสมาชิกรายเดือน":"Monthly price to be announced";
  const formatter=new Intl.NumberFormat(locale==="th"?"th-TH":"en-US",{style:"currency",currency:config.monthlyPrice.currency.toUpperCase()});
  const digits=formatter.resolvedOptions().maximumFractionDigits??2;
  return formatter.format(config.monthlyPrice.amountMinor/10**digits);
}
