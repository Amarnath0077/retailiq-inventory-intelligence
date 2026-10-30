import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Database, 
  Code2, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  ArrowRight, 
  BarChart3, 
  Globe, 
  ExternalLink, 
  Search,
  MessageSquare,
  Zap,
  Terminal,
  Cpu
} from 'lucide-react';
import { ChatMessage } from '../../types/inventory.ts';
import { apiFetch } from '../../utils/api.ts';

interface AssistantViewProps {
  lowStockThreshold: number;
  databaseName?: string;
  initialQuery?: string;
}

export const AssistantView: React.FC<AssistantViewProps> = ({ 
  lowStockThreshold, 
  databaseName = 'Connected Data', 
  initialQuery 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState(initialQuery || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedSqlId, setCopiedSqlId] = useState<string | null>(null);
  const [expandedSqlIds, setExpandedSqlIds] = useState<Set<string>>(new Set());
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(false);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<Array<{ title: string; query: string; tag: string }>>([]);
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch('/api/ai/suggestions')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setDynamicSuggestions(data);
        }
      })
      .catch(() => {});

    apiFetch('/api/ai/status')
      .then(res => res.json())
      .then(data => setAiStatus(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      handleSend(initialQuery.trim());
    }
  }, [initialQuery]);

  const isEcommerceDb = databaseName.toLowerCase().includes('ecommerce') || databaseName.toLowerCase().includes('shop') || databaseName.toLowerCase().includes('store');

  const suggestedQuestions = dynamicSuggestions.length > 0 ? dynamicSuggestions : (isEcommerceDb ? [
    {
      title: "Find 5 Cheapest Products",
      query: "Find the 5 cheapest products",
      tag: "Price Analysis",
      color: "border-indigo-200 text-indigo-700 bg-indigo-50"
    },
    {
      title: "Low Stock Alert (Units ≤ 10)",
      query: "Show products with stock below 10",
      tag: "Restocking",
      color: "border-amber-200 text-amber-700 bg-amber-50"
    },
    {
      title: "Inventory Value by Brand",
      query: "Calculate inventory value by brand",
      tag: "Valuation",
      color: "border-emerald-200 text-emerald-700 bg-emerald-50"
    },
    {
      title: "Stock Distribution Overview",
      query: "Show inventory distribution by category",
      tag: "Distribution",
      color: "border-purple-200 text-purple-700 bg-purple-50"
    }
  ] : [
    {
      title: "Find 5 Cheapest Products",
      query: "Find the 5 cheapest products",
      tag: "Price Analysis",
      color: "border-indigo-200 text-indigo-700 bg-indigo-50"
    },
    {
      title: "Low Stock Alert (Units ≤ 10)",
      query: "Show products with stock below 10",
      tag: "Restocking",
      color: "border-amber-200 text-amber-700 bg-amber-50"
    },
    {
      title: "Inventory Value by Brand",
      query: "Calculate inventory value by brand",
      tag: "Valuation",
      color: "border-emerald-200 text-emerald-700 bg-emerald-50"
    },
    {
      title: "Which Brand Has Lowest Stock?",
      query: "Which brand has the lowest stock?",
      tag: "Analysis",
      color: "border-cyan-200 text-cyan-700 bg-cyan-50"
    }
  ]);

  const searchGroundingQuestions = [
    {
      title: "Nike Dri-FIT Market Pricing",
      query: "Search Google for current retail market price benchmarks for Nike Dri-FIT t-shirts across major retailers",
      tag: "Web Grounding"
    },
    {
      title: "2026 Trending Apparel Colors",
      query: "Search Google for 2026 trending athletic apparel colors and consumer retail demand shifts",
      tag: "Market Intel"
    },
    {
      title: "Levi's T-Shirt Market Pricing",
      query: "Search Google for current commercial retail price range for Levi's graphic tees",
      tag: "Competitor Intel"
    }
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSubmitting]);

  const toggleSqlExpand = (id: string) => {
    setExpandedSqlIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopySql = (id: string, sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedSqlId(id);
    setTimeout(() => setCopiedSqlId(null), 2000);
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isSubmitting) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: textToSend.trim()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsSubmitting(true);

    try {
      const endpoint = useSearchGrounding ? '/api/search-grounding' : '/api/chat';
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: textToSend.trim(),
          searchGrounding: useSearchGrounding 
        })
      });

      if (!res.ok) {
        let errorText = `Server returned HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errorText = errData.error;
          }
        } catch (_) {}
        throw new Error(errorText);
      }

      const data = await res.json();

      let formattedTableData = undefined;
      if (data.tableData && Array.isArray(data.tableData.rows) && data.tableData.rows.length > 0) {
        formattedTableData = data.tableData;
      } else if (data.rows && Array.isArray(data.rows) && data.rows.length > 0 && data.columns) {
        formattedTableData = {
          columns: data.columns,
          rows: data.rows
        };
      }

      let metricData = undefined;
      if (data.metric && typeof data.metric === 'object') {
        metricData = data.metric;
      } else if (data.metric !== undefined) {
        metricData = {
          label: data.metricLabel || 'Calculated Metric',
          value: typeof data.metric === 'number' && !Number.isInteger(data.metric)
            ? `$${data.metric.toFixed(2)}`
            : String(data.metric),
          subtext: data.metricSubtext
        };
      }

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: data.answer || data.summary || 'I analyzed your request and computed the inventory ledger results below.',
        sqlQuery: data.sqlQuery || undefined,
        queryType: data.queryType || (useSearchGrounding ? 'google_search_grounding' : 'exact_pattern'),
        metric: metricData,
        tableData: formattedTableData,
        chartData: data.chartData,
        groundingMetadata: data.groundingMetadata
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `Query processing notice: ${err.message || 'Could not execute search. Please verify input or connect database.'}`,
        isError: true
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
  };

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-5xl mx-auto flex flex-col h-[calc(100vh-4rem)] text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
              Retail Intelligence Assistant
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
              <span>Gemini 3.8 Flash</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Natural-language NL-to-SQL synthesizer, Google Search market grounding, and merchandising analytics.
          </p>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Clear Chat</span>
          </button>
        )}
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 ? (
          /* Empty Assistant State with Suggestion Cards */
          <div className="py-6 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 md:p-8 text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-lg md:text-xl font-extrabold text-slate-900 mb-2">
                Ask anything about your retail inventory
              </h2>
              <p className="text-xs md:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
                Query current stock levels, low-stock risk, catalog valuation, brand comparisons, or market price benchmarks using natural language.
              </p>
            </div>

            {/* Suggested Question Cards */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 px-1">
                <Terminal className="w-4 h-4 text-indigo-600" />
                <span>Deterministic Catalog Queries:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q.query)}
                    className="p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/5 transition-all text-left flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {q.tag}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {q.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 font-mono">
                        "{q.query}"
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Google Search Grounding Inquiries */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 px-1">
                <Globe className="w-4 h-4 text-cyan-600" />
                <span>Real-Time Web Grounded Intelligence:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {searchGroundingQuestions.map((sq, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setUseSearchGrounding(true);
                      handleSend(sq.query);
                    }}
                    className="p-3.5 bg-gradient-to-br from-cyan-50/50 via-white to-white rounded-xl border border-cyan-100 hover:border-cyan-400 hover:shadow-sm transition-all text-left flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 mb-2 inline-block">
                        {sq.tag}
                      </span>
                      <h3 className="text-xs font-bold text-slate-800 group-hover:text-cyan-700 transition-colors">
                        {sq.title}
                      </h3>
                    </div>
                    <span className="text-[10px] text-cyan-600 font-semibold mt-2 flex items-center gap-1 group-hover:underline">
                      <span>Query Google Search</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Conversation Flow */
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isExpanded = expandedSqlIds.has(msg.id);

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold shadow-xs ${
                    isUser
                      ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white'
                      : 'bg-gradient-to-tr from-purple-600 to-cyan-500 text-white'
                  }`}
                >
                  {isUser ? 'U' : <Bot className="w-4 h-4 text-white" />}
                </div>

                {/* Message Bubble */}
                <div className={`space-y-2 max-w-2xl ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white'
                        : msg.isError
                        ? 'bg-rose-50 border border-rose-200 text-rose-800'
                        : 'bg-white border border-slate-200/90 text-slate-800'
                    }`}
                  >
                    <p className="whitespace-pre-line text-xs font-normal">
                      {msg.text}
                    </p>

                    {/* Numeric Metric Highlight Card */}
                    {msg.metric && (
                      <div className="mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            {msg.metric.label}
                          </div>
                          <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 tracking-tight mt-0.5">
                            {msg.metric.value}
                          </div>
                        </div>
                        {msg.metric.subtext && (
                          <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 shrink-0">
                            {msg.metric.subtext}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Visual Chart Graphic */}
                    {msg.chartData && msg.chartData.items && msg.chartData.items.length > 0 && (
                      <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs font-bold text-slate-900">
                            <BarChart3 className="w-4 h-4 text-indigo-600" />
                            <span>{msg.chartData.title}</span>
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-500 font-mono px-2 py-0.5 rounded bg-white border border-slate-200">
                            {msg.chartData.type === 'donut' ? 'Distribution' : 'Comparison'}
                          </span>
                        </div>

                        <div className="space-y-2 pt-1">
                          {msg.chartData.items.slice(0, 8).map((item, idx) => {
                            const maxVal = Math.max(...msg.chartData!.items.map(i => i.value)) || 1;
                            const pct = Math.min(100, Math.max(8, Math.round((item.value / maxVal) * 100)));
                            const barPalette = [
                              '#6366F1', '#3B82F6', '#06B6D4', '#10B981',
                              '#F59E0B', '#8B5CF6', '#F43F5E', '#14B8A6'
                            ];
                            const color = barPalette[idx % barPalette.length];

                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                                    {item.label}
                                  </span>
                                  <span className="font-mono tabular-nums font-bold text-slate-900">
                                    {item.value >= 1000 ? `$${item.value.toLocaleString()}` : item.value}
                                  </span>
                                </div>
                                <div className="h-2.5 w-full bg-slate-200/80 rounded-full overflow-hidden p-0.5">
                                  <div 
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{ width: `${pct}%`, backgroundColor: color }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Formatted Data Table */}
                    {msg.tableData && msg.tableData.rows.length > 0 && (
                      <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <div className="overflow-x-auto max-h-60">
                          <table className="w-full text-left text-xs font-mono tabular-nums border-collapse">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 font-sans">
                              <tr>
                                {msg.tableData.columns.map((col) => (
                                  <th key={col} className="py-2.5 px-3 whitespace-nowrap">
                                    {col.replace(/_/g, ' ')}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {msg.tableData.rows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-50">
                                  {msg.tableData!.columns.map((col) => (
                                    <td key={col} className="py-2 px-3 whitespace-nowrap text-slate-800">
                                      {row[col] !== undefined && row[col] !== null ? String(row[col]) : '-'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Grounding Citations */}
                    {msg.groundingMetadata?.sources && msg.groundingMetadata.sources.length > 0 && (
                      <div className="mt-3 p-3 bg-cyan-50/60 rounded-xl border border-cyan-100 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-cyan-900">
                          <div className="flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-cyan-700" />
                            <span>Grounded Market Citations</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                            {msg.groundingMetadata.sources.length} Verified Sources
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {msg.groundingMetadata.sources.map((src, sIdx) => (
                            <a
                              key={sIdx}
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-cyan-100 text-[11px] text-cyan-900 hover:border-cyan-300 transition-colors truncate"
                            >
                              <span className="truncate">{src.title}</span>
                              <ExternalLink className="w-3 h-3 text-cyan-600 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Collapsible SQL Query Inspector */}
                    {msg.sqlQuery && (
                      <div className="mt-3 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => toggleSqlExpand(msg.id)}
                          className="flex items-center justify-between w-full text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5 font-mono">
                            <Code2 className="w-3.5 h-3.5" />
                            <span>{isExpanded ? 'Hide Executed SQL' : 'View Executed SQL'}</span>
                          </span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-3 bg-slate-900 rounded-xl text-slate-100 text-[11px] font-mono relative overflow-x-auto">
                            <code>{msg.sqlQuery}</code>
                            <button
                              type="button"
                              onClick={() => handleCopySql(msg.id, msg.sqlQuery!)}
                              className="absolute top-2.5 right-2.5 p-1 rounded bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                              title="Copy SQL query"
                            >
                              {copiedSqlId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Message Timestamp */}
                  <div className={`flex items-center gap-2 text-[10px] text-slate-400 px-1 font-mono ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span>{msg.timestamp}</span>
                    {msg.queryType && (
                      <>
                        <span>·</span>
                        <span className="font-semibold text-slate-600">
                          {msg.queryType === 'exact_pattern'
                            ? 'Pattern Match'
                            : msg.queryType === 'google_search_grounding'
                            ? 'Google Grounding'
                            : msg.queryType === 'gemini_reasoning'
                            ? 'Gemini 3.8 Flash'
                            : 'MySQL Query'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Processing Indicator */}
        {isSubmitting && (
          <div className="flex gap-3 max-w-xl mr-auto animate-in fade-in duration-150">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Sparkles className="w-4 h-4 text-purple-600 animate-spin" />
                <span>
                  {useSearchGrounding
                    ? 'Retrieving live market retail pricing benchmarks...'
                    : 'Querying merchandise database with Gemini 3.8 Flash...'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-100" />
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <div className="pt-3 border-t border-slate-200 shrink-0 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUseSearchGrounding(!useSearchGrounding)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                useSearchGrounding
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-cyan-500/20'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Google Search Grounding: {useSearchGrounding ? 'ACTIVE' : 'OFF'}</span>
            </button>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              {useSearchGrounding
                ? 'Retrieves real-time retail market prices and competitor pricing trends'
                : 'Runs schema-grounded queries against active store database'}
            </span>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isSubmitting}
            placeholder={
              useSearchGrounding
                ? "Search live web for retail pricing benchmarks, apparel trends, competitor prices..."
                : "Ask an inventory question (e.g. 'How many white Nike T-shirts do we have?')..."
            }
            className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-xs disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isSubmitting}
            className="absolute right-2 p-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm shadow-indigo-500/20 active:scale-95"
            aria-label="Send query"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
          <span>Press Enter to send inquiry</span>
          <span>Read-only SELECT access · {databaseName}</span>
        </div>
      </div>
    </div>
  );
};
