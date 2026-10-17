import test from 'node:test';
import assert from 'node:assert/strict';

import { askAiAssistant, fetchDepartments, fetchHealth } from '../src/services/api.js';
import { fetchSportsSlots } from '../src/services/sportsApi.js';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('generic 404 responses use the standard user-facing message', async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({ detail: { internal: 'raw object' } }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );

  await assert.rejects(
    fetchDepartments(),
    (error) => error.status === 404 &&
      error.message === 'İstediğiniz veri veya kaynak bulunamadı (404).'
  );
});

test('generic server errors use the standard temporary-failure message', async () => {
  globalThis.fetch = async () => new Response(
    '<html><title>Gateway failure</title></html>',
    { status: 502, headers: { 'Content-Type': 'text/html' } }
  );

  await assert.rejects(
    fetchHealth(),
    (error) => error.status === 502 &&
      error.message === 'Sunucu tarafında geçici bir sorun yaşanıyor, lütfen daha sonra tekrar deneyin.'
  );
});

test('network failures use the standard connection message', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  await assert.rejects(
    fetchDepartments(),
    (error) => error.status === 0 &&
      error.message === 'Sunucuya ulaşılamıyor. Lütfen internet bağlantınızı kontrol edin.'
  );
});

test('sports-specific 401 errors are not replaced by generic messages', async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      detail: {
        code: 'SESSION_EXPIRED',
        message: 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.'
      }
    }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );

  await assert.rejects(
    fetchSportsSlots('token', '17.10.2026'),
    (error) => error.status === 401 &&
      error.code === 'SESSION_EXPIRED' &&
      error.message === 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.'
  );
});

test('sports generic server errors use the shared fallback message', async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({ detail: { internal: 'raw object' } }),
    { status: 504, headers: { 'Content-Type': 'application/json' } }
  );

  await assert.rejects(
    fetchSportsSlots('token', '17.10.2026'),
    (error) => error.status === 504 &&
      error.message === 'Sunucu tarafında geçici bir sorun yaşanıyor, lütfen daha sonra tekrar deneyin.'
  );
});

test('AI rate-limit response keeps its specific message and metadata', async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: 'Çok fazla istek gönderdiniz, lütfen 1 dakika bekleyin.' }),
    { status: 429, headers: { 'Content-Type': 'application/json' } }
  );

  await assert.rejects(
    askAiAssistant({ prompt: 'Pazartesi boş olsun', combinations: [{}] }),
    (error) => error.status === 429 &&
      error.message === 'Çok fazla istek gönderdiniz, lütfen 1 dakika bekleyin.'
  );
});
