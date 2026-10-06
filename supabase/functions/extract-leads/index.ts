import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =================== HELPERS ===================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function successResponse(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(error: string, details: string = '', status = 200) {
  // Always return 200 so supabase.functions.invoke passes the body through
  // The `success: false` flag tells the frontend it failed
  console.error(`[extract-leads] Error: ${error} | Details: ${details}`);
  return new Response(JSON.stringify({ success: false, error, details }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function validateApifyToken(token: string): Promise<{ valid: boolean; username?: string; error?: string; status?: number }> {
  const cleanToken = String(token || '').trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

  if (!cleanToken) {
    return { valid: false, error: 'Token vazio' };
  }

  // Nao usa /users/me como bloqueio. O Actor real e a fonte de verdade.
  return { valid: true, username: 'token configurado' };
}

type RotatingApiKey = {
  id: string | null;
  key: string;
  label: string;
  source: 'pool' | 'legacy' | 'env';
};

function normalizeApiKey(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

async function loadRotatingKeys(
  supabase: any,
  userId: string | undefined,
  provider: 'apify' | 'veriphone',
  legacyKey?: string | null,
  envKey?: string | null,
): Promise<RotatingApiKey[]> {
  const keys: RotatingApiKey[] = [];
  const seen = new Set<string>();

  if (userId) {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, key_value, label, disabled_until')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_active', true)
      .order('last_used_at', { ascending: true, nullsFirst: true })
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`[extract-leads] Failed to load ${provider} key pool: ${error.message}`);
    } else {
      const now = Date.now();
      for (const row of data || []) {
        if (row.disabled_until && new Date(row.disabled_until).getTime() > now) continue;
        const key = normalizeApiKey(row.key_value);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        keys.push({
          id: row.id,
          key,
          label: row.label || `${provider} key`,
          source: 'pool',
        });
      }
    }
  }

  const normalizedLegacy = normalizeApiKey(legacyKey);
  if (normalizedLegacy && !seen.has(normalizedLegacy)) {
    seen.add(normalizedLegacy);
    keys.push({
      id: null,
      key: normalizedLegacy,
      label: `${provider} legacy`,
      source: 'legacy',
    });
  }

  const normalizedEnv = normalizeApiKey(envKey);
  if (normalizedEnv && !seen.has(normalizedEnv)) {
    keys.push({
      id: null,
      key: normalizedEnv,
      label: `${provider} fallback`,
      source: 'env',
    });
  }

  return keys;
}

async function markPoolKeyUsed(supabase: any, key: RotatingApiKey) {
  if (!key.id) return;
  await supabase
    .from('api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      last_error: null,
      disabled_until: null,
    })
    .eq('id', key.id);
}

async function markPoolKeyFailed(supabase: any, key: RotatingApiKey, message: string) {
  if (!key.id) return;

  const lower = message.toLowerCase();
  const cooldownMinutes =
    lower.includes('429') || lower.includes('rate') ? 15 :
    lower.includes('401') || lower.includes('unauthorized') ? 24 * 60 :
    lower.includes('402') || lower.includes('credit') || lower.includes('crédit') || lower.includes('quota') ? 12 * 60 :
    lower.includes('403') || lower.includes('forbidden') ? 6 * 60 :
    60;

  await supabase
    .from('api_keys')
    .update({
      last_error: message.slice(0, 500),
      disabled_until: new Date(Date.now() + cooldownMinutes * 60_000).toISOString(),
    })
    .eq('id', key.id);
}

function shouldRotateApiKey(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(HTTP\s*(401|402|403|429)|unauthori[sz]ed|forbidden|rate\s*limit|quota|credit|crédit|insufficient|token.*invalid|invalid.*token)/i.test(message);
}

async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  apifyKey: string,
  supabase: any,
  sessionId: string,
  label: string,
  maxPollAttempts = 120,
): Promise<any[]> {
  const url = `https://api.apify.com/v2/acts/${actorId}/runs`;
  console.log(`[extract-leads] Starting actor: ${actorId}`);
  console.log(`[extract-leads] Actor input: ${JSON.stringify(input)}`);

  const runResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apifyKey}`,
    },
    body: JSON.stringify(input),
  });

  const runBody = await runResponse.text();
  console.log(`[extract-leads] Actor start response: ${runResponse.status} - ${runBody.substring(0, 500)}`);

  if (!runResponse.ok) {
    const parsed = tryParseJSON(runBody);
    const msg = parsed?.error?.message || runBody.substring(0, 300);
    if (runResponse.status === 402) {
      throw new Error(`Créditos Apify insuficientes para ${label}. Recarregue seus créditos em console.apify.com.`);
    }
    if (runResponse.status === 403) {
      throw new Error(`Actor "${actorId}" não disponível. Você precisa alugar este actor no Apify. Detalhes: ${msg}`);
    }
    throw new Error(`Falha ao iniciar ${label}: HTTP ${runResponse.status} - ${msg}`);
  }

  const runData = tryParseJSON(runBody);
  const runId = runData?.data?.id;
  if (!runId) throw new Error(`Resposta inválida do Apify ao iniciar ${label}: sem ID de execução`);

  await supabase.from('extraction_logs').insert({
    session_id: sessionId, tipo: 'info',
    mensagem: `⏳ ${label} iniciado (ID: ${runId}). Aguardando...`
  });

  // Poll for completion
  let attempts = 0;
  let runStatus = 'RUNNING';
  while ((runStatus === 'RUNNING' || runStatus === 'READY') && attempts < maxPollAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
      headers: { 'Authorization': `Bearer ${apifyKey}` },
    });
    const statusBody = await statusRes.text();
    const statusData = tryParseJSON(statusBody);
    runStatus = statusData?.data?.status || 'UNKNOWN';
    attempts++;
    if (attempts % 12 === 0) {
      await supabase.from('extraction_logs').insert({
        session_id: sessionId, tipo: 'info',
        mensagem: `⏳ ${label} processando... (${Math.floor(attempts * 5 / 60)}min)`
      });
    }
  }

  if (runStatus !== 'SUCCEEDED') {
    throw new Error(`${label} finalizou com status: ${runStatus}. Verifique os logs no Apify.`);
  }

  const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`, {
    headers: { 'Authorization': `Bearer ${apifyKey}` },
  });
  if (!dataRes.ok) {
    const errBody = await dataRes.text();
    throw new Error(`Falha ao buscar resultados do ${label}: HTTP ${dataRes.status} - ${errBody.substring(0, 200)}`);
  }
  const results = await dataRes.json();
  console.log(`[extract-leads] ${label} returned ${Array.isArray(results) ? results.length : 0} items`);
  return Array.isArray(results) ? results : [];
}

