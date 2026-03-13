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

async function validateApifyToken(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${token}`);
    if (res.ok) {
      const data = await res.json();
      return { valid: true, username: data.data?.username || 'OK' };
    }
    const body = await res.text();
    return { valid: false, error: `Status ${res.status}: ${body.substring(0, 200)}` };
  } catch (e: any) {
    return { valid: false, error: `Conexão falhou: ${e.message}` };
  }
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
  const url = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyKey}`;
  console.log(`[extract-leads] Starting actor: ${actorId}`);
  console.log(`[extract-leads] Actor input: ${JSON.stringify(input)}`);

  const runResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
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

  const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyKey}`);
  if (!dataRes.ok) {
    const errBody = await dataRes.text();
    throw new Error(`Falha ao buscar resultados do ${label}: HTTP ${dataRes.status} - ${errBody.substring(0, 200)}`);
  }
  const results = await dataRes.json();
  console.log(`[extract-leads] ${label} returned ${Array.isArray(results) ? results.length : 0} items`);
  return Array.isArray(results) ? results : [];
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

// =================== UTILITIES ===================

function sanitizePhoneNumber(phone: string, ddd: string = '11'): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (cleaned.length >= 8 && cleaned.length <= 9) cleaned = ddd + cleaned;
  if (cleaned.length === 10 || cleaned.length === 11) cleaned = '55' + cleaned;
  if (cleaned.length < 12 || cleaned.length > 13)

 return '';
  return cleaned;
}

function extractD. DD(location: string): string {
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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let sessionId = '';

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

    const { keyword, location = '', sessionId: sid, apiProvider = 'mock', maxResults = 100, userId, source = 'google_maps', searchType = 'empresas' } = payload;
    sessionId = sid;

    console.log(`[extract-leads] Payload: source=${source}, type=${searchType}, keyword="${keyword}", location="${location}", provider=${apiProvider}, max=${maxResults}`);

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

    await logToSession(supabase, sessionId, 'info', `🔍 Iniciando extração: "${keyword}" | Fonte: ${source} | Tipo: ${searchType}`);

    const ddd = extractDDD(location);
    let leadsCount = 0;

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
          const whatsappNumero = sanitizePhoneNumber(celular, ddd);
          leads.push({
            nome_empresa: businessName,
            telefone_original: `(${ddd}) ${celular.substring(0, 5)}-${celular.substring(5)}`,
            whatsapp_numero: whatsappNumero,
            site: `www.${businessName.toLowerCase().replace(/\s+/g, '').replace(/[&]/g, 'e')}.com.br`,
            endereco: `${location} - Centro`,
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
      // Get token: user profile first, then env fallback
      let apifyKey: string | null = null;
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('apify_api_token')
          .eq('user_id', userId)
          .single();
        apifyKey = profile?.apify_api_token || null;
        console.log(`[extract-leads] User token from profile: ${!!apifyKey}`);
      }
      if (!apifyKey) {
        apifyKey = Deno.env.get('APIFY_API_KEY') || null;
        console.log(`[extract-leads] Fallback to env APIFY_API_KEY: ${!!apifyKey}`);
      }

      if (!apifyKey) {
        await logToSession(supabase, sessionId, 'error', '❌ Token Apify não configurado. Vá em Configurações e insira seu token.');
        return errorResponse('Token Apify não configurado', 'Nenhum token encontrado no perfil do usuário nem nas variáveis de ambiente. Configure em Configurações > API Token Apify.');
      }

      // Validate token
      console.log(`[extract-leads] Validating Apify token...`);
      const tokenValidation = await validateApifyToken(apifyKey);
      if (!tokenValidation.valid) {
        console.error(`[extract-leads] Token validation failed: ${tokenValidation.error}`);
        await logToSession(supabase, sessionId, 'error', `❌ Token Apify inválido ou expirado: ${tokenValidation.error}`);
        return errorResponse('Token Apify inválido ou expirado', `Validação falhou: ${tokenValidation.error}. Atualize em Configurações.`);
      }
      console.log(`[extract-leads] Token valid for user: ${tokenValidation.username}`);
      await logToSession(supabase, sessionId, 'info', `🔑 Token Apify validado (${tokenValidation.username})`);

      // ---- TELEGRAM ----
      if (source === 'telegram') {
        await logToSession(supabase, sessionId, 'info', '🔗 Conectando ao Telegram Scraper (Apify)...');
        const results = await runApifyActor(
          'dainty_screw~telegram-scraper',
          { channels: [keyword.replace(/\s+/g, '').toLowerCase()], maxPostsPerChannel: maxResults || 100, maxCommentsPerPost: 0 },
          apifyKey, supabase, sessionId, 'Telegram Scraper', 60
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

        const results = await runApifyActor(
          actorId,
          { searchUrls: [searchUrl], maxResults: maxResults || 100 },
          apifyKey, supabase, sessionId, 'LinkedIn Scraper', 120
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
        const results = await runApifyActor(
          'compass~crawler-google-places',
          {
            searchStringsArray: [keyword],
            locationQuery: location ? `${location}, Brasil` : 'Brasil',
            maxCrawledPlacesPerSearch: maxResults || 100,
            language: 'pt-BR',
            deeperCityScrape: true,
            skipClosedPlaces: true,
            scrapeReviewsPersonalData: true,
            reviewsSort: 'lowest_rating',
            maxReviews: 5,
          },
          apifyKey, supabase, sessionId, 'Google Reviews Scraper', 60
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
        await logToSession(supabase, sessionId, 'info', '🔗 Conectando ao Google Maps Scraper (Apify)...');
        const results = await runApifyActor(
          'compass~crawler-google-places',
          {
            searchStringsArray: [keyword],
            locationQuery: location ? `${location}, Brasil` : 'Brasil',
            maxCrawledPlacesPerSearch: maxResults || 100,
            language: 'pt-BR',
            deeperCityScrape: true,
            skipClosedPlaces: true,
          },
          apifyKey, supabase, sessionId, 'Google Maps Scraper', 120
        );

        const leads = results.map((place: any) => {
          const phoneRaw = place.phone || place.phoneUnformatted || '';
          const whatsappNumero = sanitizePhoneNumber(phoneRaw, ddd);
          return {
            nome_empresa: place.title || place.name || '',
            telefone_original: phoneRaw,
            whatsapp_numero: whatsappNumero,
            site: place.website || place.url || '',
            endereco: place.address || place.street || '',
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

    return successResponse({ leadsCount, source });

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
        }
      } catch { /* ignore logging errors */ }
    }

    // Return 200 with success:false so frontend gets the actual error message
    return errorResponse(errorMessage, 'Erro interno do scraper');
  }
});
