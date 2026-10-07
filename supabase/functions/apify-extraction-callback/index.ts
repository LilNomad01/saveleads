import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ApiKeyRow = {
  id: string;
  key_value: string;
  label: string | null;
  disabled_until: string | null;
  last_used_at: string | null;
  priority: number | null;
};

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeApiKey(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

async function logToSession(supabase: any, sessionId: string, tipo: string, mensagem: string) {
  try {
    await supabase.from('extraction_logs').insert({ session_id: sessionId, tipo, mensagem });
  } catch (error) {
    console.error('[apify-callback] log error', error);
  }
}

function encodeApifyRunWebhooks(requestUrl: string): string {
  const webhooks = [{
    eventTypes: [
      'ACTOR.RUN.SUCCEEDED',
      'ACTOR.RUN.FAILED',
      'ACTOR.RUN.ABORTED',
      'ACTOR.RUN.TIMED_OUT',
    ],
    requestUrl,
    payloadTemplate: '{"resource":{{resource}}}',
  }];
  return btoa(JSON.stringify(webhooks));
}

async function startActor(
  actorId: string,
  input: Record<string, unknown>,
  apiKey: string,
  callbackUrl: string,
): Promise<string> {
  const webhooks = encodeApifyRunWebhooks(callbackUrl);
  const response = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?webhooks=${encodeURIComponent(webhooks)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(input),
    },
  );

  const text = await response.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* ignore */ }

  if (!response.ok) {
    throw new Error(body?.error?.message || `HTTP ${response.status}: ${text.slice(0, 250)}`);
  }

  const runId = body?.data?.id;
  if (!runId) throw new Error('Apify não retornou o ID da nova execução.');
  return runId;
}

function resolveCountry(location: string): 'BR' | 'US' | 'OTHER' {
  const normalized = String(location || '').toLowerCase();
  if (/\b(usa|united states|eua)\b/i.test(normalized) || /,\s*(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/i.test(normalized)) {
    return 'US';
  }
  if (/\b(brasil|brazil)\b/i.test(normalized)) return 'BR';
  return 'OTHER';
}

function sanitizePhoneNumber(phone: string, country: 'BR' | 'US' | 'OTHER'): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');

  if (country === 'US') {
    if (cleaned.length === 11 && cleaned.startsWith('1')) return cleaned;
    if (cleaned.length === 10) return '1' + cleaned;
    return cleaned.length >= 10 && cleaned.length <= 15 ? cleaned : '';
  }

  if (country === 'BR') {
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) return cleaned;
    if (cleaned.length === 10 || cleaned.length === 11) return '55' + cleaned;
    return cleaned.length >= 12 && cleaned.length <= 13 ? cleaned : '';
  }

  return cleaned.length >= 10 && cleaned.length <= 15 ? cleaned : '';
}

async function markKeyFailed(supabase: any, keyId: string, message: string) {
  await supabase
    .from('api_keys')
    .update({
      last_error: message.slice(0, 500),
      disabled_until: new Date(Date.now() + 60 * 60_000).toISOString(),
    })
    .eq('id', keyId);
}