async function runApifyActorRotating(
  actorId: string,
  input: Record<string, unknown>,
  keys: RotatingApiKey[],
  supabase: any,
  sessionId: string,
  label: string,
  maxPollAttempts = 120,
): Promise<any[]> {
  if (keys.length === 0) {
    throw new Error('Nenhuma API key Apify ativa disponível.');
  }

  let lastError: unknown = null;

  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];

    if (index > 0) {
      await logToSession(
        supabase,
        sessionId,
        'warning',
        `🔄 Rotação automática: tentando a próxima chave Apify (${index + 1}/${keys.length}).`
      );
    }

    try {
      const results = await runApifyActor(
        actorId,
        input,
        key.key,
        supabase,
        sessionId,
        label,
        maxPollAttempts,
      );

      await markPoolKeyUsed(supabase, key);
      return results;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);

      if (!shouldRotateApiKey(error) || index === keys.length - 1) {
        throw error;
      }

      await markPoolKeyFailed(supabase, key, message);
      await logToSession(
        supabase,
        sessionId,
        'warning',
        `⚠️ Chave Apify indisponível (${message.slice(0, 140)}). Alternando sem interromper a extração.`
      );
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Falha nas chaves Apify'));
}

function tryParseJSON(text: string): any {
  try { return JSON.parse(text); } catch { return null; }
}

