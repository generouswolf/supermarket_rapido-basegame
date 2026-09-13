import { createClient } from 'npm:@supabase/supabase-js@2.112.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

type Product = { id:string; name:string; price:number; stock:number }
const food:Product[] = [
  ['Golden Apples',4.5],['Mega Cereal',7.25],['Fresh Milk',5],['Snack Stack',3.8],['Power Juice',8.9],['Super Bites',6.6],['Bread Loaf',3.25],['Berry Box',6.45],['Cheese Wheel',7.9],['Pasta Pack',4.2],['Iced Tea',3.6],['Cake Slice',9.5],['Spring Water',2.25],['Sparkling Water',3.1],['Iced Tea',3.6],['Empanadas',8.5],['Family Pizza',14.9],['Tomato Pasta',6.75],['Orange Soda',2.9],['Salad Bowl',7.2],['Yogurt Pack',5.5],['Coffee Beans',11.4]
].map(([name,price],index)=>({id:'food-'+index,name:String(name),price:Number(price),stock:15}))
const techNames = [
  ['Smart Watch',149],['Gaming Pad',65],['Headphones',89],['Phone Pro',399],['Camera',249],['Laptop Air',599],['VR Headset',319],['Smart Speaker',99],['Keyboard',119],['Drone Mini',179],['Power Bank',49],['Game Console',449],['Ultra TV',549],['Soundbar Pro',179],['Smart Fridge',629],['Air Fryer',129],['Robot Vacuum',279],['Blender Max',99],['Coffee Machine',189],['Microwave',159],['Washing Machine',649],['Projector',329]
] as [string,number][]
const small = new Set(['Smart Watch','Gaming Pad','Headphones','Smart Speaker','Keyboard','Power Bank'])
const large = new Set(['Laptop Air','Game Console','Robot Vacuum'])
const extraLarge = new Set(['Ultra TV','Smart Fridge','Washing Machine'])
const tech:Product[] = techNames.map(([name,price],index)=>({id:'tech-'+index,name,price,stock:small.has(name)?20:large.has(name)?6:extraLarge.has(name)?4:12}))
const products = (store:string) => store === 'tech' ? tech : food
const options = <ResponseInit>{ headers:{ ...corsHeaders, 'Content-Type':'application/json' } }
const fail = (message:string,status=400) => new Response(JSON.stringify({error:message}),{status,headers:options.headers})

