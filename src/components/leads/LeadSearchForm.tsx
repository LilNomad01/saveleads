import { useState } from "react";
import { Search, MapPin, Loader2, Database, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export type DataSource = 'google_maps' | 'telegram' | 'google_reviews' | 'linkedin';
export type SearchType = 'empresas' | 'grupos' | 'reviews_negativas' | 'usuarios' | 'perfis' | 'empresas_linkedin';
export interface ReputationFilters {
  minRating: number;
  maxRating: number;
  minReviews: number;
  maxReviews: number | null;
  negativeReviewMaxRating: 1 | 2;
  requirePhone: boolean;
}

const sourceConfig: Record<DataSource, { label: string; emoji: string; searchTypes: { value: SearchType; label: string }[] }> = {
  google_maps: {
    label: 'Google Maps',
    emoji: '🗺️',
    searchTypes: [
      { value: 'empresas', label: 'Empresas' },
    ]
  },
  telegram: {
    label: 'Telegram',
    emoji: '✈️',
    searchTypes: [
      { value: 'grupos', label: 'Grupos' },
      { value: 'usuarios', label: 'Usuários' },
    ]
  },
  google_reviews: {
    label: 'Google Reviews',
    emoji: '⭐',
    searchTypes: [
      { value: 'reviews_negativas', label: 'Reviews Negativas (≤2★)' },
      { value: 'empresas', label: 'Empresas' },
    ]
  },
  linkedin: {
    label: 'LinkedIn',
    emoji: '💼',
    searchTypes: [
      { value: 'perfis', label: 'Perfis / Pessoas' },
      { value: 'empresas_linkedin', label: 'Empresas' },
    ]
  }
};

interface LeadSearchFormProps {
  onSearch: (params: {
    source: DataSource;
    searchType: SearchType;
    query: string;
    location: string;
    maxResults: number;
    apiProvider: 'apify' | 'mock';
    websiteFilter: 'all' | 'without';
    reputationFilters: ReputationFilters;
  }) => void;
  isLoading: boolean;
}

export function LeadSearchForm({ onSearch, isLoading }: LeadSearchFormProps) {
  const [source, setSource] = useState<DataSource>('google_maps');
  const [searchType, setSearchType] = useState<SearchType>('empresas');
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState(1000);
  const [apiProvider, setApiProvider] = useState<'apify' | 'mock'>('apify');
  const [websiteFilter, setWebsiteFilter] = useState<'all' | 'without'>('all');
  const [minRating, setMinRating] = useState(3.8);
  const [maxRating, setMaxRating] = useState(4.4);
  const [minReviews, setMinReviews] = useState(10);
  const [maxReviews, setMaxReviews] = useState('');
  const [negativeReviewMaxRating, setNegativeReviewMaxRating] = useState<1 | 2>(2);
  const [requirePhone, setRequirePhone] = useState(true);
  const isReputationSource = source === 'google_maps' || source === 'google_reviews';

  const currentConfig = sourceConfig[source];
  const showLocation = source !== 'telegram' && source !== 'linkedin';

  const handleSourceChange = (newSource: DataSource) => {
    setSource(newSource);
    setSearchType(sourceConfig[newSource].searchTypes[0].value);
    if (newSource !== 'google_maps') {
      setWebsiteFilter('all');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalQuery = query.trim();
    let finalLocation = location.trim();

    // Protect against accidentally swapping fields such as
    // Query="Raleigh, NC" and Location="Electrician".
    if (source === 'google_maps' || source === 'google_reviews') {
      const queryLooksLikeUsLocation = /,\s*[A-Za-z]{2}(?:\s*,?\s*(?:USA|US))?\s*$/i.test(finalQuery);
      const locationLooksLikeUsLocation = /,\s*[A-Za-z]{2}(?:\s*,?\s*(?:USA|US))?\s*$/i.test(finalLocation);

      if (queryLooksLikeUsLocation && finalLocation && !locationLooksLikeUsLocation) {
        const previousQuery = finalQuery;
        finalQuery = finalLocation;
        finalLocation = previousQuery;
        setQuery(finalQuery);
        setLocation(finalLocation);
        toast.info('Query e localização pareciam invertidas. Corrigi automaticamente antes da extração.');
      }
    }

    if (isReputationSource) {
      const reviewMax = maxReviews.trim() === '' ? null : Number(maxReviews);
      if (!Number.isFinite(minRating) || !Number.isFinite(maxRating) || minRating < 1 || maxRating > 5 || minRating > maxRating) {
        toast.error('Defina um intervalo de estrelas entre 1 e 5.');
        return;
      }
      if (!Number.isInteger(minReviews) || minReviews < 0 || (reviewMax !== null && (!Number.isInteger(reviewMax) || reviewMax < minReviews))) {
        toast.error('Confira o mínimo e máximo de avaliações.');
        return;
      }
    }
    if (finalQuery) {
      onSearch({
        source, searchType, query: finalQuery, location: finalLocation, maxResults,
        apiProvider: isReputationSource ? 'apify' : apiProvider,
        websiteFilter,
        reputationFilters: {
          minRating, maxRating, minReviews,
          maxReviews: maxReviews.trim() === '' ? null : Number(maxReviews),
          negativeReviewMaxRating, requirePhone,
        }
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl p-4 sm:p-6 shadow-card border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Extrair Dados
        </h3>
        <Select value={isReputationSource ? 'apify' : apiProvider} onValueChange={(v) => setApiProvider(v as 'apify' | 'mock')}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apify">🚀 API Real (Apify)</SelectItem>
            {!isReputationSource && <SelectItem value="mock">🧪 Demo (Simulado)</SelectItem>}
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
        {/* Fonte de dados */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Fonte de Dados</Label>
          <Select value={source} onValueChange={(v) => handleSourceChange(v as DataSource)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="google_maps">🗺️ Google Maps</SelectItem>
              <SelectItem value="telegram">✈️ Telegram</SelectItem>
              <SelectItem value="google_reviews">⭐ Google Reviews</SelectItem>
              <SelectItem value="linkedin">💼 LinkedIn</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tipo de busca */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Tipo de Busca</Label>
          <Select value={searchType} onValueChange={(v) => setSearchType(v as SearchType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currentConfig.searchTypes.map(st => (
                <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Query */}
        <div className="space-y-2">
          <Label htmlFor="query" className="text-sm font-medium">Query de Busca</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="query"
              placeholder={source === 'telegram' ? 'Ex: Marketing Digital' : source === 'linkedin' ? 'Ex: CEO, Marketing Manager' : 'Ex: Clínica estética'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        {/* Localização */}
        <div className="space-y-2">
          <Label htmlFor="location" className="text-sm font-medium">
            Localização {!showLocation && <span className="text-muted-foreground">(opcional)</span>}
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="location"
              placeholder="Ex: São Paulo, Brasil"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-10"
              disabled={source === 'telegram' || source === 'linkedin'}
            />
          </div>
        </div>
        
        {/* Máx resultados */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Máx. Resultados: {maxResults}</Label>
          <Slider
            value={[maxResults]}
            onValueChange={(value) => setMaxResults(value[0])}
            min={100}
            max={10000}
            step={100}
            className="mt-3"
          />
          <Input
            type="number"
            min={100}
            max={10000}
            step={100}
            value={maxResults}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value)) {
                setMaxResults(Math.min(10000, Math.max(100, value)));
              }
            }}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground">
            Até 10.000 por extração. Os leads anteriores continuam acumulados.
          </p>
        </div>

        {/* Filtro de website (Google Maps) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Filtro de Site</Label>
          <Select
            value={websiteFilter}
            onValueChange={(value) => setWebsiteFilter(value as 'all' | 'without')}
            disabled={source !== 'google_maps'}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              <SelectItem value="without">🚫 Somente sem site</SelectItem>
            </SelectContent>
          </Select>
          {source === 'google_maps' && websiteFilter === 'without' && (
            <p className="text-xs text-muted-foreground">
              Só salva empresas sem website cadastrado no Google Maps.
            </p>
          )}
        </div>
        
        {/* Botão */}
        <div className="flex items-end">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isLoading || !query}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2">Extraindo...</span>
              </>
            ) : (
              <>
                <Filter className="h-4 w-4" />
                <span className="ml-2">Extrair</span>
              </>
            )}
          </Button>
        </div>
      </div>
      {isReputationSource && (
        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-4">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />Filtrar por reputação
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              O filtro seleciona empresas reais antes de salvar. A busca pode consultar mais empresas do que o limite solicitado.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="minRating">Nota mínima (estrelas)</Label>
              <Input id="minRating" type="number" min={1} max={5} step="0.1" value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxRating">Nota máxima (estrelas)</Label>
              <Input id="maxRating" type="number" min={1} max={5} step="0.1" value={maxRating}
                onChange={(e) => setMaxRating(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minReviews">Mínimo de avaliações</Label>
              <Input id="minReviews" type="number" min={0} step={1} value={minReviews}
                onChange={(e) => setMinReviews(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxReviews">Máximo de avaliações (opcional)</Label>
              <Input id="maxReviews" type="number" min={0} step={1} placeholder="Sem limite" value={maxReviews}
                onChange={(e) => setMaxReviews(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Checkbox id="requirePhone" checked={requirePhone} onCheckedChange={(value) => setRequirePhone(value === true)} />
              <Label htmlFor="requirePhone">Somente com telefone</Label>
            </div>
          </div>
          {source === 'google_reviews' && searchType === 'reviews_negativas' && (
            <div className="mt-4 space-y-2 sm:max-w-[300px]">
              <Label>Notas das avaliações individuais</Label>
              <Select value={String(negativeReviewMaxRating)}
                onValueChange={(value) => setNegativeReviewMaxRating(value === '1' ? 1 : 2)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Somente reviews de 1 estrela</SelectItem>
                  <SelectItem value="2">Reviews de 1 e 2 estrelas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
