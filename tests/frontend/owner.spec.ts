import {expect,test,type Page} from "@playwright/test";
const ownerId="44444444-4444-4444-8444-444444444444";
const config={billingEnabled:false,monthlyPrice:{amountMinor:2500,currency:"usd",interval:"month"},approvalRequired:false,contactDeliveryEnabled:false,lineLinkEnabled:false,registrationEnabled:true,termsVersion:"test-fixture-only",lineFriendUrl:null};
const profile={id:ownerId,displayName:"Fixture Owner",company:null,phone:null,approvalStatus:"approved",approvedAt:null,createdAt:"2026-10-04T00:00:00Z",accountKind:"owner"};
const account={profile,subscription:{status:"active",currentPeriodEnd:"2099-01-01T00:00:00Z",cancelAtPeriodEnd:false},entitlement:{active:true,reason:"active"},billingEnabled:false};
const preferences={emailEnabled:false,lineEnabled:false,lineLinked:false,consentVersion:"contact-relay-v1"};
const lead={id:"22222222-2222-4222-8222-222222222222",propertyId:"33333333-3333-4333-8333-333333333333",name:"Fixture Lead",email:"lead@example.test",country:"Thailand",message:"Private synthetic lead message",status:"new",createdAt:"2026-10-26T10:00:00Z"};
const report={totals:{views:3,inquiries:1,contactClicks:2,leads:1,newLeads:1,contactedLeads:0,closedLeads:0,respondedLeads:0,medianResponseSeconds:null},daily:[],listings:[{propertyId:"33333333-3333-4333-8333-333333333333",title:{en:"Sea view condo",th:"คอนโดวิวทะเล"},slug:"sea-view-condo",published:true,views:3,inquiries:1,contactClicks:2}]};

async function mockOwner(page:Page,signedIn=true){
  await page.addInitScript(()=>{if(!localStorage.getItem("thaimora-consent"))localStorage.setItem("thaimora-consent","rejected");});
  if(signedIn)await page.addInitScript(()=>sessionStorage.setItem("thaimora-broker-session",JSON.stringify({accessToken:"synthetic-owner-session",expiresAt:Date.now()+3600000})));
  await page.route("**/mock-api/**",route=>{
    const path=new URL(route.request().url()).pathname.split("/mock-api")[1];
    if(path==="/v1/broker/config")return route.fulfill({json:config});
    if(path==="/v1/broker/me")return route.fulfill({json:account});
    if(path==="/v1/contact/preferences")return route.fulfill({json:preferences});
    if(path==="/v1/broker/dashboard")return route.fulfill({json:{stats:{listings:1,publishedListings:1,newLeads:1},listings:[],leads:[lead]}});
    if(path==="/v1/broker/reports/summary")return route.fulfill({json:report});
    if(path==="/v1/broker/reports/leads")return route.fulfill({json:{items:[lead]}});
    return route.fulfill({json:{}});
  });
}

for(const width of [360,390,1024,1440]){
  test(`owner report fits ${width}px without horizontal scroll`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await mockOwner(page);
    await page.goto("/owner/dashboard/");
    await expect(page.getByRole("heading",{name:"Report",exact:true})).toBeVisible();
    await expect(page.getByText("Sea view condo")).toBeVisible();
    await expect(page.getByText("Fixture Lead")).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("owner exports inquiries as a dated CSV",async({page})=>{
  await mockOwner(page);
  let exportUrl="";
  await page.route("**/mock-api/v1/broker/reports/export**",route=>{
    exportUrl=route.request().url();
    return route.fulfill({headers:{"Content-Type":"text/csv; charset=utf-8"},body:"﻿\"name\",\"message\"\r\n\"Fixture Lead\",\"Private synthetic lead message\"\r\n"});
  });
  await page.goto("/owner/dashboard/");
  await expect(page.getByText("Fixture Lead")).toBeVisible();
  const download=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export inquiries (CSV)"}).click();
  const file=await download;
  expect(file.suggestedFilename()).toMatch(/^leads-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(exportUrl).toContain("kind=leads");
});

test("owner membership quotes the shared monthly price in English and Thai",async({page})=>{
  await mockOwner(page,false);
  await page.goto("/owner/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content","noindex, nofollow");
  await expect(page.getByRole("heading",{name:"List your property. Reach buyers directly."})).toBeVisible();
  await expect(page.getByText("$25.00 / month").first()).toBeVisible();
  await page.goto("/th/owner/");
  await expect(page.getByRole("heading",{name:"ลงประกาศทรัพย์ ติดต่อผู้สนใจโดยตรง"})).toBeVisible();
  await expect(page.getByText("$25.00 / เดือน").first()).toBeVisible();
});
