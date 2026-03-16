'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, VolumeX, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from '@/lib/auction/live/chat-types';
import { CHAT_MAX_LENGTH, CHAT_RATE_LIMIT_MS } from '@/lib/auction/live/chat-types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  chatMuted: boolean;
  onToggleMute?: () => void;
  isCommissioner: boolean;
  userId: string;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return 'now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

export function ChatPanel({
  messages,
  onSend,
  chatMuted,
  onToggleMute,
  isCommissioner,
  userId,
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [lastSentAt, setLastSentAt] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track unread messages when panel is closed
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    if (!isOpen) {
      const newCount = messages.length - prevMessageCountRef.current;
      if (newCount > 0) {
        setUnreadCount((prev) => prev + newCount);
      }
    } else {
      setUnreadCount(0);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isOpen]);

  // Auto-scroll to bottom (messages are newest-first, so scroll to top)
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollTop = 0;
    }
  }, [messages.length, isOpen]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
      return;
    }
    cooldownRef.current = setInterval(() => {
      const remaining = Math.max(0, lastSentAt + CHAT_RATE_LIMIT_MS - Date.now());
      setCooldown(remaining);
    }, 100);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown > 0, lastSentAt]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || chatMuted || cooldown > 0) return;
    onSend(trimmed);
    setText('');
    const now = Date.now();
    setLastSentAt(now);
    setCooldown(CHAT_RATE_LIMIT_MS);
  }, [text, chatMuted, cooldown, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Floating toggle button when collapsed
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setUnreadCount(0);
        }}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-emerald-500"
      >
        <MessageCircle className="size-4" />
        Chat
        {unreadCount > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-emerald-700">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col rounded-xl border border-white/[0.08] bg-[#0a0f0a] shadow-2xl sm:w-96">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-3.5 text-emerald-400" />
          <span className="text-sm font-medium text-white/80">
            Chat
          </span>
          <span className="text-[10px] text-white/30">
            {messages.length} msg{messages.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isCommissioner && onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              className={`rounded p-1 transition-colors ${
                chatMuted
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-white/40 hover:bg-white/[0.06] hover:text-white/60'
              }`}
              title={chatMuted ? 'Unmute chat' : 'Mute chat'}
            >
              {chatMuted ? (
                <VolumeX className="size-3.5" />
              ) : (
                <Volume2 className="size-3.5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded p-1 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/60"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Muted banner */}
      {chatMuted && (
        <div className="border-b border-red-500/10 bg-red-500/5 px-3 py-1.5 text-center text-[11px] text-red-400">
          Chat muted by commissioner
        </div>
      )}

      {/* Messages — newest at top */}
      <div
        ref={messagesEndRef}
        className="flex h-64 flex-col-reverse gap-0.5 overflow-y-auto px-3 py-2 scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-white/20">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`group rounded px-2 py-1 text-xs ${
                msg.userId === userId
                  ? 'bg-emerald-500/5'
                  : 'hover:bg-white/[0.02]'
              }`}
            >
              <span className="font-semibold text-emerald-400/80">
                {msg.displayName}
              </span>
              <span className="ml-1.5 text-white/60">{msg.text}</span>
              <span className="ml-1.5 text-[10px] text-white/20 opacity-0 transition-opacity group-hover:opacity-100">
                {formatRelativeTime(msg.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06] p-2">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) =>
              setText(e.target.value.slice(0, CHAT_MAX_LENGTH))
            }
            onKeyDown={handleKeyDown}
            placeholder={chatMuted ? 'Chat is muted' : 'Type a message...'}
            disabled={chatMuted}
            className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none transition-colors focus:border-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            maxLength={CHAT_MAX_LENGTH}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={chatMuted || !text.trim() || cooldown > 0}
            className="h-auto rounded-lg bg-emerald-600 px-2.5 py-1.5 hover:bg-emerald-500 disabled:opacity-30"
          >
            {cooldown > 0 ? (
              <span className="text-[10px] tabular-nums">
                {Math.ceil(cooldown / 1000)}s
              </span>
            ) : (
              <Send className="size-3" />
            )}
          </Button>
        </div>
        {text.length > CHAT_MAX_LENGTH - 50 && (
          <p className="mt-1 text-right text-[10px] text-white/20">
            {CHAT_MAX_LENGTH - text.length} chars left
          </p>
        )}
      </div>
    </div>
  );
}