function code() {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes=crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes,byte=>alphabet[byte%alphabet.length]).join('')
}
const privacyNamePrompts:Record<string,string>={'en-CA':"Do not share personal information such as your real name, phone number, city, or sex. Let's make the Digital Life private.",'fr-CA':'Ne partagez pas de renseignements personnels comme votre vrai nom, numéro de téléphone, ville ou sexe. Gardons la vie numérique privée.','fr-FR':'Ne partagez pas d’informations personnelles comme votre vrai nom, numéro de téléphone, ville ou sexe. Gardons la vie numérique privée.','es-ES':'No compartas información personal como tu nombre real, número de teléfono, ciudad o sexo. Mantengamos privada la vida digital.','de-DE':'Teile keine persönlichen Daten wie deinen echten Namen, deine Telefonnummer, Stadt oder Geschlecht. Halten wir das digitale Leben privat.','it-IT':'Non condividere informazioni personali come il tuo vero nome, numero di telefono, città o sesso. Manteniamo privata la vita digitale.','pt-PT':'Não partilhes informações pessoais como o teu nome verdadeiro, número de telefone, cidade ou sexo. Vamos manter a vida digital privada.','nl-NL':'Deel geen persoonlijke informatie zoals je echte naam, telefoonnummer, stad of geslacht. Laten we het digitale leven privé houden.','pl-PL':'Nie udostępniaj danych osobowych, takich jak prawdziwe imię, numer telefonu, miasto lub płeć. Dbajmy o prywatność cyfrowego życia.','ja-JP':'本名、電話番号、都市、性別などの個人情報を共有しないでください。デジタルライフをプライベートに保ちましょう。','zh-CN':'请勿分享真实姓名、电话号码、城市或性别等个人信息。让我们保护数字生活的隐私。'}
const privacyNamePrompt=(language:unknown)=>privacyNamePrompts[String(language)]||privacyNamePrompts['en-CA']
const privateInfoWords=new Set(['TORONTO','MONTREAL','VANCOUVER','OTTAWA','QUEBEC','CALGARY','EDMONTON','WINNIPEG','NEWYORK','LOSANGELES','CHICAGO','LONDON','PARIS','BERLIN','ROME','LISBON','AMSTERDAM','WARSAW','TOKYO','OSAKA','BEIJING','SHANGHAI','MALE','FEMALE','BOY','GIRL','MAN','WOMAN','NONBINARY'])
const likelyRealNames=new Set(['LUCAS','LIAM','NOAH','OLIVER','JACK','BENJAMIN','WILLIAM','JAMES','HENRY','ALEXANDER','DANIEL','DAVID','MICHAEL','MATTHEW','ETHAN','LOGAN','JACOB','MASON','AIDEN','JACKSON','SEBASTIAN','SAMUEL','JOSEPH','JOHN','ROBERT','THOMAS','MARK','PAUL','PETER','ANDREW','RYAN','ADAM','NATHAN','JOSHUA','EVAN','DYLAN','OWEN','CALEB','LEO','LOUIS','HUGO','ARTHUR','THEO','FELIX','CARLOS','MIGUEL','DIEGO','PABLO','JORGE','RAFAEL','PEDRO','MARCO','ANDREA','LUCA','MATTEO','GIUSEPPE','LORENZO','ALBERTO','HANS','KLAUS','FRANZ','JOHANN','LUKAS','LEON','FINN','EMIL','MAX','JAN','PIOTR','MAREK','EMMA','CHARLOTTE','AMELIA','SOPHIA','OLIVIA','AVA','MIA','ISABELLA','ELLA','CHLOE','CLARA','ALICE','JULIA','ANNA','MARIA','MARIE','CAMILLE','LEA','EMILY','GRACE','LILY','SOFIA','HELENA','SARAH','HANNAH','VICTORIA','NORA','ELEANOR','ZOE','MADELINE','EVA','LAURA','AMANDA','KATIE','KATHERINE','KATE','RACHEL','JULIE','NICOLE','MARIANA','ANA','BEATRIZ','LUCIA','MARTA','ELENA','CARLA','PAULA','INES','CARMEN','ISABEL','GIULIA','CHIARA','FRANCESCA','LENA','ZOFIA'])
function hasPersonalInfo(value:string) {
  const raw=String(value||'').trim(),normalized=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(),words=normalized.split(/[^A-Z]+/).filter(Boolean),compact=normalized.replace(/[^A-Z]/g,''),digitCount=(raw.match(/\d/g)||[]).length
  return digitCount>=7||!/^[\p{L}\p{N}_.-]+$/u.test(raw)||/@|https?:|www\.|\.(?:com|net|org|io|gg|ca)\b/i.test(raw)||words.some(word=>privateInfoWords.has(word)||likelyRealNames.has(word))||privateInfoWords.has(compact)||likelyRealNames.has(compact)
}
function cleanName(value:unknown,language:unknown) {
  const name=String(value||'').trim().toUpperCase()
  if(!name || name.length>15) throw new Error('A player name from 1 to 15 characters is required.')
  if(hasPersonalInfo(name)) throw new Error(privacyNamePrompt(language))
  return name
}
function cleanAvatar(value:unknown) {
  const avatar=String(value||'orange')
  if(!['orange','blue','green','yellow','pink','black'].includes(avatar)) throw new Error('That outfit is not available.')
  return avatar
}
function cleanSex(value:unknown) {
  const sex=String(value||'female')
  if(!['female','male'].includes(sex)) throw new Error('That character choice is not available.')
  return sex
}

async function snapshot(admin:any,roomId:string,userId:string) {
  const own=await admin.from('room_players').select('id,state').eq('room_id',roomId).eq('user_id',userId).maybeSingle()
  if(own.error || !own.data) throw new Error('You are not a member of this room.')
  const [roomResult,playersResult,inventoryResult,cartResult] = await Promise.all([
    admin.from('rooms').select('*').eq('id',roomId).single(),
    admin.from('room_players').select('*').eq('room_id',roomId).order('joined_at'),
    admin.from('room_inventory').select('*').eq('room_id',roomId).order('product_id'),
    admin.from('room_cart_items').select('product_id,price_base,collected_at').eq('player_id',own.data.id).order('collected_at')
  ])
  if(roomResult.error) throw new Error('Room was not found.')
  if(playersResult.error || inventoryResult.error || cartResult.error) throw new Error('Could not load room state.')
  return {room:roomResult.data,players:playersResult.data,inventory:inventoryResult.data,cartItems:cartResult.data}
}
async function reconcile(admin:any,roomId:string) {
  const result=await admin.rpc('reconcile_room',{p_room:roomId})
  if(result.error) throw new Error('Could not reconcile the room.')
}
async function touch(admin:any,roomId:string,userId:string) {
  const result=await admin.from('room_players').update({last_seen:new Date().toISOString()}).eq('room_id',roomId).eq('user_id',userId).neq('state','left')
  if(result.error) throw new Error('Your player session is no longer active.')
}

