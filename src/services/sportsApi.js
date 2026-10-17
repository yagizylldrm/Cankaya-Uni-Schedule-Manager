import { ApiError, createHttpError, createNetworkError } from './httpErrors.js';

const BASE_URL = '/api';
const UPSTREAM_HTML_ERROR =
  'Üniversite spor sistemi şu an yanıt veremiyor veya bakım modunda (Sunucu hatası).';

function safeErrorMessage(message, fallback) {
  if (typeof message !== 'string') return fallback;
  return /<!doctype|<html|<head|<body|<title|<script|<style/i.test(message)
    ? UPSTREAM_HTML_ERROR
    : message;
}

export class SportsApiError extends ApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'SportsApiError';
  }
}

function parseErrorResponse(status, data, defaultMsg) {
  let message = defaultMsg;
  let code = 'UNKNOWN_ERROR';

  if (data && typeof data === 'object') {
    if (data.detail && typeof data.detail === 'object') {
      message = data.detail.message || defaultMsg;
      code = data.detail.code || code;
    } else if (typeof data.detail === 'string') {
      message = data.detail;
      if (status === 401) code = 'INVALID_CREDENTIALS';
      else if (status === 429) code = 'RATE_LIMIT_EXCEEDED';
      else if (status === 409) code = 'CONCURRENT_REQUEST';
    } else if (data.message) {
      message = data.message;
    }
  }

  const error = createHttpError(status, { detail: { message, code } }, {
    fallback: defaultMsg,
    htmlFallback: UPSTREAM_HTML_ERROR,
    preserveServerCodes: ['UPSTREAM_ERROR', 'PARSE_ERROR']
  });
  return new SportsApiError(safeErrorMessage(error.message, defaultMsg), {
    status: error.status,
    code: error.code,
    data
  });
}

async function requestSports(endpoint, body, signal = null, defaultErrorMsg = 'İşlem başarısız oldu.') {
  let res;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(body),
      signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw err;
    }
    const networkError = createNetworkError(err);
    throw new SportsApiError(networkError.message, {
      status: networkError.status,
      code: networkError.code
    });
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw parseErrorResponse(res.status, data, defaultErrorMsg);
  }

  return data;
}

export async function loginSports(username, password) {
  const data = await requestSports(
    '/sports/login',
    { username, password },
    null,
    'Giriş yapılamadı. Kullanıcı adı veya şifre hatalı.'
  );
  if (!data.token) {
    throw new SportsApiError('Sunucudan geçersiz oturum yanıtı alındı.', {
      status: 502,
      code: 'INVALID_RESPONSE'
    });
  }
  return data;
}

export async function fetchSportsSlots(token, date, unitId = '4', locationId = '8', signal = null) {
  const data = await requestSports(
    '/sports/slots',
    {
      token,
      date,
      unit_id: String(unitId),
      location_id: String(locationId)
    },
    signal,
    'Seans listesi alınamadı.'
  );

  if (!data.success || !Array.isArray(data.slots)) {
    throw new SportsApiError('Geçersiz seans verisi alındı.', {
      status: 502,
      code: 'INVALID_SLOTS_DATA'
    });
  }

  return data.slots;
}

export async function bookSportsSlot(token, seansId) {
  const data = await requestSports(
    '/sports/book',
    {
      token,
      seans_id: String(seansId)
    },
    null,
    'Randevu alma işlemi tamamlanamadı.'
  );

  return data;
}
