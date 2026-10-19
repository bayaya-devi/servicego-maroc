import * as Leaflet from "/vendor/leaflet/leaflet-src.esm.js";
import { preloadPhotoSet, selectPhotoSet } from "/photo-catalog.js";
import { translate } from "/i18n.js";
const app = document.querySelector("#app");
const savedLocale = localStorage.getItem("servicego-locale");
const browserLocale = (navigator.languages?.[0] || navigator.language || "fr").toLowerCase();
const initialLocale = savedLocale || (browserLocale.startsWith("ar") ? "ar" : browserLocale.startsWith("en") ? "en" : "fr");
const state = {
  user: null,
  categories: [],
  map: { requests: [], services: [] },
  config: {
    mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    mapAttribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  },
  view: "home",
  selected: null,
  modal: null,
  authMode: "register",
  pendingIntent: null,
  pendingRoute: null,
  conversations: [],
  activeConversation: null,
  messages: [],
  mine: { requests: [], services: [] },
  offers: { request: null, items: [] },
  adminStats: null,
  locale: initialLocale,
  mapFilter: "all",
  mapCategory: "all",
  mapMode: "2d",
  publicMenuOpen: false,
  languageMenuOpen: false,
  legalTab: 0,
  geo: { country: "", region: "", city: "", source: "fallback" },
  publicPhotos: [],
  passwordVisible: false,
  mobileConversationOpen: false,
  locating: false,
};
let leafletMap = null;
let mapMarkerLayer = null;
let userLocationMarker = null;
let marketingMap = null;
let modalReturnAction = null;
const cities = {
  Casablanca: [33.5731, -7.5898],
  Rabat: [34.0209, -6.8416],
  Tanger: [35.7595, -5.834],
  Fes: [34.0331, -5.0003],
  Meknes: [33.8935, -5.5473],
  Marrakech: [31.6295, -7.9811],
  Agadir: [30.4278, -9.5981],
  Oujda: [34.6814, -1.9086],
  Kenitra: [34.261, -6.5802],
  Tetouan: [35.5711, -5.3724],
  "Beni Mellal": [32.3373, -6.3498],
  Laayoune: [27.1253, -13.1625],
};
function escape(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
}
function localizeDom() {
  const skipLink = document.querySelector(".skip-link");
  if (skipLink) skipLink.textContent = translate(state.locale, "Aller au contenu");
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const raw = node.nodeValue;
    const value = raw.trim();
    const localized = translate(state.locale, value);
    if (localized !== value) node.nodeValue = raw.replace(value, localized);
  }
  app.querySelectorAll("[placeholder]").forEach((element) => {
    const value = element.getAttribute("placeholder");
    const localized = translate(state.locale, value);
    if (localized !== value) element.setAttribute("placeholder", localized);
  });
  app.querySelectorAll("[aria-label], [data-label]").forEach((element) => {
    for (const attribute of ["aria-label", "data-label"]) {
      const value = element.getAttribute(attribute);
      const localized = translate(state.locale, value);
      if (localized !== value) element.setAttribute(attribute, localized);
    }
  });
}
async function api(path, options = {}) {
  const settings = {
    credentials: "same-origin",
    ...options,
    headers: {
      "accept-language": state.locale,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  };
  const response = await fetch(path, settings);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Une erreur est survenue.");
  return data;
}
function notify(message, isError = false) {
  const old = document.querySelector(".notice");
  old?.remove();
  const element = document.createElement("div");
  element.className = `notice${isError ? " error" : ""}`;
  element.textContent = translate(state.locale, message);
  document.body.append(element);
  setTimeout(() => element.remove(), 3600);
}
function coordsFromCity(city) {
  const [lat, lng] = cities[city] || cities.Rabat;
  return { latitude: lat, longitude: lng };
}
function pointStyle(latitude, longitude, i = 0) {
  const x = Math.max(
    8,
    Math.min(
      92,
      ((Number(longitude) + 13.25) / 12.25) * 100 + ((i % 3) - 1) * 2,
    ),
  );
  const y = Math.max(
    10,
    Math.min(90, ((35.95 - Number(latitude)) / 8.4) * 100 + ((i % 4) - 1) * 2),
  );
  return `left:${x}%;top:${y}%`;
}
function categoryOptions(selected = "") {
  return state.categories
    .map(
      (category) =>
        `<option value="${escape(category.id)}" ${category.id === selected ? "selected" : ""}>${escape(translate(state.locale, category.name))}</option>`,
    )
    .join("");
}
function cityOptions(selected = "Rabat") {
  return Object.keys(cities)
    .map(
      (city) =>
        `<option ${city === selected ? "selected" : ""}>${city}</option>`,
    )
    .join("");
}
function brand() {
  return `<button class="brand" data-action="home" aria-label="Accueil ServiceGO"><span class="brand-symbol" aria-hidden="true"><img src="/assets/servicego-symbol.png" alt=""></span><strong>Service<span>GO</span></strong></button>`;
}
const routeForView = { map: "/app/carte", messages: "/app/messages", profile: "/app/profil", admin: "/app/admin" };
const viewForRoute = Object.fromEntries(Object.entries(routeForView).map(([view, route]) => [route, view]));
function icon(name) {
  const paths = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    messages: '<path d="M5 18.5 3.5 22l4.5-2h9a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v7.5a4 4 0 0 0 2 3.5Z"/><path d="M8 9h8M8 13h5"/>',
    language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    faq: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.5 2.1c-.8.4-1.3 1-1.3 1.9v.4"/><path d="M12 17h.01"/>',
    legal: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h4M9 12h6M9 16h6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    send: '<path d="m3 11 18-8-8 18-2-8z"/><path d="m11 13 10-10"/>',
    location: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    request: '<path d="M12 3a7 7 0 0 0-7 7v8l3-2h4a7 7 0 1 0 0-14Z"/><path d="M12 7v6M9 10h6"/>',
    offer: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M8 12.5 10.7 15 16 9"/>',
    arrowLeft: '<path d="m15 18-6-6 6-6"/>',
    activity: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  };
  return `<svg class="sg-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.plus}</svg>`;
}
function initials(value) {
  return String(value || "ServiceGO").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}
