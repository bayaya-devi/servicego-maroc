import * as Leaflet from "/vendor/leaflet/leaflet-src.esm.js";

const app = document.querySelector("#app");

const state = {
  user: null,
  categories: [],
  map: { requests: [], services: [] },
  config: { mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", mapAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors' },
  view: "home",
  selected: null,
  modal: null,
  authMode: "login",
  conversations: [],
  activeConversation: null,
  messages: [],
  mine: { requests: [], services: [] },
  offers: { request: null, items: [] },
  adminStats: null,
};

let leafletMap = null;

const cities = {
  Casablanca: [33.5731, -7.5898],
  Rabat: [34.0209, -6.8416],
  Tanger: [35.7595, -5.8340],
  Fes: [34.0331, -5.0003],
  Meknes: [33.8935, -5.5473],
  Marrakech: [31.6295, -7.9811],
  Agadir: [30.4278, -9.5981],
  Oujda: [34.6814, -1.9086],
  Kenitra: [34.2610, -6.5802],
  Tetouan: [35.5711, -5.3724],
  "Beni Mellal": [32.3373, -6.3498],
  Laayoune: [27.1253, -13.1625],
};

function escape(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
}

async function api(path, options = {}) {
  const settings = { credentials: "same-origin", ...options, headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) } };
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
  const [lat, lng] = cities[city] || cities.Casablanca;
  return { latitude: lat, longitude: lng };
}

function pointStyle(latitude, longitude, i = 0) {
  const x = Math.max(8, Math.min(92, ((Number(longitude) + 13.25) / 12.25) * 100 + ((i % 3) - 1) * 2));
  const y = Math.max(10, Math.min(90, ((35.95 - Number(latitude)) / 8.4) * 100 + ((i % 4) - 1) * 2));
  return `left:${x}%;top:${y}%`;
}

function categoryOptions(selected = "") {
  return state.categories.map((category) => `<option value="${escape(category.id)}" ${category.id === selected ? "selected" : ""}>${escape(category.name)}</option>`).join("");
}

function cityOptions(selected = "Casablanca") {
  return Object.keys(cities).map((city) => `<option ${city === selected ? "selected" : ""}>${city}</option>`).join("");
}

function brand() {
  return `<button class="brand" data-action="home" aria-label="ServiceGO accueil"><span class="brand-mark"><b>?</b><i></i><b>v</b></span><strong>Service<span>GO</span></strong></button>`;
}

function header() {
  const signedIn = Boolean(state.user);
  return `<header class="topbar">${brand()}<nav class="top-actions">${signedIn ? `
    <button class="nav-button ${state.view === "map" ? "active" : ""}" data-action="view" data-view="map">Carte</button>
    <button class="nav-button ${state.view === "messages" ? "active" : ""}" data-action="view" data-view="messages">Messages</button>
    <button class="nav-button ${state.view === "profile" ? "active" : ""}" data-action="view" data-view="profile">Profil</button>
    <button class="button outline" data-action="logout">Sortir</button>` : `<button class="button" data-action="open-auth">Se connecter</button>`}</nav></header>`;
}

function staticBubble(kind, label, position, urgent = false) {
  return `<span class="map-bubble ${kind} ${urgent ? "urgent" : ""}" style="${position}">${escape(label)}</span>`;
}

function homeView() {
  return `<main class="hero"><section><p class="eyebrow">Partout au Maroc</p><h1>Du besoin a la solution.</h1><p class="lead">Un seul compte pour demander une aide, proposer son savoir-faire et parler directement avec la bonne personne.</p><div class="button-row"><button class="button large" data-action="open-auth">Commencer</button><button class="button large secondary" data-action="preview-map">Voir la carte</button></div><p class="proof">Demandes en bleu. Services disponibles en vert. Simple a reconnaitre, simple a utiliser.</p></section><section class="preview-phone" id="preview"><div class="preview-head">Maroc <small>Apercu avant connexion</small></div><div class="map preview-map"><span class="map-label a">Tanger</span><span class="map-label b">Rabat</span><span class="map-label c">Casablanca</span><span class="map-label d">Marrakech</span>${staticBubble("need", "Fuite", "left:42%;top:44%", true)}${staticBubble("help", "Peinture", "left:51%;top:27%")}${staticBubble("need", "Livraison", "left:52%;top:58%")}${staticBubble("help", "Menage", "left:59%;top:74%")}<div class="locked-strip">Connectez-vous pour appuyer sur les bulles</div></div></section></main>`;
}

