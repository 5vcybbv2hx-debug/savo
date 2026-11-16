// HIGH FIX 1: Token now uses crypto.randomUUID() instead of Math.random()
// HIGH FIX 2: All user input is HTML-escaped before rendering to prevent XSS
Deno.serve(async (req) => {
    try {
        const appId = Deno.env.get('BASE44_APP_ID');
        if (!appId) throw new Error('App ID nicht gefunden');

        const baseUrl = 'https://api.base44.com';
        const headers = { 'X-App-Id': appId, 'Content-Type': 'application/json' };

        // Helper: escape HTML to prevent XSS
        const esc = (str) => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

        const companyResponse = await fetch(`${baseUrl}/entities/CompanyInfo`, { headers });
        const companyData = await companyResponse.json();
        const companyInfo = (companyData.data && companyData.data[0]) || {};
        const barName = companyInfo.company_name || 'BarManager';

        if (req.method === 'POST') {
            const formData = await req.formData();

            // Validate guests
            const guestCount = parseInt(formData.get('guests'));
            if (isNaN(guestCount) || guestCount < 1 || guestCount > 100) {
                return new Response('<html><body>Ungültige Personenanzahl</body></html>', { status: 400, headers: { 'Content-Type': 'text/html' } });
            }

            const data = {
                customer_name: String(formData.get('customer_name') || '').slice(0, 100),
                email: String(formData.get('email') || '').slice(0, 100),
                phone: String(formData.get('phone') || '').slice(0, 30),
                date: String(formData.get('date') || '').slice(0, 10),
                time: String(formData.get('time') || '').slice(0, 5),
                guests: guestCount,
                notes: String(formData.get('notes') || '').slice(0, 500),
                // HIGH FIX: Cryptographically secure token
                guest_token: crypto.randomUUID() + '-' + crypto.randomUUID(),
                status: 'vorgemerkt',
                source: 'online'
            };

            const createResponse = await fetch(`${baseUrl}/entities/Reservation`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });

            if (!createResponse.ok) throw new Error('Fehler beim Erstellen der Reservierung');

            const reservation = await createResponse.json();

            const dateObj = new Date(reservation.date);
            const formattedDate = dateObj.toLocaleDateString('de-DE', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            });

            // HIGH FIX: All user data is HTML-escaped in the success page
            const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reservierung bestätigt - ${esc(barName)}</title>
<style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; } .card { background: rgba(30,41,59,0.95); backdrop-filter: blur(12px); border: 1px solid rgba(148,163,184,0.1); border-radius: 1rem; padding: 2rem; max-width: 600px; width: 100%; } .success-icon { width: 80px; height: 80px; border-radius: 50%; background: rgba(34,197,94,0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 2.5rem; } h1 { text-align: center; font-size: 2rem; margin-bottom: 1rem; } .subtitle { text-align: center; color: #94a3b8; margin-bottom: 2rem; } .details { background: rgba(148,163,184,0.1); border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1.5rem; } .detail-row { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid rgba(148,163,184,0.1); } .detail-row:last-child { border-bottom: none; } .detail-label { color: #94a3b8; } .detail-value { font-weight: 600; } .info-box { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); border-radius: 0.75rem; padding: 1rem; text-align: center; font-size: 0.875rem; margin-bottom: 1.5rem; } .button { display: block; width: 100%; padding: 1rem; background: linear-gradient(90deg, #f59e0b 0%, #ea580c 100%); color: #1e293b; border: none; border-radius: 0.75rem; font-weight: 600; text-decoration: none; text-align: center; cursor: pointer; }</style>
</head>
<body>
    <div class="card">
        <div class="success-icon">✓</div>
        <h1>Reservierung erhalten!</h1>
        <p class="subtitle">Vielen Dank, <strong>${esc(reservation.customer_name)}</strong>!<br>Wir haben Ihre Reservierung erhalten und werden sie in Kürze bestätigen.</p>
        <div class="details">
            <h3 style="margin-bottom:1rem;">Ihre Reservierungsdetails:</h3>
            <div class="detail-row"><span class="detail-label">Datum:</span><span class="detail-value">${esc(formattedDate)}</span></div>
            <div class="detail-row"><span class="detail-label">Uhrzeit:</span><span class="detail-value">${esc(reservation.time)} Uhr</span></div>
            <div class="detail-row"><span class="detail-label">Personen:</span><span class="detail-value">${esc(String(reservation.guests))}</span></div>
            ${reservation.notes ? `<div class="detail-row"><span class="detail-label">Ihre Anmerkungen:</span><span class="detail-value">${esc(reservation.notes)}</span></div>` : ''}
        </div>
        <div class="info-box">📧 Sie erhalten in Kürze eine Bestätigungsmail an<br><strong>${esc(reservation.email)}</strong></div>
        <a href="/api/functions/public-menu" class="button">🍷 Zur Getränkekarte</a>
    </div>
</body>
</html>`;

            return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        // GET: Formular anzeigen
        const minDate = new Date().toISOString().split('T')[0];
        const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reservierung - ${esc(barName)}</title>
<style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: #f1f5f9; min-height: 100vh; } .header { background: rgba(30,41,59,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(148,163,184,0.1); padding: 1.5rem; } .logo-section { max-width: 800px; margin: 0 auto; display: flex; align-items: center; gap: 1rem; } .logo { width: 48px; height: 48px; border-radius: 16px; background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; } h1 { font-size: 1.75rem; } .subtitle { color: #94a3b8; font-size: 0.875rem; } .content { max-width: 800px; margin: 3rem auto; padding: 0 1rem; } .card { background: rgba(30,41,59,0.95); backdrop-filter: blur(12px); border: 1px solid rgba(148,163,184,0.1); border-radius: 1rem; padding: 2rem; } .form-group { margin-bottom: 1.5rem; } label { display: block; margin-bottom: 0.5rem; font-weight: 500; } input, textarea { width: 100%; padding: 0.75rem; background: rgba(148,163,184,0.1); border: 1px solid rgba(148,163,184,0.2); border-radius: 0.5rem; color: #f1f5f9; font-family: inherit; } input:focus, textarea:focus { outline: none; border-color: #f59e0b; } textarea { min-height: 100px; resize: vertical; } .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; } .button { width: 100%; padding: 1rem; background: linear-gradient(90deg, #f59e0b 0%, #ea580c 100%); color: #1e293b; border: none; border-radius: 0.75rem; font-size: 1rem; font-weight: 600; cursor: pointer; transition: transform 0.2s; } .button:hover { transform: translateY(-2px); } .required { color: #ef4444; } .footer { background: rgba(30,41,59,0.95); border-top: 1px solid rgba(148,163,184,0.1); padding: 2rem 1rem; margin-top: 3rem; text-align: center; color: #94a3b8; } .guest-stepper { display: flex; align-items: center; gap: 0.5rem; } .guest-stepper input { width: 4.5rem; flex: 0 0 auto; text-align: center; font-size: 1.125rem; font-weight: 600; } .stepper-btn { width: 44px; height: 44px; flex: 0 0 44px; display: flex; align-items: center; justify-content: center; border-radius: 0.5rem; border: 1px solid rgba(148,163,184,0.2); background: rgba(148,163,184,0.1); color: #f1f5f9; font-size: 1.25rem; line-height: 1; cursor: pointer; touch-action: manipulation; } .stepper-btn:active { background: rgba(148,163,184,0.25); }</style>
</head>
<body>
    <header class="header">
        <div class="logo-section">
            <div class="logo">🍷</div>
            <div><h1>${esc(barName)}</h1><div class="subtitle">Online Reservierung</div></div>
        </div>
    </header>
    <main class="content">
        <div class="card">
            <h2 style="margin-bottom:0.5rem">Tisch reservieren</h2>
            <p style="color:#94a3b8;margin-bottom:2rem;font-size:0.875rem">Reservieren Sie jetzt Ihren Tisch. Wir bestätigen Ihre Reservierung in Kürze per E-Mail.</p>
            <form method="POST" onsubmit="document.getElementById('submitBtn').disabled=true;">
                <div class="form-row">
                    <div class="form-group"><label>Name <span class="required">*</span></label><input type="text" name="customer_name" required placeholder="Ihr Name" maxlength="100"></div>
                    <div class="form-group"><label>Telefon <span class="required">*</span></label><input type="tel" name="phone" required placeholder="+49 123 456789" maxlength="30"></div>
                </div>
                <div class="form-group"><label>E-Mail <span class="required">*</span></label><input type="email" name="email" required placeholder="ihre@email.de" maxlength="100"></div>
                <div class="form-row">
                    <div class="form-group"><label>Datum <span class="required">*</span></label><input type="date" name="date" required min="${minDate}"></div>
                    <div class="form-group"><label>Uhrzeit <span class="required">*</span></label><input type="time" name="time" required></div>
                    <div class="form-group"><label for="guests">Personen <span class="required">*</span></label>
                        <div class="guest-stepper">
                            <button type="button" class="stepper-btn" aria-label="Personen verringern" onclick="stepGuests(-1)">&minus;</button>
                            <input type="number" id="guests" name="guests" required min="1" max="50" value="2" inputmode="numeric" onblur="normalizeGuests()">
                            <button type="button" class="stepper-btn" aria-label="Personen erhöhen" onclick="stepGuests(1)">+</button>
                        </div>
                    </div>
                </div>
                <div class="form-group"><label>Besondere Wünsche</label><textarea name="notes" placeholder="z.B. Allergien, Kinderstuhl..." maxlength="500"></textarea></div>
                <button type="submit" class="button" id="submitBtn">Jetzt reservieren</button>
                <p style="text-align:center;font-size:0.75rem;color:#94a3b8;margin-top:1rem"><span class="required">*</span> Pflichtfelder</p>
            </form>
        </div>
    </main>
    <footer class="footer">
        <p>${esc(companyInfo.address || '')}</p>
        <p style="margin-top:0.5rem">${companyInfo.phone ? `Tel: ${esc(companyInfo.phone)}` : ''}${companyInfo.phone && companyInfo.email ? ' • ' : ''}${companyInfo.email ? `E-Mail: ${esc(companyInfo.email)}` : ''}</p>
        <p style="margin-top:1rem;font-size:0.875rem">© 2026 ${esc(barName)}</p>
    </footer>
    <script>
        function stepGuests(delta) {
            var el = document.getElementById('guests');
            var current = parseInt(el.value, 10);
            if (isNaN(current)) current = 1;
            el.value = Math.min(50, Math.max(1, current + delta));
        }
        function normalizeGuests() {
            var el = document.getElementById('guests');
            var current = parseInt(el.value, 10);
            el.value = isNaN(current) ? 1 : Math.min(50, Math.max(1, current));
        }
    </script>
</body>
</html>`;

        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (error) {
        console.error('Fehler:', error);
        // HIGH FIX: Don't expose error.message in public HTML
        return new Response('<html><body><h1>Fehler</h1><p>Ein Fehler ist aufgetreten. Bitte versuche es später erneut.</p></body></html>', {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }
});