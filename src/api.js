// API helper — all calls go through /api/games (Vercel serverless proxy)

const API = '/api/games';

export async function fetchAllGames() {
  try {
    const resp = await fetch(API);
    if (!resp.ok) throw new Error('Failed to fetch');
    return await resp.json();
  } catch (e) {
    console.error('fetchAllGames:', e);
    return null;
  }
}

export async function fetchGame(id) {
  try {
    const resp = await fetch(`${API}?id=${id}`);
    if (!resp.ok) throw new Error('Failed to fetch');
    const data = await resp.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (e) {
    console.error('fetchGame:', e);
    return null;
  }
}

export async function createGame(game) {
  try {
    const resp = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(game),
    });
    if (!resp.ok) throw new Error('Failed to create');
    const data = await resp.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (e) {
    console.error('createGame:', e);
    return null;
  }
}

export async function updateGame(game) {
  try {
    const resp = await fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(game),
    });
    if (!resp.ok) throw new Error('Failed to update');
    const data = await resp.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (e) {
    console.error('updateGame:', e);
    return null;
  }
}

export async function deleteGame(id) {
  try {
    const resp = await fetch(`${API}?id=${id}`, { method: 'DELETE' });
    return resp.ok;
  } catch (e) {
    console.error('deleteGame:', e);
    return false;
  }
}
