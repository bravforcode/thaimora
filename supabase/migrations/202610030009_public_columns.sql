revoke select on properties,property_images from anon;
grant select(id,slug,title,description,transaction,type,price_thb,area_m2,land_area_m2,beds,baths,floor,built_year,ownership,furnishing,status,public_location,zone,province,amenities,published,demo,rights_status,updated_at,expires_at) on properties to anon;
grant select(id,property_id,url,alt,credit,source_url,rights_status,position) on property_images to anon;
