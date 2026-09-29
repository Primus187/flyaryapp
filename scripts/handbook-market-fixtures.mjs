// Fictional marketplace data shared by both local handbook capture scripts.
export function marketFixtures({uid,gid,peer,school=false}) {
  const ids={foreign:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',own:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',school:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',sold:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};
  const common={created_by:uid,listing_type:'offer',category:'glider',description:'Gepflegter Beispielschirm für Schulung und Freizeit. Prüfprotokoll bei Besichtigung vorhanden. Fiktives Angebot für das Handbuch.',price_cents:145000,price_type:'negotiable',condition:'used',manufacturer:'Advance',model:'Alpha',size:'26',year:2023,attributes:{certification:'a',weight_min:75,weight_max:95,flight_hours:45,last_check:'2026-03',repairs:'Keine angegeben'},quantity:1,postal_code:'6376',locality:'Emmetten',canton:'NW',delivery:'pickup',visibility:'all',status:'active',removed_reason:null,published_at:'2026-09-25T07:00:00Z',expires_at:'2026-11-24T07:00:00Z',bumped_at:'2026-09-25T07:00:00Z',featured_until:null,created_at:'2026-09-25T07:00:00Z',updated_at:'2026-09-25T07:00:00Z'};
  const listings=[{...common,id:ids.foreign,seller_user_id:peer,seller_group_id:null,title:'Advance Alpha 26 – gepflegte Occasion'}, {...common,id:ids.own,seller_user_id:uid,seller_group_id:null,title:'Mein Alpha 26 – mit Prüfprotokoll'}, {...common,id:ids.school,seller_user_id:null,seller_group_id:gid,title:'Schulschirm Alpha 26',school_equipment_id:'eq1'}, {...common,id:ids.sold,seller_user_id:peer,seller_group_id:null,title:'Alpha 26 – abgeschlossener Kauf',status:'sold'}];
  const shop={group_id:gid,legal_name:'Flugschule Voralpen (Beispiel)',street:'Beispielweg 1',postal_code:'6376',locality:'Emmetten',email:'shop@example.invalid',phone:null,vat_registered:false,uid_number:null,warranty_text:'Die vereinbarten Bedingungen werden vor dem Kauf schriftlich festgehalten.',active:true};
  const tables={marketplace_listings:listings,marketplace_listing_photos:[],marketplace_favorites:[{user_id:uid,listing_id:ids.foreign}],marketplace_terms_acceptances:[{user_id:uid,version:1}],school_shop_profiles:[shop]};
  const item=l=>({...l,is_school:!!l.seller_group_id,mine:l.seller_user_id===uid||(school&&!!l.seller_group_id),thumb_path:null,available:true,saved_at:'2026-09-25T08:00:00Z'});
  const rpc=(name,body)=>{
    switch(name){
      case 'marketplace_search':return {items:listings.filter(l=>l.status==='active').map(item),next_cursor:null};
      case 'marketplace_my_shops':return school?[{group_id:gid,name:'Flugschule Voralpen',ready:true,can_admin:true}]:[];
      case 'marketplace_seller_cards': {const l=listings.find(l=>l.id===body._listing_ids[0]);return [{seller_kind:l.seller_group_id?'school':'person',seller_id:l.seller_group_id||l.seller_user_id,name:l.seller_group_id?'Flugschule Voralpen':'Sam Muster',avatar_url:null,member_since:'2025-04-01',flight_count:64,rating_avg:4.5,rating_count:2}];}
      case 'market_can_manage_listing': {const l=listings.find(l=>l.id===body._listing);return l?.seller_user_id===uid||(school&&l?.seller_group_id===gid);}
      case 'is_market_moderator':return false;
      case 'marketplace_review_state':return 'of_seller';
      case 'marketplace_chat_buyers':return [{user_id:peer,pilot_name:'Sam Muster'}];
      case 'marketplace_sale_candidates':return [{user_id:peer,pilot_name:'Alex Beispiel'}];
      case 'marketplace_my_favorites':return [item(listings[0])];
      case 'marketplace_saved_searches_overview':return [{id:'saved1',name:'Schirm Klasse A',query:'q=Alpha',notify:true,new_count:1,created_at:'2026-09-25T08:00:00Z'}];
      case 'marketplace_reviews_of':return [{id:'review1',rating:5,comment:'Freundlicher Kontakt und klare Angaben.',direction:'of_seller',listing_title:'Beispielschirm',created_at:'2026-09-20T08:00:00Z',hidden:false,reported:false,reviewer_name:'Robin Beispiel'}];
      default:return undefined;
    }
  };
  return {ids,tables,rpc};
}

export async function captureMarket({page,shot,market,school=false,gid}) {
  await page.clock.setFixedTime(new Date('2026-09-25T12:00:00+02:00'));
  const b=name=>page.getByRole('button',{name,exact:true});
  const scroll=async text=>page.getByText(text,{exact:true}).first().evaluate(el=>el.scrollIntoView({block:'center'}));
  const {ids}=market;
  if(school){
    await shot('52-shop','/school/shop');
    await shot('53-shop-profile','/school/shop',async()=>{await page.getByRole('tab',{name:'Shop-Profil',exact:true}).click();});
    await shot('54-shop-sale',`/market/${ids.school}`,async()=>{await b('An Mitglied verkaufen (Abrechnung)').click();await b('Alex Beispiel').click();});
    await shot('55-equipment-market','/school/equipment');
    await shot('56-school-listing',`/market/${ids.school}`,()=>scroll('Als verkauft markieren'),true);
    await shot('57-school-form',`/market/${ids.school}/edit`,()=>scroll('Sichtbar für'),true);
    await shot('58-shop-activation','/school/shop',async()=>{await page.getByRole('tab',{name:'Shop-Profil',exact:true}).click();await scroll('Shop aktiv');},true);
    return;
  }
  await shot('45-market','/market');
  await shot('46-market-filters','/market',async()=>{await b('Filter').click();});
  await shot('47-market-detail',`/market/${ids.foreign}`);
  await shot('48-market-seller',`/market/${ids.foreign}`,()=>scroll('Anbieter'),true);
  await shot('49-market-form',`/market/${ids.own}/edit`,()=>scroll('Titel'),true);
  await shot('50-market-price',`/market/${ids.own}/edit`,()=>scroll('Betrag (CHF)'),true);
  await shot('51-market-mine','/market/mine');
  await shot('52-market-sold',`/market/${ids.own}`,async()=>{await b('Als verkauft markieren').click();});
  await shot('53-market-saved','/market',async()=>{await b('Gespeicherte Suchen').click();});
  await shot('54-market-favorites','/market/mine',async()=>{await page.getByRole('tab',{name:'Gemerkt',exact:true}).click();});
  await shot('55-market-report',`/market/${ids.foreign}`,async()=>{await b('Anzeige melden').click();});
  await shot('57-market-photos','/market/new');
  const accepted=[...market.tables.marketplace_terms_acceptances];
  market.tables.marketplace_terms_acceptances.length=0;
  await shot('58-market-terms','/market/new');
  market.tables.marketplace_terms_acceptances.push(...accepted);
  await shot('56-market-review',`/market/${ids.sold}`,async()=>{await b('Bewerten').click();});
}
