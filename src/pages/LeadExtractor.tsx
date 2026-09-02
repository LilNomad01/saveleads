import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LeadSearchForm, DataSource, SearchType } from "@/components/leads/LeadSearchForm";
import { LeadsTableReal } from "@/components/leads/LeadsTableReal";
import { TelegramLeadsTable } from "@/components/leads/TelegramLeadsTable";
import { LinkedinLeadsTable } from "@/components/leads/LinkedinLeadsTable";
import { ReviewsLeadsTable } from "@/components/leads/ReviewsLeadsTable";
import { ExtractionConsole } from "@/components/leads/ExtractionConsole";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Building2, CheckCircle2, Phone, Star, MessageCircle, Briefcase } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useTelegramLeads } from "@/hooks/useTelegramLeads";
import { useLinkedinLeads } from "@/hooks/useLinkedinLeads";
import { useReviewsLeads } from "@/hooks/useReviewsLeads";
import { useLeadExtraction } from "@/hooks/useLeadExtraction";
import { useExtractionLogs } from "@/hooks/useExtractionLogs";
import { Badge } from "@/components/ui/badge";

export default function LeadExtractor() {
  const { leads, isLoading: isLoadingLeads, deleteLeads, extractPhoneNumbers } = useLeads();
  const { leads: telegramLeads, isLoading: isLoadingTelegram, deleteLeads: deleteTelegramLeads } = useTelegramLeads();
  const { leads: linkedinLeads, isLoading: isLoadingLinkedin, deleteLeads: deleteLinkedinLeads } = useLinkedinLeads();
  const { leads: reviewsLeads, isLoading: isLoadingReviews, deleteLeads: deleteReviewsLeads } = useReviewsLeads();
  const { isExtracting, sessionId, startExtraction } = useLeadExtraction();
  const { logs } = useExtractionLogs(sessionId);
  const [activeTab, setActiveTab] = useState<string>("google_maps");

  const handleSearch = async (params: {
    source: DataSource;
    searchType: SearchType;
    query: string;
    location: string;
    maxResults: number;
    apiProvider: 'apify' | 'mock';
    websiteFilter: 'all' | 'without';
  }) => {
    // Switch to the tab of the source being extracted
    setActiveTab(params.source);
    
    await startExtraction(
      params.query,
      params.location,
      params.apiProvider,
      params.maxResults,
      params.source,
      params.searchType,
      params.websiteFilter
    );
  };

  const totalLeads = leads.length + telegramLeads.length + linkedinLeads.length + reviewsLeads.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Extração de Dados
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Extraia leads de múltiplas fontes: Google Maps, Telegram, Reviews, LinkedIn
            </p>
          </div>
          {isExtracting && (
            <Badge variant="outline" className="animate-pulse bg-primary/10 text-primary border-primary self-start sm:self-auto">
              <span className="mr-2 h-2 w-2 rounded-full bg-primary animate-ping" />
              Extração em andamento...
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard title="Total de Leads" value={totalLeads} description="todas as fontes" icon={Database} variant="navy" />
          <StatCard title="Google Maps" value={leads.length} description="empresas" icon={Building2} />
          <StatCard title="Telegram" value={telegramLeads.length} description="grupos/usuários" icon={MessageCircle} variant="accent" />
          <StatCard title="LinkedIn" value={linkedinLeads.length} description="perfis/empresas" icon={Briefcase} />
          <StatCard title="Reviews" value={reviewsLeads.length} description="reviews negativos" icon={Star} variant="success" />
        </div>

        {/* Search Form */}
        <LeadSearchForm onSearch={handleSearch} isLoading={isExtracting} />

        {/* Extraction Console */}
        <ExtractionConsole logs={logs} isExtracting={isExtracting} />

        {/* Results with Tabs per source */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="google_maps" className="gap-1">
              🗺️ <span className="hidden sm:inline">Google Maps</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{leads.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="telegram" className="gap-1">
              ✈️ <span className="hidden sm:inline">Telegram</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{telegramLeads.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="gap-1">
              💼 <span className="hidden sm:inline">LinkedIn</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{linkedinLeads.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="google_reviews" className="gap-1">
              ⭐ <span className="hidden sm:inline">Reviews</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{reviewsLeads.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="google_maps">
            <LeadsTableReal 
              leads={leads} 
              isLoading={isLoadingLeads} 
              onDelete={deleteLeads}
              onExtractPhones={extractPhoneNumbers}
            />
          </TabsContent>

          <TabsContent value="telegram">
            <TelegramLeadsTable
              leads={telegramLeads}
              isLoading={isLoadingTelegram}
              onDelete={deleteTelegramLeads}
            />
          </TabsContent>

          <TabsContent value="linkedin">
            <LinkedinLeadsTable
              leads={linkedinLeads}
              isLoading={isLoadingLinkedin}
              onDelete={deleteLinkedinLeads}
            />
          </TabsContent>

          <TabsContent value="google_reviews">
            <ReviewsLeadsTable
              leads={reviewsLeads}
              isLoading={isLoadingReviews}
              onDelete={deleteReviewsLeads}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
