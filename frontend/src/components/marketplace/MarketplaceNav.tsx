import { Link, useLocation } from "react-router-dom";
import { Button } from "../ui/button";
import { Store, Package, ShoppingBag, Plus } from "lucide-react";

interface MarketplaceNavProps {
  showCreate?: boolean;
}

export function MarketplaceNav({ showCreate = true }: MarketplaceNavProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/marketplace") {
      return currentPath === "/marketplace";
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Navigation Links */}
      <div className="flex items-center bg-muted rounded-xl p-1">
        <Link
          to="/marketplace"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            isActive("/marketplace") && !isActive("/marketplace/my-")
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Store className="h-4 w-4" />
          <span className="hidden sm:inline">Browse</span>
        </Link>
        <Link
          to="/marketplace/my-listings"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            isActive("/marketplace/my-listings")
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          <span className="hidden sm:inline">My Listings</span>
        </Link>
        <Link
          to="/marketplace/my-purchases"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            isActive("/marketplace/my-purchases")
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden sm:inline">My Purchases</span>
        </Link>
      </div>

      {/* Create Button */}
      {showCreate && (
        <Button asChild>
          <Link to="/marketplace/create">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Create</span>
            <span className="sm:hidden">New</span>
          </Link>
        </Button>
      )}
    </div>
  );
}