Deno.serve(async request => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  if(request.method!=='POST') return fail('POST only.',405)
  try {
    const url=Deno.env.get('SUPABASE_URL')!
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/,'')
    if(!url || !serviceKey || !token) return fail('Missing authenticated game session.',401)
    const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}})
    const userResult=await admin.auth.getUser(token)
    if(userResult.error || !userResult.data.user) return fail('Invalid game session.',401)
    const userId=userResult.data.user.id
    const body=await request.json()
    const action=String(body.action||'')

    if(action==='create_room') {
      const store=String(body.store),currency=String(body.currency)
      if(!['food','tech'].includes(store) || !['usd','eur','jpy'].includes(currency)) return fail('Invalid room settings.')
      const displayName=cleanName(body.displayName,body.language),avatar=cleanAvatar(body.avatar),sex=cleanSex(body.sex)
      let joinCode=code()
      for(let attempt=0;attempt<5;attempt++) {
        const exists=await admin.from('rooms').select('id').eq('join_code',joinCode).maybeSingle()
        if(!exists.data) break
        joinCode=code()
      }
      const roomResult=await admin.from('rooms').insert({join_code:joinCode,host_user_id:userId,store,currency,budget_base:store==='tech'?650:90,duration_seconds:180}).select('*').single()
      if(roomResult.error) throw new Error('Could not create the room.')
      const room=roomResult.data
      const stockRows=products(store).map(item=>({room_id:room.id,product_id:item.id,product_name:item.name,price_base:item.price,stock:item.stock,max_stock:item.stock}))
      const inventoryResult=await admin.from('room_inventory').insert(stockRows)
      const playerResult=await admin.from('room_players').insert({room_id:room.id,user_id:userId,display_name:displayName,avatar,sex})
      if(inventoryResult.error || playerResult.error) throw new Error('Could not prepare the room inventory.')
      return new Response(JSON.stringify({snapshot:await snapshot(admin,room.id,userId)}),options)
    }

    if(action==='join_room') {
      const roomResult=await admin.from('rooms').select('*').eq('join_code',String(body.code||'').toUpperCase()).maybeSingle()
      if(roomResult.error || !roomResult.data) return fail('That room code was not found.',404)
      const room=roomResult.data
      if(room.status!=='lobby') return fail('This match has already started.')
      const displayName=cleanName(body.displayName,body.language),avatar=cleanAvatar(body.avatar),sex=cleanSex(body.sex)
      const existing=await admin.from('room_players').select('id').eq('room_id',room.id).eq('user_id',userId).maybeSingle()
      if(!existing.data) {
        const count=await admin.from('room_players').select('id',{count:'exact',head:true}).eq('room_id',room.id).neq('state','left')
        if((count.count||0)>=room.max_players) return fail('This room is full.')
        const inserted=await admin.from('room_players').insert({room_id:room.id,user_id:userId,display_name:displayName,avatar,sex})
        if(inserted.error) throw new Error('Could not join this room.')
      } else {
        const updated=await admin.from('room_players').update({display_name:displayName,avatar,sex,ready:false,state:'joined',last_seen:new Date().toISOString()}).eq('id',existing.data.id)
        if(updated.error) throw new Error('Could not restore your player.')
      }
      return new Response(JSON.stringify({snapshot:await snapshot(admin,room.id,userId)}),options)
    }

    const roomId=String(body.roomId||'')
    if(!roomId) return fail('Room id is required.')
    await reconcile(admin,roomId)
    if(action==='snapshot') return new Response(JSON.stringify({snapshot:await snapshot(admin,roomId,userId)}),options)

    await touch(admin,roomId,userId)
    if(action==='heartbeat') {
      await reconcile(admin,roomId)
      return new Response(JSON.stringify({snapshot:await snapshot(admin,roomId,userId)}),options)
    }
    if(action==='ready') {
      const room=await admin.from('rooms').select('status').eq('id',roomId).single()
      if(room.error || room.data.status!=='lobby') return fail('The lobby is closed.')
      const ready=Boolean(body.ready)
      const updated=await admin.from('room_players').update({ready,state:ready?'ready':'joined',last_seen:new Date().toISOString()}).eq('room_id',roomId).eq('user_id',userId).in('state',['joined','ready'])
      if(updated.error) throw new Error('Could not update readiness.')
      return new Response(JSON.stringify({snapshot:await snapshot(admin,roomId,userId)}),options)
    }
    if(action==='start_room') {
      const roomResult=await admin.from('rooms').select('*').eq('id',roomId).single()
      if(roomResult.error || roomResult.data.host_user_id!==userId) return fail('Only the host can start the match.',403)
      if(roomResult.data.status!=='lobby') return fail('This match has already started.')
      const playersResult=await admin.from('room_players').select('id,ready,state').eq('room_id',roomId).neq('state','left')
      if((playersResult.data||[]).length<2 || !(playersResult.data||[]).every((player:any)=>player.ready)) return fail('At least two ready players are required.')
      // A shared future start time keeps every client’s countdown in sync.
      const startedAt=new Date(Date.now()+8000).toISOString()
      const roomUpdate=await admin.from('rooms').update({status:'playing',started_at:startedAt,updated_at:startedAt}).eq('id',roomId)
      const playersUpdate=await admin.from('room_players').update({state:'active',ready:false,last_seen:startedAt}).eq('room_id',roomId).in('state',['joined','ready'])
      if(roomUpdate.error || playersUpdate.error) throw new Error('Could not start this match.')
      return new Response(JSON.stringify({snapshot:await snapshot(admin,roomId,userId)}),options)
    }
    if(action==='pause_match') {
      const [roomResult,playerResult]=await Promise.all([
        admin.from('rooms').select('status,paused_by_user_id').eq('id',roomId).single(),
        admin.from('room_players').select('state').eq('room_id',roomId).eq('user_id',userId).maybeSingle()
      ])
      if(roomResult.error || roomResult.data.status!=='playing' || playerResult.data?.state!=='active') return fail('This match is not active.')
      if(roomResult.data.paused_by_user_id && roomResult.data.paused_by_user_id!==userId) return fail('Another shopper has already paused the match.')
      const updated=await admin.from('rooms').update({paused_by_user_id:userId,paused_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',roomId)
      if(updated.error) throw new Error('Could not pause the match.')
      return new Response(JSON.stringify({snapshot:await snapshot(admin,roomId,userId)}),options)
    }
    if(action==='resume_match') {
      const roomResult=await admin.from('rooms').select('status,paused_by_user_id,paused_at,started_at').eq('id',roomId).single()
      const room=roomResult.data
      if(roomResult.error || room.status!=='playing' || room.paused_by_user_id!==userId) return fail('Only the shopper who paused can resume the match.',403)
      const pausedAt=Date.parse(room.paused_at||''),startedAt=Date.parse(room.started_at||''),pauseLength=Number.isFinite(pausedAt)?Math.max(0,Date.now()-pausedAt):0
      const updated=await admin.from('rooms').update({paused_by_user_id:null,paused_at:null,started_at:Number.isFinite(startedAt)?new Date(startedAt+pauseLength).toISOString():room.started_at,updated_at:new Date().toISOString()}).eq('id',roomId)
      if(updated.error) throw new Error('Could not resume the match.')
      return new Response(JSON.stringify({snapshot:await snapshot(admin,roomId,userId)}),options)
    }
    if(action==='move_player') {
      const roomResult=await admin.from('rooms').select('paused_by_user_id').eq('id',roomId).single()
      if(roomResult.error || roomResult.data.paused_by_user_id) return fail('This match is paused.')
      const x=Math.max(7,Math.min(88,Number(body.x))),y=Math.max(16,Math.min(76,Number(body.y)))
      if(!Number.isFinite(x)||!Number.isFinite(y)) return fail('Invalid position.')
      const moved=await admin.from('room_players').update({position:{x,y},last_seen:new Date().toISOString()}).eq('room_id',roomId).eq('user_id',userId).eq('state','active')
      if(moved.error) throw new Error('Could not update player position.')
      return new Response(JSON.stringify({ok:true}),options)
    }
    if(action==='take_product') {
      const roomResult=await admin.from('rooms').select('paused_by_user_id').eq('id',roomId).single()
      if(roomResult.error || roomResult.data.paused_by_user_id) return fail('This match is paused.')
      const taken=await admin.rpc('take_room_product',{p_room:roomId,p_user:userId,p_product:String(body.productId||'')})
      if(taken.error) return fail(taken.error.message)
      return new Response(JSON.stringify({pickup:taken.data,snapshot:await snapshot(admin,roomId,userId)}),options)
    }
    if(action==='finish_player') {
      const roomResult=await admin.from('rooms').select('paused_by_user_id').eq('id',roomId).single()
      if(roomResult.error || roomResult.data.paused_by_user_id) return fail('This match is paused.')
      const finished=await admin.rpc('finish_room_player',{p_room:roomId,p_user:userId})
      if(finished.error) return fail(finished.error.message)
      return new Response(JSON.stringify({snapshot:await snapshot(admin,roomId,userId)}),options)
    }
    if(action==='leave_room') {
      await admin.from('room_players').update({state:'left',ready:false,last_seen:new Date().toISOString()}).eq('room_id',roomId).eq('user_id',userId)
      await reconcile(admin,roomId)
      return new Response(JSON.stringify({ok:true}),options)
    }
    return fail('Unknown room action.')
  } catch (problem) {
    console.error(problem)
    return fail(problem instanceof Error ? problem.message : 'Unexpected room service error.',500)
  }
})
