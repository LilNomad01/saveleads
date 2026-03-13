import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function sanitizePhoneNumber(phone: string, ddd: string = '11'): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (cleaned.length >= 8 && cleaned.length <= 9) cleaned = ddd + cleaned;
  if (cleaned.length === 10 || cleaned.length === 11) cleaned = '55' + cleaned;
  if (cleaned.length < 12 || cleaned.length > 13) return '';
  return cleaned;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { keyword, location, sessionId, apiProvider = 'mock', maxResults = 100, userId, source = 'google_maps', searchType = 'empresas' }: ExtractRequest = await req.json();

    console.log(`[extract-leads] Source: ${source}, Type: ${searchType}, Query: ${keyword}, Location: ${location}`);

    // Fetch user's Apify token from profile (persisted permanently)
    let userApifyToken: string | null = null;
    if (userId && apiProvider === 'apify') {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('apify_api_token')
        .eq('user_id', userId)
        .single();
      
      if (profileError) {
        console.log(`[extract-leads] Profile fetch error: ${profileError.message}`);
      }
      userApifyToken = profile?.apify_api_token || null;
      console.log(`[extract-leads] User token found: ${!!userApifyToken}`);
    }

    await supabase.from('extraction_logs').insert({
      session_id: sessionId,
      tipo: 'info',
      mensagem: `🔍 Iniciando extração: "${keyword}" | Fonte: ${source} | Tipo: ${searchType}`
    });

    const ddd = extractDDD(location);
    let leadsCount = 0;

    // =================== MOCK MODE ===================
    if (apiProvider === 'mock') {
      await supabase.from('extraction_logs').insert({
        session_id: sessionId, tipo: 'warning',
        mensagem: '⚠️ Modo demonstração ativo.'
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockCount = Math.min(maxResults || 100, 5000);

      if (source === 'telegram') {
        // Mock Telegram data
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
        if (insertError) throw insertError;
        leadsCount = telegramLeads.length;

        await supabase.from('extraction_logs').insert({
          session_id: sessionId, tipo: 'success',
          mensagem: `✅ ${leadsCount} ${searchType} do Telegram extraídos (demo)`
        });

      } else if (source === 'google_reviews' && searchType === 'reviews_negativas') {
        // Mock Google Reviews data
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
            review: `Péssimo atendimento, não recomendo. Experiência terrível.`,
            rating: Math.floor(1 + Math.random() * 2),
            autor: `Usuário ${i + 1}`,
            data_review: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            user_id: userId || null,
          });
        }

        const { error: insertError } = await supabase.from('reviews_negativos').insert(reviewLeads);
        if (insertError) throw insertError;
        leadsCount = reviewLeads.length;

        await supabase.from('extraction_logs').insert({
          session_id: sessionId, tipo: 'success',
          mensagem: `✅ ${leadsCount} reviews negativos extraídos (demo)`
        });

      } else if (source === 'linkedin') {
        // Mock LinkedIn data
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
        if (insertError) throw insertError;
        leadsCount = linkedinLeads.length;

        await supabase.from('extraction_logs').insert({
          session_id: sessionId, tipo: 'success',
          mensagem: `✅ ${leadsCount} perfis do LinkedIn extraídos (demo)`
        });

      } else {
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

        // Insert in batches of 500
        for (let i = 0; i < leads.length; i += 500) {
          const batch = leads.slice(i, i + 500);
          const { error: insertError } = await supabase.from('leads').insert(batch);
          if (insertError) throw insertError;
        }
        leadsCount = leads.length;

        await supabase.from('extraction_logs').insert({
          session_id: sessionId, tipo: 'success',
          mensagem: `✅ ${leadsCount} leads do Google Maps extraídos (demo)`
        });
      }

    // =================== APIFY MODE ===================
    } else if (apiProvider === 'apify') {
      const apifyKey = userApifyToken || Deno.env.get('APIFY_API_KEY');
      if (!apifyKey) {
        throw new Error('Token Apify não configurado.');
      }

      if (source === 'telegram') {
        // Apify Telegram scraper
        await supabase.from('extraction_logs').insert({
          session_id: sessionId, tipo: 'info',
          mensagem: '🔗 Conectando ao Telegram Scraper (Apify)...'
        });

        const runResponse = await fetch(
          `https://api.apify.com/v2/acts/dainty_screw~telegram-scraper/runs?token=${apifyKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channels: [keyword.replace(/\s+/g, '').toLowerCase()],
              maxPostsPerChannel: maxResults || 100,
              maxCommentsPerPost: 0,
            })
          }
        );

        if (!runResponse.ok) {
          const errText = await runResponse.text();
          throw new Error(`Apify Telegram falhou: ${runResponse.status} - ${errText}`);
        }

        const runData = await runResponse.json();
        const runId = runData.data?.id;
        if (!runId) throw new Error('Sem ID de execução Apify');

        // Poll for completion
        let attempts = 0;
        let runStatus = 'RUNNING';
        while (runStatus === 'RUNNING' && attempts < 60) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
          const statusData = await statusRes.json();
          runStatus = statusData.data?.status;
          attempts++;
        }

        if (runStatus !== 'SUCCEEDED') throw new Error(`Telegram scraper status: ${runStatus}`);

        const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyKey}`);
        const results = await dataRes.json();

        const telegramLeads = results.map((item: any) => ({
          nome: item.channelTitle || item.title || item.authorName || keyword,
          username: item.channelUsername || item.username || '',
          link: item.url || item.authorTelegram || '',
          membros: item.viewsCount || item.views || 0,
          descricao: item.text?.substring(0, 500) || item.description || '',
          categoria: keyword,
          fonte: 'telegram',
          tipo: searchType === 'usuarios' ? 'usuario' : 'grupo',
          user_id: userId || null,
        }));

        if (telegramLeads.length > 0) {
          const { error: insertError } = await supabase.from('telegram_leads').insert(telegramLeads);
          if (insertError) throw insertError;
        }
        leadsCount = telegramLeads.length;

      } else if (source === 'linkedin') {
        // LinkedIn scraper via Apify
        await supabase.from('extraction_logs').insert({
          session_id: sessionId, tipo: 'info',
          mensagem: '🔗 Conectando ao LinkedIn Scraper (Apify)...'
        });

        const actorId = searchType === 'empresas_linkedin' 
          ? 'curious_coder~linkedin-company-scraper'
          : 'curious_coder~linkedin-profile-scraper';

        const inputBody = searchType === 'empresas_linkedin'
          ? { searchUrls: [`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(keyword)}`], maxResults: maxResults || 100 }
          : { searchUrls: [`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keyword)}`], maxResults: maxResults || 100 };

        const runResponse = await fetch(
          `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputBody)
          }
        );

        if (!runResponse.ok) {
          const errText = await runResponse.text();
          throw new Error(`Apify LinkedIn falhou: ${runResponse.status} - ${errText}`);
        }

        const runData = await runResponse.json();
        const runId = runData.data?.id;
        if (!runId) throw new Error('Sem ID de execução Apify');

        let attempts = 0;
        let runStatus = 'RUNNING';
        while (runStatus === 'RUNNING' && attempts < 120) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
          const statusData = await statusRes.json();
          runStatus = statusData.data?.status;
          attempts++;
          if (attempts % 12 === 0) {
            await supabase.from('extraction_logs').insert({
              session_id: sessionId, tipo: 'info',
              mensagem: `⏳ LinkedIn processando... (${Math.floor(attempts * 5 / 60)}min)`
            });
          }
        }

        if (runStatus !== 'SUCCEEDED') throw new Error(`LinkedIn scraper status: ${runStatus}`);

        const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyKey}`);
        const results = await dataRes.json();

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
            const batch = linkedinLeads.slice(i, i + 500);
            const { error: insertError } = await supabase.from('linkedin_leads').insert(batch);
            if (insertError) throw insertError;
          }
        }
        leadsCount = linkedinLeads.length;

      } else if (source === 'google_reviews') {
        // Google Reviews scraper
        await supabase.from('extraction_logs').insert({
          session_id: sessionId, tipo: 'info',
          mensagem: '🔗 Conectando ao Google Reviews Scraper (Apify)...'
        });

        const runResponse = await fetch(
          `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${apifyKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              searchStringsArray: [keyword],
              locationQuery: location ? `${location}, Brasil` : 'Brasil',
              maxCrawledPlacesPerSearch: maxResults || 100,
              language: 'pt-BR',
              deeperCityScrape: true,
              skipClosedPlaces: true,
              scrapeReviewsPersonalData: true,
              reviewsSort: 'lowest_rating',
              maxReviews: 5,
            })
          }
        );

        if (!runResponse.ok) throw new Error(`Apify Reviews falhou: ${runResponse.status}`);

        const runData = await runResponse.json();
        const runId = runData.data?.id;
        if (!runId) throw new Error('Sem ID de execução Apify');

        let attempts = 0;
        let runStatus = 'RUNNING';
        while (runStatus === 'RUNNING' && attempts < 60) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
          const statusData = await statusRes.json();
          runStatus = statusData.data?.status;
          attempts++;
        }

        if (runStatus !== 'SUCCEEDED') throw new Error(`Reviews scraper status: ${runStatus}`);

        const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyKey}`);
        const results = await dataRes.json();

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
            const batch = reviewLeads.slice(i, i + 500);
            const { error: insertError } = await supabase.from('reviews_negativos').insert(batch);
            if (insertError) throw insertError;
          }
        }
        leadsCount = reviewLeads.length;

      } else {
        // Google Maps (default)
        await supabase.from('extraction_logs').insert({
          session_id: sessionId, tipo: 'info',
          mensagem: '🔗 Conectando ao Google Maps Scraper (Apify)...'
        });

        const runResponse = await fetch(
          `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${apifyKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              searchStringsArray: [keyword],
              locationQuery: location ? `${location}, Brasil` : 'Brasil',
              maxCrawledPlacesPerSearch: maxResults || 100,
              language: 'pt-BR',
              deeperCityScrape: true,
              skipClosedPlaces: true,
            })
          }
        );

        if (!runResponse.ok) {
          const errText = await runResponse.text();
          if (runResponse.status === 402) {
            await supabase.from('extraction_logs').insert({
              session_id: sessionId, tipo: 'warning',
              mensagem: '⚠️ Créditos insuficientes. Usando modo demo...'
            });
            // Fallback to mock - insert a few leads
            const leads = [];
            for (let i = 0; i < 5; i++) {
              const celular = `9${Math.floor(10000000 + Math.random() * 90000000)}`;
              leads.push({
                nome_empresa: `${keyword} Demo ${i + 1}`,
                telefone_original: `(${ddd}) ${celular.substring(0,5)}-${celular.substring(5)}`,
                whatsapp_numero: sanitizePhoneNumber(celular, ddd),
                endereco: `${location} - Centro`,
                categoria: keyword,
                avaliacao: 4.0 + i * 0.1,
                total_avaliacoes: 100 + i * 50,
                status: 'validado',
                fonte: 'mock_fallback',
                user_id: userId || null,
              });
            }
            await supabase.from('leads').insert(leads);
            leadsCount = leads.length;
          } else {
            throw new Error(`Apify Maps falhou: ${runResponse.status}`);
          }
        } else {
          const runData = await runResponse.json();
          const runId = runData.data?.id;
          if (!runId) throw new Error('Sem ID de execução');

          await supabase.from('extraction_logs').insert({
            session_id: sessionId, tipo: 'info',
            mensagem: `⏳ Extração iniciada (ID: ${runId}). Aguardando...`
          });

          let attempts = 0;
          let runStatus = 'RUNNING';
          while (runStatus === 'RUNNING' && attempts < 120) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
            const statusData = await statusRes.json();
            runStatus = statusData.data?.status;
            attempts++;
            if (attempts % 12 === 0) {
              await supabase.from('extraction_logs').insert({
                session_id: sessionId, tipo: 'info',
                mensagem: `⏳ Processando... (${Math.floor(attempts * 5 / 60)}min)`
              });
            }
          }

          if (runStatus !== 'SUCCEEDED') throw new Error(`Maps scraper status: ${runStatus}`);

          const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyKey}`);
          const results = await dataRes.json();

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

          // Insert in batches
          for (let i = 0; i < leads.length; i += 500) {
            const batch = leads.slice(i, i + 500);
            const { error: insertError } = await supabase.from('leads').insert(batch);
            if (insertError) throw insertError;
          }
          leadsCount = leads.length;
        }
      }

      await supabase.from('extraction_logs').insert({
        session_id: sessionId, tipo: 'success',
        mensagem: `🎉 Extração concluída! ${leadsCount} resultados salvos.`
      });
    }

    // Final log
    await supabase.from('extraction_logs').insert({
      session_id: sessionId, tipo: 'success',
      mensagem: `🎉 Total: ${leadsCount} resultados extraídos e salvos.`,
      dados: { total: leadsCount, source, searchType }
    });

    return new Response(
      JSON.stringify({ success: true, leadsCount, source }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[extract-leads] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
