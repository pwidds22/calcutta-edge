'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateDisplayName } from '@/actions/auth';
import { User, Check } from 'lucide-react';

interface DisplayNameFormProps {
  currentName: string | null;
}

export function DisplayNameForm({ currentName }: DisplayNameFormProps) {
  const [name, setName] = useState(currentName ?? '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    const result = await updateDisplayName(name);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'Display name updated' });
      setTimeout(() => setMessage(null), 3000);
    }
    setLoading(false);
  };

  const isDirty = name.trim() !== (currentName ?? '');

  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <User className="size-4 shrink-0 text-white/30" />
      <div className="flex-1 space-y-1.5">
        <p className="text-xs text-white/40">Display Name</p>
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter a display name"
            maxLength={30}
            className="h-8 border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-white/30"
          />
          <Button
            onClick={handleSave}
            disabled={loading || !isDirty || !name.trim()}
            size="sm"
            className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            <Check className="size-3.5" />
            Save
          </Button>
        </div>
        {message && (
          <p className={`text-xs ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {message.text}
          </p>
        )}
        <p className="text-[11px] text-white/25">
          Used when you host or join auctions. Max 30 characters.
        </p>
      </div>
    </div>
  );
}
