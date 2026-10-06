import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2, Plus, RotateCw, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type Provider = 'apify' | 'veriphone';

interface ApiKeyRow {
  id: string;
  user_id: string;
  provider: Provider;
  label: string | null;
  key_value: string;
  is_active: boolean;
  priority: number;
  last_used_at: string | null;
  last_error: string | null;
  disabled_until: string | null;
  created_at: string;
}

function normalizeKey(raw: string) {
  return raw
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

function maskKey(value: string) {
  const clean = normalizeKey(value);
  if (clean.length <= 8) return '••••••••';
  return `••••••••••••${clean.slice(-6)}`;
}

function formatDate(value: string | null) {
  if (!value) return 'Nunca usada';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ApiKeyPoolSettings() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [apifyInput, setApifyInput] = useState('');
  const [veriphoneInput, setVeriphoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingProvider, setSavingProvider] = useState<Provider | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('provider', { ascending: true })
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setKeys((data || []) as ApiKeyRow[]);
    } catch (error: any) {
      toast.error('Erro ao carregar chaves: ' + (error?.message || 'erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const grouped = useMemo(() => ({
    apify: keys.filter((item) => item.provider === 'apify'),
    veriphone: keys.filter((item) => item.provider === 'veriphone'),
  }), [keys]);

  const addKeys = async (provider: Provider) => {
    if (!user) return;

    const input = provider === 'apify' ? apifyInput : veriphoneInput;
    const parsed = Array.from(
      new Set(
        input
          .split(/[\n,;]+/)
          .map(normalizeKey)
          .filter(Boolean)
      )
    );

    if (parsed.length === 0) {
      toast.error('Cole pelo menos uma chave válida.');
      return;
    }

    const existing = new Set(
      keys
        .filter((item) => item.provider === provider)
        .map((item) => normalizeKey(item.key_value))
    );

    const newKeys = parsed.filter((key) => !existing.has(key));
    if (newKeys.length === 0) {
      toast.info('Essas chaves já estão cadastradas.');
      return;
    }

    setSavingProvider(provider);
    try {
      const baseIndex = grouped[provider].length;
      const rows = newKeys.map((key, index) => ({
        user_id: user.id,
        provider,
        label: `${provider === 'apify' ? 'Apify' : 'Veriphone'} ${baseIndex + index + 1}`,
        key_value: key,
        is_active: true,
        priority: 100 + baseIndex + index,
      }));

      const { error } = await supabase.from('api_keys').insert(rows);
      if (error) throw error;

      if (provider === 'apify') setApifyInput('');
      else setVeriphoneInput('');

      toast.success(`${newKeys.length} chave(s) adicionada(s) à rotação automática.`);
      await fetchKeys();
    } catch (error: any) {
      toast.error('Erro ao adicionar chaves: ' + (error?.message || 'erro desconhecido'));
    } finally {
      setSavingProvider(null);
    }
  };

  const toggleKey = async (key: ApiKeyRow, active: boolean) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({
          is_active: active,
          ...(active ? { disabled_until: null, last_error: null } : {}),
        })
        .eq('id', key.id);

      if (error) throw error;
      await fetchKeys();
    } catch (error: any) {
      toast.error('Erro ao atualizar chave: ' + (error?.message || 'erro desconhecido'));
    }
  };

  const removeKey = async (key: ApiKeyRow) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', key.id);

      if (error) throw error;
      toast.success('Chave removida da rotação.');
      await fetchKeys();
    } catch (error: any) {
      toast.error('Erro ao remover chave: ' + (error?.message || 'erro desconhecido'));
    }
  };

  const renderProvider = (provider: Provider) => {
    const title = provider === 'apify' ? 'Apify — Extração' : 'Veriphone — Verificação de números';
    const description = provider === 'apify'
      ? 'As extrações usam automaticamente uma chave disponível e trocam para a próxima se houver erro de autenticação, limite, créditos ou rate limit.'
      : 'A verificação dos telefones distribui as consultas entre as chaves ativas e troca automaticamente quando uma chave ficar sem cota ou limitada.';
    const input = provider === 'apify' ? apifyInput : veriphoneInput;
    const setInput = provider === 'apify' ? setApifyInput : setVeriphoneInput;
    const providerKeys = grouped[provider];

    return (
      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="space-y-2">
          <Label>
            Adicionar várias chaves
          </Label>
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Cole uma chave por linha"
            className="min-h-[100px] font-mono text-xs"
            autoComplete="off"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Uma por linha. As chaves não aparecem completas depois de salvas.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => addKeys(provider)}
              disabled={savingProvider === provider || !input.trim()}
            >
              {savingProvider === provider ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center py-4 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : providerKeys.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Nenhuma chave cadastrada no pool. O sistema ainda pode usar a chave antiga/Secret como fallback.
            </p>
          ) : (
            providerKeys.map((key, index) => {
              const temporarilyDisabled = !!key.disabled_until && new Date(key.disabled_until) > new Date();

              return (
                <div
                  key={key.id}
                  className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">
                        {key.label || `Chave ${index + 1}`}
                      </span>
                      <Badge variant={key.is_active && !temporarilyDisabled ? 'default' : 'secondary'}>
                        {temporarilyDisabled ? 'Pausada automaticamente' : key.is_active ? 'Ativa' : 'Desativada'}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {maskKey(key.key_value)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Último uso: {formatDate(key.last_used_at)}
                      {key.last_error ? ` • último aviso: ${key.last_error.slice(0, 100)}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <Switch
                      checked={key.is_active}
                      onCheckedChange={(checked) => toggleKey(key, checked)}
                      aria-label="Ativar ou desativar chave"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeKey(key)}
                      aria-label="Remover chave"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCw className="h-5 w-5" />
          Rotação automática de API Keys
        </CardTitle>
        <CardDescription>
          Cadastre várias contas. O SaveLeads escolhe e alterna as chaves automaticamente sem interromper a extração ou a verificação dos números.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-2">
        {renderProvider('apify')}
        {renderProvider('veriphone')}
        <div className="lg:col-span-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground flex gap-2">
          <KeyRound className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Se uma chave falhar por autenticação, cota/créditos ou rate limit, ela é colocada em espera e o sistema tenta a próxima chave ativa. Erros gerais do provedor não são mascarados pela rotação.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
