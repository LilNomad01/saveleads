import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ApiTokenSettings } from '@/components/settings/ApiTokenSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, User, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  useEffect(() => {
    if (!user && !authLoading) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Erro ao sair');
    } else {
      toast.success('Até logo!');
      navigate('/auth');
    }
  };

  if (authLoading || profileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie sua conta e integrações</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Perfil
              </CardTitle>
              <CardDescription>Informações da sua conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{profile?.full_name || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">E-mail</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair da conta
              </Button>
            </CardContent>
          </Card>

          {/* API Token Settings */}
          <ApiTokenSettings />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
