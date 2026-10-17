import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Bot, Send, Key, Check, AlertCircle, RefreshCw, Sliders, Calendar } from 'lucide-react';
import AppDialog from './AppDialog';
import { useSchedule } from '../context/useSchedule';
import { askAiAssistant } from '../services/api';

const PRESET_PROMPTS = [
  'Pazartesi günü tamamen boş olsun',
  'Cuma günü dersim olmasın, uzun hafta sonu olsun',
  'Sabah erken ders olmasın, öğleden sonra başlasın',
  'Haftada mümkün olan en az gün okula geleyim',
  'Dersler arasında uzun boşluklar ve bekleme olmasın',
  'Öğle yemeği molası (12:00-13:00) açık kalsın',
];

export default function AIAssistantModal({ isOpen, onClose }) {
  const {
    combinations,
    currentComboIndex,
    setCurrentComboIndex,
    preferences,
    updatePreferences,
    customBlocks,
    notify
  } = useSchedule();

  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState(() => localStorage.getItem('cankaya_ai_provider') || 'gemini');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(`cankaya_${provider}_key`) || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Merhaba! Ders programınızı doğal dil ile optimize etmenize yardımcı olabilirim. Nasıl bir program istiyorsunuz? (Örn: "Pazartesi boş olsun", "Sabahları erken ders olmasın", "Haftada 3 gün geleyim")'
    }
  ]);
  const [lastRecommendation, setLastRecommendation] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('cankaya_ai_provider', provider);
    const savedKey = localStorage.getItem(`cankaya_${provider}_key`) || '';
    setApiKey(savedKey);
  }, [provider]);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem(`cankaya_${provider}_key`, apiKey);
    }
  }, [apiKey, provider]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const text = (textToSend || prompt).trim();
    if (!text || loading) return;

    if (!combinations || combinations.length === 0) {
      notify('Henüz seçili ders ve oluşturulmuş bir program alternatifi bulunmuyor.', 'warning');
      return;
    }

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setPrompt('');
    setLoading(true);
    setLastRecommendation(null);

    try {
      const res = await askAiAssistant({
        prompt: text,
        provider,
        apiKey: apiKey.trim(),
        combinations,
        preferences,
        customBlocks
      });

      const isRelevant = res.is_relevant !== false && typeof res.recommended_index === 'number';
      const recIndex = isRelevant ? res.recommended_index : null;
      const explanation = res.explanation || 'Talebinize göre en uygun program kombinasyonu belirlendi.';
      const suggestedPrefs = res.suggested_preferences || {};

      if (isRelevant && recIndex !== null) {
        setLastRecommendation({
          index: recIndex,
          explanation,
          preferences: suggestedPrefs
        });
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: explanation,
          recommendation: isRelevant && recIndex !== null ? {
            index: recIndex,
            preferences: suggestedPrefs
          } : null
        }
      ]);
    } catch (err) {
      const errMsg = err.message || 'Yapay zeka asistanına bağlanırken bir hata oluştu.';
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Hata: ${errMsg} ${!apiKey ? 'Lütfen yukarıdaki anahtar simgesine tıklayarak kendi ücretsiz API anahtarınızı tanımlayın.' : ''}`,
          isError: true
        }
      ]);
      if (errMsg.includes('API anahtarı')) {
        setShowKeyInput(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (rec) => {
    if (!rec) return;
    if (typeof rec.index === 'number' && rec.index >= 0 && rec.index < combinations.length) {
      setCurrentComboIndex(rec.index);
    }
    if (rec.preferences && Object.keys(rec.preferences).length > 0) {
      updatePreferences(rec.preferences);
    }
    notify(`Önerilen program (#${(rec.index ?? 0) + 1}) ve tercihler uygulandı!`, 'success');
    onClose?.();
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Yapay Zeka Program Asistanı"
      description="Doğal dildeki isteklerinize göre en uygun haftalık ders kombinasyonunu seçer ve önerir."
      size="lg"
      initialFocusRef={inputRef}
    >
      <div className="flex flex-col gap-3">
        {/* Top Control Bar: Provider selection & API Key Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-muted/60 border border-border-subtle text-xs">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-brand" />
            <span className="font-semibold text-ink">Model Sağlayıcı:</span>
            <div className="inline-flex rounded-lg border border-border-subtle bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`px-2.5 py-1 rounded-md transition-colors ${provider === 'gemini' ? 'bg-brand text-ink font-semibold' : 'text-ink-muted hover:text-ink'}`}
              >
                Google Gemini
              </button>
              <button
                type="button"
                onClick={() => setProvider('groq')}
                className={`px-2.5 py-1 rounded-md transition-colors ${provider === 'groq' ? 'bg-brand text-ink font-semibold' : 'text-ink-muted hover:text-ink'}`}
              >
                Groq (Llama 3.3)
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface border border-border-subtle transition-colors"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{apiKey ? 'API Anahtarı Tanımlı' : 'API Anahtarı Gir'}</span>
          </button>
        </div>

        {/* Collapsible API Key Input */}
        {showKeyInput && (
          <div className="p-3 rounded-xl bg-surface border border-border-strong text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">
                {provider === 'gemini' ? 'Google Gemini API Anahtarı' : 'Groq API Anahtarı'}
              </span>
              <a
                href={provider === 'gemini' ? 'https://aistudio.google.com/app/apikey' : 'https://console.groq.com/keys'}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline font-medium"
              >
                Ücretsiz Anahtar Al ↗
              </a>
            </div>
            <input
              type="password"
              placeholder={`Örnek: ${provider === 'gemini' ? 'AIzaSy...' : 'gsk_...'}`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-border-subtle bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-brand font-mono text-xs"
            />
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Anahtarınız yalnızca tarayıcınızın yerel depolama alanında tutulur ve doğrudan istek sırasında model sağlayıcısına iletilir. Sunucuda kalıcı olarak saklanmaz.
            </p>
          </div>
        )}

        {/* Preset Prompt Suggestions */}
        <div className="flex flex-wrap gap-1.5 py-1">
          {PRESET_PROMPTS.map((promptText, i) => (
            <button
              key={i}
              type="button"
              disabled={loading}
              onClick={() => handleSend(promptText)}
              className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-surface-muted hover:bg-surface border border-border-subtle hover:border-brand/50 text-ink transition-colors text-left"
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Chat Messages Container */}
        <div className="h-64 sm:h-72 overflow-y-auto rounded-xl border border-border-subtle bg-surface-muted/30 p-3 space-y-3 text-xs sm:text-sm">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-ink text-surface dark:bg-brand dark:text-brand-ink font-medium rounded-tr-sm'
                    : msg.isError
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900/60 rounded-tl-sm'
                    : 'bg-surface text-ink border border-border-subtle shadow-xs rounded-tl-sm'
                }`}
              >
                <div className="leading-relaxed whitespace-pre-wrap text-inherit">{msg.content}</div>

                {/* If message carries an actionable recommendation */}
                {msg.recommendation && (
                  <div className="mt-2.5 pt-2 border-t border-border-subtle/50 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-brand flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Seçilen: Program #{msg.recommendation.index + 1}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleApply(msg.recommendation)}
                      className="px-3.5 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-brand-ink font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Programı Uygula</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-ink-muted text-xs p-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand" />
              <span>Program alternatifleri analiz ediliyor...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 pt-1"
        >
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            placeholder="İstediğiniz programı tarif edin (örn: Pazartesi boş olsun)..."
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-border-subtle bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand text-xs sm:text-sm"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-40 text-ink font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1.5 shadow-xs min-h-[40px]"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Gönder</span>
          </button>
        </form>
      </div>
    </AppDialog>
  );
}
