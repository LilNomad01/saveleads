import { useEffect, useRef } from 'react';
import { Terminal, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExtractionLog } from '@/hooks/useExtractionLogs';

interface ExtractionConsoleProps {
  logs: ExtractionLog[];
  isExtracting: boolean;
}

const iconMap = {
  info: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
};

const colorMap = {
  info: 'text-blue-400',
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
};

export function ExtractionConsole({ logs, isExtracting }: ExtractionConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-slate-800 border-b border-slate-700">
        <Terminal className="h-4 w-4 text-green-400" />
        <span className="text-xs sm:text-sm font-medium text-slate-200">Console de Extração</span>
        {isExtracting && (
          <span className="ml-auto flex items-center gap-1 sm:gap-2">
            <span className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-[10px] sm:text-xs text-green-400">Extraindo...</span>
          </span>
        )}
      </div>
      
      <div 
        ref={scrollRef}
        className="h-[150px] sm:h-[200px] overflow-y-auto p-3 sm:p-4 font-mono text-xs sm:text-sm space-y-1"
      >
        {logs.length === 0 ? (
          <div className="text-slate-500 text-center py-6 sm:py-8">
            <Terminal className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs sm:text-sm">Aguardando início da extração...</p>
          </div>
        ) : (
          logs.map((log) => {
            const Icon = iconMap[log.tipo];
            return (
              <div key={log.id} className="flex items-start gap-2 animate-fadeIn">
                <Icon className={cn('h-3 w-3 sm:h-4 sm:w-4 mt-0.5 flex-shrink-0', colorMap[log.tipo])} />
                <span className="text-slate-300 flex-1 break-words">{log.mensagem}</span>
                <span className="text-slate-600 text-[10px] sm:text-xs ml-auto shrink-0">
                  {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
