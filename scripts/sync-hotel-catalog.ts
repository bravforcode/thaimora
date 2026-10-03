import {readJson,rest,runSync} from "./lib/db";
import {coordinate,text} from "../supabase/functions/_shared/domain";
async function main(){
  if(process.env.CATALOG_RIGHTS_CONFIRMED!=="true")throw new Error("Client-owned listing rights required");
  const file=process.argv[2];if(!file)throw new Error("Pass client-owned JSON property catalog; no portal scraping");
  const rows=await readJson(file);if(!Array.isArray(rows))throw new Error("Catalog array required");
  await runSync("client-property-catalog",async()=>{
    let written=0;
    for(const row of rows){
      text(row.ownership_evidence);coordinate(row.privateLocation);
      if(row.demo||row.rights_status!=="approved"||!["freehold","leasehold"].includes(row.ownership))throw new Error("Real properties with rights and ownership evidence required");
      const old=await rest("properties?source_id=eq."+encodeURIComponent(row.source_id)+"&select=id,admin_override");
      if(old[0]?.admin_override)continue;
      const {privateLocation,images,...property}=row;
      const [item]=await rest("properties?on_conflict=source_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({...property,published:false})});
      await rest("property_private_locations?on_conflict=property_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({...privateLocation,property_id:item.id})});
      for(const [position,image]of (images??[]).entries()){if(image.rights_status!=="approved"||!image.rights_evidence)throw new Error("Gallery rights evidence required");await rest("property_images?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({...image,property_id:item.id,position})});}
      written++;
    }return {rows_read:rows.length,rows_written:written,detail:{publication:"admin review required; private coordinates never exported"}};
  });
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
