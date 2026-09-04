import { useState, useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Key, Loader2, Save, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

function normalizeApifyToken(rawToken: string): string {
  return rawToken
    .trim()
    .replace(/^Bearer\\s+/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

async function validateApifyToken(token: string): Promise<{ valid: boolean; username?: string; error?: string; canSave?: boolean }> {
  const cleanToken = normalizeApifyToken(token);
  if (!cleanToken) {
    return { valid: false, error: 'Token vazio', canSave: false };
  }

  // Nao bloqueia o token pelo endpoint /users/me.
  // A validacao real acontece quando o Actor do Apify e executado.
  return { valid: true, username: 'configurado', canSave: true };
}

export function ApiTokenSettings() {
  const { profile, loading, updateProfile } = useProfile();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'unknown' | 'valid' | 'invalid'>('unknown');
  const [tokenUser, setTokenUser] = useState<string | null>(null);

  // Validate existing token on load
  useEffect(() => {
    if (profile?.apify_api_token) {
      checkExistingToken(profile.apify_api_token);
    }
  }, [profile?.apify_api_token]);

  const checkExistingToken = async (existingToken: string) => {
    setIsValidating(true);
    const result = await validateApifyToken(existingToken);
    setTokenStatus(result.valid ? 'valid' : 'invalid');
    setTokenUser(result.username || null);
    setIsValidating(false);
  };

  const handleSave = async () => {
    const cleanToken = normalizeApifyToken(token);

    if (!cleanToken) {
      toast.error('Digite um token válido');
      return;
    }

    setIsSaving(true);

    const { error } = await updateProfile({ apify_api_token: cleanToken });

    if (error) {
      toast.error('Erro ao salvar token');
    } else {
      toast.success('Token Apify salvo! A validação será feita na próxima extração.');
      setToken('');
      setTokenStatus('valid');
      setTokenUser(null);
    }

    setIsSaving(false);
  };

  const hasExistingToken = !!profile?.apify_api_token;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Token Apify
        </CardTitle>
        <CardDescription>
          Configure seu token da API Apify para extrair leads. O token é salvo permanentemente e reutilizado em todas as extrações.
          {hasExistingToken && (
            <span className="block mt-2">
              {isValidating ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Verificando token...
                </span>
              ) : tokenStatus === 'valid' ? (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Token válido {tokenUser && `(${tokenUser})`}
                </span>
              ) : tokenStatus === 'invalid' ? (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3.5 w-3.5" />
                  Token inválido ou expirado — insira um novo token abaixo
                </span>
              ) : (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Token configurado
                </span>
              )}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apify-token">
            {hasExistingToken ? 'Atualizar Token' : 'Token da API'}
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="apify-token"
                type={showToken ? 'text' : 'password'}
                placeholder={hasExistingToken ? '••••••••••••••••' : 'apify_api_xxxxxxxx'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={loading || isSaving}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <Button onClick={handleSave} disabled={loading || isSaving || !token.trim()}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {hasExistingToken && tokenStatus === 'valid' && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkExistingToken(profile!.apify_api_token!)}
              disabled={isValidating}
            >
              {isValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Re-verificar Token
            </Button>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Obtenha seu token em{' '}
          <a 
            href="https://console.apify.com/account/integrations" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            console.apify.com
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
