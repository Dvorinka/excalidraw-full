import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, X, Bot, User, Loader2 } from 'lucide-react';
import { Button, Input } from '@/components';
import styles from './ChatPanel.module.scss';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  onClose: () => void;
  drawingContext?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onClose, drawingContext }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'I can help you create or refine diagrams. What would you like to do?' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const systemPrompt = drawingContext
        ? `You are an AI assistant for Excalidraw. The user is working on a diagram. Context: ${drawingContext}. Help them create, refine, or explain their diagram. Respond with concise, actionable suggestions. When suggesting diagram structures, describe elements and their layout clearly.`
        : 'You are an AI assistant for Excalidraw. Help users create, refine, or explain diagrams. Respond with concise, actionable suggestions.';

      const res = await fetch('/api/v2/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMsg },
          ],
          max_tokens: 800,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const assistantContent = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again later.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, drawingContext]);

  return (
    <div className={styles.panel} role="complementary" aria-label="AI chat panel">
      <div className={styles.header}>
        <div className={styles.title}>
          <Bot size={18} aria-hidden="true" />
          <span>AI Assistant</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close chat panel">
          <X size={16} />
        </button>
      </div>

      <div className={styles.messages} ref={scrollRef} role="log" aria-live="polite" aria-atomic="false">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.assistant}`}
          >
            <div className={styles.avatar} aria-hidden="true">
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className={styles.bubble}>{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.avatar} aria-hidden="true"><Bot size={14} /></div>
            <div className={styles.bubble}><Loader2 size={16} className={styles.spinner} /></div>
          </div>
        )}
      </div>

      <div className={styles.inputRow}>
        <Input
          className={styles.chatInput}
          placeholder="Ask about your diagram..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          aria-label="Chat input"
        />
        <Button size="sm" onClick={handleSend} disabled={isLoading || !input.trim()} aria-label="Send message">
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
};
