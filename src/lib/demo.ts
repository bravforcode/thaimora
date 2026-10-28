import { type PublicProperty, publicSnapshot } from "./property";
import { type HomeListing } from "./listings";
import { zones } from "./zones";
export const demoPlaces = [
  {
    id: "phuket",
    label: { en: "Phuket, Thailand", th: "ภูเก็ต ประเทศไทย" },
    lat: 7.94,
    lng: 98.33,
  },
  {
    id: "bang-tao",
    label: { en: "Bang Tao, Phuket", th: "บางเทา ภูเก็ต" },
    lat: 8.003,
    lng: 98.303,
  },
  {
    id: "kamala",
    label: { en: "Kamala, Phuket", th: "กมลา ภูเก็ต" },
    lat: 7.954,
    lng: 98.284,
  },
  {
    id: "rawai",
    label: { en: "Rawai, Phuket", th: "ราไวย์ ภูเก็ต" },
    lat: 7.786,
    lng: 98.325,
  },
  {
    id: "kathu",
    label: { en: "Kathu, Phuket", th: "กะทู้ ภูเก็ต" },
    lat: 7.914,
    lng: 98.344,
  },
  {
    id: "phuket-town",
    label: { en: "Phuket Town, Phuket", th: "เมืองภูเก็ต ภูเก็ต" },
    lat: 7.884,
    lng: 98.389,
  },
];
const types = ["villa", "condo", "house", "townhouse", "land"] as const;
const names = {
  villa: ["Garden pool villa", "วิลล่าสระว่ายน้ำในสวน"],
  condo: ["Coastal view residence", "คอนโดวิวชายฝั่ง"],
  house: ["Quiet family home", "บ้านครอบครัวในทำเลสงบ"],
  townhouse: ["Courtyard townhouse", "ทาวน์เฮาส์พร้อมลานส่วนตัว"],
  land: ["Hillside land plot", "ที่ดินบนเนินเขา"],
};
export const demoProperties: PublicProperty[] = Array.from(
  { length: 30 },
  (_, i) => {
    const type = types[i % 5],
      zone = zones[i % zones.length],
      rent = i % 4 === 1;
    return publicSnapshot({
      id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      slug: `${type}-${zone.id}-${i + 1}`,
      title: {
        en: `${names[type][0]} · ${zone.en}`,
        th: `${names[type][1]} · ${zone.th}`,
      },
      description: {
        en: "Synthetic property created to explore the PhuketLens experience. The photography illustrates Phuket and is not a photograph of this listing. No property is offered for sale or rent in this preview.",
        th: "อสังหาริมทรัพย์จำลองเพื่อทดลองใช้งาน PhuketLens ภาพประกอบแสดงบรรยากาศภูเก็ต ไม่ใช่ภาพของรายการนี้ ไม่มีการเสนอขายหรือให้เช่าจริงในตัวอย่างนี้",
      },
      transaction: rent ? "rent" : "sale",
      type,
      priceTHB: rent ? 25000 + i * 5000 : 3200000 + i * 610000,
      areaM2: type === "land" ? 0 : 68 + i * 7,
      landAreaM2: type === "condo" ? null : 240 + i * 18,
      beds: type === "land" ? 0 : 1 + (i % 4),
      baths: type === "land" ? 0 : 1 + (i % 3),
      floor: type === "condo" ? 2 + (i % 12) : null,
      builtYear: type === "land" ? null : 2019 + (i % 6),
      ownership: i % 3 === 0 ? "leasehold" : "freehold",
      furnishing:
        type === "land"
          ? "unfurnished"
          : i % 3 === 0
            ? "partly_furnished"
            : "furnished",
      status: i === 28 ? "sold" : i === 29 ? "rented" : "available",
      location: {
        lat: Number((zone.center[1] + (Math.floor(i / 8) - 2) * 0.002).toFixed(4)),
        lng: Number((zone.center[0] + ((i % 3) - 1) * 0.002).toFixed(4)),
        accuracy: "approximate",
        radiusMeters: 300,
      },
      zone: zone.en,
      province: "Phuket",
      images: [],
      amenities:
        type === "land"
          ? ["Road access"]
          : [
              "Pool",
              "Parking",
              ...(i % 2 === 0 ? ["Garden", "Security"] : ["Gym", "Balcony"]),
            ],
      updatedAt: new Date(Date.UTC(2026, 8, 30 - (i % 12))).toISOString(),
      expiresAt: null,
    });
  },
);
export const illustrativeImages: PublicProperty["images"] = [
  {
    url: "/images/phuket-coast.jpg",
    alt: {
      en: "Illustrative Banana Beach, not this property",
      th: "ภาพประกอบหาดกล้วย ไม่ใช่ภาพอสังหาริมทรัพย์นี้",
    },
    credit: "Anton Zelenov · CC BY-SA 4.0 · illustrative",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Banana_beach_Phuket_2017_-_01.jpg",
  },
  {
    url: "/images/phuket-building.jpg",
    alt: {
      en: "Illustrative Phuket house with shrine, not this property",
      th: "ภาพประกอบบ้านในภูเก็ต ไม่ใช่ภาพอสังหาริมทรัพย์นี้",
    },
    credit: "Sharon Hahn Darlin · CC BY 2.0 · illustrative",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Phuket,_Thailand_December_2021_-_House_with_shrine.jpg",
  },
];
demoProperties.forEach((p) => {
  p.images = illustrativeImages;
});
// Demo channel split: every third listing is sold by its owner directly,
// the rest are posted by sample agents. Names are synthetic placeholders.
const sampleAgents = [
  { name: "Sample Agent A", agency: "Sample Realty · Patong" },
  { name: "Sample Agent B", agency: "Sample Realty · Bang Tao" },
];
export const demoListings: HomeListing[] = demoProperties.map((p, i) => ({
  ...p,
  channel:
    i % 3 === 0
      ? { kind: "owner" }
      : { kind: "agent", ...sampleAgents[i % sampleAgents.length] },
}));
export const previewFX = {
  date: "2026-10-01",
  rates: {
    THB: 1,
    USD: 0.0306,
    EUR: 0.0262,
    GBP: 0.0228,
    AUD: 0.0465,
    CNY: 0.218,
    JPY: 4.47,
  },
};
export const demoPOIs = [
  {
    id: "beach",
    name: { en: "Bang Tao Beach", th: "หาดบางเทา" },
    category: "Beach",
    lat: 8.002,
    lng: 98.291,
  },
  {
    id: "town",
    name: { en: "Phuket Old Town", th: "เมืองเก่าภูเก็ต" },
    category: "Culture",
    lat: 7.884,
    lng: 98.389,
  },
  {
    id: "hospital",
    name: { en: "Public hospital area", th: "ย่านโรงพยาบาล" },
    category: "Hospital",
    lat: 7.902,
    lng: 98.38,
  },
];
