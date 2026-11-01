import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { RobotDesign } from "../shared/types";
export type Viewer = {
  dispose: () => void;
  explode: (value: number) => void;
  select: (id: string) => void;
  reset: () => void;
};
export function mountRobot(
  host: HTMLElement,
  design: RobotDesign,
  onSelect: (id: string) => void,
  onFallback: () => void,
): Viewer | null {
  let disposed = false;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  host.appendChild(renderer.domElement);
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    queueMicrotask(() => {
      if (!disposed) onFallback();
    });
  });
  renderer.domElement.setAttribute(
    "aria-label",
    "Illustrative service robot — use component list to select parts",
  );
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(2.7, 2, 3.2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.85, 0);
  controls.enableDamping = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.enablePan = false;
  scene.add(new THREE.HemisphereLight(0xc9e8ff, 0x24373b, 3));
  const light = new THREE.DirectionalLight(0xffffff, 5);
  light.position.set(2, 5, 3);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  scene.add(light);
  const rim = new THREE.DirectionalLight(0xb4f375, 2);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  const group = new THREE.Group();
  scene.add(group);
  const parts: THREE.Mesh[] = [];
  const white = new THREE.MeshStandardMaterial({
    color: 0xd6dfdb,
    metalness: 0.55,
    roughness: 0.32,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x182a33,
    metalness: 0.5,
    roughness: 0.4,
  });
  const lime = new THREE.MeshStandardMaterial({
    color: 0xb4f375,
    metalness: 0.35,
    roughness: 0.3,
    emissive: 0x324c18,
    emissiveIntensity: 0.3,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x111b20,
    roughness: 0.9,
  });
  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    id: string,
    x: number,
    y: number,
    z: number,
    layer: number,
  ): THREE.Mesh {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { id, baseY: y, layer, material };
    parts.push(m);
    group.add(m);
    return m;
  }
  mesh(
    new THREE.CylinderGeometry(0.46, 0.43, 0.24, 64),
    white,
    "chassis",
    0,
    0.2,
    0,
    0,
  );
  mesh(
    new THREE.CylinderGeometry(0.465, 0.465, 0.045, 64),
    dark,
    "chassis",
    0,
    0.3,
    0,
    0,
  );
  mesh(
    new THREE.CylinderGeometry(0.435, 0.44, 0.035, 64),
    lime,
    "chassis",
    0,
    0.12,
    0,
    0,
  );
  for (const x of [-0.43, 0.43]) {
    const w = mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.06, 24),
      rubber,
      "drive",
      x,
      0.14,
      0,
      0,
    );
    w.rotation.z = Math.PI / 2;
  }
  mesh(
    new THREE.BoxGeometry(0.29, 0.12, 0.21),
    dark,
    "battery",
    0,
    0.37,
    -0.04,
    1,
  );
  for (const x of [-0.31, 0.31])
    for (const z of [-0.18, 0.18])
      mesh(
        new THREE.CylinderGeometry(0.021, 0.021, 1.15, 12),
        white,
        "trays",
        x,
        0.92,
        z,
        1,
      );
  for (let i = 0; i < design.trays; i++) {
    const y = 0.5 + i * 0.31;
    mesh(
      new THREE.BoxGeometry(0.79, 0.034, 0.56),
      dark,
      "trays",
      0,
      y,
      0,
      2 + i,
    );
    mesh(
      new THREE.BoxGeometry(0.75, 0.009, 0.52),
      white,
      "trays",
      0,
      y + 0.023,
      0,
      2 + i,
    );
    for (const x of [-0.38, 0.38])
      mesh(
        new THREE.BoxGeometry(0.018, 0.055, 0.55),
        dark,
        "trays",
        x,
        y + 0.03,
        0,
        2 + i,
      );
    mesh(
      new THREE.BoxGeometry(0.75, 0.055, 0.018),
      dark,
      "trays",
      0,
      y + 0.03,
      -0.27,
      2 + i,
    );
    if (i === 1) {
      mesh(
        new THREE.CylinderGeometry(0.09, 0.07, 0.013, 32),
        white,
        "trays",
        0.17,
        y + 0.045,
        0.02,
        2 + i,
      );
      mesh(
        new THREE.CylinderGeometry(0.055, 0.035, 0.06, 32),
        lime,
        "trays",
        0.17,
        y + 0.07,
        0.02,
        2 + i,
      );
    }
  }
  const top = 0.5 + (design.trays - 1) * 0.31;
  mesh(
    new THREE.BoxGeometry(0.065, 0.27, 0.055),
    white,
    "tablet",
    0,
    top + 0.2,
    -0.15,
    design.trays + 2,
  );
  const tablet = mesh(
    new THREE.BoxGeometry(0.3, 0.2, 0.028),
    dark,
    "tablet",
    0,
    top + 0.35,
    -0.11,
    design.trays + 2,
  );
  tablet.rotation.x = -0.3;
  const screen = mesh(
    new THREE.BoxGeometry(0.26, 0.155, 0.005),
    lime,
    "tablet",
    0,
    top + 0.35,
    -0.09,
    design.trays + 2,
  );
  screen.rotation.x = -0.3;
  mesh(
    design.sensor === "lidar"
      ? new THREE.CylinderGeometry(0.09, 0.09, 0.07, 32)
      : new THREE.BoxGeometry(0.2, 0.075, 0.07),
    dark,
    "sensor",
    0,
    0.38,
    0.3,
    1,
  );
  mesh(
    design.sensor === "lidar"
      ? new THREE.CylinderGeometry(0.091, 0.091, 0.012, 32)
      : new THREE.BoxGeometry(0.15, 0.018, 0.075),
    lime,
    "sensor",
    0,
    0.405,
    0.3,
    1,
  );
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 80),
    new THREE.MeshStandardMaterial({
      color: 0x15252b,
      roughness: 1,
      transparent: true,
      opacity: 0.9,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.position.y = 0.008;
  scene.add(floor);
  const grid = new THREE.GridHelper(5, 25, 0x3e565c, 0x263d43);
  grid.position.y = 0.012;
  scene.add(grid);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 0.686, 80),
    new THREE.MeshBasicMaterial({
      color: 0xb4f375,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);
  const render = () => renderer.render(scene, camera);
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener("change", render);
  let down = { x: 0, y: 0 };
  renderer.domElement.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const r = host.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      camera,
    );
    const hit = ray.intersectObjects(parts)[0];
    if (hit) onSelect(String(hit.object.userData.id));
  });
  resize();
  return {
    explode(value) {
      camera.position.set(
        2.7 + value * 0.7,
        2 + value * 0.8,
        3.2 + value * 0.8,
      );
      controls.target.set(0, 0.85 + value * 0.4, 0);
      controls.update();
      for (const m of parts)
        m.position.y =
          Number(m.userData.baseY) + Number(m.userData.layer) * value * 0.15;
      render();
    },
    select(id) {
      for (const m of parts) {
        m.material = m.userData.id === id ? lime : m.userData.material;
      }
      render();
    },
    reset() {
      camera.position.set(2.7, 2, 3.2);
      controls.target.set(0, 0.85, 0);
      controls.update();
      render();
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          for (const material of Array.isArray(o.material)
            ? o.material
            : [o.material])
            material.dispose();
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      host.replaceChildren();
    },
  };
}
