const BASE_URL = '/api';

export class SportsApiError extends Error {
  constructor(message, { status = 500, code = 'UNKNOWN_ERROR', data = null } = {}) {
    super(message);
    this.name = 'SportsApiError';
    this.status = status;
    this.code = code;
    this.data = data;
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

  return new SportsApiError(message, { status, code, data });
}

async function requestSports(
  endpoint,
  {
    method = 'POST',
    body = null,
    signal = null,
    defaultErrorMsg = 'İşlem başarısız oldu.'
  } = {}
) {
  const options = {
    method,
    cache: 'no-store',
    signal
  };

  if (body !== null) {
    options.headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    };
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, options);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw err;
    }
    throw new SportsApiError('Sunucuya bağlanılamadı. Lütfen bağlantınızı kontrol edin.', {
      status: 0,
      code: 'NETWORK_ERROR'
    });
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw parseErrorResponse(res.status, data, defaultErrorMsg);
  }

  return data;
}

export function pemToSpkiBytes(pemKey) {
  if (typeof pemKey !== 'string') {
    throw new SportsApiError('Sunucudan geçersiz şifreleme anahtarı alındı.', {
      status: 502,
      code: 'INVALID_PUBLIC_KEY'
    });
  }

  const match = pemKey.trim().match(
    /^-----BEGIN PUBLIC KEY-----([A-Za-z0-9+/=\s]+)-----END PUBLIC KEY-----$/
  );
  if (!match) {
    throw new SportsApiError('Sunucudan geçersiz şifreleme anahtarı alındı.', {
      status: 502,
      code: 'INVALID_PUBLIC_KEY'
    });
  }

  try {
    const binary = atob(match[1].replace(/\s/g, ''));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    throw new SportsApiError('Sunucudan geçersiz şifreleme anahtarı alındı.', {
      status: 502,
      code: 'INVALID_PUBLIC_KEY'
    });
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function encryptPassword(password, pemKey, maxPlaintextBytes = 190) {
  if (!globalThis.crypto?.subtle) {
    throw new SportsApiError('Tarayıcınız güvenli şifrelemeyi desteklemiyor.', {
      status: 0,
      code: 'WEB_CRYPTO_UNAVAILABLE'
    });
  }

  const plaintext = new TextEncoder().encode(password);
  if (!plaintext.length || plaintext.length > maxPlaintextBytes) {
    throw new SportsApiError('Şifreniz güvenli giriş için izin verilen uzunluğu aşıyor.', {
      status: 400,
      code: 'PASSWORD_TOO_LONG_FOR_ENCRYPTION'
    });
  }

  let publicKey;
  try {
    publicKey = await globalThis.crypto.subtle.importKey(
      'spki',
      pemToSpkiBytes(pemKey),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
  } catch (err) {
    if (err instanceof SportsApiError) throw err;
    throw new SportsApiError('Sunucunun şifreleme anahtarı kullanılamadı.', {
      status: 502,
      code: 'INVALID_PUBLIC_KEY'
    });
  }

  try {
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      plaintext
    );
    return arrayBufferToBase64(ciphertext);
  } catch {
    throw new SportsApiError('Şifreniz güvenli biçimde şifrelenemedi.', {
      status: 0,
      code: 'PASSWORD_ENCRYPTION_FAILED'
    });
  }
}

export async function fetchSportsPublicKey() {
  const data = await requestSports('/sports-booking/public-key', {
    method: 'GET',
    defaultErrorMsg: 'Güvenli giriş anahtarı alınamadı.'
  });

  if (
    typeof data.key_id !== 'string' || !data.key_id ||
    typeof data.public_key_pem !== 'string' ||
    data.algorithm !== 'RSA-OAEP' ||
    data.hash !== 'SHA-256' ||
    !Number.isInteger(data.max_plaintext_bytes) ||
    data.max_plaintext_bytes < 1 || data.max_plaintext_bytes > 190
  ) {
    throw new SportsApiError('Sunucudan geçersiz şifreleme anahtarı yanıtı alındı.', {
      status: 502,
      code: 'INVALID_PUBLIC_KEY'
    });
  }

  return data;
}

export async function loginSports(username, password) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const keyData = await fetchSportsPublicKey();
    const encryptedPassword = await encryptPassword(
      password,
      keyData.public_key_pem,
      keyData.max_plaintext_bytes
    );

    try {
      const data = await requestSports('/sports/login', {
        body: {
          username,
          key_id: keyData.key_id,
          encrypted_password: encryptedPassword
        },
        defaultErrorMsg: 'Giriş yapılamadı. Kullanıcı adı veya şifre hatalı.'
      });
      if (!data.token) {
        throw new SportsApiError('Sunucudan geçersiz oturum yanıtı alındı.', {
          status: 502,
          code: 'INVALID_RESPONSE'
        });
      }
      return data;
    } catch (err) {
      const staleKey = err instanceof SportsApiError &&
        err.status === 409 && err.code === 'LOGIN_KEY_STALE';
      if (!staleKey) throw err;
      if (attempt === 1) {
        throw new SportsApiError(
          'Güvenli giriş anahtarı bu sunucu oturumunda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
          { status: 409, code: 'LOGIN_KEY_UNAVAILABLE' }
        );
      }
    }
  }

  throw new SportsApiError('Güvenli giriş anahtarı alınamadı.', {
    status: 409,
    code: 'LOGIN_KEY_UNAVAILABLE'
  });
}

export async function fetchSportsSlots(token, date, unitId = '4', locationId = '8', signal = null) {
  const data = await requestSports('/sports/slots', {
    body: {
      token,
      date,
      unit_id: String(unitId),
      location_id: String(locationId)
    },
    signal,
    defaultErrorMsg: 'Seans listesi alınamadı.'
  });

  if (!data.success || !Array.isArray(data.slots)) {
    throw new SportsApiError('Geçersiz seans verisi alındı.', {
      status: 502,
      code: 'INVALID_SLOTS_DATA'
    });
  }

  return data.slots;
}

export async function bookSportsSlot(token, seansId) {
  return requestSports('/sports/book', {
    body: {
      token,
      seans_id: String(seansId)
    },
    defaultErrorMsg: 'Randevu alma işlemi tamamlanamadı.'
  });
}
