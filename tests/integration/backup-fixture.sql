insert into properties(id,slug,title,description,transaction,type,price_thb,area_m2,ownership,furnishing,zone,province,rights_status,ownership_evidence,demo)
values('99999999-9999-9999-9999-999999999999','backup-fixture','{"en":"Backup fixture","th":"ข้อมูลทดสอบ"}','{"en":"Synthetic restoration test","th":"ข้อมูลทดสอบ"}','sale','villa',1000000,100,'freehold','furnished','Phuket','Phuket','approved','synthetic owner evidence',true);
insert into property_private_locations(property_id,lat,lng)values('99999999-9999-9999-9999-999999999999',7.912345,98.312345);
insert into inquiries(property_id,name,email,country,message,idempotency_hash,payload_hash)
values('99999999-9999-9999-9999-999999999999','Synthetic backup test','backup@example.test','TH','Restoration fixture only','backup-test-key','backup-test-payload');
insert into email_outbox(inquiry_id)select id from inquiries where idempotency_hash='backup-test-key';
