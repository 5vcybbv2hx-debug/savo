const getAppId = () => import.meta.env.VITE_APP_ID || window.__BASE44_APP_ID__;

export async function sendPushNotification({ title, message, external_user_id, target_role, url }) {
  try {
    const appId = getAppId();
    const res = await fetch(`/api/apps/${appId}/functions/sendPushNotification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, external_user_id, target_role, url })
    });
    const data = await res.json();
    if (!res.ok) console.error('[Push] Fehler:', data);
    return data;
  } catch (err) {
    console.error('[Push] Exception:', err);
  }
}