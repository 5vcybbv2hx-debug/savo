Deno.serve(async (req) => {
  const ONESIGNAL_APP_ID = '664fda20-f8c7-411a-928f-217c855bb2bb';
  const ONESIGNAL_REST_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY_2');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  if (!ONESIGNAL_REST_KEY) {
    return Response.json({ error: 'OneSignal REST Key nicht konfiguriert' }, { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Ungültiger JSON Body' }, { status: 400 }); }

  const { title, message, target_role, external_user_id, url } = body;
  if (!title || !message) return Response.json({ error: 'title und message Pflicht' }, { status: 400 });

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    headings: { de: title, en: title },
    contents: { de: message, en: message },
    web_url: url || 'https://bar-shift-pro-fc3522b9.base44.app',
  };

  if (external_user_id) {
    payload.include_aliases = { external_id: [String(external_user_id)] };
    payload.target_channel = 'push';
  } else if (target_role && target_role !== 'all') {
    payload.filters = [{ field: 'tag', key: 'role', relation: '=', value: target_role }];
  } else {
    payload.included_segments = ['All'];
  }

  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${ONESIGNAL_REST_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) return Response.json({ error: result.errors }, { status: 500 });
  return Response.json({ success: true, notification_id: result.id, recipients: result.recipients });
});