const headers = (key) => ({
  'Content-Type': 'application/json',
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Prefer': 'return=representation',
});

function sanitize(obj) {
  const allowed = ['team_name', 'players', 'shots', 'events', 'quarter', 'updated_at'];
  const out = {};
  if (obj.teamName !== undefined) out.team_name = obj.teamName;
  if (obj.team_name !== undefined) out.team_name = obj.team_name;
  allowed.forEach(k => { if (obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const base = `${url}/rest/v1/games`;

  try {
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

    if (req.method === 'POST') {
      const body = sanitize(req.body);
      body.created_at = req.body.created_at || new Date().toISOString();
      const resp = await fetch(base, {
        method: 'POST',
        headers: headers(key),
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing game id' });
      const updates = sanitize(req.body);
      updates.updated_at = new Date().toISOString();
      const resp = await fetch(`${base}?id=eq.${id}`, {
        method: 'PATCH',
        headers: headers(key),
        body: JSON.stringify(updates),
      });
      const data = await resp.json();
      return res.status(200).json(data);
    }

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
