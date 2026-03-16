'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { placeBid } from '@/actions/bidding';
import { Gavel } from 'lucide-react';

import { DEFAULT_BID_INCREMENTS } from '@/lib/auction/live/types';

interface BidPanelProps {
  sessionId: string;
  biddingStatus: string;
  currentHighestBid: number;
  currentHighestBidderName: string | null;
  userId: string;
  bidIncrements?: number[];
  minimumBid?: number;
}

export function BidPanel({
  sessionId,
  biddingStatus,
  currentHighestBid,
  currentHighestBidderName,
  userId,
  bidIncrements,
  minimumBid: minimumBidProp,
}: BidPanelProps) {
  const increments = bidIncrements ?? DEFAULT_BID_INCREMENTS;
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const floorBid = minimumBidProp ?? 1;
  const minBid = currentHighestBid > 0 ? currentHighestBid + 1 : floorBid;

  const handleBid = async () => {
    const amount = Number(bidAmount);
    if (!amount || amount < minBid) {
      setError(`Bid must be at least $${minBid}`);
      return;
    }

    setLoading(true);
    setError(null);
    const result = await placeBid(sessionId, amount);
    if (result.error) setError(result.error);
    else setBidAmount('');
    setLoading(false);
  };

  const handleIncrement = async (inc: number) => {
    const base = currentHighestBid || 0;
    const newAmount = Math.max(base + inc, floorBid);
    // One-click auto-bid — submit immediately for fast bidding wars
    setLoading(true);
    setError(null);
    setBidAmount(String(newAmount));
    const result = await placeBid(sessionId, newAmount);
    if (result.error) setError(result.error);
    else setBidAmount('');
    setLoading(false);
  };

  const isOpen = biddingStatus === 'open';

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      {/* Current high bid */}
      <div className="mb-3 text-center">
        {currentHighestBid > 0 ? (
          <>
            <p className="text-xs text-white/40">Current High Bid</p>
            <p className="text-2xl font-bold text-emerald-400">
              ${currentHighestBid.toLocaleString()}
            </p>
            {currentHighestBidderName && (
              <p className="text-xs text-white/40">
                by {currentHighestBidderName}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-white/40">
              {isOpen ? 'No bids yet — be the first!' : 'Waiting for bidding to open'}
            </p>
          </>
        )}
      </div>

      {/* Minimum bid indicator */}
      {isOpen && floorBid > 0 && (
        <p className="mb-2 text-center text-[11px] text-white/30">
          Min: ${floorBid.toLocaleString()}
        </p>
      )}

      {/* Bid input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
            $
          </span>
          <input
            type="number"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder={isOpen ? String(minBid) : '—'}
            disabled={!isOpen || loading}
            min={minBid}
            className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] pl-7 pr-3 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-40"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleBid();
            }}
          />
        </div>
        <Button
          onClick={handleBid}
          disabled={!isOpen || loading || !bidAmount}
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          <Gavel className="size-4" />
          Bid
        </Button>
      </div>

      {/* Quick increments */}
      {isOpen && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {increments.map((inc) => (
            <button
              key={inc}
              onClick={() => handleIncrement(inc)}
              className="flex-1 rounded-md bg-white/[0.04] py-1 text-xs text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/70"
            >
              +${inc}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