function mapBubbles() {
  const entries = [
    ...state.map.requests.map((item, index) => ({ ...item, kind: "need", label: item.title, mapType: "request", index })),
    ...state.map.services.map((item, index) => ({ ...item, kind: "help", label: item.title, mapType: "service", index })),
  ];
  if (!entries.length) return `<div class="map-empty"><strong>La carte attend la premiere bulle.</strong>Appuyez sur Demander ou Proposer pour commencer.</div>`;
  return entries.map((item) => `<button class="map-bubble ${item.kind} ${item.urgency === "urgent" ? "urgent" : ""}" style="${pointStyle(item.latitude, item.longitude, item.index)}" data-action="select" data-type="${item.mapType}" data-id="${item.id}" title="${escape(item.label)}">${escape(item.label)}</button>`).join("");
}

function mountInteractiveMap() {
  const target = document.querySelector("#liveMap");
  if (!target) return;
  leafletMap?.remove();
  leafletMap = Leaflet.map(target, { zoomControl: true, minZoom: 5, maxBounds: [[26.7, -14.8], [36.5, 0.4]] }).setView([31.75, -7.1], 6);
  Leaflet.tileLayer(state.config.mapTileUrl, {
    maxZoom: 19,
    attribution: state.config.mapAttribution,
  }).addTo(leafletMap);
  const entries = [
    ...state.map.requests.map((item) => ({ item, type: "request", kind: "need" })),
    ...state.map.services.map((item) => ({ item, type: "service", kind: "help" })),
  ];
  for (const entry of entries) {
    const label = escape(entry.item.title).slice(0, 32);
    const icon = Leaflet.divIcon({
      className: "servicego-marker",
      html: `<span class="map-pin ${entry.kind} ${entry.item.urgency === "urgent" ? "urgent" : ""}">${entry.kind === "need" ? "?" : "v"}<span>${label}</span></span>`,
      iconSize: [120, 54],
      iconAnchor: [60, 46],
    });
    Leaflet.marker([Number(entry.item.latitude), Number(entry.item.longitude)], { icon })
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
      .setContent("Publiez le premier besoin ou service pour faire apparaitre une bulle.")
      .openOn(leafletMap);
  }
}

function selectedItem() {
  if (!state.selected) return `<p class="eyebrow">Selection</p><h2>Appuyez sur une bulle</h2><p>Les bulles bleues sont des besoins. Les vertes montrent les personnes disponibles.</p><div class="detail-meta">Vous pouvez etre les deux avec le meme compte.</div>`;
  const item = state.selected.item;
  const own = item.requester_id === state.user?.id || item.user_id === state.user?.id;
  const request = state.selected.type === "request";
  const identity = request ? item.requester_name : item.full_name;
  const photo = request && item.photo_key ? `<img class="detail-photo" src="/api/files/${escape(item.photo_key)}" alt="Photo de la demande" />` : "";
  const actions = own ? (request ? `<button class="button secondary" data-action="open-offers" data-id="${item.id}">Voir les reponses</button>` : `<button class="button outline" disabled>Votre service</button>`) : request
    ? `<button class="button" data-action="open-reply" data-id="${item.id}">Repondre</button>`
    : `<button class="button green" data-action="open-direct" data-id="${item.id}">Demander ce service</button>`;
  return `<p class="eyebrow">${request ? "Demande" : "Service disponible"}</p><h2>${escape(item.title)}</h2><span class="badge">${escape(item.category_name || "Service")} - ${escape(item.district)}</span>${photo}<div class="detail-meta"><strong>${escape(identity || "Utilisateur ServiceGO")}</strong><br>${escape(item.description)}${item.budget_hint || item.price_hint ? `<br><br>${request ? "Budget" : "Prix"}: ${escape(item.budget_hint || item.price_hint)}` : ""}</div><div class="detail-actions">${actions}</div>`;
}

function mapView() {
  return `<main class="workspace"><aside class="panel actions-panel"><div><p class="eyebrow">Connecte</p><h2>Que voulez-vous faire ?</h2></div><button class="choice" data-action="open-request"><span class="choice-icon">?</span><span><strong>Demander</strong><small>Publier un besoin</small></span></button><button class="choice green-choice" data-action="open-service"><span class="choice-icon">v</span><span><strong>Proposer</strong><small>Rendre un service visible</small></span></button><div class="legend"><span><i class="dot blue"></i> Besoins</span><span><i class="dot green"></i> Services</span><span><i class="dot orange"></i> Urgent</span></div></aside><section class="panel map-panel"><div class="map-toolbar"><span><strong>Maroc</strong><small>Zoomez, deplacez la carte, appuyez sur une bulle</small></span><button class="button secondary" data-action="open-request">+ Besoin</button></div><div id="liveMap" class="real-map" aria-label="Carte interactive du Maroc"></div></section><aside class="panel selection">${selectedItem()}</aside></main>${mobileTabs()}`;
}

