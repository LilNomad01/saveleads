import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parsePhoneNumberFromString } from "https://esm.sh/libphonenumber-js@1.11.20/max";

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

type PhoneAnalysis = {
  ok: boolean;
  valid: boolean;
  e164?: string | null;
  country?: string | null;
  type?: string | null;
  rawType?: string | null;
  carrier?: string | null;
  provider: "veriphone" | "libphonenumber";
  error?: string | null;
};

function normalizeCandidate(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const raw = String(phone).trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;

  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function mapLocalType(rawType: string | undefined): string {
  switch (rawType) {
    case "MOBILE":
      return "mobile";
    case "FIXED_LINE":
      return "landline";
    case "VOIP":
      return "nonFixedVoip";
    case "FIXED_LINE_OR_MOBILE":
      return "unknown";
    default:
      return "unknown";
  }
}

function localAnalyze(phone: string | null | undefined): PhoneAnalysis {
  const candidate = normalizeCandidate(phone);
  if (!candidate) {
    return {
      ok: true,
      valid: false,
      provider: "libphonenumber",
      error: "Número inválido ou fora do padrão internacional",
    };
  }

  try {
    const parsed = parsePhoneNumberFromString(candidate);
    if (!parsed || !parsed.isValid()) {
      return {
        ok: true,
        valid: false,
        e164: parsed?.number || candidate,
        country: parsed?.country || null,
        provider: "libphonenumber",
        error: "Formato ou faixa de numeração inválida",
      };
    }

    const rawType = parsed.getType();
    return {
      ok: true,
      valid: true,
      e164: parsed.number,
      country: parsed.country || null,
      type: mapLocalType(rawType),
      rawType: rawType || null,
      carrier: null,
      provider: "libphonenumber",
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      valid: false,
      provider: "libphonenumber",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function mapVeriphoneType(rawType: string | null | undefined): string {
  const type = String(rawType || "").toLowerCase();
  if (type === "mobile") return "mobile";
  if (type === "fixed_line" || type === "landline") return "landline";
  if (type === "voip") return "nonFixedVoip";
  if (type === "fixed_line_or_mobile") return "unknown";
  return "unknown";
}

async function lookupVeriphone(
  phone: string,
  apiKey: string,
): Promise<PhoneAnalysis> {
  const url = `https://api.veriphone.io/v3/verify?phone=${encodeURIComponent(phone)}&mode=static`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null);

      if (response.ok && payload?.status === "success") {
        return {
          ok: true,
          valid: payload?.phone_valid === true,
          e164: payload?.e164 || payload?.phone || phone,
          country: payload?.country_code || null,
          type: mapVeriphoneType(payload?.phone_type),
          rawType: payload?.phone_type || null,
          carrier: payload?.carrier || null,
          provider: "veriphone",
          error: payload?.phone_valid === false
            ? String(payload?.reason || "Número inválido")
            : null,
        };
      }

      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        await sleep(700);
        continue;
      }

      const message =
        payload?.message ||
        payload?.type ||
        `Veriphone HTTP ${response.status}`;

      return {
        ok: false,
        valid: false,
        provider: "veriphone",
        error: String(message).slice(0, 500),
      };
    } catch (error) {
      if (attempt === 0) {
        await sleep(700);
        continue;
      }

      return {
        ok: false,
        valid: false,
        provider: "veriphone",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    ok: false,
    valid: false,
    provider: "veriphone",
    error: "Falha desconhecida no Veriphone",
  };
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

  // Free-only mode:
  // 1) libphonenumber runs locally and consumes no API credits.
  // 2) Veriphone standard lookup uses the API key saved in the user's profile first.
  // 3) If the user has not configured one, the project Secret VERIPHONE_API_KEY is
  //    used as a fallback. This lets the user switch Veriphone accounts from Settings
  //    without editing Supabase Secrets or redeploying the Edge Function.
  // 4) We only call mode=static here; no paid Current Carrier Lookup fallback is used.
  const admin = createClient(supabaseUrl, serviceRole);

  let veriphoneKey: string | null = null;
  const { data: profile } = await admin
    .from("profiles")
    .select("veriphone_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  veriphoneKey = profile?.veriphone_api_key || Deno.env.get("VERIPHONE_API_KEY") || null;

  if (veriphoneKey) {
    veriphoneKey = String(veriphoneKey)
      .trim()
      .replace(/^Bearer\\s+/i, "")
      .replace(/^[\"']|[\"']$/g, "")
      .trim();
  }

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
    veriphone: 0,
    localOnly: 0,
    ambiguous: 0,
  };

  const results: Array<Record<string, unknown>> = [];
  const source = leads || [];

  // Small waves keep within free-provider rate limits while preserving decent speed.
  for (let offset = 0; offset < source.length; offset += 5) {
    const wave = source.slice(offset, offset + 5);

    const waveResults = await Promise.all(
      wave.map(async (lead: any) => {
        const rawPhone = lead.whatsapp_numero || lead.telefone_original;
        const local = localAnalyze(rawPhone);

        if (!local.ok || !local.valid || !local.e164) {
          await admin
            .from("leads")
            .update({
              phone_lookup_status: local.ok ? "verified" : "error",
              phone_valid: false,
              phone_line_type: null,
              phone_carrier: null,
              phone_lookup_provider: "libphonenumber",
              phone_lookup_error: local.error || "Número inválido",
              phone_verified_at: new Date().toISOString(),
            })
            .eq("id", lead.id)
            .eq("user_id", user.id);

          if (local.ok) summary.invalid++;
          else summary.errors++;

          return {
            id: lead.id,
            ok: local.ok,
            valid: false,
            provider: "libphonenumber",
            error: local.error || null,
          };
        }

        let finalResult = local;
        let lookupStatus = "local";

        if (veriphoneKey) {
          const remote = await lookupVeriphone(local.e164, veriphoneKey);

          if (remote.ok) {
            finalResult = remote;
            lookupStatus = "verified";
            summary.veriphone++;
          } else {
            // Free quota exhausted / provider unavailable: keep the local result
            // and do not fall back to any paid service.
            summary.localOnly++;
            finalResult = {
              ...local,
              error: `Veriphone indisponível; validação local usada: ${remote.error || "erro desconhecido"}`,
            };
          }
        } else {
          summary.localOnly++;
        }

        const lineType = finalResult.type || "unknown";
        const isValid = finalResult.valid === true;

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
          summary.ambiguous++;
        }

        await admin
          .from("leads")
          .update({
            phone_lookup_status: lookupStatus,
            phone_valid: isValid,
            phone_line_type: lineType,
            phone_carrier: finalResult.carrier || null,
            phone_lookup_provider: finalResult.provider,
            phone_lookup_error: finalResult.error || null,
            phone_verified_at: new Date().toISOString(),
          })
          .eq("id", lead.id)
          .eq("user_id", user.id);

        return {
          id: lead.id,
          ok: true,
          valid: isValid,
          type: lineType,
          rawType: finalResult.rawType || null,
          carrier: finalResult.carrier || null,
          provider: finalResult.provider,
          lookupStatus,
        };
      }),
    );

    results.push(...waveResults);

    if (veriphoneKey && offset + 5 < source.length) {
      await sleep(150);
    }
  }

  return json(200, {
    success: true,
    mode: veriphoneKey ? "free_veriphone_plus_local" : "local_only",
    summary,
    results,
    notice: veriphoneKey
      ? "Verificação gratuita: Veriphone (modo static) + libphonenumber. Nenhum fallback pago é utilizado."
      : "VERIPHONE_API_KEY não configurada: somente libphonenumber local foi utilizado. Nos EUA, ele não confirma com segurança se uma linha é móvel nem se recebe SMS.",
  });
});
