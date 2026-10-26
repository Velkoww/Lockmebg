export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. ВЗИМАНЕ НА РЕВЮТАТА (GET)
  if (request.method === 'GET') {
    try {
      const { results } = await env.DB.prepare(
        "SELECT name, rating, text FROM reviews ORDER BY id DESC"
      ).all();
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // 2. ДОБАВЯНЕ НА РЕВЮ (POST)
  if (request.method === 'POST') {
    try {
      const data = await request.json();
      if (!data.name || !data.rating || !data.text) {
        return new Response(JSON.stringify({ error: 'Липсват полета' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.DB.prepare(
        "INSERT INTO reviews (name, rating, text) VALUES (?, ?, ?)"
      ).bind(data.name, Number(data.rating), data.text).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Not Found', { status: 404, headers: corsHeaders });
}
