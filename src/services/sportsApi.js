const BASE_URL = '/api';

export async function loginSports(username, password) {
  const res = await fetch(`${BASE_URL}/sports/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Giriş yapılamadı. Kullanıcı adı veya şifre hatalı.');
  }
  return data;
}

export async function fetchSportsSlots(token, date, unitId = '4', locationId = '8') {
  const res = await fetch(`${BASE_URL}/sports/slots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      date,
      unit_id: String(unitId),
      location_id: String(locationId)
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Seans listesi alınamadı.');
  }
  return data.slots || [];
}

export async function bookSportsSlot(token, seansId) {
  const res = await fetch(`${BASE_URL}/sports/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      seans_id: String(seansId)
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || 'Randevu alma işlemi başarısız oldu.');
  }
  return data;
}
