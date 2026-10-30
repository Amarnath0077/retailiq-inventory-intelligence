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
  Search
} from 'lucide-react';
import { ChatMessage } from '../../types/inventory.ts';
import { apiFetch } from '../../utils/api.ts';

interface AssistantViewProps {
  lowStockThreshold: number;
  databaseName?: string;
  initialQuery?: string;
}

export const AssistantView: React.FC<AssistantViewProps> = ({ lowStockThreshold, databaseName = 'Connected Data', initialQuery }) => {
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
      tag: "Lowest Price SKUs"
    },
    {
      title: "Low Stock Alert (Units ≤ 10)",
      query: "Show products with stock below 10",
      tag: "Stock Replenishment"
    },
    {
      title: "Inventory Value by Brand",
      query: "Calculate inventory value by brand",
      tag: "Brand Valuation"
    },
    {
      title: "Compare Monthly Orders & Sales",
      query: "Compare monthly sales",
      tag: "Revenue Performance"
    }
  ] : [
    {
      title: "Find 5 Cheapest Shirts",
      query: "Find the 5 cheapest shirts",
      tag: "Lowest Price SKUs"
    },
    {
      title: "Low Stock Alert (Units ≤ 10)",
      query: "Show products with stock below 10",
      tag: "Stock Replenishment"
    },
    {
      title: "Inventory Value by Brand",
      query: "Calculate inventory value by brand",
      tag: "Valuation Breakdown"
    },
    {
      title: "Which Brand Has Lowest Stock?",
      query: "Which brand has the lowest stock?",
      tag: "Brand Stock Analysis"
    }
  ]);

  const searchGroundingQuestions = [
    {
      title: "Nike Dri-FIT Market Pricing",
      query: "Search Google for current retail market price benchmarks for Nike Dri-FIT t-shirts across major retailers",
      tag: "Google Search Grounded"
    },
    {
      title: "2026 Trending Apparel Colors",
      query: "Search Google for 2026 trending athletic apparel colors and consumer retail demand shifts",
      tag: "Market Trends"
    },
    {
      title: "Levi's T-Shirt Market Pricing",
      query: "What is the average retail price benchmark for Levi's crew neck and graphic t-shirts across online retailers?",
      tag: "Competitor Intel"
    },
    {
      title: "Sony vs Bose Street Prices",
      query: "What are the latest street retail prices and discounts for Sony WH-1000XM5 and Bose QuietComfort headphones?",
      tag: "Market Benchmark"
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSubmitting]);

  const handleSend = async (queryText?: string, forceSearchGrounding?: boolean) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || isSubmitting) return;

    const activeGrounding = forceSearchGrounding !== undefined ? forceSearchGrounding : useSearchGrounding;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: textToSend
    };

    setMessages(prev => [...prev, userMessage]);
    setInputQuery('');
    setIsSubmitting(true);

    try {
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: textToSend,
          searchGrounding: activeGrounding
        })
      });

      if (!response.ok) {
        throw new Error('Query router returned an error.');
      }

      const result = await response.json();

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: result.answer,
        metric: result.metric,
        sqlQuery: result.sqlQuery,
        tableData: result.tableData,
        chartData: result.chartData,
        queryType: result.queryType,
        groundingMetadata: result.groundingMetadata,
        isError: false
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `Unable to process query: ${err.message || 'Server connection error'}.`,
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const toggleSqlExpand = (id: string) => {
    setExpandedSqlIds(prev => {
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

  const handleClearChat = () => {
    setMessages([]);
    setExpandedSqlIds(new Set());
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto p-4 md:p-6 text-[#252B28]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E4E5DC] shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#252B28]">
              Retail Assistant
            </h1>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#E8EFEA] text-[#245C45] border border-[#CCDACC]">
              <Sparkles className="w-3 h-3 text-[#245C45]" />
              <span>Grounded Schema Engine</span>
            </span>
          </div>
          <p className="text-xs text-[#6F756F] mt-0.5">
            Query inventory quantities, brand valuations, low-stock risks, and real-time market retail benchmarks.
          </p>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#555C56] hover:text-[#252B28] bg-white border border-[#E4E5DC] hover:bg-[#F7F6F0] rounded-md transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#7A807A]" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Messages Viewport */}
      <div className="flex-1 overflow-y-auto py-5 space-y-5">
        {messages.length === 0 ? (
          /* Welcoming Panel / Suggested Prompts */
          <div className="max-w-3xl mx-auto py-4 space-y-6">
            <div className="text-center space-y-1.5">
              <div className="w-10 h-10 rounded-md bg-[#E8EFEA] text-[#245C45] flex items-center justify-center mx-auto border border-[#CCDACC]">
                <Bot className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-[#252B28]">
                Retail Intelligence & Inventory Planning Assistant
              </h2>
              <p className="text-xs text-[#6F756F] max-w-md mx-auto leading-relaxed">
                Execute natural-language merchandise queries, inspect generated read-only SQL, and cross-reference live market benchmarks.
              </p>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-[#6F756F] uppercase tracking-wider mb-2.5 px-1 flex items-center justify-between">
                <span>Database Inventory Inquiries</span>
                <span className="text-[10px] text-[#7A807A] font-mono">Store: {databaseName}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q.query, false)}
                    className="p-3 text-left bg-white rounded-md border border-[#E4E5DC] hover:border-[#245C45] transition-colors group flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-semibold text-[#245C45]">
                          {q.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#F7F6F0] text-[#6F756F] font-mono border border-[#E4E5DC]">
                          {q.tag}
                        </span>
                      </div>
                      <p className="text-xs text-[#252B28] leading-snug">
                        "{q.query}"
                      </p>
                    </div>
                    <div className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-[#7A807A] group-hover:text-[#245C45]">
                      <span>Run Query</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Google Search Grounding Section */}
            <div>
              <div className="text-[11px] font-semibold text-[#C66A42] uppercase tracking-wider mb-2.5 px-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>Market Retail Benchmarks (Google Search Grounding)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {searchGroundingQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q.query, true)}
                    className="p-3 text-left bg-white rounded-md border border-[#E4E5DC] hover:border-[#C66A42] transition-colors group flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-semibold text-[#C66A42] flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          <span>{q.title}</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#FDF3EC] text-[#C66A42] font-mono border border-[#F2D7C7]">
                          {q.tag}
                        </span>
                      </div>
                      <p className="text-xs text-[#252B28] leading-snug">
                        "{q.query}"
                      </p>
                    </div>
                    <div className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-[#7A807A] group-hover:text-[#C66A42]">
                      <span>Retrieve Market Benchmark</span>
                      <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-white rounded-md border border-[#E4E5DC] text-xs text-[#555C56] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[#252B28]">
                <Database className="w-3.5 h-3.5 text-[#245C45]" />
                <span>Safe Read-Only Operations</span>
              </div>
              <p className="text-[11px] text-[#6F756F] leading-relaxed">
                All generated queries execute parameterized read-only SELECT statements against connected store tables.
              </p>
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
                  className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-xs font-bold ${
                    isUser
                      ? 'bg-[#245C45] text-white'
                      : 'bg-[#1C2520] text-[#DCE7DD]'
                  }`}
                >
                  {isUser ? 'U' : <Bot className="w-4 h-4 text-[#DCE7DD]" />}
                </div>

                {/* Message Bubble */}
                <div className={`space-y-2 max-w-2xl ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-3.5 rounded-md text-xs leading-relaxed ${
                      isUser
                        ? 'bg-[#245C45] text-white'
                        : msg.isError
                        ? 'bg-[#F9ECEB] border border-[#F0CECA] text-[#B9473F]'
                        : 'bg-white border border-[#E4E5DC] text-[#252B28]'
                    }`}
                  >
                    <p className="whitespace-pre-line text-xs font-normal">
                      {msg.text}
                    </p>

                    {/* Numeric Metric Highlight Card */}
                    {msg.metric && (
                      <div className="mt-3 p-3 bg-[#F7F6F0] rounded-md border border-[#E4E5DC] flex items-center justify-between gap-4">
                        <div>
                          <div className="text-[11px] font-medium text-[#6F756F]">
                            {msg.metric.label}
                          </div>
                          <div className="text-xl font-bold font-mono tabular-nums text-[#252B28] tracking-tight">
                            {msg.metric.value}
                          </div>
                        </div>
                        {msg.metric.subtext && (
                          <div className="text-[11px] font-medium text-[#245C45] bg-[#E8EFEA] px-2 py-0.5 rounded border border-[#CCDACC] shrink-0">
                            {msg.metric.subtext}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Visual Chart Graphic (Comparison/Distribution) */}
                    {msg.chartData && msg.chartData.items && msg.chartData.items.length > 0 && (
                      <div className="mt-3 p-3 bg-[#F7F6F0] rounded-md border border-[#E4E5DC] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-[#252B28]">
                            <BarChart3 className="w-3.5 h-3.5 text-[#245C45]" />
                            <span>{msg.chartData.title}</span>
                          </span>
                          <span className="text-[10px] uppercase font-bold text-[#7A807A] font-mono">
                            {msg.chartData.type === 'donut' ? 'Distribution' : 'Comparison'}
                          </span>
                        </div>

                        <div className="space-y-2 pt-1">
                          {msg.chartData.items.slice(0, 8).map((item, idx) => {
                            const maxVal = Math.max(...msg.chartData!.items.map(i => i.value)) || 1;
                            const pct = Math.min(100, Math.max(6, Math.round((item.value / maxVal) * 100)));
                            const barPalette = [
                              '#245C45', '#7E9F8B', '#C66A42', '#3D4A43',
                              '#D48D3B', '#5A7568', '#A25936', '#87948B'
                            ];
                            const color = barPalette[idx % barPalette.length];

                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-medium text-[#252B28] truncate max-w-[220px]">
                                    {item.label}
                                  </span>
                                  <span className="font-mono tabular-nums font-semibold text-[#252B28]">
                                    {item.value >= 1000 ? `$${item.value.toLocaleString()}` : item.value}
                                  </span>
                                </div>
                                <div className="h-2 w-full bg-[#EAEBE2] rounded-xs overflow-hidden">
                                  <div 
                                    className="h-full rounded-xs transition-all duration-300"
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
                      <div className="mt-3 border border-[#E4E5DC] rounded-md overflow-hidden">
                        <div className="overflow-x-auto max-h-60">
                          <table className="w-full text-left text-[11px] font-mono tabular-nums border-collapse">
                            <thead className="bg-[#F7F6F0] text-[#555C56] font-semibold border-b border-[#E4E5DC] font-sans">
                              <tr>
                                {msg.tableData.columns.map((col) => (
                                  <th key={col} className="py-2 px-3 whitespace-nowrap">
                                    {col.replace(/_/g, ' ')}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EAEBE2] bg-white">
                              {msg.tableData.rows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-[#F9FAF6]">
                                  {msg.tableData!.columns.map((col) => (
                                    <td key={col} className="py-2 px-3 whitespace-nowrap text-[#252B28]">
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

                    {/* Google Search Grounding Sources & Query Citations */}
                    {msg.groundingMetadata && (
                      <div className="mt-3 p-3 bg-[#F7F6F0] rounded-md border border-[#E4E5DC] space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#252B28]">
                            <Globe className="w-3.5 h-3.5 text-[#C66A42]" />
                            <span>Grounded Market Intel</span>
                          </div>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-[#FDF3EC] text-[#C66A42] border border-[#F2D7C7]">
                            Search Grounded
                          </span>
                        </div>

                        {msg.groundingMetadata.sources && msg.groundingMetadata.sources.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#7A807A]">
                              Citations ({msg.groundingMetadata.sources.length})
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {msg.groundingMetadata.sources.map((src, sIdx) => (
                                <a
                                  key={sIdx}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-white rounded-md border border-[#E4E5DC] hover:border-[#C66A42] transition-colors flex items-start justify-between gap-2 text-left"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-medium text-[#252B28] hover:text-[#C66A42] truncate transition-colors">
                                      {src.title || src.url}
                                    </p>
                                    <p className="text-[10px] text-[#7A807A] truncate font-mono">
                                      {src.url.replace(/^https?:\/\/(www\.)?/, '')}
                                    </p>
                                  </div>
                                  <ExternalLink className="w-3 h-3 text-[#7A807A] shrink-0 mt-0.5" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Collapsible SQL Query Disclosure */}
                    {msg.sqlQuery && (
                      <div className="mt-2.5 pt-2 border-t border-[#E4E5DC]">
                        <button
                          type="button"
                          onClick={() => toggleSqlExpand(msg.id)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6F756F] hover:text-[#252B28] transition-colors cursor-pointer"
                        >
                          <Code2 className="w-3.5 h-3.5 text-[#245C45]" />
                          <span>{isExpanded ? 'Hide Executed SQL' : 'View Executed SQL'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 relative rounded-md bg-[#1C2520] p-3 text-[11px] font-mono text-[#DCE7DD] border border-[#2B3830]">
                            <pre className="overflow-x-auto whitespace-pre-wrap">
                              {msg.sqlQuery}
                            </pre>
                            <button
                              onClick={() => handleCopySql(msg.id, msg.sqlQuery!)}
                              className="absolute top-2 right-2 p-1.5 text-[#8E9F94] hover:text-white rounded bg-[#2B3830] transition-colors cursor-pointer"
                              title="Copy SQL to clipboard"
                            >
                              {copiedSqlId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-[#8EA898]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Message Meta */}
                  <div className={`flex items-center gap-2 text-[10px] text-[#7A807A] px-1 font-mono ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span>{msg.timestamp}</span>
                    {msg.queryType && (
                      <>
                        <span>·</span>
                        <span className="font-sans font-medium text-[#555C56]">
                          {msg.queryType === 'exact_pattern'
                            ? 'Deterministic Pattern'
                            : msg.queryType === 'google_search_grounding'
                            ? 'Google Search Grounding'
                            : msg.queryType === 'gemini_reasoning'
                            ? 'Gemini 3.8 Flash'
                            : 'Database SQL Query'}
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
            <div className="w-7 h-7 rounded-md bg-[#1C2520] text-[#DCE7DD] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 bg-white rounded-md border border-[#E4E5DC] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#252B28]">
                <Sparkles className="w-3.5 h-3.5 text-[#245C45] animate-spin" />
                <span>
                  {useSearchGrounding
                    ? 'Retrieving market retail benchmarks...'
                    : 'Querying merchandise database...'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#245C45] animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#245C45] animate-pulse delay-100" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#245C45] animate-pulse delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <div className="pt-3 border-t border-[#E4E5DC] shrink-0 space-y-2">
        {/* Toggle Mode Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUseSearchGrounding(!useSearchGrounding)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                useSearchGrounding
                  ? 'bg-[#C66A42] text-white'
                  : 'bg-white text-[#555C56] border border-[#E4E5DC] hover:bg-[#F7F6F0]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Google Search Grounding: {useSearchGrounding ? 'ON' : 'OFF'}</span>
            </button>
            <span className="text-[11px] text-[#7A807A] hidden sm:inline">
              {useSearchGrounding
                ? 'Retrieves real-time market retail pricing and competitor benchmarks'
                : 'Runs schema-grounded SQL against active store database'}
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
                ? "Search live web for market retail pricing or competitor benchmarks..."
                : "Ask an inventory inquiry (e.g. 'How many white Levi\'s T-shirts do we have?')..."
            }
            className="w-full pl-3.5 pr-11 py-2.5 bg-white border border-[#E4E5DC] rounded-md text-xs text-[#252B28] placeholder-[#9BA19B] focus:outline-hidden focus:border-[#245C45] focus:ring-1 focus:ring-[#245C45] transition-colors disabled:bg-[#F7F6F0]"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isSubmitting}
            className="absolute right-1.5 p-1.5 bg-[#245C45] hover:bg-[#1C4A37] text-white rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Send query"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <div className="flex items-center justify-between text-[11px] text-[#7A807A] px-1 font-mono">
          <span>Press Enter to inquire</span>
          <span>Read-only SELECT access · {databaseName}</span>
        </div>
      </div>
    </div>
  );
};
