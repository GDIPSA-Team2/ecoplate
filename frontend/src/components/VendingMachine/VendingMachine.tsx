import { useVendingMachine } from "../../hooks/useVendingMachine";
import { VendingDisplay } from "./VendingDisplay";
import { VendingSlot } from "./VendingSlot";
import { VendingKeypad } from "./VendingKeypad";
import { VendingCoinSlot } from "./VendingCoinSlot";
import { VendingDispenser } from "./VendingDispenser";
import { RefreshCw } from "lucide-react";

const ROWS = ["A", "B", "C", "D", "E", "F"];
const COLS = ["1", "2", "3", "4", "5"];

export function VendingMachine() {
  const {
    products,
    loading,
    error,
    selectedSlot,
    inputCode,
    balance,
    status,
    displayMessage,
    dispensedProduct,
    selectSlot,
    pressKey,
    insertCoin,
    dispense,
    returnCoins,
    reload,
  } = useVendingMachine();

  // Check if we can dispense
  const selectedProduct = products.find((p) => p.slotCode === selectedSlot);
  const canDispense =
    selectedProduct !== undefined &&
    balance >= (selectedProduct.listing.price ?? 0) &&
    status !== "dispensing" &&
    status !== "complete";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-400">Loading vending machine...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={reload}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Vending Machine Frame */}
      <div className="bg-gradient-to-b from-gray-700 to-gray-900 rounded-2xl shadow-2xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">EcoPlate Vending</h2>
          <button
            onClick={reload}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Refresh products"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Display */}
        <VendingDisplay
          message={displayMessage}
          status={status}
          inputCode={inputCode}
          balance={balance}
        />

        {/* Main content area */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Product grid */}
          <div className="flex-1">
            <div className="grid grid-cols-5 gap-2">
              {ROWS.map((row) =>
                COLS.map((col) => {
                  const slotCode = `${row}${col}`;
                  const product = products.find((p) => p.slotCode === slotCode);
                  return (
                    <VendingSlot
                      key={slotCode}
                      slotCode={slotCode}
                      product={product}
                      isSelected={selectedSlot === slotCode}
                      onSelect={selectSlot}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Controls panel */}
          <div className="lg:w-48 space-y-4">
            <VendingKeypad
              onKeyPress={pressKey}
              disabled={status === "dispensing" || status === "complete"}
            />
            <VendingCoinSlot
              balance={balance}
              onInsertCoin={insertCoin}
              onReturnCoins={returnCoins}
              disabled={status === "dispensing" || status === "complete"}
            />
          </div>
        </div>

        {/* Dispenser */}
        <VendingDispenser
          status={status}
          dispensedProduct={dispensedProduct}
          onDispense={dispense}
          canDispense={canDispense}
        />

        {/* Instructions */}
        <div className="text-gray-400 text-sm text-center">
          <p>Click a slot or use the keypad to select an item. Insert coins and press DISPENSE.</p>
        </div>
      </div>
    </div>
  );
}
