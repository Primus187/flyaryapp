import { rmSync } from 'node:fs';
rmSync('docs/handbook/current-screenshots.json', { force: true });
import { marketFixtures, captureMarket } from './handbook-market-fixtures.mjs';
import { chromium } from '@playwright/test';
import { loadEnv } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

// Genuine mobile UI with fictional, isolated API responses. No production traffic.
const base=(process.env.HANDBOOK_BASE_URL || 'http://127.0.0.1:4175'), out='docs/handbook/school-mobile';
mkdirSync(out,{recursive:true});
const uid='11111111-1111-4111-8111-111111111111', gid='22222222-2222-4222-8222-222222222222', eid='33333333-3333-4333-8333-333333333333', sid='44444444-4444-4444-8444-444444444444', hid='55555555-5555-4555-8555-555555555555';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'schule@example.invalid',app_metadata:{provider:'email'},user_metadata:{full_name:'Robin Beispiel'},created_at:'2026-01-01T00:00:00Z'};
const profile={user_id:uid,pilot_name:'Robin Beispiel',training_level:'licensed',avatar_url:null};
const group={id:gid,name:'Flugschule Voralpen',group_type:'school',created_by:uid,invite_code:'DEMO2026',description:'Gemeinsam sicher lernen.'};
const event={id:eid,group_id:gid,title:'Höhenflüge Niederbauen',event_date:'2026-09-26T07:00:00Z',status:'confirmed',event_category:'height_flight',event_type:'Höhenflug',meeting_point:'Talstation Emmetten',flight_area:'Niederbauen',day_topic:'Landeeinteilung',instructor:'Robin Beispiel',launch_helper:'Sam Muster',max_participants:8,signup_deadline:'2026-09-25',created_by:uid,groups:group,description:'Wir besprechen das Tagesziel gemeinsam.',flight_prep_notes:'Schirm und Funkgerät prüfen. Persönliches Tagesziel vorbereiten.'};
const equipment=[{id:'eq1',group_id:gid,name:'Schulschirm Alpha 26',equipment_type:'glider',inventory_number:'S-026',size:'26',condition:'Gut, Check dokumentiert',status:'in_stock',purchase_date:'2026-03-01',next_check_date:'2027-03-01',notes:'Blau / weiss',shv_type_approved:true},{id:'eq2',group_id:gid,name:'Gurtzeug Schulung M',equipment_type:'harness',inventory_number:'G-014',size:'M',condition:'Gut',status:'assigned',next_check_date:'2027-03-01',shv_type_approved:true}];
const loan={id:'loan1',group_id:gid,equipment_id:'eq2',user_id:sid,assigned_on:'2026-09-20',due_on:'2026-09-30',returned_on:null,note:'Für Höhenflugkurs'};
const billing=[{id:'bill1',group_id:gid,user_id:sid,event_id:eid,item_type:'rental',description:'Materialmiete Höhenflugtag',quantity:1,unit_amount:30,amount:30,billing_date:'2026-09-22',paid_at:null,note:'Gurtzeug'},{id:'bill2',group_id:gid,user_id:sid,event_id:null,item_type:'course_fee',description:'Grundkurs',quantity:1,unit_amount:300,amount:300,billing_date:'2026-06-01',paid_at:'2026-06-05',note:null}];
const data={profiles:[profile,{user_id:sid,pilot_name:'Alex Beispiel',training_level:'altitude',shv_number:'123456'},{user_id:hid,pilot_name:'Sam Muster',training_level:'licensed'}],groups:[group],group_members:[{group_id:gid,user_id:uid,role:'admin',groups:group},{group_id:gid,user_id:sid,role:'member',groups:group},{group_id:gid,user_id:hid,role:'member',groups:group}],group_member_functions:[{group_id:gid,user_id:uid,function:'school_lead'},{group_id:gid,user_id:uid,function:'instructor'},{group_id:gid,user_id:sid,function:'student'},{group_id:gid,user_id:hid,function:'launch_helper'}],flight_events:[event],event_signups:[{id:'signup1',event_id:eid,user_id:sid,signed_up:true,status:'confirmed',confirmed_by_school:true,attended:true}],event_staff:[{id:'staff1',event_id:eid,user_id:uid,role:'instructor',flight_events:event},{id:'staff2',event_id:eid,user_id:hid,role:'launch_helper',flight_events:event}],school_equipment:equipment,equipment_assignments:[loan],billing_items:billing,school_rates:[['travel_per_km',.7,'km'],['rental_per_day',30,'Tag'],['rental_per_week',120,'Woche'],['launch_leader_per_day',50,'Tag']].map(([rate_key,amount,unit])=>({group_id:gid,rate_key,amount,unit,valid_from:'2026-01-01'})),launch_leader_credits:[{id:'credit1',group_id:gid,user_id:hid,event_id:eid,entry_type:'earned',booking_date:'2026-09-22',days:1,amount:50,note:'Startleitung Höhenflugtag'}],equipment_maintenance:[{id:'maint1',group_id:gid,equipment_id:'eq1',maintenance_type:'glider_check',due_at:'2027-03-01',completed_at:null,note:'Termin beim Checkbetrieb vereinbaren'}],instructor_certifications:[{id:'cert1',group_id:gid,user_id:uid,cert_type:'instructor',issued_at:'2025-03-01',valid_until:'2028-03-01'},{id:'cert2',group_id:gid,user_id:hid,cert_type:'launch_leader',issued_at:'2025-04-01',valid_until:'2028-04-01'}],equipment_checks:['helmet','shoes','harness_protector','reserve'].map(item=>({group_id:gid,student_user_id:sid,item,present:item!=='reserve'})),incident_reports:[{id:'incident1',group_id:gid,event_id:eid,occurred_at:'2026-09-22T09:30:00Z',description:'Bei der Materialausgabe wurde eine beschädigte Funkgerätehalterung festgestellt.',involved_persons:'Alex Beispiel',measures:'Gerät ersetzt und zur Kontrolle zurückgelegt.',reported_by:uid,submitted_at:null}],instructor_availability:[{id:'avail1',group_id:gid,user_id:uid,date:'2026-09-26',status:'available',note:'Ab 08:00 Uhr'},{id:'avail2',group_id:gid,user_id:hid,date:'2026-09-26',status:'unsure',note:'Rückmeldung am Freitag'}],team_polls:[{id:'poll1',group_id:gid,question:'Wer übernimmt am Samstag den Rücktransport?',options:['Ich kann','Nur vormittags','Nicht verfügbar'],closes_at:'2026-09-25T16:00:00Z',created_by:uid,created_at:'2026-09-22T12:00:00Z'}],team_poll_responses:[],student_day_notes:[{id:'daynote1',event_id:eid,student_id:sid,coach_id:uid,note:'Saubere Vorbereitung. Nächster Fokus: Gegenanflug früher planen.',flight_number:null,visible_to_student:true,is_next_step:true,created_at:'2026-09-22T16:00:00Z'}],training_categories:[{id:'cat1',name:'Landung',training_level:'brevetkurs',sort_order:1}],training_items:[{id:'item1',name:'Landeeinteilung',category_id:'cat1',sort_order:1,is_exam_maneuver:true,training_categories:{name:'Landung'}}],training_progress:[{user_id:sid,item_id:'item1',rating:2,notes:'Gegenanflug früher planen'}],flights:[{id:'flight1',user_id:sid,group_id:gid,date:'2026-09-26',duration_minutes:32,altitude_gain:820,glider:'Advance Alpha 26'}],push_subscriptions:[{user_id:uid}],group_messages:[],training_level_history:[{user_id:sid,group_id:gid,training_level:'ground',changed_at:'2026-06-01T00:00:00Z'},{user_id:sid,group_id:gid,training_level:'altitude',changed_at:'2026-07-01T00:00:00Z'}],student_status_history:[]};
const dossier={overview:{name:'Alex Beispiel',level:'altitude',shvNumber:'123456',theoryDate:'2026-06-15',practicalDate:null,gliderInfo:'Advance Alpha 26',flightCount:24,lastFlight:'2026-09-22',examTotal:8,examDone:5,status:{status:'active',reason:null,date:null},nextStep:{note:'Gegenanflug früher planen und Blickführung festigen.',eventId:eid,date:'2026-09-22'},upcoming:[event]},training:{rows:[{id:'item1',name:'Landeeinteilung',category:'Landung',training_level:'brevetkurs',is_exam_maneuver:true,rating:2,notes:'Gegenanflug früher planen',updated_at:'2026-09-22'}]},flights:{rows:[{id:'flight1',date:'2026-09-22',glider:'Advance Alpha 26',duration_minutes:32,altitude_gain:820,comments:'Ruhiger Flug. Landeeinteilung geübt.',takeoff:'Niederbauen',landing:'Emmetten',notes:[{id:'n1',note:'Gute Blickführung, Gegenanflug früher planen.',author:'Robin Beispiel',visible:true,date:'2026-09-22'}]}],total:1},notes:{rows:[{id:'n2',note:'Gegenanflug früher planen und Blickführung festigen.',flight_number:null,visible:true,is_next_step:true,author:'Robin Beispiel',event_id:eid,title:event.title,event_date:'2026-09-22'}],total:1},equipment:{loans:[{...loan,...equipment[1],id:'loan1'}],own:[{id:'own1',manufacturer:'Advance',model:'Alpha',size:'26',is_default:true,last_check_date:'2026-03-01',next_check_date:'2027-03-01',reserve_repack_date:'2027-03-15'}]},billing:{rows:billing,total:2,open:30,paid:300}};
const dashboard={isAdmin:true,studentCount:1,nextEvent:event,openNotesCount:1,openBilling:30,licensedCount:3,nextSignups:1,students:[{userId:sid,pilotName:'Alex Beispiel',trainingLevel:'altitude',flightCount:24,examProgress:63,lastSummary:'Saubere Vorbereitung und ruhige Landung.',nextStep:'Gegenanflug früher planen.',status:'active'}],events:[{...event,participantCount:1,notesCount:1}]};
data.student_day_notes[0].student_user_id=sid;
data.student_day_notes.push({id:'daynote2',event_id:eid,student_user_id:sid,coach_id:uid,flight_number:1,note:'Gute Blickführung. Gegenanflug früher planen.',visible_to_student:true,is_next_step:false});
data.instructor_availability.push({id:'avail3',group_id:gid,user_id:uid,date:'2026-09-24',status:'available',note:'Planung ab 14:00 Uhr'});
data.group_messages.push({id:'message1',group_id:gid,user_id:uid,message:'Am Samstag treffen wir uns um 09:00 Uhr an der Talstation. Bitte bestätigt die Information.',is_team_only:false,is_announcement:true,requires_confirmation:true,attachment_path:null,created_at:'2026-09-23T15:00:00Z'});
data.announcement_read_receipts=[{message_id:'message1',user_id:sid}];
const cid='66666666-6666-4666-8666-666666666666', tid='77777777-7777-4777-8777-777777777777';
const channels=[
 {id:cid,name:'Allgemein',audience:'all',description:'Informationen für unsere Schulgruppe.'},
 {id:tid,name:'Team',audience:'team',description:'Interne Einsatzplanung.'},
 {id:'88888888-8888-4888-8888-888888888888',name:null,kind:'event',event_id:eid,event_title:event.title,event_date:event.event_date,audience:'all'},
 {id:'99999999-9999-4999-8999-999999999999',name:null,kind:'direct',peer:{user_id:hid,pilot_name:'Sam Muster'},audience:'custom'},
].map(c=>({kind:'group',group_id:gid,group_name:group.name,group_type:'school',description:null,event_id:null,event_title:null,event_date:null,audience_levels:null,staff_only_posting:false,is_default:true,archived_at:null,created_at:'2026-09-23T12:00:00Z',last_message_at:'2026-09-24T10:00:00Z',can_manage:true,can_post:true,notify_level:'mentions',unread:1,last_message:{message:'Treffpunkt am Samstag: Talstation Emmetten.',author:'Robin Beispiel',created_at:'2026-09-24T10:00:00Z',user_id:uid,has_attachment:false,is_announcement:false},...c}));
data.chat_messages=channels.flatMap(c=>[
 {id:c.id+'-2',channel_id:c.id,user_id:uid,message:c.id===tid?'Danke Sam, ich übernehme das Briefing.':'Treffpunkt am Samstag: Talstation Emmetten.',created_at:'2026-09-24T10:00:00Z',is_announcement:false,requires_confirmation:false,attachment_path:null,mentions:[],reply_to:null},
 {id:c.id+'-1',channel_id:c.id,user_id:hid,message:c.id===tid?'Ich übernehme am Samstag die Startleitung.':'Ich bin am Samstag dabei.',created_at:'2026-09-24T09:00:00Z',is_announcement:false,requires_confirmation:false,attachment_path:null,mentions:[],reply_to:null}
]);
data.chat_message_reactions=[];data.chat_message_receipts=[];
data.event_carpools=[];data.annual_report_submissions=[];data.event_briefing_tasks=[];data.event_maneuvers=[];data.event_program_items=[];data.flight_training_items=[];
const market=marketFixtures({uid,gid,peer:sid,school:true});
Object.assign(data,market.tables);
data.event_day_pauses=[];
data.event_school_flights=[{id:'school-flight-1',event_id:eid,student_user_id:sid,seq:1,status:'landed',started_at:'2026-09-26T08:00:00Z',landed_at:'2026-09-26T08:18:00Z',start_note:null}];
data.event_school_flight_notes=[];
data.event_school_flight_items=[];
for(const note of data.student_day_notes){note.student_user_id=sid;note.flight_number=null;}
const authKey='sb-'+new URL(loadEnv('development',process.cwd(),'VITE_').VITE_SUPABASE_URL).hostname.split('.')[0]+'-auth-token';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'de-CH',timezoneId:'Europe/Zurich',colorScheme:'light',serviceWorkers:'block'});
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:4102444800,role:'authenticated'})).toString('base64url')}.demo`;
await context.addInitScript(({user,token,gid,authKey})=>{localStorage.setItem(authKey,JSON.stringify({access_token:token,refresh_token:'demo',token_type:'bearer',expires_in:31536000,expires_at:4102444800,user}));localStorage.setItem('flyary-language','de');localStorage.setItem('flyary-theme','light');localStorage.setItem('flyary-onboarding-done','1');localStorage.setItem(`flyary.roleMode:${user.id}`,'school');localStorage.setItem(`flyary.school:${user.id}`,gid);sessionStorage.setItem('flyary-splash-seen','1');},{user,token,gid,authKey});
await context.routeWebSocket(/.*/, ws=>ws.close());
const unknown=new Set();
await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin===base)return route.continue();if(url.pathname.startsWith('/auth/v1/'))return route.fulfill({json:user});if(!url.pathname.includes('/rest/v1/'))return route.abort();const table=url.pathname.split('/').at(-1);let result;
 if(url.pathname.includes('/rpc/')){const body=req.postDataJSON()||{};if(market.rpc(table,body)!==undefined)result=market.rpc(table,body);else if(table==='flight_day_role')result=data.group_member_functions.some(r=>r.user_id===uid&&r.function==='instructor')?'instructor':'helper';else if(table==='inactive_school_students')result=[];else if(table==='event_detail_data')result={event,signups:data.event_signups,members:data.group_members,myFunctions:data.group_member_functions.filter(r=>r.user_id===uid).map(r=>r.function),profiles:Object.fromEntries(data.profiles.map(p=>[p.user_id,p.pilot_name])),me:profile,briefingTasks:[],maneuverNames:[],photos:[]};else if(table==='chat_inbox')result=channels;else if(table==='chat_channel_json')result=channels.find(c=>c.id===body._channel);else if(table==='chat_event_channel')result=channels.find(c=>c.event_id===body._event);else if(table==='chat_channel_readers')result=data.profiles;else if(table==='chat_mark_read')result=null;else if(table==='chat_direct_candidates')result=data.profiles.filter(p=>p.user_id!==uid).map(p=>({...p,groups:[group.name]}));else if(table==='chat_search')result=[{id:cid+'-2',channel_id:cid,message:'Treffpunkt am Samstag: Talstation Emmetten.',created_at:'2026-09-24T10:00:00Z',author:'Robin Beispiel',channel:'Allgemein',kind:'group',group_name:group.name}];else if(table==='school_dashboard_data')result=dashboard;else if(table==='school_student_dossier')result=dossier[body._section];else if(table==='get_own_profile_private')result=[profile];else if(table==='my_access')result={has_access:true,waitlisted:false,invited:false};else{unknown.add('rpc/'+table);result=[];}}
 else{result=[...(data[table]||[])];if(!data[table])unknown.add(table);for(const [key,val]of url.searchParams){if(val.startsWith('eq.'))result=result.filter(r=>String(r[key])===val.slice(3));if(val.startsWith('in.('))result=result.filter(r=>val.slice(4,-1).split(',').includes(String(r[key])));}if(url.searchParams.has('limit'))result=result.slice(0,Number(url.searchParams.get('limit')));if(req.headers().accept?.includes('vnd.pgrst.object'))result=result[0]??null;}
 return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':`0-0/${Array.isArray(result)?result.length:1}`},body:req.method()==='HEAD'?'':JSON.stringify(result)});
});
const page=await context.newPage(),errors=[];
await page.clock.setFixedTime(new Date('2026-09-24T12:00:00+02:00'));page.on('pageerror',e=>errors.push(e.message));
const selected=process.argv.find(a=>a.startsWith('--screen='))?.slice(9).split(',');
const additional=process.argv.includes('--additional');
let manifest=(selected||additional)&&existsSync(`${out}/manifest.json`)?JSON.parse(readFileSync(`${out}/manifest.json`,'utf8')).screenshots.filter(s=>selected?!selected.includes(s.name):Number(s.name.slice(0,2))<31):[];
const btn=(name)=>page.getByRole('button',{name,exact:true});
const fill=async(name,value)=>{await page.getByText(name,{exact:true}).last().locator('..').locator('input,textarea').first().fill(value);};
const choose=async(name)=>{await page.getByRole('dialog').getByRole('combobox').first().click();await page.getByRole('option',{name,exact:true}).click();};
const tab=async name=>{await page.getByRole('tab',{name,exact:true}).click();await page.waitForTimeout(400);};
const scroll=async text=>{await page.getByText(new RegExp('^'+text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i')).first().evaluate(el=>el.scrollIntoView({block:'start'}));};
async function shot(name,path,action,keep=false){if(selected&&!selected.includes(name))return;if(additional&&Number(name.slice(0,2))<31)return;await page.goto(base+path,{waitUntil:'networkidle'});await page.waitForTimeout(600);if(action)await action();await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(0,0);if(!keep)await page.evaluate(()=>{window.scrollTo(0,0);for(const el of document.querySelectorAll('*'))if(el.scrollTop)el.scrollTop=0;});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});manifest.push({name,path,viewport:{width:390,height:844},pixels:{width:780,height:1688},demo:true});writeFileSync(`${out}/${name}.txt`,await page.locator('body').innerText());console.log('Captured '+name);}
const dp=`/school/students/${gid}/${sid}`;
try{
await shot('01-overview','/school');
await shot('02-team','/school/people');
await shot('03-team-functions','/school/people',async()=>{await btn('Funktionen verteilen').click();});
await shot('04-students','/school/students');
await shot('05-dossier',dp);
await shot('06-training',dp,()=>tab('Ausbildung'));
await shot('07-flights',dp,()=>tab('Flüge'));
await shot('08-notes',dp,()=>tab('Tagesnotizen'));
await shot('09-student-equipment',dp,()=>tab('Material'));
await shot('10-student-billing',dp,()=>tab('Abrechnung'));
await shot('11-days','/school/days');
await shot('12-event-form',`/events/new?group=${gid}`,async()=>{await page.locator('input').first().fill('Höhenflüge Niederbauen');await page.locator('input[type=date]').first().fill('2026-09-26');});
await shot('13-event',`/events/${eid}`);
await shot('14-inventory','/school/equipment');
await shot('15-material-form','/school/equipment',async()=>{await btn('Material aufnehmen').click();await fill('Bezeichnung','Schulschirm Alpha 26');await fill('Grösse','26');await fill('Inventarnummer','S-027');await fill('Zustand','Neu aufgenommen');await fill('Nächster Check','2027-03-01');});
await shot('16-loan-form','/school/equipment',async()=>{await btn('Ausgeben').first().click();await choose('Alex Beispiel');await fill('Zurück bis','2026-09-30');await fill('Notizen','Für Höhenflugkurs');});
await shot('17-loans','/school/equipment',()=>tab('Ausgaben'));
await shot('18-rates','/school/equipment',()=>tab('Ansätze'));
await shot('19-maintenance','/school/safety',()=>tab('Wartung'));
await shot('20-certificates','/school/safety',()=>tab('Zertifikate'));
await shot('21-gear','/school/safety',()=>tab('Ausrüstung'));
await shot('22-incidents','/school/safety');
await shot('23-incident-form','/school/safety',async()=>{await btn('Vorfall melden').click();await fill('Beteiligte Personen','Alex Beispiel');await fill('Hergang','Beschädigte Funkgerätehalterung bei der Materialausgabe festgestellt.');await fill('Getroffene Massnahmen','Gerät ersetzt und zur Kontrolle zurückgelegt.');});
await shot('24-billing','/school/billing');
await shot('25-billing-form','/school/billing',async()=>{await btn('Posten erfassen').click();await choose('Alex Beispiel');await page.getByRole('dialog').getByRole('combobox').nth(1).click();await page.getByRole('option',{name:'Materialmiete',exact:true}).click();await fill('Beschreibung','Materialmiete, zwei Kurstage');await fill('Menge','2');});
await shot('26-credits','/school/credits');
await shot('27-credit-form','/school/credits',async()=>{await btn('Buchung erfassen').click();await choose('Sam Muster');await fill('Notiz','Startleitung Höhenflugtag');});
await shot('28-availability','/school/availability');
await shot('29-team-channel',`/messages/${tid}`);
await shot('30-stats','/school/stats');
await shot('31-event-planning',`/events/${eid}/edit`,()=>scroll('Leitung & Anmeldung'),true);
await shot('32-status',`/events/${eid}`,async()=>{await btn('Status ändern').click();});
await shot('33-attendance',`/events/${eid}?tab=participants`);
await shot('34-coaching',`/events/${eid}?tab=day`,async()=>{await page.getByRole('radiogroup').waitFor();await page.getByRole('tabpanel').evaluate(el=>el.scrollIntoView({block:'start'}));},true);
await shot('35-maintenance-form','/school/safety',async()=>{await tab('Wartung');await btn('Frist erfassen').click();await choose('Schulschirm Alpha 26');await page.getByRole('dialog').getByRole('combobox').nth(1).click();await page.getByRole('option',{name:'Schirm-Check',exact:true}).click();await fill('Fällig am','2027-03-01');await fill('Notiz','Termin beim Checkbetrieb vereinbaren');});
await shot('36-certificate-form','/school/safety',async()=>{await tab('Zertifikate');await btn('Zertifikate bearbeiten').first().click();});
await shot('37-poll-form','/school/communication',async()=>{await btn('Neue Umfrage').click();await fill('Frage','Wer übernimmt am Samstag den Rücktransport?');});
await shot('38-annual-report','/school/stats',async()=>{await page.getByRole('combobox').last().click();await page.getByRole('option',{name:'2026',exact:true}).click();await page.waitForTimeout(400);await scroll('SHV-Jahresbericht');},true);
await shot('39-statement','/school/billing',async()=>{await page.getByRole('button',{name:/Alex Beispiel/}).first().click();});
await shot('40-invite','/school',()=>scroll('Personen einladen'),true);
await shot('41-school-chat',`/messages/${cid}`,async()=>{await page.locator(`[id="announce-${cid}"]`).click();await page.locator(`[id="confirm-${cid}"]`).click();await page.getByPlaceholder('Nachricht schreiben… (@ erwähnt jemanden)').fill('Bitte prüft vor Samstag euren Ausrüstungscheck.');});
await shot('43-communication','/school/communication');
await shot('44-channel-form','/school/communication',async()=>{await btn('Neuer Kanal').click();await page.getByRole('dialog').locator('input').first().fill('Höhenflugkurs Herbst');});
await shot('45-messages','/messages');
await shot('46-message-actions',`/messages/${tid}`,async()=>{await page.getByText('Danke Sam, ich übernehme das Briefing.',{exact:true}).click({button:'right'});});
await shot('47-notify',`/messages/${tid}`,async()=>{await btn('Benachrichtigungen').click();});
await shot('48-direct','/messages',async()=>{await btn('Nachricht').click();});
await shot('49-search','/messages',async()=>{await page.getByPlaceholder('Kanäle, Personen und Nachrichten durchsuchen').fill('Treffpunkt');await page.waitForTimeout(600);});
await shot('50-event-planning',`/events/${eid}?tab=planning`);
await shot('51-event-chat',`/events/${eid}?tab=chat`,async()=>{await page.getByRole('tab',{name:'Chat',exact:true}).evaluate(el=>el.scrollIntoView({block:'nearest',inline:'center'}));},true);
await captureMarket({page,shot,market,school:true,gid});
// A separate role fixture demonstrates the actual restricted start-helper navigation.
data.group_members[0].role='member';
data.group_member_functions=data.group_member_functions.filter(row=>row.user_id!==uid);
data.group_member_functions.push({group_id:gid,user_id:uid,function:'launch_helper'});
await shot('42-helper-home','/school');
}catch(error){errors.push(error.message);throw error;}finally{writeFileSync(`${out}/manifest.json`,JSON.stringify({capturedAt:new Date().toISOString(),screenshots:manifest.sort((a,b)=>a.name.localeCompare(b.name)),errors,unknown:[...unknown]},null,2));await browser.close();}