async function logToSession(supabase: any, sessionId: string, tipo: string, mensagem: string, dados?: Record<string, any>) {
  try {
    await supabase.from('extraction_logs').insert({ session_id: sessionId, tipo, mensagem, ...(dados ? { dados } : {}) });
  } catch (e) {
    console.error(`[extract-leads] Failed to log: ${e}`);
  }
}

async function updateExtractionSession(
  supabase: any,
  sessionId: string,
  userId: string | undefined,
  updates: Record<string, unknown>,
) {
  if (!sessionId || !userId) return;
  try {
    const { error } = await supabase
      .from('extraction_sessions')
      .update(updates)
      .eq('id', sessionId)
      .eq('user_id', userId);
    if (error) {
      console.error(`[extract-leads] Failed to update extraction session: ${error.message}`);
    }
  } catch (e) {
    console.error(`[extract-leads] Failed to update extraction session: ${e}`);
  }
}

// =================== UTILITIES ===================

type SearchContext = {
  locationQuery: string;
  language: string;
  country: 'BR' | 'US' | 'OTHER';
};

function resolveSearchContext(location: string): SearchContext {
  const raw = String(location || '').trim();
  if (!raw) {
    return { locationQuery: 'Brasil', language: 'pt-BR', country: 'BR' };
  }

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const usStates = [
    'alabama','alaska','arizona','arkansas','california','colorado','connecticut','delaware',
    'florida','georgia','hawaii','idaho','illinois','indiana','iowa','kansas','kentucky',
    'louisiana','maine','maryland','massachusetts','michigan','minnesota','mississippi',
    'missouri','montana','nebraska','nevada','new hampshire','new jersey','new mexico',
    'new york','north carolina','north dakota','ohio','oklahoma','oregon','pennsylvania',
    'rhode island','south carolina','south dakota','tennessee','texas','utah','vermont',
    'virginia','washington','west virginia','wisconsin','wyoming','district of columbia'
  ];
  const usAbbreviations = new Set([
    'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky',
    'la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd',
    'oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy','dc'
  ]);

  const parts = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  const explicitUS =
    /\b(usa|u\.?s\.?a\.?|united states|estados unidos|eua)\b/i.test(normalized) ||
    usStates.some((state) => normalized.includes(state)) ||
    parts.some((part) => usAbbreviations.has(part));

  const explicitBR = /\b(brasil|brazil)\b/i.test(normalized);

  if (explicitUS) {
    // Keep the user's text intact and only add USA when it is not already explicit.
    const hasCountry = /\b(usa|u\.?s\.?a\.?|united states|estados unidos|eua)\b/i.test(normalized);
    return {
      locationQuery: hasCountry ? raw : `${raw}, USA`,
      language: 'en',
      country: 'US',
    };
  }

  if (explicitBR) {
    return { locationQuery: raw, language: 'pt-BR', country: 'BR' };
  }

  // Important: do NOT force ", Brasil" here.
  // Apify can geocode a city/state/country directly, enabling searches worldwide.
  return { locationQuery: raw, language: 'en', country: 'OTHER' };
}

function sanitizePhoneNumber(phone: string, ddd: string = '11', country: 'BR' | 'US' | 'OTHER' = 'BR'): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');

  if (country === 'US') {
    if (cleaned.length === 11 && cleaned.startsWith('1')) return cleaned;
    if (cleaned.length === 10) return '1' + cleaned;
    return cleaned.length >= 10 && cleaned.length <= 15 ? cleaned : '';
  }

  if (country === 'BR') {
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) return cleaned;
    if (cleaned.length >= 8 && cleaned.length <= 9) cleaned = ddd + cleaned;
    if (cleaned.length === 10 || cleaned.length === 11) cleaned = '55' + cleaned;
    if (cleaned.length < 12 || cleaned.length > 13) return '';
    return cleaned;
  }

  // For other countries, preserve an already international-looking number
  // instead of incorrectly prefixing Brazil's +55.
  return cleaned.length >= 10 && cleaned.length <= 15 ? cleaned : '';
}

