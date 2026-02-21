// Vercel serverless function — proxies all game CRUD to Supabase
// Environment variables (set in Vercel dashboard):
//   SUPABASE_URL       — e.g. https://xxxxx.supabase.co
//   SUPABASE_KEY       — your anon/public key (or service key for full access)

const headers = (key) => ({
  'Content-Type': 'application/json',
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Prefer': 'return=representation',
});

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const base = `${url}/rest/v1/games`;

  try {
    // GET — list all or get one by id
    if (req.method === 'GET') {
      const { id } = req.query;
      let endpoint;
      if (id) {
        endpoint = `${base}?id=eq.${id}&select=*`;
      } else {
        endpoint = `${base}?select=*&order=created_at.desc`;
      }
      const resp = await fetch(endpoint, { headers: headers(key) });
      const data = await resp.json();
      return res.status(200).json(data);
    }

    // POST — create a new game
    if (req.method === 'POST') {
      const resp = await fetch(base, {
        method: 'POST',
        headers: headers(key),
        body: JSON.stringify(req.body),
      });
      const data = await resp.json();
      return res.status(201).json(data);
    }

    // PUT — update an existing game
    if (req.method === 'PUT') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing game id' });
      const { id: _, ...updates } = req.body;
      const resp = await fetch(`${base}?id=eq.${id}`, {
        method: 'PATCH',
        headers: headers(key),
        body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
      });
      const data = await resp.json();
      return res.status(200).json(data);
    }

    // DELETE — delete a game
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing game id' });
      await fetch(`${base}?id=eq.${id}`, {
        method: 'DELETE',
        headers: headers(key),
      });
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
