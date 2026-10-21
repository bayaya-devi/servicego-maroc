import * as THREE from "/vendor/three/three.module.min.js";

export function globeSupported() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function positionFromCoordinates(latitude, longitude, radius) {
  const phi = (90 - Number(latitude)) * Math.PI / 180;
  const theta = (Number(longitude) + 180) * Math.PI / 180;
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

export function mountGlobe(target, entries, onSelect) {
  if (!globeSupported()) throw new Error("WEBGL_UNAVAILABLE");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.z = 7.2;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  target.replaceChildren(renderer.domElement);

  const world = new THREE.Group();
  scene.add(world);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(2.35, 64, 48),
    new THREE.MeshStandardMaterial({ color: 0x167eb8, roughness: .72, metalness: .05, emissive: 0x06273e, emissiveIntensity: .28 }),
  );
  world.add(earth);
  const grid = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(2.365, 32, 20)),
    new THREE.LineBasicMaterial({ color: 0x9fe8dc, transparent: true, opacity: .16 }),
  );
  world.add(grid);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.48, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x75d9ec, transparent: true, opacity: .09, side: THREE.BackSide }),
  );
  world.add(atmosphere);
  scene.add(new THREE.HemisphereLight(0xc8f5ff, 0x061421, 2.1));
  const sunlight = new THREE.DirectionalLight(0xffffff, 2.8);
  sunlight.position.set(4, 3, 5);
  scene.add(sunlight);

  const markers = [];
  for (const entry of entries) {
    const material = new THREE.MeshStandardMaterial({ color: entry.kind === "need" ? 0x2585e6 : 0x43c6a5, emissive: entry.kind === "need" ? 0x0d4f9c : 0x167b62, emissiveIntensity: .5 });
    const marker = new THREE.Mesh(new THREE.SphereGeometry(entry.urgent ? .105 : .082, 18, 12), material);
    marker.position.copy(positionFromCoordinates(entry.latitude, entry.longitude, 2.46));
    marker.userData.entry = entry;
    world.add(marker);
    markers.push(marker);
  }

  let dragging = false;
  let moved = false;
  let last = { x: 0, y: 0 };
  let frame = 0;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const resize = () => {
    const width = Math.max(target.clientWidth, 1);
    const height = Math.max(target.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(target);
  resize();
  const down = (event) => { dragging = true; moved = false; last = { x: event.clientX, y: event.clientY }; renderer.domElement.setPointerCapture(event.pointerId); };
  const move = (event) => {
    if (!dragging) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    moved ||= Math.abs(dx) + Math.abs(dy) > 3;
    world.rotation.y += dx * .006;
    world.rotation.x = Math.max(-.8, Math.min(.8, world.rotation.x + dy * .004));
    last = { x: event.clientX, y: event.clientY };
  };
  const up = (event) => {
    dragging = false;
    if (moved) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(markers, false)[0];
    if (hit) onSelect(hit.object.userData.entry);
  };
  const wheel = (event) => { event.preventDefault(); camera.position.z = Math.max(4.4, Math.min(10, camera.position.z + Math.sign(event.deltaY) * .45)); };
  renderer.domElement.addEventListener("pointerdown", down);
  renderer.domElement.addEventListener("pointermove", move);
  renderer.domElement.addEventListener("pointerup", up);
  renderer.domElement.addEventListener("wheel", wheel, { passive: false });
  const animate = () => {
    if (!dragging && !document.hidden) world.rotation.y += .0012;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  };
  animate();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    renderer.dispose();
    scene.traverse((object) => { object.geometry?.dispose?.(); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose()); });
    target.replaceChildren();
  };
}
