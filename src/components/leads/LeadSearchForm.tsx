import { useState } from "react";
import { Search, MapPin, Loader2, Settings2 } from "lucide-react";
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

interface LeadSearchFormProps {
  onSearch: (keyword: string, location: string, apiProvider: 'apify' | 'mock', maxResults: number) => void;
  isLoading: boolean;
}

export function LeadSearchForm({ onSearch, isLoading }: LeadSearchFormProps) {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [apiProvider, setApiProvider] = useState<'apify' | 'mock'>('apify');
  const [maxResults, setMaxResults] = useState(50);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword && location) {
      onSearch(keyword, location, apiProvider, maxResults);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl p-6 shadow-card border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Buscar Leads no Google Maps</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          <span>Powered by Apify</span>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="keyword" className="text-sm font-medium">
            O que você busca?
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="keyword"
              placeholder="Ex: Pizzaria, Advocacia"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="location" className="text-sm font-medium">
            Em qual cidade/país?
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="location"
              placeholder="Ex: São Paulo, Brasil"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Fonte de Dados</Label>
          <Select value={apiProvider} onValueChange={(value) => setApiProvider(value as 'apify' | 'mock')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apify">🚀 Apify (Dados Reais)</SelectItem>
              <SelectItem value="mock">🧪 Demo (Dados Simulados)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Máx. Resultados: {maxResults}</Label>
          <Slider
            value={[maxResults]}
            onValueChange={(value) => setMaxResults(value[0])}
            min={10}
            max={200}
            step={10}
            className="mt-3"
          />
        </div>
        
        <div className="flex items-end">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isLoading || !keyword || !location}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Extraindo...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Pesquisar
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
