import { useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LeadSearchFormProps {
  onSearch: (keyword: string, location: string) => void;
  isLoading: boolean;
}

export function LeadSearchForm({ onSearch, isLoading }: LeadSearchFormProps) {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword && location) {
      onSearch(keyword, location);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl p-6 shadow-card border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Buscar Leads no Google Maps</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="keyword" className="text-sm font-medium">
            Palavra-chave
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="keyword"
              placeholder="Ex: Pizzaria, Escritório Advocacia"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="location" className="text-sm font-medium">
            Localização
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="location"
              placeholder="Ex: São Paulo, SP"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-end md:col-span-2 lg:col-span-2 gap-3">
          <Button
            type="submit"
            size="lg"
            className="flex-1"
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
                Iniciar Extração
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
