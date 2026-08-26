# Enable real multiplayer

This game uses anonymous Supabase Auth for temporary, private player sessions. It
does not collect email addresses or put any secret key in the browser.

1. In **Authentication → Providers**, enable **Anonymous sign-ins**. 
2. Run [the multiplayer migration](supabase/migrations/20260826000000_realtime_multiplayer.sql) in the SQL Editor, or deploy it with the Supabase CLI.
3. Deploy [room-action](supabase/functions/room-action/index.ts) as an Edge Function named room-action with **Verify JWT enabled**.
4. In **Project Settings → API**, copy the project URL and a **publishable key** into [supabase-config.js](supabase-config.js). Never use a service-role key there. 
5. Confirm that the new public tables are exposed to the Data API. The migration enables RLS and grants only **SELECT** to signed-in players; all writes use the server-side Edge Function.

The migration adds the three realtime tables to supabase_realtime. Each shopper
sends a heartbeat every 15 seconds. A shopper that disappears for 45 seconds is
marked as left; a remaining player becomes host automatically; a match changes
to results once everyone still active has finished or left.
