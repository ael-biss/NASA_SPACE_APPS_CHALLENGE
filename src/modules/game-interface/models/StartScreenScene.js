/**
 * @file src/modules/game-interface/models/StartScreenScene.js
 * @owner Member 4 (Interface & Integration)
 * @goal Cinematic Three.js main menu scene featuring Deep Space (#050B1B), nebula & starfield,
 *       a curved Earth horizon with city lights & cyan atmosphere rim, a Moon in the upper right,
 *       one golden spacecraft with thruster plume on the left, and one rotating ring space station on the right.
 */

import * as THREE from "three";
import { createPlanetModel } from "../../mission-science/models/proceduralPlanets.js";

function _createCanvasTexture(width, height, drawFn) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function _createNebulaTexture() {
  return _createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);

    const g1 = ctx.createRadialGradient(w * 0.25, h * 0.35, 10, w * 0.25, h * 0.35, w * 0.5);
    g1.addColorStop(0, "rgba(22, 119, 255, 0.28)");
    g1.addColorStop(0.45, "rgba(25, 191, 255, 0.10)");
    g1.addColorStop(1, "rgba(5, 11, 27, 0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createRadialGradient(w * 0.72, h * 0.65, 10, w * 0.72, h * 0.65, w * 0.48);
    g2.addColorStop(0, "rgba(91, 61, 219, 0.26)");
    g2.addColorStop(0.5, "rgba(22, 119, 255, 0.08)");
    g2.addColorStop(1, "rgba(5, 11, 27, 0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);
  });
}

function _createCityLightsTexture() {
  return _createCanvasTexture(1024, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);

    // Deterministic pseudo-random city networks on the visible Earth limb
    let seed = 4219;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const hubs = [];
    for (let i = 0; i < 42; i++) {
      hubs.push({
        x: (0.1 + rand() * 0.8) * w,
        y: (0.18 + rand() * 0.64) * h,
        r: 10 + rand() * 24,
      });
    }

    // Fine glowing transport filaments connecting nearby hubs
    ctx.lineWidth = 0.9;
    for (let i = 0; i < hubs.length; i++) {
      for (let j = i + 1; j < hubs.length; j++) {
        const dx = hubs[i].x - hubs[j].x;
        const dy = hubs[i].y - hubs[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 110) {
          ctx.strokeStyle = `rgba(255, 174, 66, ${0.22 * (1 - dist / 110)})`;
          ctx.beginPath();
          ctx.moveTo(hubs[i].x, hubs[i].y);
          ctx.lineTo(hubs[j].x, hubs[j].y);
          ctx.stroke();
        }
      }
    }

    // Glowing metropolitan clusters
    for (const hub of hubs) {
      const grad = ctx.createRadialGradient(hub.x, hub.y, 0, hub.x, hub.y, hub.r);
      grad.addColorStop(0, "rgba(255, 224, 140, 0.92)");
      grad.addColorStop(0.35, "rgba(255, 157, 36, 0.45)");
      grad.addColorStop(1, "rgba(255, 157, 36, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, hub.r, 0, Math.PI * 2);
      ctx.fill();

      // Scatter satellite towns around each hub
      const subCount = 12 + Math.floor(rand() * 16);
      for (let s = 0; s < subCount; s++) {
        const angle = rand() * Math.PI * 2;
        const radius = rand() * hub.r * 1.45;
        const sx = hub.x + Math.cos(angle) * radius;
        const sy = hub.y + Math.sin(angle) * radius;
        ctx.fillStyle = rand() > 0.35 ? "rgba(255, 198, 102, 0.85)" : "rgba(255, 236, 179, 0.9)";
        ctx.fillRect(sx, sy, 1.4, 1.4);
      }
    }
  });
}

function _createSolarCellTexture() {
  return _createCanvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = "#1148B8";
    ctx.fillRect(0, 0, w, h);

    // Subtle diagonal photovoltaic sheen
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "rgba(25, 191, 255, 0.25)");
    grad.addColorStop(0.5, "rgba(22, 119, 255, 0.08)");
    grad.addColorStop(1, "rgba(5, 11, 27, 0.25)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Cell grid lines
    ctx.strokeStyle = "rgba(234, 244, 255, 0.35)";
    ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += w / 6) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += h / 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });
}

