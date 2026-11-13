import { Check } from 'lucide-react';
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const cancelled = status === 'cancelled';
  const currentIdx = ORDER_STATUS_FLOW.indexOf(status);

  return (
    <div className="flex flex-col gap-0">
      {ORDER_STATUS_FLOW.map((s, idx) => {
        const isDone = !cancelled && idx < currentIdx;
        const isCurrent = !cancelled && idx === currentIdx;
        const isFuture = !cancelled && idx > currentIdx;
        const isLast = idx === ORDER_STATUS_FLOW.length - 1;

        return (
          <div key={s} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                  isDone
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : isCurrent
                      ? 'border-amber-500 bg-amber-500 text-white animate-pulse'
                      : isFuture
                        ? 'border-slate-200 bg-white text-slate-300'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                {isDone ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-bold">{idx + 1}</span>
                )}
              </div>
              {!isLast && (
                <div
                  className={`h-8 w-0.5 ${isDone ? 'bg-emerald-500' : 'bg-slate-200'}`}
                />
              )}
            </div>
            <div className="pt-1.5 pb-6">
              <p
                className={`text-sm font-medium ${
                  isCurrent
                    ? 'text-amber-500'
                    : isDone
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                }`}
              >
                {ORDER_STATUS_LABELS[s]}
              </p>
            </div>
          </div>
        );
      })}
      {cancelled && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
          <span className="text-sm font-medium text-red-500">
            {ORDER_STATUS_LABELS.cancelled}
          </span>
        </div>
      )}
    </div>
  );
}
