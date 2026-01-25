import { Coins, RotateCcw } from "lucide-react";
import { cn } from "../../lib/utils";

interface VendingCoinSlotProps {
  balance: number;
  onInsertCoin: (amount: number) => void;
  onReturnCoins: () => void;
  disabled?: boolean;
}

const COIN_VALUES = [
  { label: "$0.25", value: 0.25 },
  { label: "$1", value: 1 },
  { label: "$5", value: 5 },
  { label: "$10", value: 10 },
];

export function VendingCoinSlot({
  balance,
  onInsertCoin,
  onReturnCoins,
  disabled,
}: VendingCoinSlotProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border-2 border-gray-700">
      {/* Coin slot visual */}
      <div className="flex items-center justify-center mb-3">
        <div className="bg-gray-900 w-16 h-3 rounded-full border border-gray-600 shadow-inner" />
      </div>

      {/* Balance display */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <Coins className="w-5 h-5 text-yellow-500" />
        <span className="text-lg font-bold text-yellow-400">
          ${balance.toFixed(2)}
        </span>
      </div>

      {/* Coin buttons */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {COIN_VALUES.map((coin) => (
          <button
            key={coin.value}
            onClick={() => onInsertCoin(coin.value)}
            disabled={disabled}
            className={cn(
              "py-2 px-3 rounded-lg font-bold text-sm",
              "bg-yellow-600 hover:bg-yellow-500 text-white",
              "transition-all duration-150 active:scale-95",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-1"
            )}
          >
            <Coins className="w-4 h-4" />
            {coin.label}
          </button>
        ))}
      </div>

      {/* Return coins button */}
      <button
        onClick={onReturnCoins}
        disabled={disabled || balance === 0}
        className={cn(
          "w-full py-2 rounded-lg font-bold text-sm",
          "bg-gray-600 hover:bg-gray-500 text-white",
          "transition-all duration-150 active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "flex items-center justify-center gap-2"
        )}
      >
        <RotateCcw className="w-4 h-4" />
        Return Coins
      </button>
    </div>
  );
}
