import { useState } from "react";
import { Search, MapPin, Loader2, Database, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export type DataSource = 'google_maps' | 'telegram' | 'google_reviews' | 'linkedin';
export type SearchType = 'empresas' | 'grupos' | 'reviews_negativas' | 'usuarios' | 'perfis' | 'empresas_linkedin';

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
  }) => void;
  isLoading: boolean;
}

export function LeadSearchForm({ onSearch, isLoading }: LeadSearchFormProps) {
  const [source, setSource] = useState<DataSource>('google_maps');
  const [searchType, setSearchType] = useState<SearchType>('empresas');
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState(100);
  const [apiProvider, setApiProvider] = useState<'apify' | 'mock'>('apify');
  const [websiteFilter, setWebsiteFilter] = useState<'all' | 'without'>('all');

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
    if (query) {
      onSearch({ source, searchType, query, location, maxResults, apiProvider, websiteFilter });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl p-4 sm:p-6 shadow-card border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Extrair Dados
        </h3>
        <Select value={apiProvider} onValueChange={(v) => setApiProvider(v as 'apify' | 'mock')}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apify">🚀 API Real (Apify)</SelectItem>
            <SelectItem value="mock">🧪 Demo (Simulado)</SelectItem>
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
            max={5000}
            step={100}
            className="mt-3"
          />
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
    </form>
  );
}
