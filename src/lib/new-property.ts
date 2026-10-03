import type { PublicProperty } from "./property";
export function newProperty(): PublicProperty {
  return {
    id: crypto.randomUUID(),
    slug: `new-property-${Date.now()}`,
    title: { en: "", th: "" },
    description: { en: "", th: "" },
    transaction: "sale",
    type: "condo",
    priceTHB: 1,
    areaM2: 0,
    landAreaM2: null,
    beds: 0,
    baths: 0,
    floor: null,
    builtYear: null,
    ownership: "unknown",
    furnishing: "unfurnished",
    status: "available",
    location: {
      lat: 7.94,
      lng: 98.33,
      accuracy: "approximate",
      radiusMeters: 300,
    },
    zone: "Phuket",
    province: "Phuket",
    images: [],
    amenities: [],
    updatedAt: new Date().toISOString(),
    expiresAt: null,
  };
}