function formatDate(value) {
  if (!value) return "";
  const normalized = /Z|[+-]\d\d:?\d\d$/.test(value) ? value : `${String(value).replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(state.locale, { day: "numeric", month: "short", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }).format(date);
}
function pricePresentation(item, request) {
  const raw = String(request ? item.budget_hint || "" : item.price_hint || "").trim();
  if (!raw) return { short: "À convenir", full: request ? "Budget à convenir" : "Prix à convenir" };
  if (/gratuit|bénévol|free|مجاني/i.test(raw)) return { short: "Gratuit", full: raw };
  return { short: "Rémunéré", full: raw };
}
function languageMenu() {
  if (!state.languageMenuOpen) return "";
  return `<div class="language-nucleus" role="menu" aria-label="Langue"><button data-action="set-locale" data-locale="fr" role="menuitem" lang="fr">FR <span>Français</span></button><button data-action="set-locale" data-locale="en" role="menuitem" lang="en">EN <span>English</span></button><button data-action="set-locale" data-locale="ar" role="menuitem" lang="ar">AR <span>العربية</span></button></div>`;
}
function header() {
  const signedIn = Boolean(state.user);
  if (!signedIn) return `<header class="public-nucleus ${state.publicMenuOpen ? "is-expanded" : ""}"><nav aria-label="Navigation principale"><button class="nucleus-icon" data-action="home" aria-label="Accueil" data-label="Accueil">${icon("home")}</button><button class="nucleus-icon" data-action="open-auth" aria-label="Connexion / Inscription" data-label="Connexion / Inscription">${icon("user")}</button><span class="nucleus-secondary" aria-hidden="${!state.publicMenuOpen}"><button class="nucleus-icon" data-action="open-language" aria-label="Langue" data-label="Langue" tabindex="${state.publicMenuOpen ? "0" : "-1"}">${icon("language")}</button><button class="nucleus-icon" data-action="open-faq" aria-label="Questions fréquentes" data-label="Questions fréquentes" tabindex="${state.publicMenuOpen ? "0" : "-1"}">${icon("faq")}</button><button class="nucleus-icon" data-action="open-legal" aria-label="Informations légales et contact" data-label="Informations légales et contact" tabindex="${state.publicMenuOpen ? "0" : "-1"}">${icon("legal")}</button></span><button class="nucleus-icon plus" data-action="toggle-public-menu" aria-label="${state.publicMenuOpen ? "Fermer" : "Plus"}" aria-expanded="${state.publicMenuOpen}" data-label="${state.publicMenuOpen ? "Fermer" : "Plus"}">${icon(state.publicMenuOpen ? "minus" : "plus")}</button></nav>${languageMenu()}</header>`;
  return `<header class="public-nucleus member-nucleus ${state.publicMenuOpen ? "is-expanded" : ""}"><nav aria-label="Navigation principale"><button class="nucleus-icon ${state.view === "map" ? "active" : ""}" data-action="view" data-view="map" aria-label="Accueil" data-label="Accueil">${icon("home")}</button><button class="nucleus-icon ${state.view === "messages" ? "active" : ""}" data-action="view" data-view="messages" aria-label="Messages" data-label="Messages">${icon("messages")}</button><button class="nucleus-icon ${state.view === "profile" ? "active" : ""}" data-action="view" data-view="profile" aria-label="Profil" data-label="Profil">${icon("user")}</button><span class="nucleus-secondary member-secondary" aria-hidden="${!state.publicMenuOpen}"><button class="nucleus-icon" data-action="open-legal" aria-label="Informations légales et contact" data-label="Informations légales et contact" tabindex="${state.publicMenuOpen ? "0" : "-1"}">${icon("legal")}</button></span><button class="nucleus-icon plus" data-action="toggle-public-menu" aria-label="${state.publicMenuOpen ? "Fermer" : "Plus"}" aria-expanded="${state.publicMenuOpen}" data-label="${state.publicMenuOpen ? "Fermer" : "Plus"}">${icon(state.publicMenuOpen ? "minus" : "plus")}</button></nav></header>`;
}
function staticBubble(kind, label, position, urgent = false) {
  return `<span class="map-bubble ${kind} ${urgent ? "urgent" : ""}" style="${position}">${escape(label)}</span>`;
}
function homeView() {
  const photos = state.publicPhotos.length ? state.publicPhotos : selectPhotoSet(state.geo.country);
  state.publicPhotos = photos;
  const first = photos[0];
  const second = photos[1] || photos[0];
  const alt = (photo) => escape(photo.alt[state.locale] || photo.alt.fr);
  const credit = [...new Set(photos.map((photo) => photo.credit))].join(" · ");
  const characters = `<div class="character-stage" aria-label="Les deux personnages ServiceGO se rencontrent"><img class="character blue-character" src="/assets/servicego-character-blue.svg" alt=""><span class="meeting-light" aria-hidden="true"></span><img class="character green-character" src="/assets/servicego-character-green.svg" alt=""></div>`;
  return `<main id="main-content" class="story-v21" tabindex="-1" style="--photo-one:url('${first.resolutions.large}');--photo-two:url('${second.resolutions.large}')"><div class="story-scroll" aria-hidden="true"><span id="moment-one"></span><span id="possibilities"></span><span id="moment-three"></span></div><div class="story-viewport"><div class="story-photo photo-one" role="img" aria-label="${alt(first)}"></div><div class="story-photo photo-two" role="img" aria-label="${alt(second)}"></div><div class="story-light" aria-hidden="true"></div><section class="narrative moment-one" aria-labelledby="story-title"><div class="discovery-copy"><h1 id="story-title"><span>Un besoin.</span><span>Une personne.</span><span>Une solution.</span></h1><button class="urgent-help-cta" data-action="urgent-request" aria-label="J'ai besoin d'aide maintenant"><span class="urgent-help-icon" aria-hidden="true">⚡</span><span>J'ai besoin d'aide maintenant</span></button></div><div class="device-perspective"><div class="smartphone" aria-label="Aperçu fictif de ServiceGO"><div class="phone-frame"><div class="phone-speaker" aria-hidden="true"></div><div class="phone-screen"><div class="phone-status" aria-hidden="true"><span>9:41</span><span>● ● ▰</span></div><div id="marketing-map" class="marketing-map" aria-label="Carte géographique fictive"></div></div><span class="phone-reflection" aria-hidden="true"></span></div></div></div><button class="discover-arrow" data-action="discover" aria-label="Découvrir"><span aria-hidden="true">↓</span></button></section><section class="narrative moment-two" aria-labelledby="possibility-title"><div class="story-content"><h2 id="possibility-title">Deux possibilités. Un seul compte.</h2>${characters}<div class="possibility-actions"><button class="possibility need" data-action="open-auth" data-intent="request"><span>Je demande</span></button><button class="possibility offer" data-action="open-auth" data-intent="offer"><span>Je propose</span></button></div></div></section><section class="narrative moment-three" aria-labelledby="conclusion-title"><div class="story-content">${characters}<h2 id="conclusion-title">L'entraide commence ici.</h2><button class="button large join" data-action="open-auth">Rejoindre ServiceGO</button><p class="photo-credit">${translate(state.locale, "Photos :")} ${escape(credit)} · Unsplash</p></div></section></div></main><button class="back-to-top" data-action="back-top" aria-label="Retour en haut">↑</button>`;
}
function mapBubbles() {
  const entries = [
    ...state.map.requests.map((item, index) => ({
      ...item,
      kind: "need",
      label: item.title,
      mapType: "request",
      index,
    })),
    ...state.map.services.map((item, index) => ({
      ...item,
      kind: "help",
      label: item.title,
      mapType: "service",
      index,
    })),
  ];
  if (!entries.length)
    return `<div class="map-empty"><strong>La carte attend la première bulle.</strong>Appuyez sur Demander ou Proposer pour commencer.</div>`;
  return entries
    .map(
      (item) =>
        `<button class="map-bubble ${item.kind} ${item.urgency === "urgent" ? "urgent" : ""}" style="${pointStyle(item.latitude, item.longitude, item.index)}" data-action="select" data-type="${item.mapType}" data-id="${item.id}" title="${escape(item.label)}">${escape(item.label)}</button>`,
    )
    .join("");
}
function accessibleMapList() {
  const entries = [
    ...state.map.requests.map((item) => ({ ...item, type: "request", kind: "need" })),
    ...state.map.services.map((item) => ({ ...item, type: "service", kind: "help" })),
  ].filter((item) => (state.mapFilter === "all" || state.mapFilter === item.type) && (state.mapCategory === "all" || state.mapCategory === item.category_id));
  if (!entries.length) return `<p class="page-lead">Aucun résultat avec ces filtres.</p>`;
  return entries.map((item) => `<button class="map-list-item ${item.kind}" data-action="select" data-type="${item.type}" data-id="${item.id}"><span>${item.kind === "need" ? "?" : "+"}</span><b>${escape(item.title)}</b><small>${escape(item.district)}</small></button>`).join("");
}
function mountInteractiveMap() {
  const target = document.querySelector("#liveMap");
  if (!target) return;
  leafletMap?.remove();
  leafletMap = Leaflet.map(target, {
    zoomControl: true,
    minZoom: 5,
    maxBounds: [
      [26.7, -14.8],
      [36.5, 0.4],
    ],
  }).setView([31.75, -7.1], 6);
  Leaflet.tileLayer(state.config.mapTileUrl, {
    maxZoom: 19,
    attribution: state.config.mapAttribution,
  }).addTo(leafletMap);
  const entries = [
    ...state.map.requests.map((item) => ({
      item,
      type: "request",
      kind: "need",
    })),
    ...state.map.services.map((item) => ({
      item,
      type: "service",
      kind: "help",
    })),
  ].filter((entry) => (state.mapFilter === "all" || state.mapFilter === entry.type) && (state.mapCategory === "all" || state.mapCategory === entry.item.category_id));
  const drawMarkers = () => {
    mapMarkerLayer?.remove();
    mapMarkerLayer = Leaflet.layerGroup().addTo(leafletMap);
    const zoom = leafletMap.getZoom();
    const cell = zoom <= 6 ? .55 : zoom <= 8 ? .2 : zoom <= 10 ? .07 : 0;
    const groups = new Map();
    entries.forEach((entry, index) => {
      const latitude = Number(entry.item.latitude);
      const longitude = Number(entry.item.longitude);
      const key = cell ? `${Math.round(latitude / cell)}:${Math.round(longitude / cell)}` : `item:${index}`;
      const group = groups.get(key) || [];
      group.push({ ...entry, latitude, longitude, index });
      groups.set(key, group);
    });
    for (const group of groups.values()) {
      if (group.length > 1) {
        const latitude = group.reduce((sum, entry) => sum + entry.latitude, 0) / group.length;
        const longitude = group.reduce((sum, entry) => sum + entry.longitude, 0) / group.length;
        const clusterIcon = Leaflet.divIcon({ className: "servicego-marker", html: `<button class="map-cluster" aria-label="${group.length} annonces">${group.length}<small>${translate(state.locale, "annonces")}</small></button>`, iconSize: [62, 62], iconAnchor: [31, 31] });
        Leaflet.marker([latitude, longitude], { icon: clusterIcon }).addTo(mapMarkerLayer).on("click", () => leafletMap.setView([latitude, longitude], Math.min(leafletMap.getZoom() + 2, 12)));
        continue;
      }
      const entry = group[0];
      const request = entry.type === "request";
      const pricing = pricePresentation(entry.item, request);
      const label = escape(entry.item.title).slice(0, 24);
      const category = escape(entry.item.category_icon || String(entry.item.category_name || "S").charAt(0));
      const markerIcon = Leaflet.divIcon({
        className: "servicego-marker",
        html: `<button class="premium-map-pin ${entry.kind} ${entry.item.urgency === "urgent" ? "urgent" : ""} ${zoom >= 8 ? "with-label" : ""}" aria-label="${label}"><span class="pin-category">${category}</span><span class="pin-copy"><b>${label}</b><small>${escape(translate(state.locale, pricing.short))}</small></span></button>`,
        iconSize: zoom >= 8 ? [156, 58] : [48, 48],
        iconAnchor: zoom >= 8 ? [28, 48] : [24, 42],
      });
      const offset = zoom >= 11 ? ((entry.index % 7) - 3) * .0018 : 0;
      Leaflet.marker([entry.latitude + offset, entry.longitude - offset], { icon: markerIcon })
        .addTo(mapMarkerLayer)
        .on("click", () => {
          state.selected = { type: entry.type, item: entry.item };
          const selection = document.querySelector(".selection");
          if (selection) {
            selection.innerHTML = `${selectedItem()}<details class="accessible-list"><summary>${translate(state.locale, "Liste accessible")}</summary>${accessibleMapList()}</details>`;
            selection.classList.add("has-selection");
            localizeDom();
          }
        });
    }
  };
  drawMarkers();
  leafletMap.on("zoomend", drawMarkers);
  if (!entries.length) {
    Leaflet.popup({ closeButton: false, autoClose: false, closeOnClick: false })
      .setLatLng([31.75, -7.1])
      .setContent(
        translate(state.locale, "Publiez le premier besoin ou service pour faire apparaître une bulle."),
      )
      .openOn(leafletMap);
  }
}
function locateUser() {
  if (!navigator.geolocation || !leafletMap) {
    notify("La localisation n'est pas disponible sur cet appareil.", true);
    return;
  }
  state.locating = true;
  document.querySelector('[data-action="locate-me"]')?.classList.add("is-locating");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      state.locating = false;
      userLocationMarker?.remove();
      userLocationMarker = Leaflet.circleMarker([coords.latitude, coords.longitude], { radius: 8, color: "#fff", weight: 3, fillColor: "#2585e6", fillOpacity: 1 })
        .addTo(leafletMap)
        .bindTooltip(translate(state.locale, "Votre position"));
      leafletMap.setView([coords.latitude, coords.longitude], Math.max(leafletMap.getZoom(), 13));
      notify("Carte recentrée sur votre position.");
      document.querySelector('[data-action="locate-me"]')?.classList.remove("is-locating");
    },
    (error) => {
      state.locating = false;
      const message = error.code === 1 ? "Localisation refusée. La carte reste disponible." : "Impossible d'obtenir votre position. Réessayez.";
      notify(message, true);
      document.querySelector('[data-action="locate-me"]')?.classList.remove("is-locating");
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 },
  );
}
function selectedItem() {
  if (!state.selected)
    return `<div class="selection-empty">${icon("location")}<p class="eyebrow">Sélection</p><h2>Choisissez une annonce</h2><p>Bleu pour les demandes, vert menthe pour les services proposés.</p></div>`;
  const item = state.selected.item;
  const own =
    item.requester_id === state.user?.id || item.user_id === state.user?.id;
  const request = state.selected.type === "request";
  const identity = request ? item.requester_name : item.full_name;
  const pricing = pricePresentation(item, request);
  const photo =
    request && item.photo_key
      ? `<img class="detail-photo" src="/api/files/${escape(item.photo_key)}" alt="Photo de la demande" />`
      : "";
  const actions = own
    ? request
      ? `<button class="button secondary" data-action="open-offers" data-id="${item.id}">Voir les réponses</button>`
      : `<button class="button outline" disabled>Votre service</button>`
    : request
      ? `<button class="button" data-action="open-reply" data-id="${item.id}">Proposer mon aide</button>`
      : `<button class="button green" data-action="open-direct" data-id="${item.id}">Demander ce service</button>`;
  return `<div class="listing-detail"><div class="listing-type ${request ? "need" : "help"}">${icon(request ? "request" : "offer")}<span>${translate(state.locale, request ? "Demande de service" : "Offre de service")}</span></div><h2>${escape(item.title)}</h2>${photo}<dl class="listing-facts"><div><dt>Catégorie</dt><dd>${escape(translate(state.locale, item.category_name || "Service"))}</dd></div><div><dt>${translate(state.locale, request ? "Budget" : "Prix")}</dt><dd>${escape(translate(state.locale, pricing.full))}</dd></div><div><dt>Localisation approximative</dt><dd>${escape(item.district)}</dd></div>${item.created_at ? `<div><dt>Publication</dt><dd>${escape(formatDate(item.created_at))}</dd></div>` : ""}</dl><p class="listing-description">${escape(item.description)}</p><div class="listing-author"><span class="conversation-avatar">${escape(initials(identity))}</span><div><small>Publié par</small><strong>${escape(identity || translate(state.locale, "Utilisateur ServiceGO"))}</strong>${!request && item.rating ? `<span>${Number(item.rating).toFixed(1)} / 5 · ${item.review_count || 0} ${translate(state.locale, "avis")}</span>` : ""}</div></div><div class="detail-actions">${actions}</div></div>`;
}
function mapView() {
  return `<main id="main-content" class="workspace premium-map-workspace" tabindex="-1"><section class="map-panel"><div id="liveMap" class="real-map" aria-label="Carte interactive du Maroc"></div><div class="map-floating-actions"><button class="map-fab request-fab" data-action="open-request" aria-label="Demander un service">${icon("request")}<span>Demander</span></button><button class="map-fab offer-fab" data-action="open-service" aria-label="Proposer un service">${icon("offer")}<span>Proposer</span></button></div><button class="map-locate" data-action="locate-me" aria-label="Activer ma localisation">${icon("location")}</button></section><aside class="panel selection">${selectedItem()}<details class="accessible-list"><summary>Liste accessible</summary>${accessibleMapList()}</details></aside></main>`;
}
function messagesView() {
  const current = state.conversations.find(
    (item) => item.id === state.activeConversation,
  );
  const list = state.conversations.length
    ? state.conversations
        .map(
          (item) =>
            `<button class="conversation ${item.id === state.activeConversation ? "active" : ""}" data-action="conversation" data-id="${item.id}"><span class="conversation-avatar">${escape(initials(item.other_name))}</span><span class="conversation-copy"><span><strong>${escape(item.other_name)}</strong><time>${escape(formatDate(item.updated_at))}</time></span><small>${escape(item.last_message || item.request_title || "Discussion ServiceGO")}</small></span></button>`,
        )
        .join("")
    : `<div class="empty-state">${icon("messages")}<strong>Aucune conversation</strong><p>Vos échanges apparaîtront ici après une mise en relation.</p></div>`;
  const chat = current
    ? `<section class="chat ${state.mobileConversationOpen ? "mobile-open" : ""}"><header class="chat-title"><button class="glass-back" data-action="messages-back" aria-label="Retour aux conversations">${icon("arrowLeft")}</button><span class="conversation-avatar">${escape(initials(current.other_name))}</span><div><strong>${escape(current.other_name)}</strong><small>${escape(current.request_title || "Discussion")}</small></div></header><div class="message-list">${state.messages.length ? state.messages.map((message) => `<div class="message ${message.sender_id === state.user.id ? "mine" : ""}"><p>${escape(message.body)}</p><small>${escape(message.sender_name)}${message.created_at ? ` · ${escape(formatDate(message.created_at))}` : ""}</small></div>`).join("") : `<div class="empty-state compact">${icon("messages")}<strong>Dites bonjour pour commencer.</strong></div>`}</div><form class="message-form" data-form="message"><input name="body" maxlength="2000" placeholder="Écrire un message" required /><button class="button icon" aria-label="Envoyer">${icon("send")}</button></form></section>`
    : `<section class="chat"><div class="empty-state">${icon("messages")}<strong>Choisissez une conversation</strong><p>Sélectionnez un échange dans la liste.</p></div></section>`;
  return `<main id="main-content" class="view-page member-page messages-page connection-surface" tabindex="-1"><div class="page-heading"><p class="eyebrow">Messages</p><h1>Vos discussions</h1><p class="page-lead">Retrouvez simplement les personnes avec qui vous êtes en contact.</p></div><div class="panel messages-layout ${state.mobileConversationOpen ? "show-conversation" : ""}"><aside class="conversation-list">${list}</aside>${chat}</div></main>`;
}
function profileView() {
  const user = state.user;
  const requestItems = state.mine.requests.length
    ? state.mine.requests
        .map(
          (item) =>
             `<li><button class="text-button" data-action="open-offers" data-id="${item.id}">${escape(item.title)}</button> <small>${escape(translate(state.locale, item.status))}</small></li>`,
        )
        .join("")
    : "<li>Aucune demande publiée.</li>";
  const serviceItems = state.mine.services.length
    ? state.mine.services
        .map(
          (item) =>
            `<li>${escape(item.title)} <small>${item.available ? "visible" : "masqué"}</small></li>`,
        )
        .join("")
    : "<li>Aucun service proposé.</li>";
  const admin = user.is_admin
    ? `<section class="panel profile-box"><h3>Administration</h3><p>${state.adminStats ? `${state.adminStats.users} ${translate(state.locale, "comptes")}<br>${state.adminStats.open_requests} ${translate(state.locale, "demandes ouvertes")}<br>${state.adminStats.active_services} ${translate(state.locale, "services visibles")}` : "Chargement des statistiques…"}</p></section>`
    : "";
  const activeRequests = state.mine.requests.filter((item) => item.status === "open" || item.status === "assigned").length;
  const completedRequests = state.mine.requests.filter((item) => item.status === "completed").length;
  const visibleServices = state.mine.services.filter((item) => item.available).length;
  return `<main id="main-content" class="view-page member-page profile-page connection-surface" tabindex="-1"><div class="page-heading profile-heading"><div><p class="eyebrow">Tableau de bord</p><h1>Votre espace ServiceGO</h1><p class="page-lead">Votre compte, vos activités et vos échanges au même endroit.</p></div><button class="nucleus-icon profile-settings" data-action="open-settings" aria-label="Paramètres" data-label="Paramètres">${icon("settings")}</button></div><div class="dashboard-sections"><section class="dashboard-section"><header><span>${icon("user")}</span><div><p class="eyebrow">Mon compte</p><h2>Identité et préférences</h2></div></header><article class="panel account-card"><div class="avatar">${escape(initials(user.full_name))}</div><div class="account-copy"><h3>${escape(user.full_name)}</h3><p>${escape(user.email)} · ${escape(user.district)}</p>${user.email_verified ? `<small>Adresse e-mail confirmée</small>` : `<small>Adresse e-mail à confirmer</small>`}</div><div class="profile-actions"><button class="button secondary" data-action="open-profile">Modifier</button><button class="button outline" data-action="logout">Se déconnecter</button></div></article></section><section class="dashboard-section"><header><span>${icon("activity")}</span><div><p class="eyebrow">Mon activité</p><h2>Demandes et services</h2></div></header><div class="dashboard-grid"><article class="panel dashboard-card"><h3>Mes demandes</h3><ul class="profile-list">${requestItems}</ul></article><article class="panel dashboard-card"><h3>Mes offres de service</h3><ul class="profile-list">${serviceItems}</ul></article></div></section><section class="dashboard-section"><header><span>${icon("messages")}</span><div><p class="eyebrow">Mes échanges</p><h2>Conversations</h2></div></header><article class="panel exchange-card"><div><strong>${state.conversations.length}</strong><span>${state.conversations.length > 1 ? "conversations" : "conversation"}</span></div><button class="button secondary" data-action="view" data-view="messages">Ouvrir mes messages</button></article></section><section class="dashboard-section"><header><span>${icon("clock")}</span><div><p class="eyebrow">Mon suivi</p><h2>Indicateurs réels</h2></div></header><div class="tracking-grid"><article class="panel"><strong>${activeRequests}</strong><span>Demandes actives</span></article><article class="panel"><strong>${completedRequests}</strong><span>Demandes terminées</span></article><article class="panel"><strong>${visibleServices}</strong><span>Services visibles</span></article><article class="panel"><strong>${state.conversations.length}</strong><span>Échanges</span></article></div></section>${admin}</div></main>`;
}
function adminView() {
  const stats = state.adminStats || {};
  return `<main id="main-content" class="view-page member-page" tabindex="-1"><p class="eyebrow">Administration</p><h1>Tableau de bord</h1><p class="page-lead">Vue réservée aux administrateurs ServiceGO.</p><div class="stats-grid"><section class="panel"><strong>${Number(stats.users || 0)}</strong><span>Utilisateurs</span></section><section class="panel"><strong>${Number(stats.open_requests || 0)}</strong><span>Demandes ouvertes</span></section><section class="panel"><strong>${Number(stats.active_services || 0)}</strong><span>Services actifs</span></section><section class="panel"><strong>${Number(stats.conversations || 0)}</strong><span>Conversations</span></section></div></main>`;
}
function authModal() {
  const register = state.authMode === "register";
  const forgot = state.authMode === "forgot";
  const country = state.geo.country || "MA";
  const codes = [["MA","+212"],["FR","+33"],["ES","+34"],["GB","+44"],["US","+1"],["DE","+49"],["AE","+971"],["IN","+91"]];
  if (forgot) return `<div class="modal-layer"><section class="modal public-modal auth-modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">ServiceGO</p><h2>Mot de passe oublié ?</h2><p class="modal-intro">Indiquez l'adresse utilisée pour votre compte.</p><form class="form-grid" data-form="forgot"><label class="field full"><span>E-mail</span><input name="email" type="email" autocomplete="email" placeholder="nom@exemple.com" required /></label><button class="button submit" type="submit">Envoyer le lien</button></form><button class="text-button auth-back" data-action="auth-tab" data-mode="login">Retour à la connexion</button></section></div>`;
  return `<div class="modal-layer"><section class="modal public-modal auth-modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">ServiceGO</p><h2>${register ? "Créez votre compte" : "Bon retour"}</h2><div class="modal-tabs"><button class="${register ? "active" : ""}" data-action="auth-tab" data-mode="register">Créer un compte</button><button class="${!register ? "active" : ""}" data-action="auth-tab" data-mode="login">Se connecter</button></div><form class="form-grid" data-form="auth">${register ? `<label class="field"><span>Prénom</span><input name="first_name" autocomplete="given-name" minlength="1" maxlength="40" placeholder="Votre prénom" required /></label><label class="field"><span>Nom</span><input name="last_name" autocomplete="family-name" minlength="1" maxlength="40" placeholder="Votre nom" required /></label>` : ""}<label class="field full"><span>E-mail</span><input name="email" type="email" autocomplete="email" placeholder="nom@exemple.com" required /></label>${register ? `<div class="phone-field full"><label class="field dial-code"><span>Indicatif</span><select name="dial_code" aria-label="Indicatif international">${codes.map(([iso,code])=>`<option value="${code}" ${iso===country?"selected":""}>${iso} ${code}</option>`).join("")}</select></label><label class="field phone-number"><span>Téléphone</span><input name="phone_number" maxlength="24" inputmode="tel" autocomplete="tel-national" placeholder="6 12 34 56 78" required /></label></div>` : ""}<label class="field full password-field"><span>Mot de passe</span><span class="password-input"><input name="password" type="${state.passwordVisible ? "text" : "password"}" autocomplete="${register ? "new-password" : "current-password"}" minlength="8" placeholder="8 caractères minimum" required /><button type="button" data-action="toggle-password" aria-label="${state.passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}">${state.passwordVisible ? "◉" : "○"}</button></span></label>${!register ? `<button type="button" class="text-button forgot-link" data-action="auth-tab" data-mode="forgot">Mot de passe oublié ?</button>` : ""}<button class="button submit" type="submit">${register ? "Créer mon compte" : "Se connecter"}</button></form><p class="form-note">Un seul compte pour demander un service et proposer votre aide.</p></section></div>`;
}
function requestModal() {
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">Demander</p><h2>Quel besoin avez-vous ?</h2><form class="form-grid" data-form="request"><label class="field"><span>Service</span><select name="category_id" required>${categoryOptions()}</select></label><label class="field"><span>Ville</span><select name="district">${cityOptions()}</select></label><label class="field full"><span>Titre court</span><input name="title" maxlength="100" placeholder="Ex. : fuite sous l'évier" required /></label><label class="field full"><span>Expliquez simplement</span><textarea name="description" maxlength="1200" placeholder="Décrivez ce qui doit être fait et précisez quand." required></textarea></label><label class="field"><span>Budget (facultatif)</span><input name="budget_hint" maxlength="80" placeholder="Ex. : 150 à 250 DH" /></label><label class="field"><span>Urgence</span><select name="urgency"><option value="normal">Normale</option><option value="urgent">Urgente</option></select></label><label class="field full"><span>Photo (facultative)</span><input type="file" name="photo" accept="image/*" /></label><button class="button submit" type="submit">Publier sur la carte</button></form></section></div>`;
}
function serviceModal() {
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">Proposer</p><h2>Quel service proposez-vous ?</h2><form class="form-grid" data-form="service"><label class="field"><span>Service</span><select name="category_id" required>${categoryOptions()}</select></label><label class="field"><span>Ville</span><select name="district">${cityOptions()}</select></label><label class="field full"><span>Titre court</span><input name="title" maxlength="100" placeholder="Ex. : peinture d'appartements" required /></label><label class="field full"><span>Expliquez votre service</span><textarea name="description" maxlength="1200" placeholder="Décrivez votre savoir-faire et vos disponibilités." required></textarea></label><label class="field full"><span>Prix indicatif (facultatif)</span><input name="price_hint" maxlength="80" placeholder="Ex. : à partir de 200 DH" /></label><button class="button green submit" type="submit">Me rendre visible</button></form></section></div>`;
}
function replyModal() {
  const item = state.selected?.item;
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">${translate(state.locale, "Répondre à")} ${escape(item?.title)}</p><h2>Proposez une solution</h2><form class="form-grid" data-form="reply"><input type="hidden" name="request_id" value="${escape(item?.id)}" /><label class="field full"><span>Votre message</span><textarea name="message" maxlength="1000" placeholder="Bonjour, je peux vous aider…" required></textarea></label><label class="field full"><span>Prix indicatif (facultatif)</span><input name="price_hint" maxlength="80" placeholder="Ex. : 180 DH" /></label><button class="button submit" type="submit">Envoyer ma réponse</button></form></section></div>`;
}
function directModal() {
  const item = state.selected?.item;
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">${translate(state.locale, "Demander à")} ${escape(item?.full_name)}</p><h2>${escape(item?.title)}</h2><form class="form-grid" data-form="direct"><input type="hidden" name="service_id" value="${escape(item?.id)}" /><label class="field"><span>Ville</span><select name="district">${cityOptions()}</select></label><label class="field"><span>Urgence</span><select name="urgency"><option value="normal">Normale</option><option value="urgent">Urgente</option></select></label><label class="field full"><span>Votre besoin</span><textarea name="description" maxlength="1200" placeholder="Bonjour, j'ai besoin de votre service…" required></textarea></label><label class="field full"><span>Budget (facultatif)</span><input name="budget_hint" maxlength="80" placeholder="Ex. : 300 DH" /></label><button class="button green submit" type="submit">Envoyer directement</button></form></section></div>`;
}
function profileModal() {
  const user = state.user;
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">Profil</p><h2>Vos informations</h2><form class="form-grid" data-form="profile"><label class="field full"><span>Prénom et nom</span><input name="full_name" value="${escape(user.full_name)}" maxlength="80" required /></label><label class="field"><span>Téléphone</span><input name="phone" value="${escape(user.phone || "")}" maxlength="30" /></label><label class="field"><span>Ville</span><select name="district">${cityOptions(user.district)}</select></label><label class="field full"><span>Quelques mots sur vous</span><textarea name="bio" maxlength="500">${escape(user.bio || "")}</textarea></label><label class="field full"><span>Nouvelle adresse e-mail</span><input name="new_email" type="email" autocomplete="email" placeholder="${translate(state.locale, "Laissez ce champ vide pour conserver")} ${escape(user.email)}" /></label><label class="field"><span>Mot de passe actuel</span><input name="current_password" type="password" autocomplete="current-password" /></label><label class="field"><span>Nouveau mot de passe</span><input name="new_password" type="password" minlength="8" autocomplete="new-password" /></label><button class="button submit" type="submit">Enregistrer</button></form></section></div>`;
}
function settingsModal() {
  return `<div class="modal-layer"><section class="modal public-modal settings-modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">ServiceGO</p><h2>Paramètres</h2><section class="settings-section"><h3>Langue</h3><div class="settings-languages" role="group" aria-label="Langue"><button class="${state.locale === "fr" ? "active" : ""}" data-action="set-locale" data-locale="fr">Français</button><button class="${state.locale === "en" ? "active" : ""}" data-action="set-locale" data-locale="en">English</button><button class="${state.locale === "ar" ? "active" : ""}" data-action="set-locale" data-locale="ar">العربية</button></div></section><section class="settings-section"><h3>Compte</h3><button class="button secondary" data-action="open-profile">Modifier mes informations</button></section></section></div>`;
}
function offersModal() {
  const request = state.offers.request;
  const offers = state.offers.items;
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">Réponses reçues</p><h2>${escape(request?.title || translate(state.locale, "Votre demande"))}</h2>${offers.length ? `<div class="offers-list">${offers.map((offer) => `<article class="offer"><strong>${escape(offer.full_name)}</strong><small>${Number(offer.rating || 5).toFixed(1)} / 5 - ${offer.review_count || 0} ${translate(state.locale, "avis")}</small><p>${escape(offer.message)}</p>${offer.price_hint ? `<b>${escape(offer.price_hint)}</b>` : ""}${offer.status === "pending" ? `<button class="button" data-action="accept-offer" data-id="${offer.id}">Accepter cette réponse</button>` : `<span class="offer-status">${escape(translate(state.locale, offer.status))}</span>`}</article>`).join("")}</div>` : `<p class="page-lead">Pas encore de réponse. Votre bulle est toujours visible sur la carte.</p>`}</section></div>`;
}
function quickModal() {
  return `<div class="modal-layer"><section class="modal quick-modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">Action rapide</p><h2>Que voulez-vous faire ?</h2><div class="quick-grid"><button class="choice" data-action="open-request"><span class="choice-icon">?</span><span><strong>Demander</strong><small>Publier un besoin</small></span></button><button class="choice green-choice" data-action="open-service"><span class="choice-icon">+</span><span><strong>Proposer</strong><small>Rendre un service visible</small></span></button></div><button class="button outline logout-wide" data-action="logout">Se déconnecter</button></section></div>`;
}
function infoModal() {
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">ServiceGO</p><h2>À propos</h2><p class="page-lead">Une plateforme locale pour demander, proposer et entrer simplement en contact. Les positions publiques restent approximatives.</p><div class="legend"><span><i class="dot blue"></i> Demandes</span><span><i class="dot orange"></i> Services</span><span><i class="dot mint"></i> Mise en relation</span></div><p class="form-note">Service commercial en phase de lancement. Ne partagez jamais votre mot de passe ni votre code de vérification.</p></section></div>`;
}
function faqModal() {
  const copy = {
    fr: { title:"Questions fréquentes", items:[["Qu'est-ce que ServiceGO ?","Une plateforme qui met en relation des personnes ayant un besoin avec celles qui peuvent aider."],["Un compte peut-il demander et proposer ?","Oui. Le même compte permet de publier des demandes et de proposer des services."],["Les services peuvent-ils être gratuits ?","Oui. Les personnes choisissent ensemble si le service est gratuit ou rémunéré."],["Comment publier une demande ?","Connectez-vous, choisissez « Je demande », puis décrivez votre besoin avant de le publier."],["Comment proposer mon aide ?","Connectez-vous, choisissez « Je propose », puis indiquez clairement le service disponible."],["Comment contacter une personne ?","Sélectionnez une annonce et envoyez une réponse ou une demande directe pour ouvrir une conversation."],["Ma localisation exacte est-elle visible ?","Non. La carte des membres affiche volontairement une position approximative."],["Comment signaler un problème ?","Écrivez à aetbconseil@gmail.com en indiquant le compte ou l'annonce concernés."]] },
    en: { title:"Frequently asked questions", items:[["What is ServiceGO?","A platform that connects people who need a service with people who can help."],["Can one account request and offer services?","Yes. The same account can post requests and offer services."],["Can services be free?","Yes. People agree together whether a service is free or paid."],["How do I post a request?","Sign in, select “I need help,” describe what you need and post your request."],["How do I offer help?","Sign in, select “I offer help,” then describe the available service clearly."],["How do I contact someone?","Select a listing and send a reply or direct request to open a conversation."],["Is my exact location visible?","No. The member map deliberately displays an approximate location."],["How do I report a problem?","Email aetbconseil@gmail.com and identify the account or listing concerned."]] },
    ar: { title:"الأسئلة الشائعة", items:[["ما هي ServiceGO؟","منصة تربط بين من يحتاج إلى خدمة ومن يستطيع تقديم المساعدة."],["هل يمكن للحساب نفسه طلب الخدمات وعرضها؟","نعم. يتيح الحساب نفسه نشر الطلبات وعرض الخدمات."],["هل يمكن أن تكون الخدمات مجانية؟","نعم. يتفق الأشخاص معًا على ما إذا كانت الخدمة مجانية أو مدفوعة."],["كيف أنشر طلبًا؟","سجّل الدخول، واختر «أطلب خدمة»، ثم صف حاجتك وانشر الطلب."],["كيف أعرض مساعدتي؟","سجّل الدخول، واختر «أعرض المساعدة»، ثم صف الخدمة المتاحة بوضوح."],["كيف أتواصل مع شخص؟","اختر إعلانًا وأرسل ردًا أو طلبًا مباشرًا لفتح محادثة."],["هل يظهر موقعي الدقيق؟","لا. تعرض خريطة الأعضاء موقعًا تقريبيًا فقط."],["كيف أبلّغ عن مشكلة؟","راسل aetbconseil@gmail.com وحدد الحساب أو الإعلان المعني."]] }
  }[state.locale] || null;
  return `<div class="modal-layer"><section class="modal public-modal public-info-modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">ServiceGO</p><h2>${copy.title}</h2><div class="faq-list">${copy.items.map(([question,answer],index)=>`<details ${index===0?"open":""}><summary>${question}</summary><p>${answer}</p></details>`).join("")}</div></section></div>`;
}
function legalModal() {
  const copy = {
    fr: { eyebrow:"Informations publiques",title:"Cadre légal et confidentialité",labels:["Mentions légales","Conditions d'utilisation","Confidentialité","Cookies","Services","Contact"],texts:["Éditeur, adresse du siège et numéro d'immatriculation : informations à compléter par le propriétaire du projet.","La version contractuelle doit être validée et publiée avant la commercialisation complète.","ServiceGO limite la carte opérationnelle aux membres et affiche des positions approximatives. La politique complète reste à valider.","La session utilise un cookie HTTPOnly nécessaire à la connexion. Les informations complémentaires restent à préciser si d'autres outils sont ajoutés.","ServiceGO met en relation des personnes qui demandent ou proposent un service. Les conditions commerciales détaillées restent à valider.","Pour toute question relative à ServiceGO, utilisez l'adresse de contact ci-dessous."] },
    en: { eyebrow:"Public information",title:"Legal and privacy framework",labels:["Legal notice","Terms of use","Privacy","Cookies","Services","Contact"],texts:["Publisher, registered office and registration number: information to be completed by the project owner.","The contractual version must be approved and published before full commercial launch.","ServiceGO limits the operational map to members and displays approximate locations. The complete policy still requires approval.","The session uses an HTTPOnly cookie required for sign-in. Additional information must be added if other tools are introduced.","ServiceGO connects people requesting or offering a service. Detailed commercial terms still require approval.","For any question about ServiceGO, use the contact address below."] },
    ar: { eyebrow:"معلومات عامة",title:"الإطار القانوني والخصوصية",labels:["الإشعار القانوني","شروط الاستخدام","الخصوصية","ملفات الارتباط","الخدمات","اتصل بنا"],texts:["الناشر وعنوان المقر ورقم التسجيل: معلومات يجب على مالك المشروع استكمالها.","يجب اعتماد النسخة التعاقدية ونشرها قبل الإطلاق التجاري الكامل.","تقصر ServiceGO الخريطة التشغيلية على الأعضاء وتعرض مواقع تقريبية. لا تزال السياسة الكاملة بحاجة إلى الاعتماد.","تستخدم الجلسة ملف ارتباط HTTPOnly ضروريا لتسجيل الدخول. يجب إضافة معلومات أخرى إذا أضيفت أدوات جديدة.","تربط ServiceGO بين الأشخاص الذين يطلبون خدمة أو يعرضونها. لا تزال الشروط التجارية التفصيلية بحاجة إلى الاعتماد.","لأي سؤال متعلق بـ ServiceGO، استخدم عنوان الاتصال أدناه."] }
  }[state.locale] || null;
  const active = Math.max(0, Math.min(copy.labels.length - 1, state.legalTab));
  const contactAction = active === 5 ? `<a class="contact-email" href="mailto:aetbconseil@gmail.com">aetbconseil@gmail.com</a><a class="button contact-action" href="mailto:aetbconseil@gmail.com?subject=ServiceGO">${translate(state.locale, "Nous écrire")}</a>` : "";
  return `<div class="modal-layer"><section class="modal public-modal public-info-modal legal-modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">${copy.eyebrow}</p><h2>${copy.title}</h2><nav class="legal-nav" aria-label="Rubriques légales">${copy.labels.map((label,index)=>`<button class="${index===active?"active":""}" data-action="legal-tab" data-index="${index}" aria-current="${index===active?"page":"false"}">${label}</button>`).join("")}</nav><div class="legal-content" aria-live="polite"><h3>${copy.labels[active]}</h3><p>${copy.texts[active]}</p>${contactAction}</div></section></div>`;
}
function modal() {
  if (!state.modal) return "";
  if (state.modal === "auth") return authModal();
  if (state.modal === "request") return requestModal();
  if (state.modal === "service") return serviceModal();
  if (state.modal === "reply") return replyModal();
  if (state.modal === "direct") return directModal();
  if (state.modal === "profile") return profileModal();
  if (state.modal === "settings") return settingsModal();
  if (state.modal === "offers") return offersModal();
  if (state.modal === "quick") return quickModal();
  if (state.modal === "info") return infoModal();
  if (state.modal === "faq") return faqModal();
  if (state.modal === "legal") return legalModal();
  return "";
}
function render() {
  const view =
    !state.user || state.view === "home"
      ? homeView()
      : state.view === "messages"
        ? messagesView()
        : state.view === "profile"
          ? profileView()
          : state.view === "admin"
            ? adminView()
          : mapView();
  app.innerHTML = `<div class="app">${header()}${view}${modal()}</div>`;
  document.documentElement.lang = state.locale;
  document.documentElement.dir = state.locale === "ar" ? "rtl" : "ltr";
  document.body.dataset.space = state.user && state.view !== "home" ? "member" : "visitor";
  document.body.classList.toggle("modal-open", Boolean(state.modal));
  document.title = `ServiceGO | ${state.view === "home" ? translate(state.locale, "Du besoin à la solution") : state.view}`;
  const dialog = document.querySelector(".modal");
  if (dialog) {
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const title = dialog.querySelector("h2");
    if (title) { title.id = "dialog-title"; dialog.setAttribute("aria-labelledby", title.id); }
    requestAnimationFrame(() => dialog.querySelector("input, select, textarea, button")?.focus());
  }
  localizeDom();
  if (state.user && state.view === "map") mountInteractiveMap();
  if (!state.user || state.view === "home") initializeStory();
}
function closeModal() {
  if (state.modal === "auth") state.pendingIntent = null;
  state.modal = null;
}
function initializeStory() {
  if (marketingMap) marketingMap.remove();
  const mapElement = document.querySelector("#marketing-map");
  if (mapElement) {
    const [lat, lng, zoom] = [32.45, -6.45, 5];
    marketingMap = Leaflet.map(mapElement, { center: [lat, lng], zoom, zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, keyboard: false, touchZoom: false });
    Leaflet.tileLayer(state.config.mapTileUrl, { attribution: state.config.mapAttribution, maxZoom: 18 }).addTo(marketingMap);
    const previewMarkers = [
      { position: cities.Rabat, label: "Fuite", kind: "need", urgent: true },
      { position: cities.Casablanca, label: "Peinture", kind: "help" },
      { position: cities.Fes, label: "Livraison", kind: "need" },
      { position: cities.Marrakech, label: "Ménage", kind: "help" },
    ];
    for (const marker of previewMarkers) {
      const markerIcon = Leaflet.divIcon({ className: "marketing-marker", html: `<span class="map-bubble ${marker.kind} ${marker.urgent ? "urgent" : ""}">${translate(state.locale, marker.label)}</span>`, iconSize: [88, 46], iconAnchor: [44, 38] });
      Leaflet.marker(marker.position, { icon: markerIcon, interactive: false }).addTo(marketingMap);
    }
  }
  updateStoryProgress();
}
function updateStoryProgress() {
  const story = document.querySelector(".story-v21");
  if (!story) return;
  const progress = Math.min(1, Math.max(0, (window.scrollY - story.offsetTop) / Math.max(1, story.scrollHeight - innerHeight)));
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const smooth = (value) => {
    const clamped = clamp(value);
    return clamped * clamped * (3 - 2 * clamped);
  };
  const characterProgress = clamp((progress - 0.17) / 0.58);
  const emergence = smooth(characterProgress / 0.16);
  const separation = smooth((characterProgress - 0.1) / 0.22);
  const approach = smooth((characterProgress - 0.38) / 0.25);
  const returnHome = smooth((characterProgress - 0.7) / 0.2);
  const meeting = smooth((characterProgress - 0.38) / 0.25);
  const conclusion = Math.min(1, Math.max(0, (progress - 0.68) / 0.2));
  const momentOne = 1 - Math.min(1, Math.max(0, (progress - 0.12) / 0.16));
  const momentTwoIn = Math.min(1, Math.max(0, (progress - 0.18) / 0.14));
  const momentTwoOut = 1 - Math.min(1, Math.max(0, (progress - 0.61) / 0.13));
  const momentTwo = Math.min(momentTwoIn, momentTwoOut);
  const phoneOpacity = 1 - Math.min(1, Math.max(0, (progress - 0.38) / 0.13));
  const titleOpacity = Math.min(1, Math.max(0, (meeting - 0.16) / 0.4));
  const actionOpacity = Math.min(1, Math.max(0, (meeting - 0.7) / 0.3));
  const characterWidth = innerWidth <= 390 ? 105 : innerWidth <= 760 ? 124 : 170;
  const stageWidth = Math.min(640, innerWidth * 0.9);
  const maxGap = Math.min(190, Math.max(24, stageWidth - characterWidth * 2 - 12));
  const restingGap = Math.min(112, maxGap * 0.64);
  const characterGap = 8 + separation * maxGap - approach * maxGap + returnHome * restingGap;
  const meetingGlow = Math.sin(clamp((characterProgress - 0.5) / 0.36) * Math.PI);
  document.documentElement.style.setProperty("--story-progress", progress.toFixed(4));
  document.documentElement.style.setProperty("--meeting-progress", meeting.toFixed(4));
  document.documentElement.style.setProperty("--conclusion-progress", conclusion.toFixed(4));
  document.documentElement.style.setProperty("--moment-one-opacity", momentOne.toFixed(4));
  document.documentElement.style.setProperty("--moment-two-opacity", momentTwo.toFixed(4));
  document.documentElement.style.setProperty("--phone-opacity", phoneOpacity.toFixed(4));
  document.documentElement.style.setProperty("--title-opacity", titleOpacity.toFixed(4));
  document.documentElement.style.setProperty("--action-opacity", actionOpacity.toFixed(4));
  document.documentElement.style.setProperty("--action-shift", `${((1 - actionOpacity) * 16).toFixed(2)}px`);
  document.documentElement.style.setProperty("--character-gap", `${characterGap.toFixed(2)}px`);
  document.documentElement.style.setProperty("--character-half-gap", `${(characterGap / 2).toFixed(2)}px`);
  document.documentElement.style.setProperty("--character-scale", (0.42 + emergence * 0.58).toFixed(4));
  document.documentElement.style.setProperty("--character-opacity", emergence.toFixed(4));
  document.documentElement.style.setProperty("--meeting-glow", meetingGlow.toFixed(4));
  document.documentElement.style.setProperty("--phone-shift", `${(-progress * 36).toFixed(2)}px`);
  document.documentElement.style.setProperty("--photo-scale", (1.06 - progress * 0.035).toFixed(4));
  document.documentElement.style.setProperty("--moment-two-shift", `${((1 - momentTwo) * 20).toFixed(2)}px`);
  document.documentElement.style.setProperty("--conclusion-shift", `${((1 - conclusion) * 26).toFixed(2)}px`);
  document.documentElement.style.setProperty("--phone-rotate", `${(-10 + Math.min(progress, .52) * 35).toFixed(2)}deg`);
  document.querySelector(".moment-two")?.classList.toggle("is-interactive", actionOpacity > 0.45);
  document.querySelector(".moment-three")?.classList.toggle("is-interactive", conclusion > 0.45);
  document.querySelector(".back-to-top")?.classList.toggle("visible", progress > 0.72);
}
window.addEventListener("scroll", updateStoryProgress, { passive: true });
async function loadMap() {
  const [mapData, categories] = await Promise.all([
    api("/api/map"),
    api("/api/categories"),
  ]);
  state.map = mapData;
  state.categories = categories.categories;
}
async function loadMine() {
  const [requests, services] = await Promise.all([
    api("/api/requests"),
    api("/api/services"),
  ]);
  state.mine = { requests: requests.requests, services: services.services };
}
async function loadConversations(selectFirst = false) {
  const data = await api("/api/conversations");
  state.conversations = data.conversations;
  if (selectFirst && !state.activeConversation && data.conversations[0])
    state.activeConversation = data.conversations[0].id;
  if (state.activeConversation) {
    const messages = await api(
      `/api/conversations/${state.activeConversation}/messages`,
    );
    state.messages = messages.messages;
  }
}
async function prepareView(view) {
  if (view === "map") await loadMap();
  if (view === "messages") await loadConversations(true);
  if (view === "profile") {
    await Promise.all([loadMine(), loadConversations(false)]);
    if (state.user?.is_admin) state.adminStats = (await api("/api/admin/overview")).stats;
  }
  if (view === "admin" && state.user?.is_admin) state.adminStats = (await api("/api/admin/overview")).stats;
}
async function navigateToView(view, { replace = false, renderNow = true } = {}) {
  const target = routeForView[view] ? view : "map";
  state.view = target;
  state.selected = null;
  state.mobileConversationOpen = false;
  await prepareView(target);
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({ view: target }, "", routeForView[target]);
  if (renderNow) render();
}
async function start() {
  try {
    const [data, config, context] = await Promise.all([
      api("/api/me"),
      api("/api/config"),
      api("/api/public-context").catch(() => ({ country: "", region: "", city: "", source: "fallback" })),
    ]);
    state.user = data.user;
    state.config = config;
    state.geo = context;
    if (!state.geo.country) {
      const region = (navigator.languages?.[0] || navigator.language || "").split("-")[1];
      if (region && /^[A-Za-z]{2}$/.test(region)) state.geo = { ...state.geo, country: region.toUpperCase(), source: "browser-locale" };
    }
    state.publicPhotos = selectPhotoSet(state.geo.country);
    preloadPhotoSet(state.publicPhotos);
    if (state.user) {
      const requestedView = viewForRoute[window.location.pathname];
      state.view = requestedView || "map";
      await prepareView(state.view);
      if (!requestedView) window.history.replaceState({ view: state.view }, "", routeForView[state.view]);
    } else if (viewForRoute[window.location.pathname]) {
      state.pendingRoute = viewForRoute[window.location.pathname];
      state.authMode = "login";
      state.modal = "auth";
      window.history.replaceState({}, "", "/");
    }
    if (
      new URLSearchParams(window.location.search).get("email_verified") === "1"
    ) {
      window.history.replaceState({}, "", window.location.pathname);
      notify("Adresse e-mail confirmée.");
    }
  } catch {
    notify("Impossible de joindre ServiceGO.", true);
  }
  render();
}
app.addEventListener("click", async (event) => {
  if (event.target.classList?.contains("modal-layer")) {
    closeModal();
    render();
    requestAnimationFrame(() => document.querySelector(`[data-action="${modalReturnAction}"]`)?.focus());
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === "home") {
      if (state.user) await navigateToView("map");
      else {
        state.view = "home";
        state.selected = null;
        window.history.pushState({ view: "home" }, "", "/");
        render();
      }
    }
    if (action === "preview-map")
      document
        .querySelector("#preview")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (action === "discover")
      document.querySelector("#possibilities")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (action === "back-top") window.scrollTo({ top: 0, behavior: "smooth" });
    if (action === "open-auth") {
      modalReturnAction = action;
      state.pendingIntent = null;
      state.authMode = "register";
      state.modal = "auth";
      render();
    }
    if (action === "urgent-request") {
      modalReturnAction = action;
      if (state.user) {
        if (!state.categories.length) await loadMap();
        state.view = "map";
        state.modal = "request";
        window.history.replaceState({ view: "map" }, "", routeForView.map);
      } else {
        state.pendingIntent = "request";
        state.authMode = "register";
        state.modal = "auth";
      }
      render();
    }
    if (action === "open-quick") {
      state.modal = "quick";
      render();
    }
    if (action === "toggle-public-menu") {
      state.publicMenuOpen = !state.publicMenuOpen;
      if (!state.publicMenuOpen) state.languageMenuOpen = false;
      render();
    }
    if (action === "open-language") {
      state.languageMenuOpen = !state.languageMenuOpen;
      render();
    }
    if (action === "set-locale") {
      state.locale = button.dataset.locale;
      localStorage.setItem("servicego-locale", state.locale);
      state.languageMenuOpen = false;
      render();
    }
    if (action === "open-faq") {
      modalReturnAction = action;
      state.modal = "faq";
      render();
    }
    if (action === "open-legal") {
      modalReturnAction = action;
      state.legalTab = 0;
      state.modal = "legal";
      render();
    }
    if (action === "open-info") {
      state.modal = "info";
      render();
    }
    if (action === "close-modal") {
      closeModal();
      render();
      requestAnimationFrame(() => document.querySelector(`[data-action="${modalReturnAction}"]`)?.focus());
    }
    if (action === "auth-tab") {
      state.authMode = button.dataset.mode;
      render();
    }
    if (action === "toggle-password") {
      state.passwordVisible = !state.passwordVisible;
      render();
    }
    if (action === "legal-tab") {
      state.legalTab = Number(button.dataset.index || 0);
      const updated = document.createElement("div");
      updated.innerHTML = legalModal();
      const nextDialog = updated.querySelector(".legal-modal");
      const currentDialog = document.querySelector(".legal-modal");
      if (nextDialog && currentDialog) {
        currentDialog.querySelector(".legal-nav").replaceWith(nextDialog.querySelector(".legal-nav"));
        currentDialog.querySelector(".legal-content").replaceWith(nextDialog.querySelector(".legal-content"));
        currentDialog.querySelector(`[data-index="${state.legalTab}"]`)?.focus();
      }
    }
    if (action === "open-request") {
      state.modal = "request";
      render();
    }
    if (action === "locate-me") locateUser();
    if (action === "open-service") {
      state.modal = "service";
      render();
    }
    if (action === "open-reply") {
      state.modal = "reply";
      render();
    }
    if (action === "open-direct") {
      state.modal = "direct";
      render();
    }
    if (action === "open-profile") {
      state.modal = "profile";
      render();
    }
    if (action === "open-settings") {
      modalReturnAction = action;
      state.modal = "settings";
      render();
    }
    if (action === "resend-verification") {
      const data = await api("/api/auth/resend-verification", {
        method: "POST",
      });
      notify(data.message);
    }
    if (action === "open-offers") {
      const data = await api(`/api/requests/${button.dataset.id}/offers`);
      state.offers = { request: data.request, items: data.offers };
      state.modal = "offers";
      render();
    }
    if (action === "accept-offer") {
      const data = await api(`/api/offers/${button.dataset.id}/accept`, {
        method: "POST",
      });
      state.modal = null;
      state.activeConversation = data.conversation_id;
      await navigateToView("messages");
      notify("Réponse acceptée. La discussion est ouverte.");
    }
    if (action === "view") {
      await navigateToView(button.dataset.view);
    }
    if (action === "filter-map") {
      state.mapFilter = button.dataset.value;
      state.selected = null;
      render();
    }
    if (action === "map-mode") {
      state.mapMode = button.dataset.value;
      render();
    }
    if (action === "select") {
      const type = button.dataset.type;
      const entries =
        type === "request" ? state.map.requests : state.map.services;
      state.selected = {
        type,
        item: entries.find((entry) => entry.id === button.dataset.id),
      };
      const selection = document.querySelector(".selection");
      if (selection) {
        selection.innerHTML = `${selectedItem()}<details class="accessible-list"><summary>${translate(state.locale, "Liste accessible")}</summary>${accessibleMapList()}</details>`;
        selection.classList.add("has-selection");
        selection.scrollTop = 0;
        localizeDom();
      }
    }
    if (action === "conversation") {
      state.activeConversation = button.dataset.id;
      const messages = await api(
        `/api/conversations/${state.activeConversation}/messages`,
      );
      state.messages = messages.messages;
      state.mobileConversationOpen = true;
      if (window.matchMedia("(max-width: 760px)").matches) {
        window.history.pushState({ view: "messages", conversation: state.activeConversation }, "", `${routeForView.messages}?conversation=${encodeURIComponent(state.activeConversation)}`);
      }
      render();
    }
    if (action === "messages-back") {
      if (new URLSearchParams(window.location.search).has("conversation")) window.history.back();
      else {
        state.mobileConversationOpen = false;
        render();
      }
    }
    if (action === "logout") {
      await api("/api/auth/logout", { method: "POST" });
      state.user = null;
      state.view = "home";
      state.selected = null;
      state.modal = null;
      state.pendingIntent = null;
      state.pendingRoute = null;
      state.publicMenuOpen = false;
      window.history.replaceState({}, "", "/");
      render();
      notify("Vous êtes déconnecté.");
    }
  } catch (error) {
    notify(error.message, true);
  }
});
app.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches('[data-action="locale"]')) {
    state.locale = target.value;
    localStorage.setItem("servicego-locale", state.locale);
    render();
  }
  if (target.matches('[data-action="filter-category"]')) {
    state.mapCategory = target.value;
    state.selected = null;
    render();
  }
});
document.addEventListener("click", (event) => {
  if (state.languageMenuOpen && !event.target.closest(".public-nucleus")) {
    state.languageMenuOpen = false;
    render();
  }
});
window.addEventListener("scroll", () => {
  if (state.languageMenuOpen) {
    state.languageMenuOpen = false;
    render();
  }
}, { passive: true });
window.addEventListener("popstate", async () => {
  if (!state.user) {
    state.view = "home";
    render();
    return;
  }
  const view = viewForRoute[window.location.pathname] || "map";
  state.view = view;
  state.mobileConversationOpen = view === "messages" && new URLSearchParams(window.location.search).has("conversation");
  await prepareView(view);
  render();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.modal) {
    closeModal();
    render();
    requestAnimationFrame(() => document.querySelector(`[data-action="${modalReturnAction}"]`)?.focus());
    return;
  }
  if (event.key === "Escape" && state.languageMenuOpen) {
    state.languageMenuOpen = false;
    render();
    requestAnimationFrame(() => document.querySelector('[data-action="open-language"]')?.focus());
    return;
  }
  if (event.key !== "Tab" || !state.modal) return;
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return;
  const controls = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')];
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
app.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const type = form.dataset.form;
  const values = Object.fromEntries(new FormData(form).entries());
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton?.disabled) return;
  if (submitButton) submitButton.disabled = true;
  try {
    if (type === "auth") {
      if (state.authMode === "register") {
        values.full_name = `${String(values.first_name || "").trim()} ${String(values.last_name || "").trim()}`.trim();
        values.phone = `${String(values.dial_code || "").trim()}${String(values.phone_number || "").replace(/[^0-9]/g, "")}`;
        delete values.first_name;
        delete values.last_name;
        delete values.dial_code;
        delete values.phone_number;
      }
      const endpoint =
        state.authMode === "register"
          ? "/api/auth/register"
          : "/api/auth/login";
      const data = await api(endpoint, {
        method: "POST",
        body: JSON.stringify(values),
      });
      state.user = data.user;
      state.pendingIntent = null;
      state.pendingRoute = null;
      state.modal = null;
      await navigateToView("map", { replace: true });
      notify(
        state.authMode === "register"
          ? data.email_delivery_configured
            ? "Un lien de confirmation vient d'être envoyé."
            : "Compte créé. L'envoi de l'e-mail de confirmation n'est pas encore configuré."
          : "Bienvenue sur ServiceGO.",
      );
    }
    if (type === "forgot") {
      const data = await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(values) });
      notify(data.message);
      state.authMode = "login";
      render();
    }
    if (type === "request") {
      const city = String(values.district);
      const coordinates = coordsFromCity(city);
      const photo = form.querySelector('input[name="photo"]');
      if (photo?.files?.[0]) {
        const upload = new FormData();
        upload.append("file", photo.files[0]);
        const response = await fetch("/api/uploads", {
          method: "POST",
          credentials: "same-origin",
          body: upload,
        });
        const uploaded = await response.json();
        if (!response.ok)
          throw new Error(uploaded.error || "Impossible d'envoyer la photo.");
        values.photo_key = uploaded.key;
      }
      await api("/api/requests", {
        method: "POST",
        body: JSON.stringify({ ...values, ...coordinates }),
      });
      state.modal = null;
      state.view = "map";
      await loadMap();
      render();
      notify("Votre besoin est maintenant visible.");
    }
    if (type === "service") {
      const coordinates = coordsFromCity(String(values.district));
      await api("/api/services", {
        method: "POST",
        body: JSON.stringify({ ...values, ...coordinates }),
      });
      state.modal = null;
      state.view = "map";
      await loadMap();
      render();
      notify("Votre service est maintenant visible.");
    }
    if (type === "reply") {
      await api(`/api/requests/${values.request_id}/offers`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      state.modal = null;
      render();
      notify("Votre réponse a été envoyée.");
    }
    if (type === "direct") {
      const coordinates = coordsFromCity(String(values.district));
      const data = await api(`/api/services/${values.service_id}/request`, {
        method: "POST",
        body: JSON.stringify({ ...values, ...coordinates }),
      });
      state.modal = null;
      state.view = "messages";
      state.activeConversation = data.conversation_id;
      await loadConversations();
      render();
      notify("Demande envoyée. La discussion est ouverte.");
    }
    if (type === "profile") {
      const data = await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      if (values.new_password)
        await api("/api/me/password", {
          method: "POST",
          body: JSON.stringify(values),
        });
      if (values.new_email)
        await api("/api/me/email", {
          method: "POST",
          body: JSON.stringify(values),
        });
      state.user = data.user;
      state.modal = null;
      render();
      notify("Profil enregistré.");
    }
    if (type === "message") {
      await api(`/api/conversations/${state.activeConversation}/messages`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      await loadConversations();
      render();
    }
  } catch (error) {
    notify(error.message, true);
  } finally {
    if (submitButton?.isConnected) submitButton.disabled = false;
  }
});
start();
