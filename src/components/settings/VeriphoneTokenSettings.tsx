import { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Save, ShieldCheck } from 'lucide-react';

function normalizeToken(rawToken: string): string {
  return rawToken
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function VeriphoneTokenSettings() {
  const { profile, loading, updateProfile } = useProfile();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasExistingToken = !!profile?.veriphone_api_key;

  const handleSave = async () => {
    const cleanToken = normalizeToken(token);

    if (!cleanToken) {
      toast.error('Digite uma API key válida do Veriphone');
      return;
    }

    setIsSaving(true);
    const { error } = await updateProfile({ veriphone_api_key: cleanToken });

    if (error) {
      toast.error('Erro ao salvar a API key do Veriphone');
    } else {
      toast.success('API key do Veriphone atualizada! As próximas verificações usarão esta conta.');
      setToken('');
    }

    setIsSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          API Key Veriphone
        </CardTitle>
        <CardDescription>
          Troque a conta do Veriphone sem alterar Secrets no Supabase. A chave salva aqui tem prioridade nas próximas verificações.
          {hasExistingToken && (
            <span className="mt-2 block text-green-600 dark:text-green-400">
              Veriphone configurado para sua conta.
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="veriphone-token">
            {hasExistingToken ? 'Trocar API Key' : 'API Key'}
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="veriphone-token"
                type={showToken ? 'text' : 'password'}
                placeholder={hasExistingToken ? '••••••••••••••••' : 'Cole a API key da nova conta'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={loading || isSaving}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowToken(!showToken)}
                aria-label={showToken ? 'Ocultar API key' : 'Mostrar API key'}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>

            <Button onClick={handleSave} disabled={loading || isSaving || !token.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Quando os créditos da conta atual estiverem acabando, cole aqui a chave da outra conta e salve.
          Não é necessário redeployar o site.
        </p>

        <p className="text-sm text-muted-foreground">
          Gerencie suas chaves em{' '}
          <a
            href="https://veriphone.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            veriphone.io
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