function mobileTabs() {
  return `<nav class="mobile-tabbar"><button class="${state.view === "map" ? "active" : ""}" data-action="view" data-view="map">Carte</button><button class="${state.view === "messages" ? "active" : ""}" data-action="view" data-view="messages">Messages</button><button class="${state.view === "profile" ? "active" : ""}" data-action="view" data-view="profile">Profil</button></nav>`;
}

function messagesView() {
  const current = state.conversations.find((item) => item.id === state.activeConversation);
  const list = state.conversations.length ? state.conversations.map((item) => `<button class="conversation ${item.id === state.activeConversation ? "active" : ""}" data-action="conversation" data-id="${item.id}"><strong>${escape(item.other_name)}</strong><small>${escape(item.request_title || item.last_message || "Discussion ServiceGO")}</small></button>`).join("") : `<div class="loading">Vos discussions apparaitront ici.</div>`;
  const chat = current ? `<section class="chat"><div class="chat-title">${escape(current.other_name)} <small>${escape(current.request_title || "Discussion")}</small></div><div class="message-list">${state.messages.length ? state.messages.map((message) => `<div class="message ${message.sender_id === state.user.id ? "mine" : ""}">${escape(message.body)}<small>${escape(message.sender_name)}</small></div>`).join("") : `<p class="page-lead">Dites bonjour pour commencer.</p>`}</div><form class="message-form" data-form="message"><input name="body" maxlength="2000" placeholder="Ecrire un message" required /><button class="button icon" aria-label="Envoyer">></button></form></section>` : `<section class="chat"><div class="loading">Choisissez une discussion.</div></section>`;
  return `<main class="view-page"><p class="eyebrow">Messages</p><h1>Vos discussions</h1><p class="page-lead">Apres une reponse acceptee ou une demande directe, la discussion s'ouvre ici.</p><div class="panel messages-layout"><aside class="conversation-list">${list}</aside>${chat}</div></main>${mobileTabs()}`;
}

function profileView() {
  const user = state.user;
  const requestItems = state.mine.requests.length ? state.mine.requests.map((item) => `<li><button class="text-button" data-action="open-offers" data-id="${item.id}">${escape(item.title)}</button> <small>${escape(item.status)}</small></li>`).join("") : "<li>Aucune demande publiee.</li>";
  const serviceItems = state.mine.services.length ? state.mine.services.map((item) => `<li>${escape(item.title)} <small>${item.available ? "visible" : "masque"}</small></li>`).join("") : "<li>Aucun service propose.</li>";
  const admin = user.is_admin ? `<section class="panel profile-box"><h3>Administration</h3><p>${state.adminStats ? `${state.adminStats.users} comptes<br>${state.adminStats.open_requests} demandes ouvertes<br>${state.adminStats.active_services} services visibles` : "Chargement des statistiques..."}</p></section>` : "";
  return `<main class="view-page"><p class="eyebrow">Profil unique</p><h1>Votre compte ServiceGO</h1><p class="page-lead">Ici, vous etes a la fois libre de demander et de proposer.</p><div class="profile-grid"><section class="panel profile-box profile-main"><div class="avatar">${escape(user.full_name.charAt(0).toUpperCase())}</div><h3>${escape(user.full_name)}</h3><p>${escape(user.email)}<br>${escape(user.district)}</p><button class="button secondary" style="margin-top:16px" data-action="open-profile">Modifier</button></section><section class="panel profile-box"><h3>Mes besoins</h3><ul class="profile-list">${requestItems}</ul></section><section class="panel profile-box"><h3>Mes services</h3><ul class="profile-list">${serviceItems}</ul></section><section class="panel profile-box"><h3>Confiance</h3><p>${Number(user.rating || 5).toFixed(1)} / 5<br>${user.review_count || 0} avis</p></section>${admin}</div></main>${mobileTabs()}`;
}

