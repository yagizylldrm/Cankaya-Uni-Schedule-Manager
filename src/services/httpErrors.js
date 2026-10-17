export const HTTP_ERROR_MESSAGES = {
  notFound: 'İstediğiniz veri veya kaynak bulunamadı (404).',
  server: 'Sunucu tarafında geçici bir sorun yaşanıyor, lütfen daha sonra tekrar deneyin.',
  network: 'Sunucuya ulaşılamıyor. Lütfen internet bağlantınızı kontrol edin.'
};

const HTML_PATTERN = /<!doctype|<html|<head|<body|<title|<script|<style/i;

export class ApiError extends Error {
  constructor(message, { status = 500, code = 'UNKNOWN_ERROR', data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function errorDetails(data) {
  if (!data || typeof data !== 'object') return {};

  if (data.detail && typeof data.detail === 'object') {
    return {
      message: typeof data.detail.message === 'string' ? data.detail.message : undefined,
      code: typeof data.detail.code === 'string' ? data.detail.code : undefined
    };
  }

  const message = [data.error, data.detail, data.message]
    .find((value) => typeof value === 'string');
  return { message };
}

export function createHttpError(status, data, {
  fallback = 'İşlem başarısız oldu.',
  htmlFallback = fallback,
  preserveServerCodes = []
} = {}) {
  const { message: rawMessage, code = 'UNKNOWN_ERROR' } = errorDetails(data);
  const hasUnsafeHtml = typeof rawMessage === 'string' && HTML_PATTERN.test(rawMessage);
  const safeMessage = rawMessage && !hasUnsafeHtml ? rawMessage : htmlFallback;

  let message = safeMessage || fallback;
  if (status === 404) {
    message = HTTP_ERROR_MESSAGES.notFound;
  } else if (
    [500, 502, 503, 504].includes(status) &&
    !hasUnsafeHtml &&
    !preserveServerCodes.includes(code)
  ) {
    message = HTTP_ERROR_MESSAGES.server;
  }

  return new ApiError(message, { status, code, data });
}

export function createNetworkError(data = null) {
  return new ApiError(HTTP_ERROR_MESSAGES.network, {
    status: 0,
    code: 'NETWORK_ERROR',
    data
  });
}
