import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Sicherer Dokument-Download für EmployeeDocument.
 * Prüft Zugriff (Eigentümer, Manager, Admin), schreibt in AccessLog
 * und liefert eine zeitlich begrenzte Signatur-URL.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { documentId } = await req.json().catch(() => ({}));
    if (!documentId) return Response.json({ error: 'documentId fehlt' }, { status: 400 });

    // Eigener Mitarbeitereintrag (Base44-Rolle admin != Employee.role Manager)
    const mine = await base44.entities.Employee.filter({ email: user.email });
    const me = mine?.[0] || null;
    const isManager = user.role === 'admin' || ['Manager', 'Admin'].includes(me?.role);

    const docs = await base44.entities.EmployeeDocument.filter({ id: documentId });
    const doc = docs?.[0] || null;

    const log = async (status, notes) => {
      try {
        await base44.asServiceRole.entities.AccessLog.create({
          user_email: user.email,
          action: 'view_document',
          resource_id: documentId,
          resource_type: 'EmployeeDocument',
          status,
          timestamp: new Date().toISOString(),
          notes,
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
        });
      } catch (_) { /* Logfehler dürfen den Download nicht blockieren */ }
    };

    if (!doc) {
      await log('denied', 'Document not found');
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    const isOwner = !!me && doc.employee_id === me.id;
    if (!isOwner && !isManager) {
      await log('denied', 'Insufficient permissions');
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    await log('success', `Document: ${doc.file_name || documentId}`);

    const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: doc.file_url,
      expires_in: 3600,
    });

    return Response.json({
      signed_url: signed?.signed_url || doc.file_url,
      file_name: doc.file_name,
      file_type: doc.file_type,
      access_granted: true,
    });
  } catch (error) {
    console.error('Download error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