function extractDDD(location: string): string {
  const dddMap: Record<string, string> = {
    'são paulo': '11', 'sao paulo': '11', 'sp': '11',
    'rio de janeiro': '21', 'rj': '21',
    'belo horizonte': '31', 'mg': '31',
    'brasília': '61', 'brasilia': '61', 'df': '61',
    'curitiba': '41', 'pr': '41',
    'porto alegre': '51', 'rs': '51',
    'salvador': '71', 'ba': '71',
    'recife': '81', 'pe': '81',
    'fortaleza': '85', 'ce': '85',
    'campinas': '19',
  };
  const locationLower = location.toLowerCase();
  for (const [city, ddd] of Object.entries(dddMap)) {
    if (locationLower.includes(city)) return ddd;
  }
  return '11';
}

// =================== MAIN ===================

interface ExtractRequest {
  keyword: string;
  location: string;
  sessionId: string;
  apiProvider?: 'apify' | 'mock';
  maxResults?: number;
  userId?: string;
  source?: 'google_maps' | 'telegram' | 'google_reviews' | 'linkedin';
  searchType?: string;
  websiteFilter?: 'all' | 'without';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let sessionId = '';
  let sessionUserId: string | undefined;

  try {
    // 1. Validate env vars
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return errorResponse('Configuração do servidor incompleta', 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Parse & validate payload
    let payload: ExtractRequest;
    try {
      payload = await req.json();
    } catch {
      return errorResponse('Payload inválido', 'O body da requisição não é um JSON válido');
    }

    const {
      keyword,
      location = '',
      sessionId: sid,
      apiProvider = 'mock',
      maxResults = 100,
      userId,
      source = 'google_maps',
      searchType = 'empresas',
      websiteFilter = 'all',
    } = payload;
    sessionId = sid;
    sessionUserId = userId;

    console.log(`[extract-leads] Payload: source=${source}, type=${searchType}, keyword="${keyword}", location="${location}", provider=${apiProvider}, max=${maxResults}, websiteFilter=${websiteFilter}`);

    if (!keyword || !keyword.trim()) {
      await logToSession(supabase, sessionId, 'error', '❌ Query/palavra-chave é obrigatória');
      return errorResponse('Query vazia', 'O campo keyword é obrigatório');
    }
    if (!sessionId) {
      return errorResponse('Session ID ausente', 'O campo sessionId é obrigatório');
    }
    if (maxResults < 1 || maxResults > 10000) {
      return errorResponse('Limite inválido', `maxResults deve ser entre 1 e 10000, recebido: ${maxResults}`);
    }

    if (userId) {
      const { error: sessionError } = await supabase
        .from('extraction_sessions')
        .upsert({
          id: sessionId,
          user_id: userId,
          query: keyword.trim(),
          location: location || null,
          source,
          search_type: searchType,
          api_provider: apiProvider,
          website_filter: websiteFilter,
          requested_max_results: maxResults,
          leads_count: 0,
          status: 'running',
          started_at: new Date().toISOString(),
          completed_at: null,
        }, { onConflict: 'id' });

      if (sessionError) {
        console.error(`[extract-leads] Failed to create extraction session: ${sessionError.message}`);
      }
    }

    await logToSession(
      supabase,
      sessionId,
      'info',
      `🔍 Iniciando extração: "${keyword}" | Fonte: ${source} | Tipo: ${searchType}${source === 'google_maps' && websiteFilter === 'without' ? ' | 🚫 Somente empresas sem site' : ''}`
    );

    const searchContext = resolveSearchContext(location);
    const ddd = extractDDD(location);
    let leadsCount = 0;

    await logToSession(
      supabase,
      sessionId,
      'info',
      `🌎 Localização resolvida: "${searchContext.locationQuery}" | Idioma: ${searchContext.language} | País: ${searchContext.country}`
    );

    // =================== MOCK MODE ===================
    if (apiProvider === 'mock') {
      await logToSession(supabase, sessionId, 'warning', '⚠️ Modo demonstração ativo.');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockCount = Math.min(maxResults || 100, 50);

      if (source === 'telegram') {
        const telegramLeads = [];
        for (let i = 0; i < mockCount; i++) {
          telegramLeads.push({
            nome: `${keyword} Grupo ${i + 1}`,
            username: `@${keyword.toLowerCase().replace(/\s/g, '')}${i + 1}`,
            link: `https://t.me/${keyword.toLowerCase().replace(/\s/g, '')}${i + 1}`,
            membros: Math.floor(100 + Math.random() * 10000),
            descricao: `Grupo de ${keyword} - Comunidade #${i + 1}`,
            categoria: keyword,
            fonte: 'telegram',
            tipo: searchType === 'usuarios' ? 'usuario' : 'grupo',
            user_id: userId || null,
          });
        }
        const { error: insertError } = await supabase.from('telegram_leads').insert(telegramLeads);
        if (insertError) throw new Error(`Erro ao salvar leads Telegram: ${insertError.message}`);
        leadsCount = telegramLeads.length;
        await logToSession(supabase, sessionId, 'success', `✅ ${leadsCount} ${searchType} do Telegram extraídos (demo)`);

      } else if (source === 'google_reviews' && searchType === 'reviews_negativas') {
        const reviewLeads = [];
        for (let i = 0; i < mockCount; i++) {
          reviewLeads.push({
            empresa: `${keyword} ${['Central', 'Express', 'Premium', 'Plus'][i % 4]} ${i + 1}`,
            telefone: `(${ddd}) 9${Math.floor(10000000 + Math.random() * 90000000)}`.replace(/(\d{5})(\d{4})/, '$1-$2'),
            website: `www.${keyword.toLowerCase().replace(/\s/g, '')}${i}.com.br`,
            endereco: `${location} - Rua ${i + 1}`,
            cidade: location,
            rating_medio: Number((1 + Math.random() * 1.5).toFixed(1)),
            total_reviews: Math.floor(5 + Math.random() * 200),
            review: `Péssimo atendimento, não recomendo.`,
            rating: Math.floor(1 + Math.random() * 2),
            autor: `Usuário ${i + 1}`,
            data_review: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            user_id: userId || null,
          });
        }
        const { error: insertError } = await supabase.from('reviews_negativos').insert(reviewLeads);
        if (insertError) throw new Error(`Erro ao salvar reviews: ${insertError.message}`);
        leadsCount = reviewLeads.length;
        await logToSession(supabase, sessionId, 'success', `✅ ${leadsCount} reviews negativos extraídos (demo)`);

      } else if (source === 'linkedin') {
        const linkedinLeads = [];
        for (let i = 0; i < mockCount; i++) {
          linkedinLeads.push({
            nome: `${['João', 'Maria', 'Pedro', 'Ana', 'Carlos'][i % 5]} ${['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima'][i % 5]}`,
            cargo: `${keyword} ${['Senior', 'Junior', 'Pleno', 'Head', 'Director'][i % 5]}`,
            empresa: `Empresa ${i + 1} Ltda`,
            localizacao: location || 'São Paulo, Brasil',
            perfil_url: `https://linkedin.com/in/user${i + 1}`,
            setor: keyword,
            conexoes: Math.floor(100 + Math.random() * 5000),
            descricao: `Profissional de ${keyword} com experiência em diversos projetos.`,
            fonte: 'linkedin',
            user_id: userId || null,
          });
        }
        const { error: insertError } = await supabase.from('linkedin_leads').insert(linkedinLeads);
        if (insertError) throw new Error(`Erro ao salvar leads LinkedIn: ${insertError.message}`);
        leadsCount = linkedinLeads.length;
        await logToSession(supabase, sessionId, 'success', `✅ ${leadsCount} perfis do LinkedIn extraídos (demo)`);

      } else {
        // Google Maps mock
        const leads = [];
        const suffixes = ['Central', 'Express', 'Premium', '& Cia', 'do Bairro', 'Família', 'Tradicional', 'Gourmet', '24h', 'VIP'];
        for (let i = 0; i < mockCount; i++) {
          const suffix = suffixes[i % suffixes.length];
          const businessName = `${keyword} ${suffix}${i >= suffixes.length ? ` ${i + 1}` : ''}`;
          const celular = `9${Math.floor(10000000 + Math.random() * 90000000)}`;
          const whatsappNumero = sanitizePhoneNumber(celular, ddd, searchContext.country);
          const mockWebsite = websiteFilter === 'without'
            ? ''
            : (i % 3 === 0 ? '' : `www.${businessName.toLowerCase().replace(/\s+/g, '').replace(/[&]/g, 'e')}.com.br`);
          leads.push({
            nome_empresa: businessName,
            telefone_original: `(${ddd}) ${celular.substring(0, 5)}-${celular.substring(5)}`,
            whatsapp_numero: whatsappNumero,
            site: mockWebsite,
            endereco: `${location} - Centro`,
            cidade: location || searchContext.locationQuery || '',
            extraction_session_id: sessionId,
            categoria: keyword,
            avaliacao: Number((3.8 + (i % 12) * 0.1).toFixed(1)),
            total_avaliacoes: 50 + (i % 500),
            status: whatsappNumero ? 'validado' : 'extraido',
            fonte: 'google_maps',
            user_id: userId || null,
          });
        }
        for (let i = 0; i < leads.length; i += 500) {
          const batch = leads.slice(i, i + 500);
          const { error: insertError } = await supabase.from('leads').insert(batch);
          if (insertError) throw new Error(`Erro ao salvar leads Google Maps: ${insertError.message}`);
        }
        leadsCount = leads.length;
        await logToSession(supabase, sessionId, 'success', `✅ ${leadsCount} leads do Google Maps extraídos (demo)`);
      }

    // =================== APIFY MODE ===================
    } else if (apiProvider === 'apify') {
      // Load all active Apify keys. The legacy profile key and project Secret stay as fallbacks.
      let legacyApifyKey: string | null = null;
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('apify_api_token')
          .eq('user_id', userId)
          .maybeSingle();
        legacyApifyKey = profile?.apify_api_token || null;
      }

      const apifyKeys = await loadRotatingKeys(
        supabase,
        userId,
        'apify',
        legacyApifyKey,
        Deno.env.get('APIFY_API_KEY') || null,
      );

      if (apifyKeys.length === 0) {
        await logToSession(supabase, sessionId, 'error', '❌ Nenhuma chave Apify ativa configurada.');
        await updateExtractionSession(supabase, sessionId, userId, {
          status: 'error',
          completed_at: new Date().toISOString(),
        });
        return errorResponse(
          'Nenhuma chave Apify disponível',
          'Adicione uma ou mais chaves em Configurações > Rotação automática de API Keys.'
        );
      }

      await logToSession(
        supabase,
        sessionId,
        'info',
        `🔑 Pool Apify carregado: ${apifyKeys.length} chave(s) disponível(is) para rotação automática.`
      );

      // ---- TELEGRAM ----
      if (source === 'telegram') {
        await logToSession(supabase, sessionId, 'info', '🔗 Conectando ao Telegram Scraper (Apify)...');
        const results = await runApifyActorRotating(
          'dainty_screw~telegram-scraper',
          { channels: [keyword.replace(/\s+/g, '').toLowerCase()], maxPostsPerChannel: maxResults || 100, maxCommentsPerPost: 0 },
          apifyKeys, supabase, sessionId, 'Telegram Scraper', 60
        );

        const telegramLeads = results.map((item: any) => ({
          nome: item.channelTitle || item.title || item.authorName || keyword,
          username: item.channelUsername || item.username || '',
          link: item.url || item.authorTelegram || '',
          membros: item.viewsCount || item.views || 0,
          descricao: (item.text || item.description || '').substring(0, 500),
          categoria: keyword,
          fonte: 'telegram',
          tipo: searchType === 'usuarios' ? 'usuario' : 'grupo',
          user_id: userId || null,
        }));

        if (telegramLeads.length > 0) {
          for (let i = 0; i < telegramLeads.length; i += 500) {
            const { error: insertError } = await supabase.from('telegram_leads').insert(telegramLeads.slice(i, i + 500));
            if (insertError) throw new Error(`Erro ao salvar Telegram leads: ${insertError.message}`);
          }
        }
        leadsCount = telegramLeads.length;

      // ---- LINKEDIN ----
      } else if (source === 'linkedin') {
        await logToSession(supabase, sessionId, 'info', '🔗 Conectando ao LinkedIn Scraper (Apify)...');
        const actorId = searchType === 'empresas_linkedin'
          ? 'curious_coder~linkedin-company-scraper'
          : 'curious_coder~linkedin-profile-scraper';
        const searchUrl = searchType === 'empresas_linkedin'
          ? `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(keyword)}`
          : `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keyword)}`;

        const results = await runApifyActorRotating(
          actorId,
          { searchUrls: [searchUrl], maxResults: maxResults || 100 },
          apifyKeys, supabase, sessionId, 'LinkedIn Scraper', 120
        );

        const linkedinLeads = results.map((item: any) => ({
          nome: item.fullName || item.name || item.title || '',
          cargo: item.headline || item.title || item.position || '',
          empresa: item.company || item.companyName || item.organization || '',
          localizacao: item.location || item.addressLocality || location || '',
          perfil_url: item.url || item.profileUrl || item.linkedInUrl || '',
          email: item.email || '',
          telefone: item.phone || '',
          setor: item.industry || item.sector || keyword,
          conexoes: item.connectionsCount || item.connections || null,
          descricao: item.summary || item.about || item.description || '',
          fonte: 'linkedin',
          user_id: userId || null,
        }));

        if (linkedinLeads.length > 0) {
          for (let i = 0; i < linkedinLeads.length; i += 500) {
            const { error: insertError } = await supabase.from('linkedin_leads').insert(linkedinLeads.slice(i, i + 500));
            if (insertError) throw new Error(`Erro ao salvar LinkedIn leads: ${insertError.message}`);
          }
        }
        leadsCount = linkedinLeads.length;

      // ---- GOOGLE REVIEWS ----
      } else if (source === 'google_reviews') {
        await logToSession(supabase, sessionId, 'info', '🔗 Conectando ao Google Reviews Scraper (Apify)...');
        const results = await runApifyActorRotating(
          'compass~crawler-google-places',
          {
            searchStringsArray: [keyword],
            locationQuery: searchContext.locationQuery,
            maxCrawledPlacesPerSearch: maxResults || 100,
            language: searchContext.language,
            deeperCityScrape: true,
            skipClosedPlaces: true,
            scrapeReviewsPersonalData: true,
            reviewsSort: 'lowest_rating',
            maxReviews: 5,
          },
          apifyKeys, supabase, sessionId, 'Google Reviews Scraper', 60
        );

        const reviewLeads: any[] = [];
        for (const place of results) {
          const negativeReviews = (place.reviews || []).filter((r: any) => (r.stars || r.rating || 5) <= 2);
          if (searchType === 'reviews_negativas' && negativeReviews.length === 0) continue;
          for (const review of (searchType === 'reviews_negativas' ? negativeReviews : [{ text: '', stars: place.totalScore }])) {
            reviewLeads.push({
              empresa: place.title || place.name,
              telefone: place.phone || '',
              website: place.website || '',
              endereco: place.address || '',
              cidade: location,
              rating_medio: place.totalScore || null,
              total_reviews: place.reviewsCount || 0,
              review: review.text || '',
              rating: review.stars || review.rating || null,
              autor: review.name || review.author || '',
              data_review: review.publishedAtDate || null,
              user_id: userId || null,
            });
          }
        }

        if (reviewLeads.length > 0) {
          for (let i = 0; i < reviewLeads.length; i += 500) {
            const { error: insertError } = await supabase.from('reviews_negativos').insert(reviewLeads.slice(i, i + 500));
            if (insertError) throw new Error(`Erro ao salvar reviews: ${insertError.message}`);
          }
        }
        leadsCount = reviewLeads.length;

      // ---- GOOGLE MAPS (default) ----
      } else {
        const crawlLimit = websiteFilter === 'without'
          ? Math.min(Math.max((maxResults || 100) * 3, maxResults || 100), 10000)
          : (maxResults || 100);

        await logToSession(
          supabase,
          sessionId,
          'info',
          websiteFilter === 'without'
            ? `🔗 Conectando ao Google Maps Scraper (Apify)... buscando até ${crawlLimit} empresas para encontrar ${maxResults} sem site.`
            : '🔗 Conectando ao Google Maps Scraper (Apify)...'
        );
        const results = await runApifyActorRotating(
          'compass~crawler-google-places',
          {
            searchStringsArray: [keyword],
            locationQuery: searchContext.locationQuery,
            maxCrawledPlacesPerSearch: crawlLimit,
            language: searchContext.language,
            deeperCityScrape: true,
            skipClosedPlaces: true,
          },
          apifyKeys, supabase, sessionId, 'Google Maps Scraper', 120
        );

        // IMPORTANTE: place.url é a URL da ficha no Google Maps, não o site da empresa.
        // Para identificar empresas realmente sem site, usamos exclusivamente place.website.
        const filteredResults = websiteFilter === 'without'
          ? results.filter((place: any) => !String(place.website || '').trim())
          : results;

        const selectedResults = filteredResults.slice(0, maxResults || 100);

        if (websiteFilter === 'without') {
          await logToSession(
            supabase,
            sessionId,
            'info',
            `🚫 Filtro sem site: ${results.length} empresas analisadas, ${filteredResults.length} sem website, ${selectedResults.length} selecionadas.`
          );
        }

        const leads = selectedResults.map((place: any) => {
          const phoneRaw = place.phone || place.phoneUnformatted || '';
          const whatsappNumero = sanitizePhoneNumber(phoneRaw, ddd, searchContext.country);
          return {
            nome_empresa: place.title || place.name || '',
            telefone_original: phoneRaw,
            whatsapp_numero: whatsappNumero,
            site: String(place.website || '').trim(),
            endereco: place.address || place.street || '',
            cidade: location || searchContext.locationQuery || '',
            extraction_session_id: sessionId,
            categoria: place.categoryName || keyword,
            avaliacao: place.totalScore || place.rating || null,
            total_avaliacoes: place.reviewsCount || place.reviews || 0,
            status: whatsappNumero ? 'validado' : 'extraido',
            fonte: 'apify',
            user_id: userId || null,
          };
        });

        for (let i = 0; i < leads.length; i += 500) {
          const { error: insertError } = await supabase.from('leads').insert(leads.slice(i, i + 500));
          if (insertError) throw new Error(`Erro ao salvar leads Google Maps: ${insertError.message}`);
        }
        leadsCount = leads.length;
      }

      await logToSession(supabase, sessionId, 'success', `🎉 Extração concluída! ${leadsCount} resultados salvos.`);
    } else {
      return errorResponse('Provider inválido', `apiProvider "${apiProvider}" não é suportado. Use "apify" ou "mock".`);
    }

    // Final success log
    await logToSession(supabase, sessionId, 'success', `🎉 Total: ${leadsCount} resultados extraídos e salvos.`, { total: leadsCount, source, searchType });

    await updateExtractionSession(supabase, sessionId, userId, {
      status: 'completed',
      leads_count: leadsCount,
      completed_at: new Date().toISOString(),
    });

    return successResponse({ leadsCount, source, sessionId });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[extract-leads] Unhandled error: ${errorMessage}`);

    // Try to log the error to session
    if (sessionId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await logToSession(supabase, sessionId, 'error', `❌ ${errorMessage}`);
          await updateExtractionSession(supabase, sessionId, sessionUserId, {
            status: 'error',
            completed_at: new Date().toISOString(),
          });
        }
      } catch { /* ignore logging errors */ }
    }

    // Return 200 with success:false so frontend gets the actual error message
    return errorResponse(errorMessage, 'Erro interno do scraper');
  }
});
