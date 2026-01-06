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
  apiProvider?: 'serpapi' | 'outscraper' | 'mock';
}

// Função para sanitizar números brasileiros
function sanitizePhoneNumber(phone: string, ddd: string = '11'): string {
  if (!phone) return '';
  
  // Remove tudo que não é dígito
  let cleaned = phone.replace(/\D/g, '');
  
  // Se começar com 0, remove
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Se tiver só 8-9 dígitos (número local), adiciona DDD
  if (cleaned.length >= 8 && cleaned.length <= 9) {
    cleaned = ddd + cleaned;
  }
  
  // Se não tiver código do país, adiciona 55
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  
  // Valida formato final (deve ter 12 ou 13 dígitos)
  if (cleaned.length < 12 || cleaned.length > 13) {
    return '';
  }
  
  return cleaned;
}

// Função para extrair DDD da localização
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
    if (locationLower.includes(city)) {
      return ddd;
    }
  }
  return '11'; // Default SP
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { keyword, location, sessionId, apiProvider = 'mock' }: ExtractRequest = await req.json();

    console.log(`[extract-leads] Starting extraction: ${keyword} in ${location}`);

    // Log inicial
    await supabase.from('extraction_logs').insert({
      session_id: sessionId,
      tipo: 'info',
      mensagem: `🔍 Iniciando busca: "${keyword}" em "${location}"...`
    });

    const ddd = extractDDD(location);
    let leads: any[] = [];

    if (apiProvider === 'mock') {
      // Dados simulados para demonstração
      await supabase.from('extraction_logs').insert({
        session_id: sessionId,
        tipo: 'warning',
        mensagem: '⚠️ Modo demonstração ativo. Configure uma API real (SerpApi/Outscraper) para dados reais.'
      });

      // Simular delay de busca
      await new Promise(resolve => setTimeout(resolve, 1500));

      await supabase.from('extraction_logs').insert({
        session_id: sessionId,
        tipo: 'info',
        mensagem: '📍 Acessando Google Maps...'
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Gerar dados simulados baseados na busca
      const mockBusinesses = [
        { nome: `${keyword} Central`, rating: 4.5, reviews: 234 },
        { nome: `${keyword} Express`, rating: 4.2, reviews: 156 },
        { nome: `${keyword} Premium`, rating: 4.8, reviews: 89 },
        { nome: `${keyword} & Cia`, rating: 4.0, reviews: 312 },
        { nome: `${keyword} do Bairro`, rating: 4.3, reviews: 178 },
        { nome: `${keyword} Família`, rating: 4.6, reviews: 245 },
        { nome: `${keyword} Tradicional`, rating: 4.1, reviews: 423 },
        { nome: `${keyword} Gourmet`, rating: 4.7, reviews: 67 },
        { nome: `${keyword} 24h`, rating: 3.9, reviews: 534 },
        { nome: `${keyword} VIP`, rating: 4.4, reviews: 123 },
      ];

      for (let i = 0; i < mockBusinesses.length; i++) {
        const business = mockBusinesses[i];
        
        await supabase.from('extraction_logs').insert({
          session_id: sessionId,
          tipo: 'success',
          mensagem: `✅ Encontrado: ${business.nome}`,
          dados: { index: i + 1, total: mockBusinesses.length }
        });

        // Gerar número aleatório
        const celular = `9${Math.floor(10000000 + Math.random() * 90000000)}`;
        const telefoneOriginal = `(${ddd}) ${celular.substring(0, 5)}-${celular.substring(5)}`;
        const whatsappNumero = sanitizePhoneNumber(celular, ddd);

        leads.push({
          nome_empresa: business.nome,
          telefone_original: telefoneOriginal,
          whatsapp_numero: whatsappNumero,
          site: `www.${business.nome.toLowerCase().replace(/\s+/g, '').replace(/[&]/g, 'e')}.com.br`,
          endereco: `${location} - Centro`,
          categoria: keyword,
          avaliacao: business.rating,
          total_avaliacoes: business.reviews,
          status: whatsappNumero ? 'validado' : 'extraido',
          fonte: 'google_maps'
        });

        await new Promise(resolve => setTimeout(resolve, 300));
      }

    } else if (apiProvider === 'serpapi') {
      const serpApiKey = Deno.env.get('SERPAPI_KEY');
      if (!serpApiKey) {
        throw new Error('SERPAPI_KEY não configurada');
      }

      await supabase.from('extraction_logs').insert({
        session_id: sessionId,
        tipo: 'info',
        mensagem: '🔗 Conectando à SerpApi...'
      });

      const query = encodeURIComponent(`${keyword} ${location}`);
      const response = await fetch(
        `https://serpapi.com/search.json?engine=google_maps&q=${query}&api_key=${serpApiKey}&hl=pt-br`
      );
      
      const data = await response.json();
      
      if (data.local_results) {
        for (const place of data.local_results) {
          const whatsappNumero = sanitizePhoneNumber(place.phone || '', ddd);
          
          leads.push({
            nome_empresa: place.title,
            telefone_original: place.phone || '',
            whatsapp_numero: whatsappNumero,
            site: place.website || '',
            endereco: place.address || '',
            categoria: keyword,
            avaliacao: place.rating || null,
            total_avaliacoes: place.reviews || 0,
            status: whatsappNumero ? 'validado' : 'extraido',
            fonte: 'serpapi'
          });

          await supabase.from('extraction_logs').insert({
            session_id: sessionId,
            tipo: 'success',
            mensagem: `✅ Encontrado: ${place.title}`,
            dados: { phone: place.phone, rating: place.rating }
          });
        }
      }

    } else if (apiProvider === 'outscraper') {
      const outscraperKey = Deno.env.get('OUTSCRAPER_KEY');
      if (!outscraperKey) {
        throw new Error('OUTSCRAPER_KEY não configurada');
      }

      await supabase.from('extraction_logs').insert({
        session_id: sessionId,
        tipo: 'info',
        mensagem: '🔗 Conectando à Outscraper...'
      });

      const query = encodeURIComponent(`${keyword} ${location}, Brasil`);
      const response = await fetch(
        `https://api.outscraper.com/maps/search-v3?query=${query}&limit=50&language=pt`,
        {
          headers: {
            'X-API-KEY': outscraperKey
          }
        }
      );
      
      const data = await response.json();
      
      if (data.data && data.data[0]) {
        for (const place of data.data[0]) {
          const whatsappNumero = sanitizePhoneNumber(place.phone || '', ddd);
          
          leads.push({
            nome_empresa: place.name,
            telefone_original: place.phone || '',
            whatsapp_numero: whatsappNumero,
            site: place.site || '',
            endereco: place.full_address || '',
            categoria: keyword,
            avaliacao: place.rating || null,
            total_avaliacoes: place.reviews || 0,
            status: whatsappNumero ? 'validado' : 'extraido',
            fonte: 'outscraper'
          });

          await supabase.from('extraction_logs').insert({
            session_id: sessionId,
            tipo: 'success',
            mensagem: `✅ Encontrado: ${place.name}`,
            dados: { phone: place.phone, rating: place.rating }
          });
        }
      }
    }

    // Inserir leads no banco
    if (leads.length > 0) {
      const { error: insertError } = await supabase.from('leads').insert(leads);
      
      if (insertError) {
        console.error('[extract-leads] Insert error:', insertError);
        throw insertError;
      }

      await supabase.from('extraction_logs').insert({
        session_id: sessionId,
        tipo: 'success',
        mensagem: `🎉 Extração concluída! ${leads.length} leads salvos.`,
        dados: { 
          total: leads.length, 
          comWhatsApp: leads.filter(l => l.whatsapp_numero).length 
        }
      });
    } else {
      await supabase.from('extraction_logs').insert({
        session_id: sessionId,
        tipo: 'warning',
        mensagem: '⚠️ Nenhum resultado encontrado para esta busca.'
      });
    }

    console.log(`[extract-leads] Completed: ${leads.length} leads extracted`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        leadsCount: leads.length,
        leadsWithWhatsApp: leads.filter(l => l.whatsapp_numero).length
      }),
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
