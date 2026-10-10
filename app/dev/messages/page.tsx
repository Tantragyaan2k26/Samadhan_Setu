'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, RefreshCw, Smartphone } from 'lucide-react';
import { NotificationItem } from '@/lib/types';

export default function DevMessagesPage() {
  const [messages, setMessages] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/dev/messages');
      const data = await res.json();
      if (res.ok && data.messages) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchMessages(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchMessages]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-amber-50 border border-amber-300 p-6 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider">
            <MessageSquare className="w-4 h-4 text-amber-600" />
            <span>डेमो संदेश आउटबॉक्स (SMS / WhatsApp Notification Outbox)</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            लाइव डिस्पैच्ड एसएमएस एवं नोटिफिकेशन लॉग
          </h1>
          <p className="text-xs text-slate-600">
            हैकथॉन जूरी परीक्षण: सिस्टम द्वारा नागरिकों को भेजे गए OTP, पावती एवं प्रगति संदेशों का वास्तविक रिकॉर्ड।
          </p>
        </div>

        <button
          onClick={fetchMessages}
          disabled={isLoading}
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>रिफ्रेश संदेश</span>
        </button>
      </div>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="bg-white p-8 text-center text-slate-400 rounded-2xl border border-slate-200">
            वर्तमान में कोई संदेश नहीं है।
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2 hover:border-brand-300 transition"
            >
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-slate-500" /> +91-{msg.recipient}
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    {msg.channel} • {msg.status}
                  </span>
                  {msg.ticketNo && (
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-mono px-2 py-0.5 rounded">
                      {msg.ticketNo}
                    </span>
                  )}
                </div>
                <span className="text-slate-400 text-[11px] font-mono">
                  {new Date(msg.createdAt).toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              <div className="text-xs font-bold text-slate-900">{msg.title}</div>
              <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono">
                {msg.body}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
