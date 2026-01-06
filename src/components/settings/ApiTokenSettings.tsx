import { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Key, Loader2, Save } from 'lucide-react';

export function ApiTokenSettings() {
  const { profile, loading, updateProfile } = useProfile();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!token.trim()) {
      toast.error('Digite um token válido');
      return;
    }

    setIsSaving(true);
    const { error } = await updateProfile({ apify_api_token: token });
    
    if (error) {
      toast.error('Erro ao salvar token');
    } else {
      toast.success('Token salvo com sucesso!');
      setToken('');
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
          Configure seu token da API Apify para extrair leads do Google Maps.
          {hasExistingToken && (
            <span className="block mt-1 text-green-600 dark:text-green-400">
              ✓ Token configurado
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
