import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLeads } from "@/hooks/useLeads";
import { detectPhoneType, formatWhatsAppLink } from "@/lib/phoneUtils";
import { MessageCircle, Search, Building2, MapPin, Star, ExternalLink, Phone, ArrowLeft } from "lucide-react";

const WhatsAppExport = () => {
  const navigate = useNavigate();
  const { leads, isLoading } = useLeads();
  const [searchTerm, setSearchTerm] = useState("");

  // Filter only mobile numbers (WhatsApp compatible)
  const mobileLeads = useMemo(() => {
    return leads.filter(lead => {
      const phoneType = detectPhoneType(lead.whatsapp_numero || lead.telefone_original);
      return phoneType === 'mobile';
    });
  }, [leads]);

  // Apply search filter
  const filteredLeads = useMemo(() => {
    if (!searchTerm) return mobileLeads;
    
    const term = searchTerm.toLowerCase();
    return mobileLeads.filter(lead => 
      lead.nome_empresa.toLowerCase().includes(term) ||
      lead.categoria?.toLowerCase().includes(term) ||
      lead.endereco?.toLowerCase().includes(term) ||
      lead.whatsapp_numero?.includes(term) ||
      lead.telefone_original?.includes(term)
    );
  }, [mobileLeads, searchTerm]);

  const handleWhatsAppClick = (phoneNumber: string) => {
    const link = formatWhatsAppLink(phoneNumber);
    if (link) {
      window.open(link, '_blank');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Exportar WhatsApp</h1>
            <p className="text-muted-foreground">
              Clique nos botões para enviar mensagem via WhatsApp
            </p>
          </div>
        </div>

        {/* Stats Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Números Móveis Disponíveis</CardTitle>
                  <CardDescription>
                    {filteredLeads.length} de {mobileLeads.length} números WhatsApp
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-1">
                {mobileLeads.length} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por empresa, categoria, endereço ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Phone className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum número móvel encontrado</h3>
              <p className="text-muted-foreground text-center mt-2">
                {searchTerm 
                  ? "Tente ajustar sua busca" 
                  : "Extraia leads com números de celular para visualizá-los aqui"}
              </p>
            </CardContent>
          </Card>
        ) : (
          /* Leads Grid */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLeads.map((lead) => {
              const phone = lead.whatsapp_numero || lead.telefone_original;
              
              return (
                <Card key={lead.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    {/* Company Name */}
                    <div className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate" title={lead.nome_empresa}>
                          {lead.nome_empresa}
                        </h3>
                        {lead.categoria && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {lead.categoria}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Address */}
                    {lead.endereco && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{lead.endereco}</span>
                      </div>
                    )}

                    {/* Rating */}
                    {lead.avaliacao && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span>{lead.avaliacao}</span>
                        {lead.total_avaliacoes && (
                          <span className="text-muted-foreground">
                            ({lead.total_avaliacoes} avaliações)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Phone Display */}
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{phone}</span>
                    </div>

                    {/* WhatsApp Button */}
                    <Button
                      onClick={() => handleWhatsAppClick(phone!)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Enviar Mensagem
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppExport;
