// Temporarily disabled after schema restructure to ClickUp-like model.
Deno.serve(() => new Response(JSON.stringify({ ok: false, error: 'disabled during restructure' }), { headers: { 'Content-Type': 'application/json' }, status: 503 }));
