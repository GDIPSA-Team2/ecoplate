import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";

interface Listing {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  quantity: number;
  unit: string;
  price: number | null;
  originalPrice: number | null;
  expiryDate: string | null;
  pickupLocation: string | null;
  status: string;
  viewCount: number;
  createdAt: string;
  seller: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  images: Array<{ id: number; imageUrl: string }>;
}

export interface VendingProduct {
  slotCode: string;
  listing: Listing;
}

export type VendingStatus =
  | "idle"
  | "selecting"
  | "paying"
  | "dispensing"
  | "complete"
  | "error";

export interface VendingMachineState {
  products: VendingProduct[];
  loading: boolean;
  error: string | null;
  selectedSlot: string | null;
  inputCode: string;
  balance: number;
  status: VendingStatus;
  displayMessage: string;
  dispensedProduct: VendingProduct | null;
}

const ROWS = ["A", "B", "C", "D", "E", "F"];
const COLS = ["1", "2", "3", "4", "5"];

function mapListingsToSlots(listings: Listing[]): VendingProduct[] {
  const products: VendingProduct[] = [];
  let index = 0;

  for (const row of ROWS) {
    for (const col of COLS) {
      if (index < listings.length) {
        products.push({
          slotCode: `${row}${col}`,
          listing: listings[index],
        });
        index++;
      }
    }
  }

  return products;
}

export function useVendingMachine() {
  const [state, setState] = useState<VendingMachineState>({
    products: [],
    loading: true,
    error: null,
    selectedSlot: null,
    inputCode: "",
    balance: 0,
    status: "idle",
    displayMessage: "Welcome! Select an item or use keypad",
    dispensedProduct: null,
  });

  // Load products from marketplace
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const listings = await api.get<Listing[]>("/marketplace/listings");
      const availableListings = listings.filter((l) => l.status === "available");
      const products = mapListingsToSlots(availableListings);
      setState((prev) => ({
        ...prev,
        products,
        loading: false,
        displayMessage:
          products.length > 0
            ? "Welcome! Select an item or use keypad"
            : "No items available",
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to load products",
        displayMessage: "Error loading products",
      }));
    }
  };

  const selectSlot = useCallback(
    (slotCode: string) => {
      const product = state.products.find((p) => p.slotCode === slotCode);
      if (product) {
        const price = product.listing.price ?? 0;
        setState((prev) => ({
          ...prev,
          selectedSlot: slotCode,
          inputCode: slotCode,
          status: "selecting",
          displayMessage: `${product.listing.title} - $${price.toFixed(2)}`,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          inputCode: slotCode,
          displayMessage: "Empty slot - try another",
          status: "error",
        }));
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            status: "idle",
            displayMessage: "Welcome! Select an item or use keypad",
            inputCode: "",
          }));
        }, 2000);
      }
    },
    [state.products]
  );

  const pressKey = useCallback(
    (key: string) => {
      if (key === "OK") {
        if (state.inputCode.length >= 2) {
          selectSlot(state.inputCode);
        }
        return;
      }

      if (key === "C") {
        // Clear input
        setState((prev) => ({
          ...prev,
          inputCode: "",
          selectedSlot: null,
          status: "idle",
          displayMessage: "Welcome! Select an item or use keypad",
        }));
        return;
      }

      // Append key to input code (max 2 characters)
      setState((prev) => {
        const newCode = (prev.inputCode + key).slice(0, 2);
        return {
          ...prev,
          inputCode: newCode,
          displayMessage: newCode.length < 2 ? `Enter code: ${newCode}_` : `Code: ${newCode}`,
        };
      });
    },
    [state.inputCode, selectSlot]
  );

  const insertCoin = useCallback(
    (amount: number) => {
      setState((prev) => {
        const newBalance = prev.balance + amount;
        const selectedProduct = prev.products.find(
          (p) => p.slotCode === prev.selectedSlot
        );
        const price = selectedProduct?.listing.price ?? 0;

        let displayMessage = prev.displayMessage;
        let status = prev.status;

        if (prev.selectedSlot && selectedProduct) {
          if (newBalance >= price) {
            displayMessage = `Ready! Press DISPENSE - Balance: $${newBalance.toFixed(2)}`;
            status = "paying";
          } else {
            displayMessage = `Insert $${(price - newBalance).toFixed(2)} more`;
            status = "paying";
          }
        } else {
          displayMessage = `Balance: $${newBalance.toFixed(2)} - Select an item`;
        }

        return {
          ...prev,
          balance: newBalance,
          status,
          displayMessage,
        };
      });
    },
    []
  );

  const dispense = useCallback(async () => {
    const selectedProduct = state.products.find(
      (p) => p.slotCode === state.selectedSlot
    );

    if (!selectedProduct) {
      setState((prev) => ({
        ...prev,
        status: "error",
        displayMessage: "No item selected",
      }));
      return;
    }

    const price = selectedProduct.listing.price ?? 0;

    if (state.balance < price) {
      setState((prev) => ({
        ...prev,
        status: "error",
        displayMessage: `Insert $${(price - state.balance).toFixed(2)} more`,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      status: "dispensing",
      displayMessage: "Dispensing...",
    }));

    try {
      // Reserve the item via API
      await api.post(`/marketplace/listings/${selectedProduct.listing.id}/reserve`);

      // Calculate change
      const change = state.balance - price;

      setState((prev) => ({
        ...prev,
        status: "complete",
        displayMessage:
          change > 0
            ? `Enjoy! Change: $${change.toFixed(2)}`
            : "Enjoy your item!",
        dispensedProduct: selectedProduct,
        balance: 0,
        selectedSlot: null,
        inputCode: "",
        products: prev.products.filter((p) => p.slotCode !== selectedProduct.slotCode),
      }));

      // Reset after showing success
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          status: "idle",
          displayMessage: "Welcome! Select an item or use keypad",
          dispensedProduct: null,
        }));
      }, 4000);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: "error",
        displayMessage: "Transaction failed. Please try again.",
        balance: prev.balance, // Keep the balance
      }));

      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          status: prev.selectedSlot ? "selecting" : "idle",
          displayMessage: prev.selectedSlot
            ? `${selectedProduct.listing.title} - $${price.toFixed(2)}`
            : "Welcome! Select an item or use keypad",
        }));
      }, 3000);
    }
  }, [state.products, state.selectedSlot, state.balance]);

  const returnCoins = useCallback(() => {
    if (state.balance > 0) {
      setState((prev) => ({
        ...prev,
        balance: 0,
        displayMessage: `Returned: $${prev.balance.toFixed(2)}`,
        status: prev.selectedSlot ? "selecting" : "idle",
      }));

      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          displayMessage: prev.selectedSlot
            ? `Select an item first`
            : "Welcome! Select an item or use keypad",
        }));
      }, 2000);
    }
  }, [state.balance]);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedSlot: null,
      inputCode: "",
      balance: 0,
      status: "idle",
      displayMessage: "Welcome! Select an item or use keypad",
      dispensedProduct: null,
    }));
  }, []);

  return {
    ...state,
    selectSlot,
    pressKey,
    insertCoin,
    dispense,
    returnCoins,
    reset,
    reload: loadProducts,
  };
}
