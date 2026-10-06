import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

type LookupResult = {
  ok: boolean;
  valid?: boolean;
  type?: string | null;
  carrier?: string | null;
  error?: string | null;
};

async function lookupPhone(
  phone: string,
  username: string,
  password: string,
): Promise<LookupResult> {
  const url =
    `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=line_type_intelligence`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${btoa(`${username}:${password}`)}`,
          Accept: "application/json",
        },
      });

      const bodyText = await response.text();
      let payload: any = null;
      try {
        payload = JSON.parse(bodyText);
      } catch {
        payload = null;
      }

      if (response.ok) {
        const lineType = payload?.line_type_intelligence ?? {};
        return {
          ok: true,
          valid: payload?.valid === true,
          type: lineType?.type ?? null,
          carrier: lineType?.carrier_name ?? null,
          error: lineType?.error_code ? String(lineType.error_code) : null,
        };
      }

      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        await sleep(700);
        continue;
      }

      const message =
        payload?.message ||
        payload?.detail ||
        `Twilio Lookup HTTP ${response.status}`;
      return { ok: false, error: String(message).slice(0, 500) };
    } catch (error) {
      if (attempt === 0) {
        await sleep(700);
        continue;
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return { ok: false, error: "Falha desconhecida no Twilio Lookup" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { success: false, error: "Método não permitido" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRole) {
    return json(500, {
      success: false,
      error: "Configuração interna do Supabase incompleta",
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json(401, { success: false, error: "Sessão não autenticada" });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return json(401, { success: false, error: "Sessão inválida ou expirada" });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: "Body JSON inválido" });
  }

  const leadIds = Array.from(
    new Set(
      (Array.isArray(body?.leadIds) ? body.leadIds : [])
        .map((id: unknown) => String(id || "").trim())
        .filter(Boolean),
    ),
  );

  if (leadIds.length === 0) {
    return json(400, { success: false, error: "Nenhum lead selecionado" });
  }

  if (leadIds.length > 50) {
    return json(400, {
      success: false,
      error: "Máximo de 50 leads por consulta. O site envia em lotes automaticamente.",
    });
  }

  // Prefer restricted API keys in production. Account SID/Auth Token remains
  // supported as a fallback for accounts that have not created an API Key yet.
  const apiKey = Deno.env.get("TWILIO_API_KEY");
  const apiSecret = Deno.env.get("TWILIO_API_SECRET");
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  const username = apiKey || accountSid;
  const password = apiSecret || authToken;

  if (!username || !password) {
    return json(200, {
      success: false,
      code: "TWILIO_NOT_CONFIGURED",
      error:
        "Twilio Lookup não configurado. Adicione TWILIO_API_KEY + TWILIO_API_SECRET (recomendado) ou TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN nos Secrets do Supabase.",
    });
  }

  const admin = createClient(supabaseUrl, serviceRole);

  const { data: leads, error: leadsError } = await admin
    .from("leads")
    .select("id, whatsapp_numero, telefone_original")
    .in("id", leadIds)
    .eq("user_id", user.id);

  if (leadsError) {
    return json(500, {
      success: false,
      error: `Erro ao carregar leads: ${leadsError.message}`,
    });
  }

  const summary = {
    requested: leadIds.length,
    found: leads?.length || 0,
    mobile: 0,
    landline: 0,
    voip: 0,
    other: 0,
    invalid: 0,
    errors: 0,
  };

  const results: Array<Record<string, unknown>> = [];

  // Small waves reduce the chance of rate limiting while keeping the UI fast.
  const source = leads || [];
  for (let offset = 0; offset < source.length; offset += 10) {
    const wave = source.slice(offset, offset + 10);

    const waveResults = await Promise.all(
      wave.map(async (lead: any) => {
        const e164 = toE164(lead.whatsapp_numero || lead.telefone_original);

        if (!e164) {
          const update = {
            phone_lookup_status: "verified",
            phone_valid: false,
            phone_line_type: null,
            phone_carrier: null,
            phone_lookup_error: "Número inválido ou fora do padrão E.164",
            phone_verified_at: new Date().toISOString(),
          };

          await admin.from("leads").update(update).eq("id", lead.id).eq("user_id", user.id);
          summary.invalid++;
          return { id: lead.id, ok: true, valid: false, type: null };
        }

        const lookup = await lookupPhone(e164, username, password);

        if (!lookup.ok) {
          await admin
            .from("leads")
            .update({
              phone_lookup_status: "error",
              phone_lookup_error: lookup.error || "Erro no Twilio Lookup",
              phone_verified_at: new Date().toISOString(),
            })
            .eq("id", lead.id)
            .eq("user_id", user.id);

          summary.errors++;
          return { id: lead.id, ok: false, error: lookup.error };
        }

        const lineType = lookup.type || "unknown";
        const isValid = lookup.valid === true;

        if (!isValid) {
          summary.invalid++;
        } else if (lineType === "mobile") {
          summary.mobile++;
        } else if (lineType === "landline") {
          summary.landline++;
        } else if (lineType === "fixedVoip" || lineType === "nonFixedVoip") {
          summary.voip++;
        } else {
          summary.other++;
        }

        await admin
          .from("leads")
          .update({
            phone_lookup_status: "verified",
            phone_valid: isValid,
            phone_line_type: lineType,
            phone_carrier: lookup.carrier || null,
            phone_lookup_error: lookup.error || null,
            phone_verified_at: new Date().toISOString(),
          })
          .eq("id", lead.id)
          .eq("user_id", user.id);

        return {
          id: lead.id,
          ok: true,
          valid: isValid,
          type: lineType,
          carrier: lookup.carrier || null,
        };
      }),
    );

    results.push(...waveResults);
  }

  return json(200, { success: true, summary, results });
});
