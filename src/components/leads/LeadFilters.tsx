import { useState } from 'react';
import { Search, Filter, X, Smartphone, Phone as PhoneIcon, Star, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface LeadFiltersState {
  search: string;
  phoneType: 'all' | 'mobile' | 'landline' | 'none';
  status: string;
  minRating: number | null;
  hasWebsite: 'all' | 'yes' | 'no';
}

interface LeadFiltersProps {
  filters: LeadFiltersState;
  onFiltersChange: (filters: LeadFiltersState) => void;
  statusOptions: string[];
}

export const defaultFilters: LeadFiltersState = {
  search: '',
  phoneType: 'all',
  status: 'all',
  minRating: null,
  hasWebsite: 'all',
};

export function LeadFilters({ filters, onFiltersChange, statusOptions }: LeadFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFiltersCount = [
    filters.phoneType !== 'all',
    filters.status !== 'all',
    filters.minRating !== null,
    filters.hasWebsite !== 'all',
  ].filter(Boolean).length;

  const updateFilter = <K extends keyof LeadFiltersState>(key: K, value: LeadFiltersState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange(defaultFilters);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa, telefone..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Quick Filter: Phone Type */}
      <Select
        value={filters.phoneType}
        onValueChange={(value) => updateFilter('phoneType', value as LeadFiltersState['phoneType'])}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Tipo telefone" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <span className="flex items-center gap-2">
              <PhoneIcon className="h-4 w-4" />
              Todos
            </span>
          </SelectItem>
          <SelectItem value="mobile">
            <span className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-green-500" />
              Móvel (WhatsApp)
            </span>
          </SelectItem>
          <SelectItem value="landline">
            <span className="flex items-center gap-2">
              <PhoneIcon className="h-4 w-4 text-blue-500" />
              Fixo
            </span>
          </SelectItem>
          <SelectItem value="none">
            <span className="flex items-center gap-2">
              <X className="h-4 w-4 text-muted-foreground" />
              Sem telefone
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Advanced Filters */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filtros Avançados</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar
                </Button>
              )}
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) => updateFilter('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rating Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Star className="h-4 w-4" />
                Avaliação mínima
              </label>
              <Select
                value={filters.minRating?.toString() || 'all'}
                onValueChange={(value) => updateFilter('minRating', value === 'all' ? null : Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="3">3+ estrelas</SelectItem>
                  <SelectItem value="4">4+ estrelas</SelectItem>
                  <SelectItem value="4.5">4.5+ estrelas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Website Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Website</label>
              <Select
                value={filters.hasWebsite}
                onValueChange={(value) => updateFilter('hasWebsite', value as LeadFiltersState['hasWebsite'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="yes">Com website</SelectItem>
                  <SelectItem value="no">Sem website</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear All Button */}
      {(filters.search || activeFiltersCount > 0) && (
        <Button variant="ghost" size="icon" onClick={clearFilters}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
