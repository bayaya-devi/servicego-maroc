export const photoCatalog = [
  {
    id: "ma-rabat-neighbours",
    country: "MA",
    region: "Rabat",
    subject: "people in a shared city space",
    light: "soft-daylight",
    colors: ["cyan", "stone", "green"],
    orientation: "landscape",
    resolutions: { large: "/assets/scenes/rabat-people.webp" },
    credit: "Souhail BIDA",
    license: "Unsplash License",
    source: "https://unsplash.com/photos/a-group-of-people-walking-down-a-street-next-to-a-train-track-YGqVa6LBuak",
    alt: { fr: "Des personnes se croisent dans un espace urbain à Rabat", en: "People crossing paths in an urban space in Rabat", ar: "أشخاص يلتقون في فضاء حضري بالرباط" },
  },
  {
    id: "ma-marrakech-street",
    country: "MA",
    region: "Marrakech",
    subject: "people walking in the city",
    light: "warm-daylight",
    colors: ["terracotta", "sky", "green"],
    orientation: "landscape",
    resolutions: { large: "/assets/scenes/marrakech-people.webp" },
    credit: "Calin Stan",
    license: "Unsplash License",
    source: "https://unsplash.com/photos/people-walking-on-street-during-daytime-7a_PHX91su8",
    alt: { fr: "Des passants dans une rue de Marrakech", en: "People walking on a street in Marrakech", ar: "مارة في أحد شوارع مراكش" },
  },
  {
    id: "fr-paris-republique",
    country: "FR",
    region: "Paris",
    subject: "people gathering in a public square",
    light: "soft-daylight",
    colors: ["stone", "blue", "green"],
    orientation: "landscape",
    resolutions: { large: "/assets/scenes/paris-republique.webp" },
    credit: "Barthélemy de Mazenod",
    license: "Unsplash License",
    source: "https://unsplash.com/photos/people-walking-on-street-during-daytime-rukoSoqUNvM",
    alt: { fr: "Des personnes sur la place de la République à Paris", en: "People in Place de la République in Paris", ar: "أشخاص في ساحة الجمهورية في باريس" },
  },
  {
    id: "fr-paris-crossing",
    country: "FR",
    region: "Paris",
    subject: "people crossing a city street",
    light: "warm-daylight",
    colors: ["stone", "red", "blue"],
    orientation: "landscape",
    resolutions: { large: "/assets/scenes/paris-crossing.webp" },
    credit: "Elena Jiang",
    license: "Unsplash License",
    source: "https://unsplash.com/photos/a-group-of-people-walking-across-a-street-In8ZnvROgHg",
    alt: { fr: "Un groupe traverse une rue de Paris", en: "A group crossing a street in Paris", ar: "مجموعة تعبر شارعا في باريس" },
  },
  {
    id: "es-madrid-plaza",
    country: "ES",
    region: "Madrid",
    subject: "people meeting in a city square",
    light: "clear-daylight",
    colors: ["sky", "stone", "orange"],
    orientation: "landscape",
    resolutions: { large: "/assets/scenes/madrid-plaza.webp" },
    credit: "Igor Oliyarnik",
    license: "Unsplash License",
    source: "https://unsplash.com/photos/people-in-a-street-during-daytime-ufm2_BJBRGc",
    alt: { fr: "Des personnes sur la Plaza Mayor à Madrid", en: "People in Plaza Mayor in Madrid", ar: "أشخاص في ساحة بلازا مايور بمدريد" },
  },
  {
    id: "es-mallorca-street",
    country: "ES",
    region: "Mallorca",
    subject: "people sharing a lively street",
    light: "warm-daylight",
    colors: ["stone", "green", "orange"],
    orientation: "landscape",
    resolutions: { large: "/assets/scenes/mallorca-street.webp" },
    credit: "ZEIHLUND",
    license: "Unsplash License",
    source: "https://unsplash.com/photos/a-busy-street-with-many-people-qxOpHALiWQA",
    alt: { fr: "Une rue animée à Majorque", en: "A lively street in Mallorca", ar: "شارع حيوي في مايوركا" },
  },
];

const fallbackCountries = ["MA", "FR", "ES"];

function shuffled(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function selectPhotoSet(country, random = Math.random) {
  const normalized = String(country || "").toUpperCase();
  let candidates = photoCatalog.filter((photo) => photo.country === normalized);
  if (candidates.length < 2) candidates = photoCatalog.filter((photo) => fallbackCountries.includes(photo.country));
  return shuffled(candidates, random).slice(0, 2);
}

export function preloadPhotoSet(photos) {
  photos.forEach((photo) => {
    const image = new Image();
    image.decoding = "async";
    image.src = photo.resolutions.large;
  });
}