function _createStarfieldLayer(count, size, colorHex, spreadRadius, opacity = 0.9) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = spreadRadius + Math.random() * 24;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = -Math.abs(r * Math.cos(phi)) - 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: colorHex,
      size,
      transparent: true,
      opacity,
      sizeAttenuation: true,
    })
  );
}

function _buildEarthHorizon() {
  const earthWrapper = new THREE.Group();
  earthWrapper.name = "start-earth-horizon";

  const earthBase = createPlanetModel("procedural:earth");
  earthBase.scale.setScalar(8.6);
  earthBase.rotation.set(0.28, -2.15, -0.18);
  earthWrapper.add(earthBase);

  // Night-side city lights web across lower continent limb
  const cityTex = _createCityLightsTexture();
  if (cityTex) {
    const cityLayer = new THREE.Mesh(
      new THREE.SphereGeometry(8.625, 64, 48),
      new THREE.MeshBasicMaterial({
        map: cityTex,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    cityLayer.rotation.set(0.22, -1.7, -0.1);
    earthWrapper.add(cityLayer);
  }

  // Luminous atmospheric Fresnel limb glow matching Cosmic Cyan / Electric Blue
  const atmosphereMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uGlowColor: { value: new THREE.Color(0x19bfff) },
      uCoreColor: { value: new THREE.Color(0x1677ff) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uGlowColor;
      uniform vec3 uCoreColor;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec3 viewDir = normalize(vViewPos);
        float rim = pow(clamp(0.74 - dot(vNormal, -viewDir), 0.0, 1.0), 2.8);
        vec3 col = mix(uCoreColor, uGlowColor, rim);
        gl_FragColor = vec4(col, rim * 0.95);
      }
    `,
  });

  const atmosphereMesh = new THREE.Mesh(new THREE.SphereGeometry(9.25, 64, 48), atmosphereMat);
  earthWrapper.add(atmosphereMesh);

  earthWrapper.position.set(-2.9, -9.85, -5.2);
  return { earthWrapper, earthBase };
}

function _buildMenuSpacecraft() {
  const craft = new THREE.Group();
  craft.name = "start-spacecraft";

  const goldFoilMat = new THREE.MeshStandardMaterial({
    color: 0xf4a024,
    emissive: 0x3b1f00,
    emissiveIntensity: 0.25,
    metalness: 0.62,
    roughness: 0.28,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x101d33,
    metalness: 0.72,
    roughness: 0.35,
  });

  const silverStrutMat = new THREE.MeshStandardMaterial({
    color: 0xc5d8f0,
    metalness: 0.8,
    roughness: 0.22,
  });

  // Octagonal spacecraft bus
  const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.92, 8), goldFoilMat);
  craft.add(bus);

  // Top & bottom dark structural caps
  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.47, 0.08, 8), darkTrimMat);
  topCap.position.y = 0.48;
  const bottomCap = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.36, 0.1, 8), darkTrimMat);
  bottomCap.position.y = -0.49;
  craft.add(topCap, bottomCap);

  // Front circular cyan sensor aperture
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 24), darkTrimMat);
  bezel.rotation.x = Math.PI / 2;
  bezel.position.set(0, 0.05, 0.43);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.13, 24),
    new THREE.MeshStandardMaterial({
      color: 0x19bfff,
      emissive: 0x19bfff,
      emissiveIntensity: 1.5,
      roughness: 0.1,
      metalness: 0.2,
    })
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.05, 0.44);
  craft.add(bezel, lens);

  // Coiled helical antenna on top
  const antennaGroup = new THREE.Group();
  antennaGroup.position.set(0, 0.52, 0);
  const antennaMast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.56, 12), silverStrutMat);
  antennaMast.position.y = 0.28;
  antennaGroup.add(antennaMast);

  const helixPoints = [];
  const turns = 4.5;
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 2 * turns;
    const radius = 0.17 * (1 - t * 0.25);
    helixPoints.push(new THREE.Vector3(Math.cos(angle) * radius, 0.08 + t * 0.48, Math.sin(angle) * radius));
  }
  const helixCurve = new THREE.CatmullRomCurve3(helixPoints);
  const helixMesh = new THREE.Mesh(new THREE.TubeGeometry(helixCurve, 72, 0.018, 8, false), goldFoilMat);
  antennaGroup.add(helixMesh);
  craft.add(antennaGroup);

  // Articulated Electric Blue solar array wings
  const cellTex = _createSolarCellTexture();
  const panelMat = new THREE.MeshStandardMaterial({
    map: cellTex,
    color: cellTex ? 0xffffff : 0x1677ff,
    emissive: 0x0a2e6d,
    emissiveIntensity: 0.35,
    metalness: 0.45,
    roughness: 0.25,
  });

  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 10), silverStrutMat);
    strut.rotation.z = Math.PI / 2;
    strut.position.x = side * 0.58;
    wing.add(strut);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.44, 0.03), darkTrimMat);
    frame.position.x = side * 1.24;
    const cells = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.38, 0.036), panelMat);
    cells.position.x = side * 1.24;

    wing.add(frame, cells);
    wing.rotation.x = 0.22;
    wing.rotation.z = side * 0.04;
    craft.add(wing);
  }

  // Bottom thruster bell + glowing Cosmic Cyan ion plume
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.23, 0.22, 18), darkTrimMat);
  nozzle.position.y = -0.64;
  craft.add(nozzle);

  const plumeGroup = new THREE.Group();
  plumeGroup.position.y = -0.75;

  const outerPlume = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 1.05, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x1677ff,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  outerPlume.rotation.x = Math.PI;
  outerPlume.position.y = -0.5;

  const innerPlume = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.78, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x19bfff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  innerPlume.rotation.x = Math.PI;
  innerPlume.position.y = -0.36;

  const corePlume = new THREE.Mesh(
    new THREE.ConeGeometry(0.065, 0.44, 16),
    new THREE.MeshBasicMaterial({
      color: 0xeaf4ff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  corePlume.rotation.x = Math.PI;
  corePlume.position.y = -0.2;

  plumeGroup.add(outerPlume, innerPlume, corePlume);
  craft.add(plumeGroup);

  // Point light from thruster
  const thrusterLight = new THREE.PointLight(0x19bfff, 1.4, 3.5);
  thrusterLight.position.set(0, -0.9, 0.2);
  craft.add(thrusterLight);

  craft.position.set(-3.55, 0.08, 0.35);
  craft.rotation.set(0.2, 0.44, -0.14);
  craft.scale.setScalar(0.95);

  return { craft, plumeGroup, thrusterLight };
}

function _buildSpaceStation() {
  const stationRoot = new THREE.Group();
  stationRoot.name = "start-space-station";

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xdce8f8,
    metalness: 0.48,
    roughness: 0.35,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x3b4f6e,
    metalness: 0.65,
    roughness: 0.35,
  });

  const cyanGlowMat = new THREE.MeshStandardMaterial({
    color: 0x19bfff,
    emissive: 0x19bfff,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });

  const goldGlowMat = new THREE.MeshStandardMaterial({
    color: 0xff9d24,
    emissive: 0xff9d24,
    emissiveIntensity: 1.15,
    roughness: 0.2,
  });

  // Central hub spire (stationary/slowly counter-rotating axis)
  const coreColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.35, 20), hullMat);
  stationRoot.add(coreColumn);

  const midHub = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.48, 20), trimMat);
  stationRoot.add(midHub);

  // Illuminated docking bay collar at center
  const centerGlowRing = new THREE.Mesh(new THREE.CylinderGeometry(0.475, 0.475, 0.12, 24), goldGlowMat);
  stationRoot.add(centerGlowRing);

  const upperDock = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.55, 16), trimMat);
  upperDock.position.y = 1.35;
  const upperSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.9, 10), hullMat);
  upperSpire.position.y = 2.0;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), cyanGlowMat);
  beacon.position.y = 2.46;

  const lowerDock = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.58, 16), trimMat);
  lowerDock.position.y = -1.35;
  const lowerGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16), cyanGlowMat);
  lowerGlow.position.y = -1.15;

  stationRoot.add(upperDock, upperSpire, beacon, lowerDock, lowerGlow);

  // Rotating centrifugal habitat wheel
  const ringRotor = new THREE.Group();
  const ringRadius = 1.82;

  const mainTorus = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.19, 16, 64), hullMat);
  mainTorus.rotation.x = Math.PI / 2;
  ringRotor.add(mainTorus);

  const innerTrussRing = new THREE.Mesh(new THREE.TorusGeometry(ringRadius - 0.24, 0.04, 10, 48), trimMat);
  innerTrussRing.rotation.x = Math.PI / 2;
  ringRotor.add(innerTrussRing);

  // Segmented module armor plates + glowing habitat windows around the wheel
  const segmentCount = 18;
  for (let i = 0; i < segmentCount; i++) {
    const theta = (i / segmentCount) * Math.PI * 2;
    const x = Math.cos(theta) * ringRadius;
    const z = Math.sin(theta) * ringRadius;

    const moduleBlock = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.42), hullMat);
    moduleBlock.position.set(x, 0, z);
    moduleBlock.rotation.y = -theta;
    ringRotor.add(moduleBlock);

    // Alternating warm Stellar Gold and Cosmic Cyan viewport strips
    const winMat = i % 3 === 0 ? goldGlowMat : cyanGlowMat;
    const winOuter = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.24), winMat);
    winOuter.position.set(Math.cos(theta) * (ringRadius + 0.175), 0.02, Math.sin(theta) * (ringRadius + 0.175));
    winOuter.rotation.y = -theta;
    ringRotor.add(winOuter);

    const winTop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.2), winMat);
    winTop.position.set(x, 0.175, z);
    winTop.rotation.y = -theta;
    ringRotor.add(winTop);
  }

  // 6 radial spokes connecting hub to habitat ring
  for (let s = 0; s < 6; s++) {
    const theta = (s / 6) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, ringRadius - 0.3, 10), trimMat);
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = -theta;
    spoke.position.set(Math.cos(theta) * (ringRadius * 0.5), 0, Math.sin(theta) * (ringRadius * 0.5));
    ringRotor.add(spoke);
  }

  stationRoot.add(ringRotor);

  // Warm hub core light
  const stationLight = new THREE.PointLight(0xff9d24, 1.1, 4.5);
  stationLight.position.set(0, 0.2, 0.6);
  stationRoot.add(stationLight);

  stationRoot.position.set(4.15, -0.78, -0.75);
  stationRoot.rotation.set(0.36, -0.45, -0.22);
  stationRoot.scale.setScalar(0.92);

  return { stationRoot, ringRotor };
}

export class StartScreenScene {
  /** @param {import('../../../core/SceneManager.js').SceneManager} sceneManager */
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this._root = null;
    this._earth = null;
    this._moon = null;
    this._craft = null;
    this._plume = null;
    this._thrusterLight = null;
    this._stationRing = null;
    this._starsNear = null;
    this._starsFar = null;
    this._elapsed = 0;
    this._onResize = () => this._updateCameraFraming();
  }

  /** Build and mount the start menu 3D scene into SceneManager. */
  mount() {
    this.unmount();

    const root = new THREE.Group();
    root.name = "orbit-craft-start-scene";

    this.sceneManager.scene.background = new THREE.Color(0x050b1b);

    // Lighting tailored to showcase gold spacecraft, silver station, Earth rim, and Moon crescent
    const hemi = new THREE.HemisphereLight(0x8ec5ff, 0x050b1b, 0.65);
    const sun = new THREE.DirectionalLight(0xfff6e8, 2.3);
    sun.position.set(-7, 5, 6);
    const earthBounce = new THREE.DirectionalLight(0x19bfff, 0.95);
    earthBounce.position.set(-2, -6, 3);
    const rim = new THREE.DirectionalLight(0x1677ff, 0.7);
    rim.position.set(6, 2, -4);
    root.add(hemi, sun, earthBounce, rim);

    // Nebula backdrop planes
    const nebulaTex = _createNebulaTexture();
    if (nebulaTex) {
      const nebulaPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(38, 22),
        new THREE.MeshBasicMaterial({
          map: nebulaTex,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        })
      );
      nebulaPlane.position.set(0, 0, -18);
      root.add(nebulaPlane);
    }

    // Multi-layered starfields
    this._starsFar = _createStarfieldLayer(650, 0.08, 0xeaf4ff, 14, 0.88);
    this._starsNear = _createStarfieldLayer(140, 0.14, 0x19bfff, 11, 0.75);
    const goldStars = _createStarfieldLayer(36, 0.16, 0xff9d24, 12, 0.85);
    root.add(this._starsFar, this._starsNear, goldStars);

    // Earth horizon (lower left/bottom)
    const { earthWrapper, earthBase } = _buildEarthHorizon();
    this._earth = earthBase;
    root.add(earthWrapper);

    // Moon (top right)
    const moon = createPlanetModel("procedural:moon");
    moon.position.set(4.55, 2.65, -6.4);
    moon.scale.setScalar(1.08);
    moon.rotation.y = 0.6;
    this._moon = moon;
    root.add(moon);

    // Spacecraft (left)
    const { craft, plumeGroup, thrusterLight } = _buildMenuSpacecraft();
    this._craft = craft;
    this._plume = plumeGroup;
    this._thrusterLight = thrusterLight;
    root.add(craft);

    // Ring Space Station (right)
    const { stationRoot, ringRotor } = _buildSpaceStation();
    this._stationRing = ringRotor;
    root.add(stationRoot);

    this._root = root;
    this.sceneManager.addObject(root);
    this._updateCameraFraming();

    if (typeof window !== "undefined") {
      window.addEventListener("resize", this._onResize);
    }
  }

  _updateCameraFraming() {
    if (!this.sceneManager) return;
    const aspect = typeof window !== "undefined" ? window.innerWidth / Math.max(window.innerHeight, 1) : 16 / 9;
    // Pull back slightly on narrower screens so both left spacecraft and right station stay visible
    const zDist = aspect < 1.35 ? 10.6 : aspect < 1.6 ? 9.2 : 8.2;
    this.sceneManager.setCamera(new THREE.Vector3(0, 0.05, zDist), new THREE.Vector3(0, 0, 0));
  }

  /** Animate spacecraft hover, thruster flicker, station rotation, and Earth turn. */
  update(deltaTime) {
    if (!this._root) return;
    this._elapsed += deltaTime;

    if (this._earth) {
      this._earth.rotation.y += deltaTime * 0.018;
    }
    if (this._moon) {
      this._moon.rotation.y += deltaTime * 0.012;
    }
    if (this._stationRing) {
      this._stationRing.rotation.y += deltaTime * 0.22;
    }
    if (this._craft) {
      this._craft.position.y = 0.08 + Math.sin(this._elapsed * 1.15) * 0.09;
      this._craft.rotation.z = -0.14 + Math.sin(this._elapsed * 0.85) * 0.025;
    }
    if (this._plume) {
      const pulse = 0.92 + Math.sin(this._elapsed * 18) * 0.08;
      this._plume.scale.set(1, pulse, 1);
    }
    if (this._thrusterLight) {
      this._thrusterLight.intensity = 1.3 + Math.sin(this._elapsed * 16) * 0.2;
    }
    if (this._starsFar) {
      this._starsFar.rotation.y += deltaTime * 0.004;
    }
    if (this._starsNear) {
      this._starsNear.rotation.y += deltaTime * 0.008;
    }
  }

  /** Remove and dispose all 3D resources created for the start screen. */
  unmount() {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this._onResize);
    }
    if (!this._root) return;

    this.sceneManager.removeObject(this._root);
    this._root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        }
      }
    });

    this._root = null;
    this._earth = null;
    this._moon = null;
    this._craft = null;
    this._plume = null;
    this._thrusterLight = null;
    this._stationRing = null;
    this._starsNear = null;
    this._starsFar = null;
  }
}