async function rotateRun(supabase: any, session: any, failureMessage: string) {
  const tried = new Set<string>((session.apify_tried_key_ids || []).filter(Boolean));
  if (session.apify_key_id) tried.add(session.apify_key_id);

  if (session.apify_key_id) {
    await markKeyFailed(supabase, session.apify_key_id, failureMessage);
  }

  const { data: rows, error } = await supabase
    .from('api_keys')
    .select('id,key_value,label,disabled_until,last_used_at,priority')
    .eq('user_id', session.user_id)
    .eq('provider', 'apify')
    .eq('is_active', true)
    .order('last_used_at', { ascending: true, nullsFirst: true })
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Falha ao carregar chaves Apify: ${error.message}`);

  const now = Date.now();
  const candidates = ((rows || []) as ApiKeyRow[]).filter((row) => {
    if (tried.has(row.id)) return false;
    if (row.disabled_until && new Date(row.disabled_until).getTime() > now) return false;
    return Boolean(normalizeApiKey(row.key_value));
  });

  if (candidates.length === 0) {
    await supabase
      .from('extraction_sessions')
      .update({ status: 'error', completed_at: new Date().toISOString() })
      .eq('id', session.id);

    await logToSession(
      supabase,
      session.id,
      'error',
      '❌ Todas as chaves Apify disponíveis falharam para esta extração.'
    );
    return;
  }

  const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/apify-extraction-callback?sessionId=${encodeURIComponent(session.id)}`;
  let lastError: unknown = null;

  for (const candidate of candidates) {
    tried.add(candidate.id);

    try {
      const apiKey = normalizeApiKey(candidate.key_value);
      const runId = await startActor(
        session.apify_actor_id,
        session.apify_input || {},
        apiKey,
        callbackUrl,
      );

      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', candidate.id);

      const { error: updateError } = await supabase
        .from('extraction_sessions')
        .update({
          apify_run_id: runId,
          apify_key_id: candidate.id,
          apify_tried_key_ids: Array.from(tried),
          status: 'running',
        })
        .eq('id', session.id);

      if (updateError) throw new Error(updateError.message);

      await logToSession(
        supabase,
        session.id,
        'warning',
        `🔄 Rotação automática: ${candidate.label || 'próxima chave'} assumiu a extração. Nova execução: ${runId}.`
      );
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      await markKeyFailed(supabase, candidate.id, message);
      await logToSession(
        supabase,
        session.id,
        'warning',
        `⚠️ ${candidate.label || 'Chave Apify'} também falhou ao iniciar. Tentando a próxima.`
      );
    }
  }

  await supabase
    .from('extraction_sessions')
    .update({ status: 'error', completed_at: new Date().toISOString() })
    .eq('id', session.id);

  await logToSession(
    supabase,
    session.id,
    'error',
    `❌ Não foi possível continuar a extração: ${lastError instanceof Error ? lastError.message : String(lastError || 'sem chave disponível')}`
  );
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return json({ ok: false, error: 'Server configuration missing' }, 500);

  const supabase = createClient(supabaseUrl, serviceRole);
  const sessionId = new URL(req.url).searchParams.get('sessionId');
  if (!sessionId) return json({ ok: false, error: 'Missing sessionId' }, 400);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const resource = payload?.resource || {};
  const runId = String(resource?.id || '');
  const status = String(resource?.status || '');

  if (!runId || !status) return json({ ok: false, error: 'Missing Apify run data' }, 400);

  const { data: session, error: sessionError } = await supabase
    .from('extraction_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError || !session) return json({ ok: true, ignored: 'session_not_found' });

  // Ignore stale/retried webhooks from runs that are no longer the active attempt.
  if (session.apify_run_id !== runId) {
    return json({ ok: true, ignored: 'stale_run' });
  }

  if (session.status === 'completed') {
    return json({ ok: true, ignored: 'already_completed' });
  }

  if (status !== 'SUCCEEDED') {
    const failureMessage = `Apify run ${runId} terminou com status ${status}`;
    await logToSession(supabase, session.id, 'warning', `⚠️ ${failureMessage}. Trocando de chave...`);
    await rotateRun(supabase, session, failureMessage);
    return json({ ok: true, rotated: true });
  }

  if (!session.apify_key_id) {
    await supabase.from('extraction_sessions').update({
      status: 'error',
      completed_at: new Date().toISOString(),
    }).eq('id', session.id);
    await logToSession(supabase, session.id, 'error', '❌ Execução concluída, mas a chave Apify usada não foi encontrada.');
    return json({ ok: false, error: 'Missing key id' });
  }

  const { data: keyRow, error: keyError } = await supabase
    .from('api_keys')
    .select('id,key_value,label')
    .eq('id', session.apify_key_id)
    .maybeSingle();

  if (keyError || !keyRow) {
    await supabase.from('extraction_sessions').update({
      status: 'error',
      completed_at: new Date().toISOString(),
    }).eq('id', session.id);
    await logToSession(supabase, session.id, 'error', '❌ Chave Apify da execução não está mais disponível.');
    return json({ ok: false, error: 'Key not found' });
  }

  const apiKey = normalizeApiKey(keyRow.key_value);
  const datasetId = String(resource?.defaultDatasetId || '');
  if (!datasetId) {
    await supabase.from('extraction_sessions').update({
      status: 'error',
      completed_at: new Date().toISOString(),
    }).eq('id', session.id);
    await logToSession(supabase, session.id, 'error', '❌ Apify concluiu sem informar o dataset de resultados.');
    return json({ ok: false, error: 'Missing dataset id' });
  }

  const datasetRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&limit=10000`,
    { headers: { 'Authorization': `Bearer ${apiKey}` } },
  );

  if (!datasetRes.ok) {
    const body = await datasetRes.text();
    await logToSession(supabase, session.id, 'error', `❌ Falha ao baixar resultados da Apify: HTTP ${datasetRes.status}.`);
    return json({ ok: false, error: body.slice(0, 250) }, 500);
  }

  const results = await datasetRes.json();
  const rawResults = Array.isArray(results) ? results : [];
  const websiteFilter = session.website_filter || 'all';
  const filtered = websiteFilter === 'without'
    ? rawResults.filter((place: any) => !String(place.website || '').trim())
    : rawResults;
  const selected = filtered.slice(0, Number(session.requested_max_results || 100));
  const country = resolveCountry(session.location || '');

  const leads = selected.map((place: any) => {
    const phoneRaw = place.phone || place.phoneUnformatted || '';
    const whatsappNumero = sanitizePhoneNumber(phoneRaw, country);
    return {
      nome_empresa: place.title || place.name || '',
      telefone_original: phoneRaw,
      whatsapp_numero: whatsappNumero,
      site: String(place.website || '').trim(),
      endereco: place.address || place.street || '',
      cidade: session.location || '',
      extraction_session_id: session.id,
      categoria: place.categoryName || session.query,
      avaliacao: place.totalScore || place.rating || null,
      total_avaliacoes: place.reviewsCount || place.reviews || 0,
      status: whatsappNumero ? 'validado' : 'extraido',
      fonte: 'apify',
      user_id: session.user_id,
    };
  });

  // Idempotency for webhook retries.
  const { count: existingCount } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('extraction_session_id', session.id);

  if (!existingCount && leads.length > 0) {
    for (let i = 0; i < leads.length; i += 500) {
      const { error: insertError } = await supabase
        .from('leads')
        .insert(leads.slice(i, i + 500));

      if (insertError) {
        await logToSession(supabase, session.id, 'error', `❌ Erro ao salvar lote de leads: ${insertError.message}`);
        return json({ ok: false, error: insertError.message }, 500);
      }
    }
  }

  const finalCount = existingCount || leads.length;

  await supabase
    .from('api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      last_error: null,
      disabled_until: null,
    })
    .eq('id', keyRow.id);

  await supabase
    .from('extraction_sessions')
    .update({
      status: 'completed',
      leads_count: finalCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  await logToSession(
    supabase,
    session.id,
    'success',
    `🎉 Extração concluída! ${finalCount} resultados salvos.`
  );
  await logToSession(
    supabase,
    session.id,
    'success',
    `🎉 Total: ${finalCount} resultados extraídos e salvos.`
  );

  return json({ ok: true, leadsCount: finalCount });
});
