import {ApiError,coordinate,publicProperty,text} from './domain.ts';
import {body,env,json} from './runtime.ts';
import {monthlyPrice,objectId,record,stripeClient,type ObjectValue} from './broker-billing.ts';
import {leadPage,csvResponse,csvText,reportWindow} from './broker-report.ts';

type DbResult={data:unknown;error:{message?:string}|null};
type DbCall=PromiseLike<DbResult>&{abortSignal?:(signal:AbortSignal)=>PromiseLike<DbResult>};
type AuthResult={data:{user:unknown};error:unknown};
export type BrokerDb={rpc:(name:string,args?:Record<string,unknown>)=>DbCall;auth:{getUser:(jwt:string)=>Promise<AuthResult>;admin:{getUserById:(id:string)=>Promise<AuthResult>}}};
export async function brokerRpc(db:BrokerDb,name:string,args?:Record<string,unknown>):Promise<unknown> {
 const call=db.rpc(name,args),result=await(call.abortSignal?call.abortSignal(AbortSignal.timeout(8000)):call);
 if(result.error){
  const message=result.error.message??'';
  if(message.includes('Own listing')||message.includes('Own lead'))throw new ApiError(404,'broker_record_not_found');
  if(message.includes('Paid broker access'))throw new ApiError(403,'subscription_required');
  if(message.includes('terms required'))throw new ApiError(503,'broker_terms_not_configured');
  if(message.includes('already active'))throw new ApiError(409,'subscription_already_active');
  if(message.includes('Existing subscription requires portal'))throw new ApiError(409,'use_billing_portal');
  if(message.includes('Billing review required'))throw new ApiError(403,'billing_review_required');
  if(message.includes('Test billing reset required'))throw new ApiError(409,'test_billing_reset_required');
  if(message.includes('Verified LINE'))throw new ApiError(422,'line_link_required');
  if(message.includes('Verified current email'))throw new ApiError(403,'verified_email_required');
  if(message.includes('Report range invalid'))throw new ApiError(422,'report_range_invalid');
  if(message.includes('Export limit exceeded'))throw new ApiError(422,'export_limit_exceeded');
  if(message.includes('Invalid account kind'))throw new ApiError(422,'invalid_account_kind');
  if(message.includes('Broker record page required'))throw new ApiError(422,'broker_record_page_required');
  throw new ApiError(503,'broker_database_unavailable');
 }
 return result.data;
}
export async function brokerUser(req:Request,db:BrokerDb,requireVerified=true):Promise<{id:string;email:string}> {
 const bearer=req.headers.get('Authorization')??'';if(!bearer.startsWith('Bearer '))throw new ApiError(401,'unauthorized');
 const result=await db.auth.getUser(bearer.slice(7));if(result.error||!result.data.user)throw new ApiError(401,'unauthorized');
 const user=record(result.data.user);
 if(requireVerified&&(typeof user.email!=='string'||!user.email_confirmed_at))throw new ApiError(403,'verified_email_required');
 return {id:uuid(user.id),email:typeof user.email==='string'?user.email:''};
}
export function uuid(value:unknown):string {const id=text(value,36,36);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new ApiError(422,'invalid_record_id');return id;}
function optionalText(value:unknown,max:number):string|null {return value==null||value===''?null:text(value,1,max);}
function enumValue(value:unknown,values:string[]):string {const result=text(value,1,50);if(!values.includes(result))throw new ApiError(422,'invalid_listing_field');return result;}
function positive(value:unknown):number {if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>1e12)throw new ApiError(422,'invalid_listing_number');return value;}
function whole(value:unknown,min:number,max:number):number {if(typeof value!=='number'||!Number.isInteger(value)||value<min||value>max)throw new ApiError(422,'invalid_listing_number');return value;}
function bilingual(value:unknown,max:number):{en:string;th:string} {const v=record(value);return {en:text(v.en,1,max),th:text(v.th,1,max)};}
export function brokerDraft(raw:ObjectValue,creating:boolean):{fields:ObjectValue;privateLocation:ObjectValue|null;images:ObjectValue[]|null} {
 const allowed=['slug','title','description','transaction','type','priceThb','areaM2','landAreaM2','beds','baths','floor','builtYear','ownership','furnishing','status','zone','province','amenities','sourceUrl','ownershipEvidence','privateLocation','images'];
 if(Object.keys(raw).some(k=>!allowed.includes(k)))throw new ApiError(422,'broker_listing_fields_restricted');
 const required=['slug','title','description','transaction','type','priceThb','areaM2','beds','baths','ownership','furnishing','status','zone','province','amenities','sourceUrl','ownershipEvidence'];
 if(creating&&required.some(k=>raw[k]===undefined))throw new ApiError(422,'incomplete_listing');
 const fields:ObjectValue={};
 for(const key of Object.keys(raw)){
  const value=raw[key];
  if(['privateLocation','images'].includes(key))continue;
  if(key==='slug'){fields.slug=text(value,3,100);if(!/^[a-z0-9][a-z0-9-]*$/.test(String(fields.slug)))throw new ApiError(422,'invalid_slug');}
  else if(key==='title'||key==='description')fields[key]=bilingual(value,key==='title'?200:10000);
  else if(key==='transaction')fields.transaction=enumValue(value,['sale','rent']);
  else if(key==='type')fields.type=enumValue(value,['condo','house','villa','land','townhouse']);
  else if(key==='ownership')fields.ownership=enumValue(value,['freehold','leasehold','unknown']);
  else if(key==='furnishing')fields.furnishing=enumValue(value,['furnished','partly_furnished','unfurnished']);
  else if(key==='status')fields.status=enumValue(value,['available','sold','rented']);
  else if(key==='priceThb')fields.price_thb=positive(value);
  else if(key==='areaM2')fields.area_m2=positive(value);
  else if(key==='landAreaM2')fields.land_area_m2=value==null?null:positive(value);
  else if(key==='beds'||key==='baths')fields[key]=whole(value,0,100);
  else if(key==='floor')fields.floor=value==null?null:whole(value,-5,300);
  else if(key==='builtYear')fields.built_year=value==null?null:whole(value,1800,2200);
  else if(key==='zone'||key==='province')fields[key]=text(value,1,100);
  else if(key==='sourceUrl'){const url=new URL(text(value,8,2000));if(url.protocol!=='https:'||url.username||url.password)throw new ApiError(422,'https_source_required');fields.source_url=url.href;}
  else if(key==='ownershipEvidence')fields.ownership_evidence=text(value,1,5000);
  else if(key==='amenities'){if(!Array.isArray(value)||value.length>50)throw new ApiError(422,'invalid_amenities');fields.amenities=[...new Set(value.map(v=>text(v,1,80)))];}
 }
 let privateLocation:ObjectValue|null=null,images:ObjectValue[]|null=null;
 if(raw.privateLocation!==undefined){const p=record(raw.privateLocation);if(p.exactPublicationConsent===true)throw new ApiError(422,'exact_location_requires_staff_review');privateLocation=coordinate(p);}
 if(raw.images!==undefined){
  if(!Array.isArray(raw.images)||raw.images.length>30)throw new ApiError(422,'invalid_gallery');
  images=raw.images.map(value=>{const image=record(value),url=new URL(text(image.url,8,2000));if(url.protocol!=='https:'||url.username||url.password)throw new ApiError(422,'https_image_required');
   if(Object.keys(image).some(k=>!['id','url','alt','credit','sourceUrl','rightsEvidence'].includes(k)))throw new ApiError(422,'broker_image_fields_restricted');
   return {...(image.id?{id:uuid(image.id)}:{}),url:url.href,alt:bilingual(image.alt,300),credit:optionalText(image.credit,300),source_url:optionalText(image.sourceUrl,2000),rights_status:'pending',rights_evidence:text(image.rightsEvidence,1,5000)};
  });
 }
 return {fields,privateLocation,images};
}
export function brokerListing(value:unknown):ObjectValue {
 const row=record(value),location=row.property_private_locations?record(row.property_private_locations):null;
 const gallery=Array.isArray(row.property_images)?row.property_images.map(value=>{const i=record(value);return {id:i.id,url:i.url,alt:i.alt,credit:i.credit,sourceUrl:i.source_url,rightsEvidence:i.rights_evidence};}):[];
 return {...publicProperty(row),publication:{published:row.published,rightsStatus:row.rights_status,reviewStatus:row.broker_review_status,sourceUrl:row.source_url,ownershipEvidence:row.ownership_evidence},
 privateLocation:location?{lat:location.lat,lng:location.lng,exactPublicationConsent:location.exact_publication_consent}:null,gallery};
}
async function configuration(db:BrokerDb):Promise<ObjectValue> {return record(await brokerRpc(db,'broker_internal_config'));}
function billingConfigured(c:ObjectValue):boolean {return env('BROKER_BILLING_ENABLED')==='true'&&c.billing_enabled===true&&typeof c.stripe_price_id==='string'&&env('STRIPE_SECRET_KEY')!=='';}
export async function publicBrokerConfiguration(db:BrokerDb):Promise<ObjectValue> {
 const c=await configuration(db),enabled=billingConfigured(c);
 const price=enabled?monthlyPrice(await stripeClient(env('STRIPE_SECRET_KEY'))('/prices/'+objectId(c.stripe_price_id,'price')),String(c.stripe_price_id),c.stripe_live_mode===true):{amountMinor:2500,currency:'USD',interval:'month'};
 return {billingEnabled:enabled,monthlyPrice:price,approvalRequired:c.approval_required===true,termsVersion:c.terms_version,
 registrationEnabled:typeof c.terms_version==='string'&&c.terms_version.length>0,
 contactDeliveryEnabled:env('CONTACT_DELIVERY_ENABLED')==='true',lineLinkEnabled:env('LINE_LINK_ENABLED')==='true',
 lineFriendUrl:env('LINE_OA_FRIEND_URL')||null};
}
function stripeReturn():string {const u=new URL(env('BROKER_APP_URL'));if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw new ApiError(503,'broker_origin_not_configured');return u.origin+'/broker/dashboard/';}
async function entitled(db:BrokerDb,user:string):Promise<void> {if(await brokerRpc(db,'broker_is_entitled',{p_actor:user})!==true)throw new ApiError(403,'subscription_required');}
export async function brokerRoute(req:Request,parts:string[],db:BrokerDb):Promise<Response|null> {
 if(parts[0]!=='broker')return null;
 const action=parts[1],id=parts[2];
 if(req.method==='GET'&&action==='config')return json(await publicBrokerConfiguration(db));
 const user=await brokerUser(req,db);
 if(req.method==='GET'&&action==='me')return json(await brokerRpc(db,'broker_context',{p_actor:user.id}));
 if(req.method==='POST'&&action==='register'){
  const raw=record(await body(req));if(raw.termsAccepted!==true)throw new ApiError(422,'broker_terms_required');const accountKind=raw.accountKind===undefined?'broker':raw.accountKind;if(typeof accountKind!=='string'||!['broker','owner'].includes(accountKind))throw new ApiError(422,'invalid_account_kind');
  await brokerRpc(db,'contact_ensure_account',{p_actor:user.id,p_email:user.email});
  return json(await brokerRpc(db,'broker_register',{p_actor:user.id,p_name:text(raw.displayName,2,100),p_company:optionalText(raw.company,200),p_phone:optionalText(raw.phone,40),p_terms:text(raw.termsVersion,1,200),p_kind:accountKind}),201);
 }
 if(req.method==='POST'&&(action==='checkout'||action==='portal')){
  const c=await configuration(db);if(!billingConfigured(c))throw new ApiError(503,'billing_not_configured');
  const stripe=stripeClient(env('STRIPE_SECRET_KEY')),returnUrl=stripeReturn(),binding=await brokerRpc(db,'broker_payment_binding',{p_actor:user.id});
  if(!binding)throw new ApiError(403,'broker_registration_required');
  if(action==='portal'){
   if(record(binding).customerLiveMode!==c.stripe_live_mode)throw new ApiError(409,'test_billing_reset_required');
   const customer=record(binding).customerId;if(!customer)throw new ApiError(403,'subscription_required');
   const session=await stripe('/billing_portal/sessions','POST',new URLSearchParams({customer:objectId(customer,'cus'),return_url:returnUrl}));
   const url=new URL(text(session.url,8,4000));if(url.origin!=='https://billing.stripe.com')throw new ApiError(503,'invalid_billing_redirect');return json({url:url.href});
  }
  monthlyPrice(await stripe('/prices/'+objectId(c.stripe_price_id,'price')),String(c.stripe_price_id),c.stripe_live_mode===true);
  const claim=record(await brokerRpc(db,'broker_start_checkout',{p_actor:user.id}));
  if(claim.busy)throw new ApiError(409,'billing_update_in_progress');if(claim.url)return json({url:claim.url});
  const token=uuid(claim.leaseToken);
  try{
   if(claim.priceId!==c.stripe_price_id||claim.liveMode!==c.stripe_live_mode)throw new ApiError(409,'billing_configuration_changed');
   let customer=claim.customerId;
   if(!customer){const created=await stripe('/customers','POST',new URLSearchParams({email:user.email,'metadata[broker_user_id]':user.id}),'broker-customer-'+user.id);
    customer=objectId(created.id,'cus');await brokerRpc(db,'broker_bind_customer',{p_actor:user.id,p_customer:customer,p_live:c.stripe_live_mode});}
   const session=await stripe('/checkout/sessions','POST',new URLSearchParams({mode:'subscription',customer:objectId(customer,'cus'),
    'line_items[0][price]':String(c.stripe_price_id),'line_items[0][quantity]':'1',success_url:returnUrl+'?checkout=returned',cancel_url:returnUrl+'?checkout=canceled',
    'subscription_data[metadata][broker_user_id]':user.id,client_reference_id:user.id}), 'broker-checkout-'+user.id+'-'+token);
   const url=text(session.url,8,4000),expiry=new Date(Number(session.expires_at)*1000).toISOString();
   if(await brokerRpc(db,'broker_finish_checkout',{p_actor:user.id,p_token:token,p_url:url,p_expires:expiry})!==true)throw new ApiError(503,'checkout_state_not_saved');
   return json({url});
  }catch(error){await brokerRpc(db,'broker_finish_checkout',{p_actor:user.id,p_token:token,p_url:null,p_expires:null}).catch(()=>undefined);throw error;}
 }
 await entitled(db,user.id);
 if(action==='reports'){
  if(req.method!=='GET')throw new ApiError(405,'method_not_allowed');
  const url=new URL(req.url),window=reportWindow(url);
  if(id==='summary')return json(await brokerRpc(db,'broker_report',{p_actor:user.id,p_from:window.from,p_to:window.to}));
  if(id==='leads'){const page=leadPage(url);return json({items:await brokerRpc(db,'broker_report_leads',{p_actor:user.id,p_from:window.from,p_to:window.to,p_before:page.before,p_limit:page.limit})});}
  if(id==='export'){
   const kind=url.searchParams.get('kind')??'';
   if(!['leads','listings'].includes(kind))throw new ApiError(422,'invalid_export_kind');
   const rows=await brokerRpc(db,'broker_report_export',{p_actor:user.id,p_kind:kind,p_from:window.from,p_to:window.to});
   if(!Array.isArray(rows))throw new ApiError(503,'broker_database_unavailable');
   const keys=kind==='leads'?['id','propertyId','name','email','country','message','status','createdAt','firstResponseAt']:['propertyId','slug','published','views','inquiries','contactClicks'];
   return csvResponse(csvText(rows.map(record),keys),`${kind}-${window.from}-${window.to}.csv`);
  }
 }
 if(req.method==='GET'&&action==='dashboard'){
  const [listingRows,leads]=await Promise.all([brokerRpc(db,'broker_read_listings',{p_actor:user.id}),brokerRpc(db,'broker_read_leads',{p_actor:user.id})]);
  if(!Array.isArray(listingRows)||!Array.isArray(leads))throw new ApiError(503,'broker_database_unavailable');
  const listings=listingRows.map(brokerListing);
  return json({stats:{listings:listings.length,publishedListings:listingRows.filter(v=>record(v).published===true).length,newLeads:leads.filter(v=>record(v).status==='new').length},listings,leads});
 }
 if(action==='listings'){
  const property=id?uuid(id):null;
  if(req.method==='GET'){const rows=await brokerRpc(db,'broker_read_listings',{p_actor:user.id,p_id:property});if(!Array.isArray(rows))throw new ApiError(503,'broker_database_unavailable');return json({items:rows.map(brokerListing)});}
  if(req.method==='POST'&&property&&parts[3]==='submit'){await brokerRpc(db,'broker_submit_listing',{p_actor:user.id,p_id:property});return json({submitted:true});}
  if((req.method==='POST'&&!property)||(req.method==='PATCH'&&property)){
   const draft=brokerDraft(record(await body(req)),!property),saved=await brokerRpc(db,'broker_save_listing',{p_actor:user.id,p_id:property,p_fields:draft.fields,p_private:draft.privateLocation,p_images:draft.images});
   const rows=await brokerRpc(db,'broker_read_listings',{p_actor:user.id,p_id:uuid(saved)});if(!Array.isArray(rows)||rows.length!==1)throw new ApiError(503,'broker_database_unavailable');return json({item:brokerListing(rows[0])},property?200:201);
  }
 }
 if(action==='leads'){
  if(req.method==='GET')return json({items:await brokerRpc(db,'broker_read_leads',{p_actor:user.id,p_id:id?uuid(id):null})});
  if(req.method==='PATCH'&&id){const raw=record(await body(req));return json({item:await brokerRpc(db,'broker_update_lead',{p_actor:user.id,p_id:uuid(id),p_status:enumValue(raw.status,['new','contacted','closed'])})});}
 }
 throw new ApiError(404,'broker_route_not_found');
}
export async function brokerAdminRoute(req:Request,parts:string[],db:BrokerDb,staff:string):Promise<Response|null> {
 if(parts[1]==='brokers'){
  if(req.method==='GET')return json({items:await brokerRpc(db,'admin_list_brokers',{p_staff:staff})});
  if(req.method==='PATCH'&&parts[2]){const raw=record(await body(req));return json(await brokerRpc(db,'admin_review_broker',{p_staff:staff,p_actor:uuid(parts[2]),p_status:enumValue(raw.approvalStatus,['approved','suspended','rejected','pending'])}));}
 }
 if(parts[1]==='properties'&&parts[2]&&parts[3]==='contact'){
  const property=uuid(parts[2]);
  if(req.method==='GET')return json({item:await brokerRpc(db,'contact_property_assignment',{p_property:property})});
  if(req.method==='PUT'){
   const raw=record(await body(req)),recipient=uuid(raw.recipientUserId),result=await db.auth.admin.getUserById(recipient);
   if(result.error||!result.data.user||!record(result.data.user).email_confirmed_at)throw new ApiError(422,'verified_recipient_required');
   await brokerRpc(db,'contact_ensure_account',{p_actor:recipient,p_email:record(result.data.user).email});
   return json({item:await brokerRpc(db,'admin_assign_contact',{p_staff:staff,p_property:property,p_recipient:recipient})});
  }
 }
 return null;
}
