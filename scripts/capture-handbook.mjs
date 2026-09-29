import { rmSync } from 'node:fs';
rmSync('docs/handbook/current-screenshots.json', { force: true });
import { marketFixtures, captureMarket } from './handbook-market-fixtures.mjs';
﻿import { loadEnv } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

// Real app rendering with local, fictional API fixtures. No production requests.
const base = (process.env.HANDBOOK_BASE_URL || 'http://127.0.0.1:4175');
const out = 'docs/handbook/mobile';
mkdirSync(out, { recursive: true });
const uid = '11111111-1111-4111-8111-111111111111';
const gid = '22222222-2222-4222-8222-222222222222';
const eid = '33333333-3333-4333-8333-333333333333';
const fid = '44444444-4444-4444-8444-444444444444';
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'alex@example.invalid', app_metadata: { provider: 'email' }, user_metadata: { full_name: 'Alex Beispiel' }, created_at: '2026-01-01T00:00:00Z' };
const profile = { ...user, user_id: uid, pilot_name: 'Alex Beispiel', avatar_url: null, cover_photo_url: null, bio: 'Unterwegs in den Schweizer Voralpen.', training_level: 'altitude', glider_info: 'Mein erster eigener Schirm', flight_school: 'Flugschule Beispiel', shv_number: '123456', exam_theory_date: '2026-06-15', exam_practical_date: null, health_data_consent_at: null, xcontest_username: null };
const group = { id: gid, name: 'Fluggruppe Voralpen', group_type: 'pilot_group', description: 'Gemeinsam fliegen, Erfahrungen teilen.', created_by: 'another-user', created_at: '2026-01-01T00:00:00Z' };
const locations = [{ id: 'takeoff', user_id: uid, name: 'Niederbauen', type: 'takeoff', latitude: 46.929, longitude: 8.530, altitude: 1575, country_code: 'CH', description: 'Beispiel eines Startplatzes', optimal_wind_directions: ['N', 'NW'] }, { id: 'landing', user_id: uid, name: 'Emmetten', type: 'landing', latitude: 46.956, longitude: 8.514, altitude: 755, country_code: 'CH', description: 'Beispiel eines Landeplatzes' }];
const gliders = [{ id: 'glider', user_id: uid, manufacturer: 'Advance', model: 'Alpha', size: '26', is_default: true, last_check_date: '2026-03-10', next_check_date: '2027-03-10', reserve_repack_date: '2027-03-15' }];
const flights = Array.from({ length: 8 }, (_, i) => ({ id: i ? `flight-${i}` : fid, user_id: uid, group_id: gid, date: `2026-09-${String(22-i*2).padStart(2,'0')}`, duration_minutes: [48,32,65,24,41,35,29,52][i], altitude_gain: 820, distance_km: [12.4,7.2,18.1,4.2,9.8,8.2,6.1,14.3][i], glider: 'Advance Alpha (26)', takeoff_location_id: 'takeoff', landing_location_id: 'landing', takeoff_location: { name: 'Niederbauen', latitude: 46.929, longitude: 8.530 }, landing_location: { name: 'Emmetten', latitude: 46.956, longitude: 8.514 }, locations: { name: 'Niederbauen' }, land: { name: 'Emmetten' }, comments: 'Ruhiger Start, saubere Landeeinteilung. Nächstes Mal den Gegenanflug früher planen.', tags: ['Training'], is_solo_shv: true, published_to_feed: true, created_at: '2026-09-22T15:00:00Z', groups: { name: group.name }, has_track: false, thumbnail: [] }));
const stats = { total_flights: 8, total_minutes: 326, total_altitude: 6560, total_distance: 80.3, unique_takeoffs: 1, unique_landings: 1 };
const event = { id: eid, group_id: gid, title: 'Gemeinsamer Flugtag', event_date: '2026-09-26T07:00:00Z', status: 'confirmed', meeting_point: 'Talstation Emmetten', event_type: 'flight', event_category: 'experienced', max_participants: 12, signup_deadline: '2026-09-25T16:00:00Z', created_by: 'organizer', description: 'Treffpunkt um 09:00 Uhr. Wir besprechen Wetter und Tagesprogramm gemeinsam vor Ort.', groups: group, day_topic: 'Saubere Startvorbereitung', flight_area: 'Niederbauen', chat_link: null };
const cats = [{ id: 'cat1', name: 'Startvorbereitung und Start', sort_order: 1, training_level: 'brevetkurs', unlocks_after_category_id: null }, { id: 'cat2', name: 'Flug und Landung', sort_order: 2, training_level: 'brevetkurs', unlocks_after_category_id: null }];
const items = ['Startcheck durchführen','Kontrollierter Start','Aktives Fliegen','Landeeinteilung'].map((name,i)=>({ id: `item${i}`, name, category_id: i<2?'cat1':'cat2', sort_order:i, is_exam_maneuver: i===3, goal: 'Den Ablauf sicher und selbstständig durchführen.', content: 'Bereite den Ablauf bewusst vor. Besprich deine Beobachtungen mit deiner Fluglehrerin oder deinem Fluglehrer.', danger: 'Ablenkung und unvollständige Vorbereitung vermeiden.', mistakes: 'Zu spätes Planen des nächsten Schritts.' }));
const data = { profiles: [profile], public_profiles: [profile], groups: [group], group_members: [{ group_id: gid, user_id: uid, role: 'member', groups: group }], group_member_functions: [], flights, locations, pilot_gliders: gliders, flight_events: [event], event_signups: [{ event_id: eid, user_id: uid, signed_up: true, status: 'confirmed', confirmed_by_school: false }], pilot_goals: [{ id:'goal1', user_id:uid, title:'Meine ersten 20 Flüge', goal_type:'flights', target_value:20, season_year:2026, unit:'Flüge' }], training_categories: cats, training_items: items, training_progress: items.map((x,i)=>({ user_id:uid,item_id:x.id,rating:[3,2,2,1][i],notes:'',updated_at:'2026-09-22T16:00:00Z' })), flight_coach_notes:[{id:'note',flight_id:fid,coach_id:uid,note:'Gute Vorbereitung. Den Gegenanflug noch früher einteilen.',visible_to_student:true,created_at:'2026-09-22T16:00:00Z'}] };
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const formsOnly = process.argv.includes('--forms');
const selectedScreen = process.argv.find(arg=>arg.startsWith('--screen='))?.split('=')[1];
const extraOnly = process.argv.includes('--additional') || formsOnly;
const peer = '55555555-5555-4555-8555-555555555555';
data.profiles.push({...profile,id:peer,user_id:peer,pilot_name:'Sam Muster'});
data.feed_comments=[{id:'comment1',flight_id:fid,user_id:peer,message:'Wie war die Landeeinteilung?',created_at:'2026-09-23T08:00:00Z'}];
data.feed_likes=[{flight_id:fid,user_id:peer,reaction_type:'clap'}];
data.notifications=[{id:'notification1',user_id:uid,actor_id:peer,type:'comment',reference_id:fid,reference_type:'flight',read:false,created_at:'2026-09-23T08:00:00Z'}];
data.pilot_xp=[{user_id:uid,total_xp:240,level:3}];
for(const f of flights) {
  f.published_at=f.created_at;
  f.takeoff={name:'Niederbauen',latitude:0,longitude:0};
  f.landing={name:'Emmetten',latitude:0,longitude:0};
}
const cid='66666666-6666-4666-8666-666666666666';
const channels=[
 {id:cid,kind:'group',name:'Allgemein',audience:'all',description:'Gemeinsam fliegen und Erfahrungen austauschen.'},
 {id:'77777777-7777-4777-8777-777777777777',kind:'event',name:null,event_id:eid,event_title:event.title,event_date:event.event_date},
 {id:'88888888-8888-4888-8888-888888888888',kind:'direct',name:null,peer:{user_id:peer,pilot_name:'Sam Muster'},group_id:null,group_name:null,group_type:null}
].map(c=>({group_id:gid,group_name:group.name,group_type:group.group_type,event_id:null,event_title:null,event_date:null,audience:'all',audience_levels:null,description:null,staff_only_posting:false,is_default:true,archived_at:null,created_at:'2026-09-23T09:00:00Z',last_message_at:'2026-09-24T09:00:00Z',can_manage:false,can_post:true,notify_level:'mentions',unread:1,last_message:{message:'Treffpunkt am Samstag: Talstation Emmetten.',author:'Sam Muster',created_at:'2026-09-24T09:00:00Z',user_id:peer,has_attachment:false,is_announcement:false},...c}));
data.chat_messages=channels.flatMap(c=>[
 {id:c.id+'-2',channel_id:c.id,user_id:uid,message:'Danke Sam, ich bin am Samstag dabei.',created_at:'2026-09-24T10:00:00Z',is_announcement:false,requires_confirmation:false,attachment_path:null,mentions:[],reply_to:null},
 {id:c.id+'-1',channel_id:c.id,user_id:peer,message:'Treffpunkt am Samstag: Talstation Emmetten.',created_at:'2026-09-24T09:00:00Z',is_announcement:false,requires_confirmation:false,attachment_path:null,mentions:[],reply_to:null}
]);
data.chat_message_receipts=[];data.chat_message_reactions=[];
for(const table of ['hidden_events','flight_photos','challenges','flight_templates','event_program_items','event_carpools','pilot_badges','profile_photos','flight_videos','igc_tracks','flight_training_items']) data[table]=[];
data.flight_coach_notes[0].coach_id=peer;
const market=marketFixtures({uid,gid,peer});
Object.assign(data,market.tables);
const authKey='sb-'+new URL(loadEnv('development',process.cwd(),'VITE_').VITE_SUPABASE_URL).hostname.split('.')[0]+'-auth-token';
const context = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'de-CH', timezoneId:'Europe/Zurich', colorScheme:'light', serviceWorkers:'block' });
const token = `${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:4102444800,role:'authenticated'})).toString('base64url')}.demo-not-a-real-token`;
await context.addInitScript(({user,token,authKey})=>{
  localStorage.setItem(authKey,JSON.stringify({access_token:token,refresh_token:'demo',token_type:'bearer',expires_in:31536000,expires_at:4102444800,user}));
  localStorage.setItem('flyary-language','de'); localStorage.setItem('flyary-theme','light'); localStorage.setItem('flyary-onboarding-done','1');
  sessionStorage.setItem('flyary-splash-seen','1');
}, {user,token,authKey});
await context.routeWebSocket(/.*/, ws=>ws.close());
const unknown = new Set();
await context.route('**/*', async route=>{
  const request=route.request(), url=new URL(request.url());
  if(url.origin===base) return route.continue();
  if(url.pathname.startsWith('/auth/v1/')) return route.fulfill({json:user});
  if(url.pathname.includes('/rest/v1/')) {
    const table=url.pathname.split('/').at(-1);
    let result;
    if(url.pathname.includes('/rpc/')) {
      const body=request.postDataJSON()||{};
      if(market.rpc(table,body)!==undefined) result=market.rpc(table,body);
      else if(table==='chat_inbox') result=channels;
      else if(table==='chat_channel_json') result=channels.find(c=>c.id===body._channel);
      else if(table==='chat_event_channel') result=channels.find(c=>c.event_id===body._event);
      else if(table==='chat_channel_readers') result=data.profiles;
      else if(table==='chat_mark_read') result=null;
      else if(table==='chat_direct_candidates') result=[{user_id:peer,pilot_name:'Sam Muster',groups:[group.name]}];
      else if(table==='chat_search') result=[{id:cid+'-1',channel_id:cid,message:'Treffpunkt am Samstag: Talstation Emmetten.',created_at:'2026-09-24T09:00:00Z',author:'Sam Muster',channel:'Allgemein',kind:'group',group_name:group.name}];
      else if(table==='event_detail_data') result={event,signups:data.event_signups,members:data.group_members,myFunctions:[],profiles:Object.fromEntries(data.profiles.map(p=>[p.user_id,p.pilot_name])),me:profile,briefingTasks:[],maneuverNames:[],photos:[]};
      else if(table==='feed_page') result={groupIds:[gid],nextCursor:null,items:[{type:'flight',date:flights[0].published_at,data:{...flights[0],pilot_name:profile.pilot_name,group_name:group.name,feedDescription:flights[0].comments,takeoff_name:'Niederbauen',landing_name:'Emmetten',avatar_path:null,photoPaths:[],uploadedVideoPaths:[],videoUrls:[],hasTrack:false,takeoff:null,landing:null,likes:data.feed_likes,comments:data.feed_comments.map(c=>({...c,pilot_name:'Sam Muster'}))}}]};
      else if(table==='feed_mention_members') result=data.profiles;
      else if(table==='get_pilot_stats') result=[body._year===2025?{...stats,total_flights:0,total_minutes:0,total_altitude:0,total_distance:0,unique_takeoffs:0,unique_landings:0}:stats];
      else if(table==='list_flights_page') result={rows:flights,total:flights.length,counts:{all:8,season:8,track:0}};
      else if(table==='get_own_profile_private') result=[profile];
      else if(table==='get_public_profile') result=[profile];
      else {unknown.add("rpc/"+table);result=[];}
    } else {
      result=[...(data[table]||[])];
      if(!data[table]) unknown.add(table);
      for(const [key,val] of url.searchParams) {
        if(val.startsWith('eq.')) result=result.filter(row=>String(row[key])===val.slice(3));
        if(val.startsWith('in.(')) result=result.filter(row=>val.slice(4,-1).split(',').includes(String(row[key])));
      }
      if(url.searchParams.has('limit')) result=result.slice(0,Number(url.searchParams.get('limit')));
      if(request.headers().accept?.includes('vnd.pgrst.object')) result=result[0]??null;
    }
    return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':`0-7/${Array.isArray(result)?result.length:1}`},body:JSON.stringify(result)});
  }
  // Block all other remote requests: captures cannot mutate production data.
  return route.abort();
});
const page=await context.newPage();
await page.clock.setFixedTime(new Date('2026-09-24T12:00:00+02:00'));
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const manifest=(extraOnly || selectedScreen) ? JSON.parse(readFileSync(`${out}/manifest.json`,'utf8')).screenshots.filter(s=>selectedScreen ? !selectedScreen.split(',').includes(s.name) : Number(s.name.slice(0,2))<(formsOnly?30:19)) : [];
async function shot(name,path,action,keepScroll=false) {
  if(selectedScreen && !selectedScreen.split(',').includes(name)) return;
  await page.goto(base+path,{waitUntil:'networkidle'});
  await page.waitForTimeout(700);
  const later=page.getByRole('button',{name:'Später',exact:true}); if(await later.count()) await later.first().click();
  if(action) await action();
  for (const close of await page.locator('[toast-close]').all()) await close.click({force:true});
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0,0);
  if(name !== '15-export' && !keepScroll) await page.evaluate(() => {
    window.scrollTo(0,0);
    for(const el of document.querySelectorAll('*')) if(el.scrollTop) el.scrollTop=0;
  });
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({path:`${out}/${name}.png`,fullPage:false,animations:'disabled'});
  manifest.push({name,path,viewport:{width:390,height:844},pixels:{width:780,height:1688},demo:true});
  writeFileSync(`${out}/${name}.txt`,await page.locator('body').innerText());
  console.log(`Captured ${name}`);
}
try {
  if(!extraOnly) {
  await shot('01-home','/');
  await shot('02-more','/more');
  await shot('03-flight-basic','/flights/new',async()=>{
    await page.locator('input[type=date]').fill('2026-09-22');
    const combos=page.getByRole('combobox');
    await combos.nth(1).click();
    await page.getByRole('option',{name:/Niederbauen/}).click();
    await combos.nth(2).click();
    await page.getByRole('option',{name:/Emmetten/}).click();
  });
  await shot('04-flight-details','/flights/new',async()=>{
    await page.getByRole('button',{name:'Weiter',exact:true}).click();
    const fields=page.locator('input[type=number]');
    for(const [i,val] of ['48','820','12.4'].entries()) if(await fields.nth(i).count()) await fields.nth(i).fill(val);
    await page.locator('textarea').first().fill('Ruhiger Start. Den Gegenanflug nächstes Mal früher planen.');
    await page.evaluate(()=>window.scrollTo(0,0));
  });
  await page.goto(base+'/more',{waitUntil:'networkidle'});
  await page.evaluate(()=>localStorage.removeItem('flyary.flightDraft'));
  await shot('05-flight-media','/flights/new',async()=>{
    await page.getByRole('button',{name:'Medien',exact:true}).click();
    await page.evaluate(()=>window.scrollTo(0,0));
  });
  await shot('06-flightbook','/flights');
  await shot('07-events','/events');
  await shot('08-event-detail',`/events/${eid}`);
  await shot('09-locations','/locations');
  await shot('10-training','/training',async()=>{await page.getByRole('button',{name:/Startvorbereitung und Start/}).click();});
  await shot('11-training-detail','/training/item3');
  await shot('12-stats','/stats');
  await shot('13-profile','/profile');
  await shot('14-settings','/settings');
  await shot('15-export','/settings',async()=>{await page.getByText('Export & Import',{exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}));});
  await shot('16-notifications','/notifications');
  await shot('17-groups','/groups');
  await shot('18-import','/import');
  }
  if(!formsOnly) {
  await shot('19-flight-view',`/flights/${fid}`);
  await shot('20-flight-notes',`/flights/${fid}`,async()=>{await page.getByText('Lehrer-Notiz',{exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}));},true);
  flights[0].published_to_feed=false;
  await shot('21-publish-preview',`/flights/${fid}`,async()=>{await page.getByRole('button',{name:'Im Feed teilen',exact:true}).click();});
  flights[0].published_to_feed=true;
  await shot('22-feed','/feed');
  await shot('23-feed-comment','/feed',async()=>{await page.locator('textarea, input[placeholder]').first().fill('Die Einteilung war ruhig. Den Gegenanflug plane ich nächstes Mal früher.');},true);
  await shot('24-feed-notifications','/feed',async()=>{await page.locator('button').filter({has:page.locator('svg.lucide-bell')}).click();});
  await shot('25-search','/search',async()=>{await page.locator('input').first().fill('Niederbauen');await page.waitForTimeout(400);});
  await shot('26-leaderboard','/leaderboard');
  await shot('27-location-import','/import-locations');
  await shot('28-training-note','/training/item3',async()=>{await page.locator('textarea').fill('Gegenanflug früher beginnen; mit der Fluglehrerin besprechen.');await page.locator('textarea').scrollIntoViewIfNeeded();},true);
  await shot('29-template','/flights/new',async()=>{await page.getByRole('button',{name:'Medien',exact:true}).click();await page.getByRole('button',{name:'Als Vorlage speichern',exact:true}).click();await page.getByPlaceholder('Name der Vorlage...').fill('Training Niederbauen');},true);
  }
  await shot('30-profile-fields','/profile',async()=>{await page.getByText('Pilotenname',{exact:true}).evaluate(el=>el.closest('.bg-card').scrollIntoView({block:'start'}));},true);
  await shot('31-glider-form','/profile',async()=>{
    const card=page.locator('.bg-card').filter({has:page.getByText('Meine Schirme',{exact:true})}).first();
    await card.getByRole('button',{name:'Hinzufügen',exact:true}).click();
    await page.getByPlaceholder('z.B. Gin').fill('Advance');
    await page.getByPlaceholder('z.B. Explorer 3').fill('Alpha');
    await page.getByPlaceholder('z.B. Gin').evaluate(el=>el.closest('.p-3').scrollIntoView({block:'start'}));
  },true);
  await shot('32-import-preview','/import',async()=>{
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([{Datum:'22.09.2026',Start:'Niederbauen','Start Land':'CH',Landung:'Emmetten','Landung Land':'CH',Flugdauer:'00:48',Km:12.4,Gleitschirm:'Advance Alpha',Beschreibung:'Trainingsflug'}]),'Flüge');
    await page.locator('input[type=file]').setInputFiles({name:'Beispielfluege.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(book,{type:'buffer',bookType:'xlsx'})});
    await page.getByText('Vorschau',{exact:true}).waitFor();
  });
  await shot('33-flight-group','/flights/new',async()=>{
    await page.getByRole('button',{name:'Flug',exact:true}).click();
    await page.locator('input[type=date]').fill('2026-09-22');
    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option',{name:/Niederbauen/}).click();
    await page.getByRole('combobox').nth(2).click();
    await page.getByRole('option',{name:/Emmetten/}).click();
    await page.getByText('Gruppe',{exact:true}).scrollIntoViewIfNeeded();
    await page.getByRole('combobox').last().click();
    await page.getByRole('option',{name:'Fluggruppe Voralpen',exact:true}).click();
  },true);
  await shot('34-messages','/messages');
  await shot('35-channel',`/messages/${cid}`);
  await shot('36-message-actions',`/messages/${cid}`,async()=>{await page.getByText('Danke Sam, ich bin am Samstag dabei.',{exact:true}).click({button:'right'});});
  await shot('37-notify',`/messages/${cid}`,async()=>{await page.getByRole('button',{name:'Benachrichtigungen',exact:true}).click();});
  await shot('38-direct','/messages',async()=>{await page.getByRole('button',{name:'Nachricht',exact:true}).click();});
  await shot('39-message-search','/messages',async()=>{await page.getByPlaceholder('Kanäle, Personen und Nachrichten durchsuchen').fill('Treffpunkt');await page.waitForTimeout(600);});
  await shot('40-event-participants',`/events/${eid}?tab=participants`);
  await shot('41-event-chat',`/events/${eid}?tab=chat`);
  await shot('42-app-update','/more',async()=>{await page.getByText('App aktualisieren',{exact:true}).evaluate(el=>el.scrollIntoView({block:'center'}));},true);
  await shot('43-reply',`/messages/${cid}`,async()=>{await page.getByText('Treffpunkt am Samstag: Talstation Emmetten.',{exact:true}).click({button:'right'});await page.getByRole('button',{name:'Antworten',exact:true}).click();await page.getByPlaceholder('Nachricht schreiben… (@ erwähnt jemanden)').fill('Ich komme direkt zur Talstation.');});
  flights[0].group_id=null;flights[0].published_to_feed=false;
  await shot('44-flight-no-group',`/flights/${fid}`,async()=>{await page.getByText('Um diesen Flug im Feed zu teilen, ordne ihn beim Bearbeiten einer Gruppe zu.',{exact:true}).evaluate(el=>el.scrollIntoView({block:'center'}));},true);
  flights[0].group_id=gid;flights[0].published_to_feed=true;
  await captureMarket({page,shot,market,gid});
  manifest.sort((a,b)=>a.name.localeCompare(b.name));
  writeFileSync(`${out}/manifest.json`,JSON.stringify({capturedAt:new Date().toISOString(),source:'Local Flyary app, fictional fixtures, no live API access',screenshots:manifest,errors,unpopulatedTables:[...unknown]},null,2));
  if(errors.length) console.log('Runtime errors:',errors);
} catch(error) {errors.push(error.message);throw error;} finally {
  writeFileSync(`${out}/manifest.json`,JSON.stringify({capturedAt:new Date().toISOString(),source:'Local Flyary app, fictional fixtures, no live API access',screenshots:manifest.sort((a,b)=>a.name.localeCompare(b.name)),errors,unpopulatedTables:[...unknown]},null,2));
  await browser.close();
}


