import { cn } from "../../lib/utils";

interface VendingKeypadProps {
  onKeyPress: (key: string) => void;
  disabled?: boolean;
}

const KEYS = [
  ["A", "B", "C"],
  ["D", "E", "F"],
  ["1", "2", "3"],
  ["4", "5", "OK"],
];

export function VendingKeypad({ onKeyPress, disabled }: VendingKeypadProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 border-2 border-gray-700">
      <div className="grid grid-cols-3 gap-2">
        {KEYS.flat().map((key) => (
          <button
            key={key}
            onClick={() => onKeyPress(key)}
            disabled={disabled}
            className={cn(
              "w-10 h-10 rounded-full font-bold text-sm",
              "flex items-center justify-center",
              "transition-all duration-150 active:scale-95",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              key === "OK"
                ? "bg-green-600 hover:bg-green-500 text-white"
                : /^[A-F]$/.test(key)
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "bg-gray-600 hover:bg-gray-500 text-white"
            )}
          >
            {key}
          </button>
        ))}
      </div>
      {/* Clear button */}
      <button
        onClick={() => onKeyPress("C")}
        disabled={disabled}
        className={cn(
          "w-full mt-2 py-2 rounded font-bold text-sm",
          "bg-red-600 hover:bg-red-500 text-white",
          "transition-all duration-150 active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        CLEAR
      </button>
    </div>
  );
}
