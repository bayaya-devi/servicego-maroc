import * as Leaflet from "/vendor/leaflet/leaflet-src.esm.js";
import { preloadPhotoSet, selectPhotoSet } from "/photo-catalog.js";
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
  authMode: "login",
  pendingIntent: null,
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
  legalTab: 0,
  geo: { country: "", region: "", city: "", source: "fallback" },
  publicPhotos: [],
  passwordVisible: false,
};
let leafletMap = null;
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
const uiTranslations = {
  en: {
    "Partout au Maroc":"Across Morocco","Un besoin. Une personne proche. Une solution.":"One need. Someone nearby. One solution.","Demandez un service ou proposez votre savoir-faire avec le meme compte.":"Request a service or offer your skills with the same account.","Commencer":"Get started","Voir l'apercu":"View preview","Apercu avant connexion":"Preview before sign in","Connectez-vous pour utiliser la carte":"Sign in to use the map","Se connecter":"Sign in","Creer un compte":"Create account","Carte":"Map","Messages":"Messages","Profil":"Profile","Admin":"Admin","Demandes":"Requests","Services":"Services","Mise en relation":"Connection","Que voulez-vous faire ?":"What would you like to do?","Demander":"Request","Proposer":"Offer","Publier un besoin":"Post a need","Rendre un service visible":"Make a service visible","Services autour de vous":"Services around you","Les positions affichees sont approximatives":"Displayed locations are approximate","Tout":"All","Toutes categories":"All categories","Liste accessible":"Accessible list","Selection":"Selection","Appuyez sur une bulle":"Choose a bubble","Repondre":"Reply","Voir les reponses":"View replies","Demander ce service":"Request this service","Vos discussions":"Your conversations","Choisissez une discussion.":"Choose a conversation.","Votre compte ServiceGO":"Your ServiceGO account","Modifier":"Edit","Administration":"Administration","Tableau de bord":"Dashboard","Utilisateurs":"Users","Demandes ouvertes":"Open requests","Services actifs":"Active services","Conversations":"Conversations","Action rapide":"Quick action","Se deconnecter":"Sign out","A propos":"About","Fermer":"Close","Langue":"Language","Bon retour":"Welcome back","Creez votre compte":"Create your account","Prenom et nom":"Full name","Telephone":"Phone","Ville":"City","Email":"Email","Mot de passe":"Password","Enregistrer":"Save","Envoyer":"Send","Urgence":"Urgency","Normale":"Normal","Urgent":"Urgent","Publier sur la carte":"Publish on map","Me rendre visible":"Make me visible"
  },
  ar: {
    "Partout au Maroc":"في جميع أنحاء المغرب","Un besoin. Une personne proche. Une solution.":"حاجة واحدة. شخص قريب. حل واحد.","Demandez un service ou proposez votre savoir-faire avec le meme compte.":"اطلب خدمة أو اعرض مهارتك بالحساب نفسه.","Commencer":"ابدأ","Voir l'apercu":"عرض المعاينة","Apercu avant connexion":"معاينة قبل الدخول","Connectez-vous pour utiliser la carte":"سجل الدخول لاستعمال الخريطة","Se connecter":"تسجيل الدخول","Creer un compte":"إنشاء حساب","Carte":"الخريطة","Messages":"الرسائل","Profil":"الملف","Admin":"الإدارة","Demandes":"الطلبات","Services":"الخدمات","Mise en relation":"التواصل","Que voulez-vous faire ?":"ماذا تريد أن تفعل؟","Demander":"اطلب","Proposer":"اعرض","Publier un besoin":"انشر حاجة","Rendre un service visible":"أظهر خدمتك","Services autour de vous":"خدمات قريبة منك","Les positions affichees sont approximatives":"المواقع المعروضة تقريبية","Tout":"الكل","Toutes categories":"كل الفئات","Liste accessible":"قائمة ميسرة","Selection":"الاختيار","Appuyez sur une bulle":"اختر فقاعة","Repondre":"أجب","Voir les reponses":"عرض الردود","Demander ce service":"اطلب هذه الخدمة","Vos discussions":"محادثاتك","Choisissez une discussion.":"اختر محادثة.","Votre compte ServiceGO":"حسابك في ServiceGO","Modifier":"تعديل","Administration":"الإدارة","Tableau de bord":"لوحة التحكم","Utilisateurs":"المستخدمون","Demandes ouvertes":"الطلبات المفتوحة","Services actifs":"الخدمات النشطة","Conversations":"المحادثات","Action rapide":"إجراء سريع","Se deconnecter":"تسجيل الخروج","A propos":"حول","Fermer":"إغلاق","Langue":"اللغة","Bon retour":"مرحبا بعودتك","Creez votre compte":"أنشئ حسابك","Prenom et nom":"الاسم الكامل","Telephone":"الهاتف","Ville":"المدينة","Email":"البريد الإلكتروني","Mot de passe":"كلمة المرور","Enregistrer":"حفظ","Envoyer":"إرسال","Urgence":"الاستعجال","Normale":"عادي","Urgent":"عاجل","Publier sur la carte":"انشر على الخريطة","Me rendre visible":"أظهر خدمتي"
  }
};
Object.assign(uiTranslations.en, {
  "Un besoin.": "One need.", "Une personne.": "One person.", "Une solution.": "One solution.",
  "J'ai besoin d'aide maintenant": "I need help now",
  "Découvrir": "Discover", "Deux possibilités. Un seul compte.": "Two possibilities. One account.",
  "Je demande": "I request", "Trouvez une personne proche.": "Find someone nearby.", "Je propose": "I offer",
  "Proposez vos services et soyez rémunéré.": "Offer your services and get paid.",
  "L'entraide commence ici.": "Helping each other starts here.", "Rejoindre ServiceGO": "Join ServiceGO",
  "Accueil": "Home", "Connexion": "Sign in", "Plus": "More", "Informations legales": "Legal information", "Contact": "Contact",
  "Questions frequentes": "Frequently asked questions", "Retour en haut": "Back to top",
  "Fuite": "Leak repair", "Peinture": "Painting", "Livraison": "Delivery", "Menage": "Cleaning",
  "Prenom": "First name", "Nom": "Last name", "Mot de passe oublié ?": "Forgot password?",
  "Afficher le mot de passe": "Show password", "Masquer le mot de passe": "Hide password",
  "Nous ecrire": "Email us", "Envoyer le lien": "Send link", "Retour a la connexion": "Back to sign in",
  "Creer mon compte": "Create my account", "Indicatif": "Country code", "Indicatif international": "International country code",
  "Un seul compte pour demander un service et proposer votre aide.": "One account to request a service and offer your help.",
  "Quel besoin avez-vous ?": "What do you need?", "Service": "Service", "Ville": "City", "Titre court": "Short title",
  "Expliquez simplement": "Explain it simply", "Budget (optionnel)": "Budget (optional)", "Photo (optionnelle)": "Photo (optional)",
  "Ex: Fuite sous evier": "E.g. Leak under the sink", "Ce qui doit etre fait, et quand.": "What needs to be done, and when.",
  "Ex: 150 - 250 DH": "E.g. MAD 150-250"
});
Object.assign(uiTranslations.ar, {
  "Un besoin.": "حاجة واحدة.", "Une personne.": "شخص واحد.", "Une solution.": "حل واحد.",
  "J'ai besoin d'aide maintenant": "أحتاج إلى المساعدة الآن",
  "Découvrir": "اكتشف", "Deux possibilités. Un seul compte.": "خياران. حساب واحد.",
  "Je demande": "أطلب", "Trouvez une personne proche.": "اعثر على شخص قريب.", "Je propose": "أعرض",
  "Proposez vos services et soyez rémunéré.": "اعرض خدماتك واحصل على مقابل.",
  "L'entraide commence ici.": "التعاون يبدأ هنا.", "Rejoindre ServiceGO": "انضم إلى ServiceGO",
  "Accueil": "الرئيسية", "Connexion": "تسجيل الدخول", "Plus": "المزيد", "Informations legales": "المعلومات القانونية", "Contact": "اتصل بنا",
  "Questions frequentes": "الأسئلة الشائعة", "Retour en haut": "العودة إلى الأعلى",
  "Fuite": "إصلاح تسرب", "Peinture": "صباغة", "Livraison": "توصيل", "Menage": "تنظيف",
  "Prenom": "الاسم الأول", "Nom": "اسم العائلة", "Mot de passe oublié ?": "هل نسيت كلمة المرور؟",
  "Afficher le mot de passe": "إظهار كلمة المرور", "Masquer le mot de passe": "إخفاء كلمة المرور",
  "Nous ecrire": "راسلنا", "Envoyer le lien": "إرسال الرابط", "Retour a la connexion": "العودة إلى تسجيل الدخول",
  "Creer mon compte": "إنشاء حسابي", "Indicatif": "رمز البلد", "Indicatif international": "رمز البلد الدولي",
  "Un seul compte pour demander un service et proposer votre aide.": "حساب واحد لطلب خدمة وعرض مساعدتك.",
  "Quel besoin avez-vous ?": "ما الخدمة التي تحتاجها؟", "Service": "الخدمة", "Ville": "المدينة", "Titre court": "عنوان مختصر",
  "Expliquez simplement": "اشرح ببساطة", "Budget (optionnel)": "الميزانية (اختيارية)", "Photo (optionnelle)": "صورة (اختيارية)",
  "Ex: Fuite sous evier": "مثال: تسرب تحت الحوض", "Ce qui doit etre fait, et quand.": "ما المطلوب إنجازه ومتى.",
  "Ex: 150 - 250 DH": "مثال: 150 - 250 درهم"
});
function localizeDom() {
  if (state.locale === "fr") return;
  const dictionary = uiTranslations[state.locale] || {};
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const raw = node.nodeValue;
    const value = raw.trim();
    if (dictionary[value]) node.nodeValue = raw.replace(value, dictionary[value]);
  }
  app.querySelectorAll("[placeholder]").forEach((element) => {
    const value = element.getAttribute("placeholder");
    if (dictionary[value]) element.setAttribute("placeholder", dictionary[value]);
  });
  app.querySelectorAll("[aria-label], [data-label]").forEach((element) => {
    for (const attribute of ["aria-label", "data-label"]) {
      const value = element.getAttribute(attribute);
      if (dictionary[value]) element.setAttribute(attribute, dictionary[value]);
    }
  });
}
async function api(path, options = {}) {
  const settings = {
    credentials: "same-origin",
    ...options,
    headers: {
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
  element.textContent = message;
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
        `<option value="${escape(category.id)}" ${category.id === selected ? "selected" : ""}>${escape(category.name)}</option>`,
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
  return `<button class="brand" data-action="home" aria-label="ServiceGO accueil"><span class="brand-symbol" aria-hidden="true"><img src="/assets/servicego-symbol.png" alt=""></span><strong>Service<span>GO</span></strong></button>`;
}
function header() {
  const signedIn = Boolean(state.user);
  const locale = `<label class="sr-only" for="locale">Langue</label><select id="locale" class="locale-select" data-action="locale" aria-label="Langue"><option value="fr" ${state.locale === "fr" ? "selected" : ""}>FR</option><option value="en" ${state.locale === "en" ? "selected" : ""}>EN</option><option value="ar" ${state.locale === "ar" ? "selected" : ""}>AR</option></select>`;
  if (!signedIn) return `<header class="public-nucleus ${state.publicMenuOpen ? "is-expanded" : ""}"><nav aria-label="Navigation principale"><button class="nucleus-icon" data-action="home" aria-label="Accueil" data-label="Accueil"><span aria-hidden="true">⌂</span></button><button class="nucleus-icon profile-icon" data-action="open-auth" aria-label="Connexion" data-label="Connexion"><span class="profile-glyph" aria-hidden="true"></span></button><span class="nucleus-secondary" aria-hidden="${!state.publicMenuOpen}"><button class="nucleus-icon language-icon" data-action="cycle-locale" aria-label="Langue" data-label="Langue" tabindex="${state.publicMenuOpen ? "0" : "-1"}">A/文</button><button class="nucleus-icon" data-action="open-faq" aria-label="Questions frequentes" data-label="Questions frequentes" tabindex="${state.publicMenuOpen ? "0" : "-1"}">?</button><button class="nucleus-icon" data-action="open-legal" aria-label="Informations legales" data-label="Informations legales" tabindex="${state.publicMenuOpen ? "0" : "-1"}">▤</button><button class="nucleus-icon" data-action="open-contact" aria-label="Contact" data-label="Contact" tabindex="${state.publicMenuOpen ? "0" : "-1"}">✉</button></span><button class="nucleus-icon plus ${state.publicMenuOpen ? "active" : ""}" data-action="toggle-public-menu" aria-label="${state.publicMenuOpen ? "Fermer" : "Plus"}" aria-expanded="${state.publicMenuOpen}" data-label="${state.publicMenuOpen ? "Fermer" : "Plus"}">${state.publicMenuOpen ? "−" : "+"}</button></nav></header>`;
  return `<header class="topbar member-nucleus">${brand()}<nav class="top-actions" aria-label="Navigation principale"><button class="nav-button ${state.view === "map" ? "active" : ""}" data-action="view" data-view="map">Carte</button><button class="nav-button ${state.view === "messages" ? "active" : ""}" data-action="view" data-view="messages">Messages</button><button class="nav-button ${state.view === "profile" ? "active" : ""}" data-action="view" data-view="profile">Profil</button>${state.user.is_admin ? `<button class="nav-button ${state.view === "admin" ? "active" : ""}" data-action="view" data-view="admin">Admin</button>` : ""}<button class="quick-trigger" data-action="open-quick" aria-label="Actions rapides">C+</button>${locale}</nav></header>`;
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
  const characters = `<div class="character-stage" aria-label="Les deux personnages ServiceGO se rencontrent"><span class="character blue-character" aria-hidden="true"></span><span class="meeting-light" aria-hidden="true"></span><span class="character green-character" aria-hidden="true"></span></div>`;
  return `<main id="main-content" class="story-v21" tabindex="-1" style="--photo-one:url('${first.resolutions.large}');--photo-two:url('${second.resolutions.large}')"><div class="story-scroll" aria-hidden="true"><span id="moment-one"></span><span id="possibilities"></span><span id="moment-three"></span></div><div class="story-viewport"><div class="story-photo photo-one" role="img" aria-label="${alt(first)}"></div><div class="story-photo photo-two" role="img" aria-label="${alt(second)}"></div><div class="story-light" aria-hidden="true"></div><section class="narrative moment-one" aria-labelledby="story-title"><div class="discovery-copy"><h1 id="story-title"><span>Un besoin.</span><span>Une personne.</span><span>Une solution.</span></h1><button class="urgent-help-cta" data-action="urgent-request" aria-label="J'ai besoin d'aide maintenant"><span class="urgent-help-icon" aria-hidden="true">⚡</span><span>J'ai besoin d'aide maintenant</span></button></div><div class="device-perspective"><div class="smartphone" aria-label="Apercu fictif de ServiceGO"><div class="phone-frame"><div class="phone-speaker" aria-hidden="true"></div><div class="phone-screen"><div class="phone-status" aria-hidden="true"><span>9:41</span><span>● ● ▰</span></div><div id="marketing-map" class="marketing-map" aria-label="Carte geographique fictive"><div class="marketing-pins">${staticBubble("need", "Fuite", "left:38%;top:42%", true)}${staticBubble("help", "Peinture", "left:62%;top:28%")}${staticBubble("need", "Livraison", "left:58%;top:62%")}${staticBubble("help", "Menage", "left:34%;top:73%")}</div></div></div><span class="phone-reflection" aria-hidden="true"></span></div></div></div><button class="discover-arrow" data-action="discover" aria-label="Découvrir"><span aria-hidden="true">↓</span></button></section><section class="narrative moment-two" aria-labelledby="possibility-title"><div class="story-content"><h2 id="possibility-title">Deux possibilités. Un seul compte.</h2>${characters}<div class="possibility-actions"><button class="possibility need" data-action="open-auth" data-intent="request"><span>Je demande</span></button><button class="possibility offer" data-action="open-auth" data-intent="offer"><span>Je propose</span></button></div></div></section><section class="narrative moment-three" aria-labelledby="conclusion-title"><div class="story-content">${characters}<h2 id="conclusion-title">L'entraide commence ici.</h2><button class="button large join" data-action="open-auth">Rejoindre ServiceGO</button><p class="photo-credit">Photos: ${escape(credit)} · Unsplash</p></div></section></div></main><button class="back-to-top" data-action="back-top" aria-label="Retour en haut">↑</button>`;
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
    return `<div class="map-empty"><strong>La carte attend la premiere bulle.</strong>Appuyez sur Demander ou Proposer pour commencer.</div>`;
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
  if (!entries.length) return `<p class="page-lead">Aucun resultat avec ces filtres.</p>`;
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
  for (const entry of entries) {
    const label = escape(entry.item.title).slice(0, 32);
    const icon = Leaflet.divIcon({
      className: "servicego-marker",
      html: `<span class="map-pin ${entry.kind} ${entry.item.urgency === "urgent" ? "urgent" : ""}">${entry.kind === "need" ? "?" : "v"}<span>${label}</span></span>`,
      iconSize: [120, 54],
      iconAnchor: [60, 46],
    });
    Leaflet.marker(
      [Number(entry.item.latitude), Number(entry.item.longitude)],
      { icon },
    )
      .addTo(leafletMap)
      .bindPopup(`${entry.kind === "need" ? "Besoin" : "Service"}: ${label}`)
      .on("click", () => {
        state.selected = { type: entry.type, item: entry.item };
        render();
      });
  }
  if (!entries.length) {
    Leaflet.popup({ closeButton: false, autoClose: false, closeOnClick: false })
      .setLatLng([31.75, -7.1])
      .setContent(
        "Publiez le premier besoin ou service pour faire apparaitre une bulle.",
      )
      .openOn(leafletMap);
  }
}
function selectedItem() {
  if (!state.selected)
    return `<p class="eyebrow">Selection</p><h2>Appuyez sur une bulle</h2><p>Les bulles bleues sont des besoins. Les vertes montrent les personnes disponibles.</p><div class="detail-meta">Vous pouvez etre les deux avec le meme compte.</div>`;
  const item = state.selected.item;
  const own =
    item.requester_id === state.user?.id || item.user_id === state.user?.id;
  const request = state.selected.type === "request";
  const identity = request ? item.requester_name : item.full_name;
  const photo =
    request && item.photo_key
      ? `<img class="detail-photo" src="/api/files/${escape(item.photo_key)}" alt="Photo de la demande" />`
      : "";
  const actions = own
    ? request
      ? `<button class="button secondary" data-action="open-offers" data-id="${item.id}">Voir les reponses</button>`
      : `<button class="button outline" disabled>Votre service</button>`
    : request
      ? `<button class="button" data-action="open-reply" data-id="${item.id}">Repondre</button>`
      : `<button class="button green" data-action="open-direct" data-id="${item.id}">Demander ce service</button>`;
  return `<p class="eyebrow">${request ? "Demande" : "Service disponible"}</p><h2>${escape(item.title)}</h2><span class="badge">${escape(item.category_name || "Service")} - ${escape(item.district)}</span>${photo}<div class="detail-meta"><strong>${escape(identity || "Utilisateur ServiceGO")}</strong><br>${escape(item.description)}${item.budget_hint || item.price_hint ? `<br><br>${request ? "Budget" : "Prix"}: ${escape(item.budget_hint || item.price_hint)}` : ""}</div><div class="detail-actions">${actions}</div>`;
}
function mapView() {
  return `<main id="main-content" class="workspace ${state.mapMode === "relief" ? "relief" : ""}" tabindex="-1"><aside class="panel actions-panel"><div><p class="eyebrow">Connecte</p><h2>Que voulez-vous faire ?</h2></div><button class="choice" data-action="open-request"><span class="choice-icon">?</span><span><strong>Demander</strong><small>Publier un besoin</small></span></button><button class="choice green-choice" data-action="open-service"><span class="choice-icon">+</span><span><strong>Proposer</strong><small>Rendre un service visible</small></span></button><div class="legend"><span><i class="dot blue"></i> Demandes</span><span><i class="dot orange"></i> Services</span><span><i class="dot mint"></i> Mise en relation</span></div></aside><section class="panel map-panel"><div class="map-toolbar"><span><strong>Services autour de vous</strong><small>Les positions affichees sont approximatives</small></span><div class="map-controls"><div class="segmented" aria-label="Type de bulle"><button class="${state.mapFilter === "all" ? "active" : ""}" data-action="filter-map" data-value="all">Tout</button><button class="${state.mapFilter === "request" ? "active" : ""}" data-action="filter-map" data-value="request">Demandes</button><button class="${state.mapFilter === "service" ? "active" : ""}" data-action="filter-map" data-value="service">Services</button></div><select data-action="filter-category" aria-label="Categorie"><option value="all">Toutes categories</option>${categoryOptions(state.mapCategory)}</select><div class="segmented" aria-label="Mode de carte"><button class="${state.mapMode === "2d" ? "active" : ""}" data-action="map-mode" data-value="2d">2D</button><button class="${state.mapMode === "relief" ? "active" : ""}" data-action="map-mode" data-value="relief">Relief</button></div></div></div><div id="liveMap" class="real-map" aria-label="Carte interactive du Maroc"></div></section><aside class="panel selection">${selectedItem()}<details class="accessible-list"><summary>Liste accessible</summary>${accessibleMapList()}</details></aside></main>${mobileTabs()}<button class="info-button" data-action="open-info" aria-label="Informations">i</button>`;
}
function mobileTabs() {
  return `<nav class="mobile-tabbar" aria-label="Navigation principale"><button class="${state.view === "map" ? "active" : ""}" data-action="view" data-view="map">Carte</button><button class="${state.view === "messages" ? "active" : ""}" data-action="view" data-view="messages">Messages</button><button class="mobile-quick" data-action="open-quick" aria-label="Actions rapides">C+</button><button class="${state.view === "profile" ? "active" : ""}" data-action="view" data-view="profile">Profil</button></nav>`;
}
function messagesView() {
  const current = state.conversations.find(
    (item) => item.id === state.activeConversation,
  );
  const list = state.conversations.length
    ? state.conversations
        .map(
          (item) =>
            `<button class="conversation ${item.id === state.activeConversation ? "active" : ""}" data-action="conversation" data-id="${item.id}"><strong>${escape(item.other_name)}</strong><small>${escape(item.request_title || item.last_message || "Discussion ServiceGO")}</small></button>`,
        )
        .join("")
    : `<div class="loading">Vos discussions apparaitront ici.</div>`;
  const chat = current
    ? `<section class="chat"><div class="chat-title">${escape(current.other_name)} <small>${escape(current.request_title || "Discussion")}</small></div><div class="message-list">${state.messages.length ? state.messages.map((message) => `<div class="message ${message.sender_id === state.user.id ? "mine" : ""}">${escape(message.body)}<small>${escape(message.sender_name)}</small></div>`).join("") : `<p class="page-lead">Dites bonjour pour commencer.</p>`}</div><form class="message-form" data-form="message"><input name="body" maxlength="2000" placeholder="Ecrire un message" required /><button class="button icon" aria-label="Envoyer">></button></form></section>`
    : `<section class="chat"><div class="loading">Choisissez une discussion.</div></section>`;
  return `<main class="view-page"><p class="eyebrow">Messages</p><h1>Vos discussions</h1><p class="page-lead">Apres une reponse acceptee ou une demande directe, la discussion s'ouvre ici.</p><div class="panel messages-layout"><aside class="conversation-list">${list}</aside>${chat}</div></main>${mobileTabs()}`;
}
function profileView() {
  const user = state.user;
  const requestItems = state.mine.requests.length
    ? state.mine.requests
        .map(
          (item) =>
            `<li><button class="text-button" data-action="open-offers" data-id="${item.id}">${escape(item.title)}</button> <small>${escape(item.status)}</small></li>`,
        )
        .join("")
    : "<li>Aucune demande publiee.</li>";
  const serviceItems = state.mine.services.length
    ? state.mine.services
        .map(
          (item) =>
            `<li>${escape(item.title)} <small>${item.available ? "visible" : "masque"}</small></li>`,
        )
        .join("")
    : "<li>Aucun service propose.</li>";
  const admin = user.is_admin
    ? `<section class="panel profile-box"><h3>Administration</h3><p>${state.adminStats ? `${state.adminStats.users} comptes<br>${state.adminStats.open_requests} demandes ouvertes<br>${state.adminStats.active_services} services visibles` : "Chargement des statistiques..."}</p></section>`
    : "";
  return `<main class="view-page"><p class="eyebrow">Profil unique</p><h1>Votre compte ServiceGO</h1><p class="page-lead">Ici, vous etes a la fois libre de demander et de proposer.</p><div class="profile-grid"><section class="panel profile-box profile-main"><div class="avatar">${escape(user.full_name.charAt(0).toUpperCase())}</div><h3>${escape(user.full_name)}</h3><p>${escape(user.email)}<br>${escape(user.district)}</p>${user.email_verified ? `<small>Adresse email confirmee</small>` : `<p><small>Adresse email a confirmer</small><br><button class="text-button" data-action="resend-verification">Renvoyer le lien</button></p>`}<button class="button secondary" style="margin-top:16px" data-action="open-profile">Modifier</button></section><section class="panel profile-box"><h3>Mes besoins</h3><ul class="profile-list">${requestItems}</ul></section><section class="panel profile-box"><h3>Mes services</h3><ul class="profile-list">${serviceItems}</ul></section><section class="panel profile-box"><h3>Confiance</h3><p>${Number(user.rating || 5).toFixed(1)} / 5<br>${user.review_count || 0} avis</p></section>${admin}</div></main>${mobileTabs()}`;
}
function adminView() {
  const stats = state.adminStats || {};
  return `<main id="main-content" class="view-page" tabindex="-1"><p class="eyebrow">Administration</p><h1>Tableau de bord</h1><p class="page-lead">Vue reservee aux administrateurs ServiceGO.</p><div class="stats-grid"><section class="panel"><strong>${Number(stats.users || 0)}</strong><span>Utilisateurs</span></section><section class="panel"><strong>${Number(stats.open_requests || 0)}</strong><span>Demandes ouvertes</span></section><section class="panel"><strong>${Number(stats.active_services || 0)}</strong><span>Services actifs</span></section><section class="panel"><strong>${Number(stats.conversations || 0)}</strong><span>Conversations</span></section></div></main>${mobileTabs()}<button class="info-button" data-action="open-info" aria-label="Informations">i</button>`;
}
function authModal() {
  const register = state.authMode === "register";
  const forgot = state.authMode === "forgot";
  const country = state.geo.country || "MA";
  const codes = [["MA","+212"],["FR","+33"],["ES","+34"],["GB","+44"],["US","+1"],["DE","+49"],["AE","+971"],["IN","+91"]];
  if (forgot) return `<div class="modal-layer"><section class="modal public-modal auth-modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">ServiceGO</p><h2>Mot de passe oublié ?</h2><p class="modal-intro">Indiquez l'adresse utilisee pour votre compte.</p><form class="form-grid" data-form="forgot"><label class="field full"><span>Email</span><input name="email" type="email" autocomplete="email" required /></label><button class="button submit" type="submit">Envoyer le lien</button></form><button class="text-button auth-back" data-action="auth-tab" data-mode="login">Retour a la connexion</button></section></div>`;
  return `<div class="modal-layer"><section class="modal public-modal auth-modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">ServiceGO</p><h2>${register ? "Creez votre compte" : "Bon retour"}</h2><div class="modal-tabs"><button class="${!register ? "active" : ""}" data-action="auth-tab" data-mode="login">Se connecter</button><button class="${register ? "active" : ""}" data-action="auth-tab" data-mode="register">Creer un compte</button></div><form class="form-grid" data-form="auth">${register ? `<label class="field"><span>Prenom</span><input name="first_name" autocomplete="given-name" minlength="1" maxlength="40" required /></label><label class="field"><span>Nom</span><input name="last_name" autocomplete="family-name" minlength="1" maxlength="40" required /></label>` : ""}<label class="field full"><span>Email</span><input name="email" type="email" autocomplete="email" required /></label>${register ? `<div class="phone-field full"><label class="field dial-code"><span>Indicatif</span><select name="dial_code" aria-label="Indicatif international">${codes.map(([iso,code])=>`<option value="${code}" ${iso===country?"selected":""}>${iso} ${code}</option>`).join("")}</select></label><label class="field phone-number"><span>Telephone</span><input name="phone_number" maxlength="24" inputmode="tel" autocomplete="tel-national" placeholder="6 12 34 56 78" required /></label></div>` : ""}<label class="field full password-field"><span>Mot de passe</span><span class="password-input"><input name="password" type="${state.passwordVisible ? "text" : "password"}" autocomplete="${register ? "new-password" : "current-password"}" minlength="8" required /><button type="button" data-action="toggle-password" aria-label="${state.passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}">${state.passwordVisible ? "◉" : "○"}</button></span></label>${!register ? `<button type="button" class="text-button forgot-link" data-action="auth-tab" data-mode="forgot">Mot de passe oublié ?</button>` : ""}<button class="button submit" type="submit">${register ? "Creer mon compte" : "Se connecter"}</button></form><p class="form-note">Un seul compte pour demander un service et proposer votre aide.</p></section></div>`;
}
function requestModal() {
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">x</button><p class="eyebrow">Demander</p><h2>Quel besoin avez-vous ?</h2><form class="form-grid" data-form="request"><label class="field"><span>Service</span><select name="category_id" required>${categoryOptions()}</select></label><label class="field"><span>Ville</span><select name="district">${cityOptions()}</select></label><label class="field full"><span>Titre court</span><input name="title" maxlength="100" placeholder="Ex: Fuite sous evier" required /></label><label class="field full"><span>Expliquez simplement</span><textarea name="description" maxlength="1200" placeholder="Ce qui doit etre fait, et quand." required></textarea></label><label class="field"><span>Budget (optionnel)</span><input name="budget_hint" maxlength="80" placeholder="Ex: 150 - 250 DH" /></label><label class="field"><span>Urgence</span><select name="urgency"><option value="normal">Normale</option><option value="urgent">Urgent</option></select></label><label class="field full"><span>Photo (optionnelle)</span><input type="file" name="photo" accept="image/*" /></label><button class="button submit" type="submit">Publier sur la carte</button></form></section></div>`;
}
function serviceModal() {
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">x</button><p class="eyebrow">Proposer</p><h2>Quel service proposez-vous ?</h2><form class="form-grid" data-form="service"><label class="field"><span>Service</span><select name="category_id" required>${categoryOptions()}</select></label><label class="field"><span>Ville</span><select name="district">${cityOptions()}</select></label><label class="field full"><span>Titre court</span><input name="title" maxlength="100" placeholder="Ex: Peinture appartements" required /></label><label class="field full"><span>Expliquez votre service</span><textarea name="description" maxlength="1200" placeholder="Ce que vous savez faire et vos disponibilites." required></textarea></label><label class="field full"><span>Prix indicatif (optionnel)</span><input name="price_hint" maxlength="80" placeholder="Ex: A partir de 200 DH" /></label><button class="button green submit" type="submit">Me rendre visible</button></form></section></div>`;
}
function replyModal() {
  const item = state.selected?.item;
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">x</button><p class="eyebrow">Repondre a ${escape(item?.title)}</p><h2>Proposez une solution</h2><form class="form-grid" data-form="reply"><input type="hidden" name="request_id" value="${escape(item?.id)}" /><label class="field full"><span>Votre message</span><textarea name="message" maxlength="1000" placeholder="Bonjour, je peux vous aider..." required></textarea></label><label class="field full"><span>Prix indicatif (optionnel)</span><input name="price_hint" maxlength="80" placeholder="Ex: 180 DH" /></label><button class="button submit" type="submit">Envoyer ma reponse</button></form></section></div>`;
}
function directModal() {
  const item = state.selected?.item;
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">x</button><p class="eyebrow">Demander a ${escape(item?.full_name)}</p><h2>${escape(item?.title)}</h2><form class="form-grid" data-form="direct"><input type="hidden" name="service_id" value="${escape(item?.id)}" /><label class="field"><span>Ville</span><select name="district">${cityOptions()}</select></label><label class="field"><span>Urgence</span><select name="urgency"><option value="normal">Normale</option><option value="urgent">Urgent</option></select></label><label class="field full"><span>Votre besoin</span><textarea name="description" maxlength="1200" placeholder="Bonjour, j'ai besoin de votre service..." required></textarea></label><label class="field full"><span>Budget (optionnel)</span><input name="budget_hint" maxlength="80" placeholder="Ex: 300 DH" /></label><button class="button green submit" type="submit">Envoyer directement</button></form></section></div>`;
}
function profileModal() {
  const user = state.user;
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">x</button><p class="eyebrow">Profil</p><h2>Vos informations</h2><form class="form-grid" data-form="profile"><label class="field full"><span>Prenom et nom</span><input name="full_name" value="${escape(user.full_name)}" maxlength="80" required /></label><label class="field"><span>Telephone</span><input name="phone" value="${escape(user.phone || "")}" maxlength="30" /></label><label class="field"><span>Ville</span><select name="district">${cityOptions(user.district)}</select></label><label class="field full"><span>Quelques mots sur vous</span><textarea name="bio" maxlength="500">${escape(user.bio || "")}</textarea></label><label class="field full"><span>Nouvelle adresse email</span><input name="new_email" type="email" autocomplete="email" placeholder="Laissez vide pour garder ${escape(user.email)}" /></label><label class="field"><span>Mot de passe actuel</span><input name="current_password" type="password" autocomplete="current-password" /></label><label class="field"><span>Nouveau mot de passe</span><input name="new_password" type="password" minlength="8" autocomplete="new-password" /></label><button class="button submit" type="submit">Enregistrer</button></form></section></div>`;
}
function offersModal() {
  const request = state.offers.request;
  const offers = state.offers.items;
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">x</button><p class="eyebrow">Reponses recues</p><h2>${escape(request?.title || "Votre demande")}</h2>${offers.length ? `<div class="offers-list">${offers.map((offer) => `<article class="offer"><strong>${escape(offer.full_name)}</strong><small>${Number(offer.rating || 5).toFixed(1)} / 5 - ${offer.review_count || 0} avis</small><p>${escape(offer.message)}</p>${offer.price_hint ? `<b>${escape(offer.price_hint)}</b>` : ""}${offer.status === "pending" ? `<button class="button" data-action="accept-offer" data-id="${offer.id}">Accepter cette reponse</button>` : `<span class="offer-status">${escape(offer.status)}</span>`}</article>`).join("")}</div>` : `<p class="page-lead">Pas encore de reponse. Votre bulle est toujours visible sur la carte.</p>`}</section></div>`;
}
function quickModal() {
  return `<div class="modal-layer"><section class="modal quick-modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">x</button><p class="eyebrow">Action rapide</p><h2>Que voulez-vous faire ?</h2><div class="quick-grid"><button class="choice" data-action="open-request"><span class="choice-icon">?</span><span><strong>Demander</strong><small>Publier un besoin</small></span></button><button class="choice green-choice" data-action="open-service"><span class="choice-icon">+</span><span><strong>Proposer</strong><small>Rendre un service visible</small></span></button></div><button class="button outline logout-wide" data-action="logout">Se deconnecter</button></section></div>`;
}
function infoModal() {
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">x</button><p class="eyebrow">ServiceGO</p><h2>A propos</h2><p class="page-lead">Une place locale pour demander, proposer et entrer en contact simplement. Les positions publiques restent approximatives.</p><div class="legend"><span><i class="dot blue"></i> Demandes</span><span><i class="dot orange"></i> Services</span><span><i class="dot mint"></i> Mise en relation</span></div><p class="form-note">Service commercial en phase de lancement. Ne partagez jamais de mot de passe ni de code de verification.</p></section></div>`;
}
function faqModal() {
  const copy = {
    fr: { title:"Questions frequentes", items:[["Qu'est-ce que ServiceGO ?","Une plateforme qui met en relation des personnes ayant un besoin avec celles qui peuvent aider."],["Un compte peut-il demander et proposer ?","Oui. Le meme compte permet de publier des demandes et de proposer des services."],["Les services peuvent-ils etre gratuits ?","Oui. Les personnes choisissent ensemble si le service est gratuit ou remunere."],["Comment publier une demande ?","Connectez-vous, choisissez Je demande, puis decrivez votre besoin avant de le publier."],["Comment proposer mon aide ?","Connectez-vous, choisissez Je propose et indiquez clairement le service disponible."],["Comment contacter une personne ?","Selectionnez une annonce et envoyez une reponse ou une demande directe pour ouvrir une conversation."],["Ma localisation exacte est-elle visible ?","Non. La carte membre affiche une position volontairement approximative."],["Comment signaler un probleme ?","Ecrivez a aetbconseil@gmail.com en indiquant le compte ou l'annonce concernee."]] },
    en: { title:"Frequently asked questions", items:[["What is ServiceGO?","A platform connecting people who need something with people who can help."],["Can one account request and offer services?","Yes. The same account can post requests and offer services."],["Can services be free?","Yes. People agree together whether a service is free or paid."],["How do I post a request?","Sign in, choose I request, describe your need and publish it."],["How do I offer help?","Sign in, choose I offer and clearly describe the available service."],["How do I contact someone?","Select a listing and send a reply or direct request to open a conversation."],["Is my exact location visible?","No. The member map deliberately displays an approximate position."],["How do I report a problem?","Email aetbconseil@gmail.com and identify the account or listing concerned."]] },
    ar: { title:"الأسئلة الشائعة", items:[["ما هي ServiceGO؟","منصة تربط بين من يحتاج إلى خدمة ومن يستطيع تقديم المساعدة."],["هل يمكن للحساب نفسه الطلب والعرض؟","نعم. يتيح الحساب نفسه نشر الطلبات وعرض الخدمات."],["هل يمكن أن تكون الخدمات مجانية؟","نعم. يتفق الأشخاص معا على ما إذا كانت الخدمة مجانية أو مدفوعة."],["كيف أنشر طلبا؟","سجل الدخول واختر أطلب ثم صف حاجتك وانشرها."],["كيف أعرض مساعدتي؟","سجل الدخول واختر أعرض ثم صف الخدمة المتاحة بوضوح."],["كيف أتواصل مع شخص؟","اختر إعلانا وأرسل ردا أو طلبا مباشرا لفتح محادثة."],["هل موقعي الدقيق ظاهر؟","لا. تعرض خريطة الأعضاء موقعا تقريبيا عن قصد."],["كيف أبلغ عن مشكلة؟","راسل aetbconseil@gmail.com وحدد الحساب أو الإعلان المعني."]] }
  }[state.locale] || null;
  return `<div class="modal-layer"><section class="modal public-modal public-info-modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">ServiceGO</p><h2>${copy.title}</h2><div class="faq-list">${copy.items.map(([question,answer],index)=>`<details ${index===0?"open":""}><summary>${question}</summary><p>${answer}</p></details>`).join("")}</div></section></div>`;
}
function legalModal() {
  const copy = {
    fr: { eyebrow:"Informations publiques",title:"Cadre legal et confidentialite",labels:["Mentions legales","Conditions d'utilisation","Confidentialite","Cookies","Services","Contact"],texts:["Editeur, adresse du siege et numero d'immatriculation : informations a completer par le proprietaire du projet.","Version contractuelle a faire valider et a publier avant la commercialisation complete.","ServiceGO limite la carte operationnelle aux membres et affiche des positions approximatives. La politique complete reste a valider.","La session utilise un cookie HTTPOnly necessaire a la connexion. Les informations complementaires restent a completer si d'autres outils sont ajoutes.","ServiceGO met en relation des personnes qui demandent ou proposent un service. Les conditions commerciales detaillees restent a valider.","Coordonnees publiques de contact : a completer par le proprietaire du projet."] },
    en: { eyebrow:"Public information",title:"Legal and privacy framework",labels:["Legal notice","Terms of use","Privacy","Cookies","Services","Contact"],texts:["Publisher, registered office and registration number: information to be completed by the project owner.","The contractual version must be approved and published before full commercial launch.","ServiceGO limits the operational map to members and displays approximate locations. The complete policy still requires approval.","The session uses an HTTPOnly cookie required for sign-in. Additional information must be added if other tools are introduced.","ServiceGO connects people requesting or offering a service. Detailed commercial terms still require approval.","Public contact details: to be completed by the project owner."] },
    ar: { eyebrow:"معلومات عامة",title:"الإطار القانوني والخصوصية",labels:["الإشعار القانوني","شروط الاستخدام","الخصوصية","ملفات الارتباط","الخدمات","اتصل بنا"],texts:["الناشر وعنوان المقر ورقم التسجيل: معلومات يجب على مالك المشروع استكمالها.","يجب اعتماد النسخة التعاقدية ونشرها قبل الإطلاق التجاري الكامل.","تقصر ServiceGO الخريطة التشغيلية على الأعضاء وتعرض مواقع تقريبية. لا تزال السياسة الكاملة بحاجة إلى الاعتماد.","تستخدم الجلسة ملف ارتباط HTTPOnly ضروريا لتسجيل الدخول. يجب إضافة معلومات أخرى إذا أضيفت أدوات جديدة.","تربط ServiceGO بين الأشخاص الذين يطلبون خدمة أو يعرضونها. لا تزال الشروط التجارية التفصيلية بحاجة إلى الاعتماد.","بيانات الاتصال العامة: يجب على مالك المشروع استكمالها."] }
  }[state.locale] || null;
  const active = Math.max(0, Math.min(copy.labels.length - 1, state.legalTab));
  return `<div class="modal-layer"><section class="modal public-modal public-info-modal legal-modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">${copy.eyebrow}</p><h2>${copy.title}</h2><nav class="legal-nav" aria-label="Rubriques legales">${copy.labels.map((label,index)=>`<button class="${index===active?"active":""}" data-action="legal-tab" data-index="${index}" aria-current="${index===active?"page":"false"}">${label}</button>`).join("")}</nav><div class="legal-content" aria-live="polite"><h3>${copy.labels[active]}</h3><p>${copy.texts[active]}</p></div></section></div>`;
}
function contactModal() {
  const copy = {
    fr: ["Nous contacter", "Une question, un signalement ou une demande concernant ServiceGO ?", "Nous ecrire"],
    en: ["Contact us", "A question, report or request about ServiceGO?", "Email us"],
    ar: ["اتصل بنا", "هل لديك سؤال أو بلاغ أو طلب بخصوص ServiceGO؟", "راسلنا"],
  }[state.locale];
  return `<div class="modal-layer"><section class="modal public-modal contact-modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">×</button><p class="eyebrow">ServiceGO</p><h2>${copy[0]}</h2><p class="modal-intro">${copy[1]}</p><a class="contact-email" href="mailto:aetbconseil@gmail.com">aetbconseil@gmail.com</a><a class="button contact-action" href="mailto:aetbconseil@gmail.com?subject=ServiceGO">${copy[2]}</a></section></div>`;
}
function modal() {
  if (!state.modal) return "";
  if (state.modal === "auth") return authModal();
  if (state.modal === "request") return requestModal();
  if (state.modal === "service") return serviceModal();
  if (state.modal === "reply") return replyModal();
  if (state.modal === "direct") return directModal();
  if (state.modal === "profile") return profileModal();
  if (state.modal === "offers") return offersModal();
  if (state.modal === "quick") return quickModal();
  if (state.modal === "info") return infoModal();
  if (state.modal === "faq") return faqModal();
  if (state.modal === "legal") return legalModal();
  if (state.modal === "contact") return contactModal();
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
  document.title = `ServiceGO | ${state.view === "home" ? "Du besoin a la solution" : state.view}`;
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
    const centers = { MA: [33.4, -7.1, 5], FR: [46.4, 2.2, 5], ES: [40.2, -3.5, 5] };
    const [lat, lng, zoom] = centers[state.geo.country] || [31, 4, 2];
    marketingMap = Leaflet.map(mapElement, { center: [lat, lng], zoom, zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, keyboard: false, touchZoom: false });
    Leaflet.tileLayer(state.config.mapTileUrl, { attribution: state.config.mapAttribution, maxZoom: 18 }).addTo(marketingMap);
  }
  updateStoryProgress();
}
function updateStoryProgress() {
  const story = document.querySelector(".story-v21");
  if (!story) return;
  const progress = Math.min(1, Math.max(0, (window.scrollY - story.offsetTop) / Math.max(1, story.scrollHeight - innerHeight)));
  const meeting = Math.min(1, Math.max(0, (progress - 0.26) / 0.28));
  const conclusion = Math.min(1, Math.max(0, (progress - 0.68) / 0.2));
  const momentOne = 1 - Math.min(1, Math.max(0, (progress - 0.12) / 0.16));
  const momentTwoIn = Math.min(1, Math.max(0, (progress - 0.18) / 0.14));
  const momentTwoOut = 1 - Math.min(1, Math.max(0, (progress - 0.61) / 0.13));
  const momentTwo = Math.min(momentTwoIn, momentTwoOut);
  const phoneOpacity = 1 - Math.min(1, Math.max(0, (progress - 0.38) / 0.13));
  const titleOpacity = Math.min(1, Math.max(0, (meeting - 0.16) / 0.4));
  const actionOpacity = Math.min(1, Math.max(0, (meeting - 0.7) / 0.3));
  const characterOffset = (1 - meeting) * Math.min(165, innerWidth * 0.26);
  const saluteAngle = meeting > 0.84 ? Math.sin(((meeting - 0.84) / 0.16) * Math.PI) * 5 : 0;
  document.documentElement.style.setProperty("--story-progress", progress.toFixed(4));
  document.documentElement.style.setProperty("--meeting-progress", meeting.toFixed(4));
  document.documentElement.style.setProperty("--conclusion-progress", conclusion.toFixed(4));
  document.documentElement.style.setProperty("--moment-one-opacity", momentOne.toFixed(4));
  document.documentElement.style.setProperty("--moment-two-opacity", momentTwo.toFixed(4));
  document.documentElement.style.setProperty("--phone-opacity", phoneOpacity.toFixed(4));
  document.documentElement.style.setProperty("--title-opacity", titleOpacity.toFixed(4));
  document.documentElement.style.setProperty("--action-opacity", actionOpacity.toFixed(4));
  document.documentElement.style.setProperty("--action-shift", `${((1 - actionOpacity) * 16).toFixed(2)}px`);
  document.documentElement.style.setProperty("--character-offset", `${characterOffset.toFixed(2)}px`);
  document.documentElement.style.setProperty("--salute-angle", `${saluteAngle.toFixed(2)}deg`);
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
      state.view = "map";
      await loadMap();
    }
    if (
      new URLSearchParams(window.location.search).get("email_verified") === "1"
    ) {
      window.history.replaceState({}, "", window.location.pathname);
      notify("Adresse email confirmee.");
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
      state.view = "home";
      state.selected = null;
      render();
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
      state.authMode = "login";
      state.modal = "auth";
      render();
    }
    if (action === "urgent-request") {
      modalReturnAction = action;
      if (state.user) {
        if (!state.categories.length) await loadMap();
        state.view = "map";
        state.modal = "request";
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
      render();
    }
    if (action === "cycle-locale") {
      const locales = ["fr", "en", "ar"];
      state.locale = locales[(locales.indexOf(state.locale) + 1) % locales.length];
      localStorage.setItem("servicego-locale", state.locale);
      render();
    }
    if (action === "open-faq") {
      modalReturnAction = action;
      state.publicMenuOpen = false;
      state.modal = "faq";
      render();
    }
    if (action === "open-legal") {
      modalReturnAction = action;
      state.publicMenuOpen = false;
      state.legalTab = 0;
      state.modal = "legal";
      render();
    }
    if (action === "open-contact") {
      modalReturnAction = action;
      state.publicMenuOpen = false;
      state.modal = "contact";
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
      render();
    }
    if (action === "open-request") {
      state.modal = "request";
      render();
    }
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
      state.view = "messages";
      state.activeConversation = data.conversation_id;
      await loadConversations();
      render();
      notify("Reponse acceptee. La discussion est ouverte.");
    }
    if (action === "view") {
      state.view = button.dataset.view;
      state.selected = null;
      if (state.view === "map") await loadMap();
      if (state.view === "messages") await loadConversations(true);
      if (state.view === "profile") {
        await loadMine();
        if (state.user.is_admin)
          state.adminStats = (await api("/api/admin/overview")).stats;
      }
      if (state.view === "admin" && state.user.is_admin)
        state.adminStats = (await api("/api/admin/overview")).stats;
      render();
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
      render();
    }
    if (action === "conversation") {
      state.activeConversation = button.dataset.id;
      const messages = await api(
        `/api/conversations/${state.activeConversation}/messages`,
      );
      state.messages = messages.messages;
      render();
    }
    if (action === "logout") {
      await api("/api/auth/logout", { method: "POST" });
      state.user = null;
      state.view = "home";
      state.selected = null;
      state.modal = null;
      state.pendingIntent = null;
      render();
      notify("Vous etes deconnecte.");
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
  if (state.publicMenuOpen && !event.target.closest(".public-nucleus")) {
    state.publicMenuOpen = false;
    render();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.modal) {
    closeModal();
    render();
    requestAnimationFrame(() => document.querySelector(`[data-action="${modalReturnAction}"]`)?.focus());
    return;
  }
  if (event.key === "Escape" && state.publicMenuOpen) {
    state.publicMenuOpen = false;
    render();
    requestAnimationFrame(() => document.querySelector('[data-action="toggle-public-menu"]')?.focus());
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
      const continueToRequest = state.pendingIntent === "request";
      state.pendingIntent = null;
      state.modal = continueToRequest ? "request" : null;
      state.view = "map";
      await loadMap();
      render();
      notify(
        state.authMode === "register"
          ? data.email_delivery_configured
            ? "Un lien de confirmation vient d'etre envoye."
            : "Compte cree. L'envoi de confirmation n'est pas encore configure."
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
          throw new Error(uploaded.error || "Photo impossible a envoyer.");
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
      notify("Votre reponse a ete envoyee.");
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
      notify("Demande envoyee. La discussion est ouverte.");
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
      notify("Profil enregistre.");
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