function authModal() {
  const register = state.authMode === "register";
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">x</button><p class="eyebrow">ServiceGO Maroc</p><h2>${register ? "Creez votre compte" : "Bon retour"}</h2><div class="modal-tabs"><button class="${!register ? "active" : ""}" data-action="auth-tab" data-mode="login">Se connecter</button><button class="${register ? "active" : ""}" data-action="auth-tab" data-mode="register">Creer un compte</button></div><form class="form-grid" data-form="auth">${register ? `<label class="field full"><span>Prenom et nom</span><input name="full_name" minlength="2" maxlength="80" required /></label><label class="field"><span>Telephone</span><input name="phone" maxlength="30" inputmode="tel" /></label><label class="field"><span>Ville</span><select name="district">${cityOptions()}</select></label>` : ""}<label class="field full"><span>Email</span><input name="email" type="email" autocomplete="email" required /></label><label class="field full"><span>Mot de passe</span><input name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" minlength="8" required /></label><button class="button submit" type="submit">${register ? "Creer mon compte" : "Se connecter"}</button></form><p class="form-note">Un seul compte suffit pour demander et proposer, partout au Maroc.</p></section></div>`;
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
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">x</button><p class="eyebrow">Profil</p><h2>Vos informations</h2><form class="form-grid" data-form="profile"><label class="field full"><span>Prenom et nom</span><input name="full_name" value="${escape(user.full_name)}" maxlength="80" required /></label><label class="field"><span>Telephone</span><input name="phone" value="${escape(user.phone || "")}" maxlength="30" /></label><label class="field"><span>Ville</span><select name="district">${cityOptions(user.district)}</select></label><label class="field full"><span>Quelques mots sur vous</span><textarea name="bio" maxlength="500">${escape(user.bio || "")}</textarea></label><label class="field"><span>Mot de passe actuel</span><input name="current_password" type="password" autocomplete="current-password" /></label><label class="field"><span>Nouveau mot de passe</span><input name="new_password" type="password" minlength="8" autocomplete="new-password" /></label><button class="button submit" type="submit">Enregistrer</button></form></section></div>`;
}

function offersModal() {
  const request = state.offers.request;
  const offers = state.offers.items;
  return `<div class="modal-layer"><section class="modal"><button class="button icon outline close" data-action="close-modal" aria-label="Fermer">x</button><p class="eyebrow">Reponses recues</p><h2>${escape(request?.title || "Votre demande")}</h2>${offers.length ? `<div class="offers-list">${offers.map((offer) => `<article class="offer"><strong>${escape(offer.full_name)}</strong><small>${Number(offer.rating || 5).toFixed(1)} / 5 - ${offer.review_count || 0} avis</small><p>${escape(offer.message)}</p>${offer.price_hint ? `<b>${escape(offer.price_hint)}</b>` : ""}${offer.status === "pending" ? `<button class="button" data-action="accept-offer" data-id="${offer.id}">Accepter cette reponse</button>` : `<span class="offer-status">${escape(offer.status)}</span>`}</article>`).join("")}</div>` : `<p class="page-lead">Pas encore de reponse. Votre bulle est toujours visible sur la carte.</p>`}</section></div>`;
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
  return "";
}

function render() {
  const view = !state.user || state.view === "home" ? homeView() : state.view === "messages" ? messagesView() : state.view === "profile" ? profileView() : mapView();
  app.innerHTML = `<div class="app">${header()}${view}${modal()}</div>`;
  if (state.user && state.view === "map") mountInteractiveMap();
}

async function loadMap() {
  const [mapData, categories] = await Promise.all([api("/api/map"), api("/api/categories")]);
  state.map = mapData;
  state.categories = categories.categories;
}

async function loadMine() {
  const [requests, services] = await Promise.all([api("/api/requests"), api("/api/services")]);
  state.mine = { requests: requests.requests, services: services.services };
}

async function loadConversations(selectFirst = false) {
  const data = await api("/api/conversations");
  state.conversations = data.conversations;
  if (selectFirst && !state.activeConversation && data.conversations[0]) state.activeConversation = data.conversations[0].id;
  if (state.activeConversation) {
    const messages = await api(`/api/conversations/${state.activeConversation}/messages`);
    state.messages = messages.messages;
  }
}

async function start() {
  try {
    const [data, config] = await Promise.all([api("/api/me"), api("/api/config")]);
    state.user = data.user;
    state.config = config;
    if (state.user) {
      state.view = "map";
      await loadMap();
    }
  } catch {
    notify("Impossible de joindre ServiceGO.", true);
  }
  render();
}

