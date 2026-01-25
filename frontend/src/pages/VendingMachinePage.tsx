import { useState } from "react";
import { VendingMachine } from "../components/VendingMachine";
import { VendingMap, type VendingLocation, SINGAPORE_VENDING_LOCATIONS } from "../components/VendingMachine/VendingMap";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "../components/ui/button";

export default function VendingMachinePage() {
  const [selectedLocation, setSelectedLocation] = useState<VendingLocation | null>(null);

  const handleSelectLocation = (location: VendingLocation) => {
    setSelectedLocation(location);
  };

  const handleBackToMap = () => {
    setSelectedLocation(null);
  };

  // Show vending machine if a location is selected
  if (selectedLocation) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleBackToMap}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Map
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6 text-green-600" />
              {selectedLocation.name}
            </h1>
            <p className="text-gray-600">{selectedLocation.address}</p>
          </div>
        </div>

        <VendingMachine />
      </div>
    );
  }

  // Show map view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">EcoPlate Vending Machines</h1>
        <p className="text-gray-600">
          Find a vending machine near you in Singapore
        </p>
      </div>

      {/* Location stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {SINGAPORE_VENDING_LOCATIONS.length}
          </div>
          <div className="text-sm text-gray-600">Locations</div>
        </div>
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {SINGAPORE_VENDING_LOCATIONS.reduce((sum, loc) => sum + loc.itemCount, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Items</div>
        </div>
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <div className="text-2xl font-bold text-green-600">24/7</div>
          <div className="text-sm text-gray-600">Availability</div>
        </div>
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <div className="text-2xl font-bold text-green-600">Eco</div>
          <div className="text-sm text-gray-600">Friendly</div>
        </div>
      </div>

      {/* Map */}
      <VendingMap onSelectLocation={handleSelectLocation} />

      {/* Location list */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-semibold">All Locations</h2>
        </div>
        <div className="divide-y">
          {SINGAPORE_VENDING_LOCATIONS.map((location) => (
            <button
              key={location.id}
              onClick={() => handleSelectLocation(location)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="font-medium">{location.name}</div>
                  <div className="text-sm text-gray-500">{location.address}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-green-600 font-medium">{location.itemCount} items</div>
                <div className="text-xs text-gray-500">Available</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
