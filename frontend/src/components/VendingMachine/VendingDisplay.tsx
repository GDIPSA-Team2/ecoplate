import { cn } from "../../lib/utils";
import type { VendingStatus } from "../../hooks/useVendingMachine";

interface VendingDisplayProps {
  message: string;
  status: VendingStatus;
  inputCode: string;
  balance: number;
}

export function VendingDisplay({
  message,
  status,
  inputCode,
  balance,
}: VendingDisplayProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 border-4 border-gray-700">
      <div
        className={cn(
          "bg-green-950 rounded px-4 py-3 font-mono text-lg",
          "border-2 border-green-900 shadow-inner",
          status === "error" && "text-red-400 bg-red-950 border-red-900",
          status === "complete" && "text-green-300",
          status === "dispensing" && "animate-pulse",
          status !== "error" && status !== "complete" && "text-green-400"
        )}
      >
        <div className="flex justify-between items-center gap-4">
          <span className="flex-1 truncate">{message}</span>
          {inputCode && (
            <span className="text-yellow-400 font-bold">[{inputCode}]</span>
          )}
        </div>
        <div className="text-sm mt-1 text-green-600">
          Balance: ${balance.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