app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === "home") { state.view = "home"; state.selected = null; render(); }
    if (action === "preview-map") document.querySelector("#preview")?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (action === "open-auth") { state.modal = "auth"; render(); }
    if (action === "close-modal") { state.modal = null; render(); }
    if (action === "auth-tab") { state.authMode = button.dataset.mode; render(); }
    if (action === "open-request") { state.modal = "request"; render(); }
    if (action === "open-service") { state.modal = "service"; render(); }
    if (action === "open-reply") { state.modal = "reply"; render(); }
    if (action === "open-direct") { state.modal = "direct"; render(); }
    if (action === "open-profile") { state.modal = "profile"; render(); }
    if (action === "open-offers") {
      const data = await api(`/api/requests/${button.dataset.id}/offers`);
      state.offers = { request: data.request, items: data.offers };
      state.modal = "offers";
      render();
    }
    if (action === "accept-offer") {
      const data = await api(`/api/offers/${button.dataset.id}/accept`, { method: "POST" });
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
        if (state.user.is_admin) state.adminStats = (await api("/api/admin/overview")).stats;
      }
      render();
    }
    if (action === "select") {
      const type = button.dataset.type;
      const entries = type === "request" ? state.map.requests : state.map.services;
      state.selected = { type, item: entries.find((entry) => entry.id === button.dataset.id) };
      render();
    }
    if (action === "conversation") {
      state.activeConversation = button.dataset.id;
      const messages = await api(`/api/conversations/${state.activeConversation}/messages`);
      state.messages = messages.messages;
      render();
    }
    if (action === "logout") {
      await api("/api/auth/logout", { method: "POST" });
      state.user = null; state.view = "home"; state.selected = null; state.modal = null; render();
      notify("Vous etes deconnecte.");
    }
  } catch (error) { notify(error.message, true); }
});

app.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const type = form.dataset.form;
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    if (type === "auth") {
      const endpoint = state.authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const data = await api(endpoint, { method: "POST", body: JSON.stringify(values) });
      state.user = data.user; state.modal = null; state.view = "map"; await loadMap(); render();
      notify(state.authMode === "register" ? "Votre compte est pret." : "Bienvenue sur ServiceGO.");
    }
    if (type === "request") {
      const city = String(values.district); const coordinates = coordsFromCity(city);
      const photo = form.querySelector('input[name="photo"]');
      if (photo?.files?.[0]) {
        const upload = new FormData(); upload.append("file", photo.files[0]);
        const response = await fetch("/api/uploads", { method: "POST", credentials: "same-origin", body: upload });
        const uploaded = await response.json(); if (!response.ok) throw new Error(uploaded.error || "Photo impossible a envoyer.");
        values.photo_key = uploaded.key;
      }
      await api("/api/requests", { method: "POST", body: JSON.stringify({ ...values, ...coordinates }) });
      state.modal = null; state.view = "map"; await loadMap(); render(); notify("Votre besoin est maintenant visible.");
    }
    if (type === "service") {
      const coordinates = coordsFromCity(String(values.district));
      await api("/api/services", { method: "POST", body: JSON.stringify({ ...values, ...coordinates }) });
      state.modal = null; state.view = "map"; await loadMap(); render(); notify("Votre service est maintenant visible.");
    }
    if (type === "reply") {
      await api(`/api/requests/${values.request_id}/offers`, { method: "POST", body: JSON.stringify(values) });
      state.modal = null; render(); notify("Votre reponse a ete envoyee.");
    }
    if (type === "direct") {
      const coordinates = coordsFromCity(String(values.district));
      const data = await api(`/api/services/${values.service_id}/request`, { method: "POST", body: JSON.stringify({ ...values, ...coordinates }) });
      state.modal = null; state.view = "messages"; state.activeConversation = data.conversation_id; await loadConversations(); render(); notify("Demande envoyee. La discussion est ouverte.");
    }
    if (type === "profile") {
      const data = await api("/api/me", { method: "PATCH", body: JSON.stringify(values) });
      if (values.new_password) await api("/api/me/password", { method: "POST", body: JSON.stringify(values) });
      state.user = data.user; state.modal = null; render(); notify("Profil enregistre.");
    }
    if (type === "message") {
      await api(`/api/conversations/${state.activeConversation}/messages`, { method: "POST", body: JSON.stringify(values) });
      await loadConversations(); render();
    }
  } catch (error) { notify(error.message, true); }
});

start();
