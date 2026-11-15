/**
 * @file src/modules/launch-orbit/models/PlanetScene.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Renders the 3D Earth sphere, destination body (Moon or Mars), starfield,
 *       sun lighting, parking orbit ring, and transfer trajectory arc for Launch & Orbit.
 */

import * as THREE from "three";
import { DEFAULT_LAUNCH_SITE_ID, getLaunchSiteById } from "../data/launchSites.js";

export class PlanetScene {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "planet-scene-root";
    this._earthGroup = null;
    this._earthMesh = null;
    this._padGroup = null;
    this._destGroup = null;
    this._destMesh = null;
    this._orbitGroup = null;
    this._earthRadius = 1.8;
    this._destPosition = new THREE.Vector3();
    this._textures = [];
    this._launchSite = getLaunchSiteById(DEFAULT_LAUNCH_SITE_ID);
    this._scales = { earth: 1, destination: 1, orbit: 1 };
  }

  /**
   * Convert geographic latitude & longitude (degrees) into a 3D Cartesian point
   * matching Three.js SphereGeometry equirectangular UV mapping (u=0 at -180° lon).
   *
   * @param {number} latDeg - Latitude in degrees (-90..90)
   * @param {number} lonDeg - Longitude in degrees (-180..180, East positive)
   * @param {number} [radius=1.8]
   * @returns {THREE.Vector3}
   */
  static latLonToVector3(latDeg, lonDeg, radius = 1.8) {
    const latRad = THREE.MathUtils.degToRad(latDeg);
    const lonRad = THREE.MathUtils.degToRad(lonDeg);
    const cosLat = Math.cos(latRad);
    return new THREE.Vector3(
      radius * cosLat * Math.cos(lonRad),
      radius * Math.sin(latRad),
      -radius * cosLat * Math.sin(lonRad)
    );
  }

  latLonToVector3(latDeg, lonDeg, radius = this._earthRadius) {
    return PlanetScene.latLonToVector3(latDeg, lonDeg, radius);
  }

  /**
   * Compute the current world-space launch site position, local vertical normal,
   * East/North tangent vectors, launch heading vector, and orbit plane normal.
   *
   * @param {string | Object} [launchSite]
   * @param {number} [azimuthDeg=90]
   */
  getLaunchSiteFrame(launchSite = this._launchSite, azimuthDeg = 90) {
    const site = getLaunchSiteById(launchSite);
    const earthRotY = this._earthMesh?.rotation.y ?? 0;
    const latDeg = site?.latitudeDeg ?? 28.6;
    const lonDeg = site?.longitudeDeg ?? -80.6;
    const lonRad = THREE.MathUtils.degToRad(lonDeg);
    const azRad = THREE.MathUtils.degToRad(azimuthDeg);
    const rotQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), earthRotY);

    const surfacePos = this.latLonToVector3(latDeg, lonDeg, this._earthRadius).applyQuaternion(rotQ);
    const up = surfacePos.clone().normalize();
    const east = new THREE.Vector3(-Math.sin(lonRad), 0, -Math.cos(lonRad))
      .applyQuaternion(rotQ)
      .normalize();
    const north = up.clone().cross(east).normalize();
    const heading = north
      .clone()
      .multiplyScalar(Math.cos(azRad))
      .addScaledVector(east, Math.sin(azRad))
      .normalize();
    const planeNormal = up.clone().cross(heading).normalize();

    return {
      site,
      earthRadius: this._earthRadius,
      scaledEarthRadius: this._earthRadius * this._scales.earth,
      earthScale: this._scales.earth,
      orbitScale: this._scales.orbit,
      destinationScale: this._scales.destination,
      earthRotY,
      surfacePos,
      up,
      east,
      north,
      heading,
      planeNormal,
    };
  }

  /**
   * Orient Earth so the launch site faces cleanly toward the launch camera (+Z / +X).
   * At KSC (-80.6°W), rotation.y = 0 places Florida facing forward with the Atlantic to the east (+X).
   * @param {string | Object} [launchSite]
   */
  orientToSite(launchSite = this._launchSite) {
    const site = getLaunchSiteById(launchSite);
    this._launchSite = site;
    const targetFacingLonDeg = -80.6;
    const rotY = THREE.MathUtils.degToRad(targetFacingLonDeg - (site?.longitudeDeg ?? -80.6));
    if (this._earthMesh) this._earthMesh.rotation.y = rotY;
  }

  /**
   * Build 3D Earth sphere (with NASA Blue Marble texture + procedural fallback),
   * KSC LC-39A launch pad marker, atmospheric rim, lighting, and starfield background.
   * @param {string | Object} [launchSite]
   * @returns {THREE.Group}
   */
  buildEarth(launchSite = DEFAULT_LAUNCH_SITE_ID) {
    this.dispose();
    this._launchSite = getLaunchSiteById(launchSite);

    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.55);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(18, 10, 14);
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rim.position.set(-14, -4, -10);
    this.group.add(hemi, sun, rim);

    const fallbackTex = this._createEarthTexture();
    const earthMat = new THREE.MeshStandardMaterial({
      map: fallbackTex ?? null,
      color: fallbackTex ? 0xffffff : 0x1d4ed8,
      roughness: 0.72,
      metalness: 0.06,
    });
    this._earthGroup = new THREE.Group();
    this._earthGroup.name = "earth-body-group";

    this._earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(this._earthRadius, 64, 48),
      earthMat
    );
    this._earthMesh.name = "earth-sphere";
    this._earthGroup.add(this._earthMesh);

    if (typeof Image !== "undefined") {
      const loader = new THREE.TextureLoader();
      loader.load(
        "/textures/earth-blue-marble.jpg",
        (blueMarble) => {
          if (!this._earthMesh) {
            blueMarble.dispose();
            return;
          }
          blueMarble.colorSpace = THREE.SRGBColorSpace;
          blueMarble.anisotropy = 4;
          this._textures.push(blueMarble);
          earthMat.map = blueMarble;
          earthMat.color.setHex(0xffffff);
          earthMat.needsUpdate = true;
        },
        undefined,
        () => {
          // Retain procedural texture fallback if external image fails to load
        }
      );
    }

    this._padGroup = this._buildLaunchPadMarker(this._launchSite);
    this._earthMesh.add(this._padGroup);

    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(this._earthRadius * 1.072, 36, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.16,
        side: THREE.BackSide,
      })
    );
    this._earthGroup.add(atmo);
    this.group.add(this._earthGroup);

    this.group.add(this._createStarfield());
    this.orientToSite(this._launchSite);
    this._applyPartScales();
    return this.group;
  }

  /**
   * Build a clean, strictly non-looping Quadratic Bezier transfer trajectory curve
   * from LEO parking departure to destination capture/target ring.
   *
   * @param {Object} orbit
   * @param {THREE.Vector3} leoDeparture
   * @param {THREE.Vector3} leoDepartureDir
   * @returns {THREE.QuadraticBezierCurve3 | null}
   */
  static computeTransferCurve(orbit, leoDeparture, leoDepartureDir) {
    if (!orbit || orbit.id === "LEO") return null;
    const targetRadius = orbit?.orbitRadius3D ?? 3.0;
    const isDeep = orbit.id === "LUNAR" || orbit.id === "MARS";

    if (isDeep) {
      const destRadius = orbit.id === "MARS" ? 0.95 : 0.72;
      const captureR = destRadius + 0.65;
      const endPoint = new THREE.Vector3(targetRadius, 0, -captureR);

      // Single clean monotonic control point forward in +X and gently arched in -Z/+Y
      const chordLen = leoDeparture.distanceTo(endPoint);
      const ctrl = leoDeparture
        .clone()
        .addScaledVector(leoDepartureDir, chordLen * 0.34);
      ctrl.x = Math.max(leoDeparture.x + 0.65, Math.min(targetRadius - 0.5, (leoDeparture.x + targetRadius) * 0.46));
      ctrl.y = Math.max(-0.2, Math.min(1.3, (leoDeparture.y + endPoint.y) * 0.55));
      ctrl.z = Math.min(leoDeparture.z, -captureR * 0.55);

      return new THREE.QuadraticBezierCurve3(leoDeparture.clone(), ctrl, endPoint);
    }

    // MEO / GEO single clean Hohmann transfer arc (monotonically spiraling outward)
    const endPoint = new THREE.Vector3(targetRadius, 0, 0);
    const ctrl = leoDeparture
      .clone()
      .lerp(endPoint, 0.5)
      .addScaledVector(leoDepartureDir, targetRadius * 0.28);
    ctrl.setLength(Math.max(leoDeparture.length() * 1.15, targetRadius * 0.88));
    return new THREE.QuadraticBezierCurve3(leoDeparture.clone(), ctrl, endPoint);
  }

  /**
   * Render target orbit ring, transfer trajectory arc, and destination planet/moon.
   * Aligns the LEO parking ring with the launch site's surface-normal & heading plane.
   * @param {Object} orbit
   * @param {string | Object} [launchSite]
   * @param {number} [azimuthDeg=90]
   * @returns {THREE.Group}
   */
  buildOrbitRing(orbit, launchSite = this._launchSite, azimuthDeg = 90) {
    if (this._orbitGroup) {
      this.group.remove(this._orbitGroup);
      this._disposeObject(this._orbitGroup);
    }

    const orbitGroup = new THREE.Group();
    orbitGroup.name = `orbit-visual:${orbit?.id ?? "LEO"}`;

    const leoRadius = 3.0;
    const targetRadius = orbit?.orbitRadius3D ?? 3.0;
    const siteMinInclDeg = Math.abs(launchSite?.latitudeDeg ?? 28.6);
    const isEarthOrbit = !orbit?.targetBody || orbit.targetBody === "Earth";
    const resolvedInclDeg =
      isEarthOrbit && typeof orbit?.inclinationDeg === "number" && Number.isFinite(orbit.inclinationDeg)
        ? orbit.inclinationDeg
        : siteMinInclDeg;
    const inclRad = (resolvedInclDeg * Math.PI) / 180;

    // Orient LEO parking orbit ring into the great-circle plane (up, heading) from launch site
    const siteFrame = this.getLaunchSiteFrame(launchSite, azimuthDeg);
    const { up, heading } = siteFrame;
    orbitGroup.add(this._makePlaneRing(leoRadius, up, heading, 0x38bdf8, 0.52));

    // Departure point on LEO parking orbit after deployment (~0.72 rad downrange along heading)
    const deployAngle = 0.72;
    const leoDeparture = up
      .clone()
      .multiplyScalar(Math.cos(deployAngle) * leoRadius)
      .addScaledVector(heading, Math.sin(deployAngle) * leoRadius);
    const leoDepartureDir = up
      .clone()
      .multiplyScalar(-Math.sin(deployAngle))
      .addScaledVector(heading, Math.cos(deployAngle))
      .normalize();

    if (orbit?.id === "LUNAR" || orbit?.id === "MARS") {
      // Destination celestial body at outer trajectory endpoint
      const isMars = orbit.id === "MARS";
      const destRadius = isMars ? 0.95 : 0.72;
      this._destPosition.set(targetRadius, 0, 0);

      const destGroup = new THREE.Group();
      destGroup.position.copy(this._destPosition);

      const destMat = new THREE.MeshStandardMaterial({
        color: isMars ? 0xc2410c : 0x94a3b8,
        emissive: isMars ? 0x431407 : 0x1e293b,
        roughness: isMars ? 0.85 : 0.92,
        metalness: 0.05,
      });
      this._destMesh = new THREE.Mesh(
        new THREE.SphereGeometry(destRadius, 64, 48),
        destMat
      );
      destGroup.add(this._destMesh);

      if (typeof Image !== "undefined") {
        const loader = new THREE.TextureLoader();
        const destUrl = isMars ? "/textures/mars.jpg" : "/textures/moon.jpg";
        loader.load(
          destUrl,
          (destTex) => {
            if (!this._destMesh || this._destMesh.material !== destMat) {
              destTex.dispose();
              return;
            }
            destTex.colorSpace = THREE.SRGBColorSpace;
            destTex.anisotropy = 4;
            this._textures.push(destTex);
            destMat.map = destTex;
            destMat.color.setHex(0xffffff);
            destMat.emissive.setHex(0x000000);
            destMat.needsUpdate = true;
          },
          undefined,
          () => {
            // Retain solid fallback color if texture fails to load
          }
        );
      }

      if (isMars) {
        const marsAtmo = new THREE.Mesh(
          new THREE.SphereGeometry(destRadius * 1.07, 28, 20),
          new THREE.MeshBasicMaterial({
            color: 0xfb923c,
            transparent: true,
            opacity: 0.16,
            side: THREE.BackSide,
          })
        );
        destGroup.add(marsAtmo);
      }

      // Destination polar capture orbit ring
      const captureRing = this._makeRing(
        destRadius + 0.65,
        isMars ? 0xfb923c : 0xe2e8f0,
        0.65,
        Math.PI * 0.48
      );
      destGroup.add(captureRing);
      destGroup.name = "destination-body-group";
      this._destGroup = destGroup;
      orbitGroup.add(destGroup);

      // Clean loop-free transfer trajectory arc
      const curve = PlanetScene.computeTransferCurve(orbit, leoDeparture, leoDepartureDir);
      if (curve) {
        const arcPoints = curve.getPoints(72);
        const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
        const arcMat = new THREE.LineBasicMaterial({
          color: isMars ? 0xf59e0b : 0x7dd3fc,
          transparent: true,
          opacity: 0.78,
        });
        orbitGroup.add(new THREE.Line(arcGeo, arcMat));

        const mid = curve.getPoint(0.52);
        this._addNotToScaleBadge(orbitGroup, mid.clone().add(new THREE.Vector3(0, 0.45, 0)));
      }
    } else if (orbit && orbit.id !== "LEO") {
      // MEO / GEO target orbit ring tilted at its true equatorial inclination + transfer arc
      orbitGroup.add(this._makeRing(targetRadius, 0x22c55e, 0.62, inclRad));
      const curve = PlanetScene.computeTransferCurve(orbit, leoDeparture, leoDepartureDir);
      if (curve) {
        const arcGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(56));
        orbitGroup.add(
          new THREE.Line(
            arcGeo,
            new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.72 })
          )
        );
        const mid = curve.getPoint(0.5);
        this._addNotToScaleBadge(orbitGroup, mid.clone().add(new THREE.Vector3(0, 0.38, 0)));
      }
      this._destPosition.set(0, 0, 0);
      this._destGroup = null;
      this._destMesh = null;
    } else {
      this._destPosition.set(0, 0, 0);
      this._destGroup = null;
      this._destMesh = null;
    }

    this._orbitGroup = orbitGroup;
    this.group.add(orbitGroup);
    this._applyPartScales();
    return orbitGroup;
  }

  /**
   * Update visual scales for individual Launch & Orbit scene components without affecting physics.
   * @param {{ earth?: number, destination?: number, orbit?: number }} [scales]
   */
  setPartScales(scales = {}) {
    const clampScale = (v, fallback) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0.25, Math.min(4.5, n)) : fallback;
    };
    this._scales.earth = clampScale(scales.earth, this._scales.earth);
    this._scales.destination = clampScale(scales.destination, this._scales.destination);
    this._scales.orbit = clampScale(scales.orbit, this._scales.orbit);
    this._applyPartScales();
    return { ...this._scales };
  }

  getPartScales() {
    return { ...this._scales };
  }

  _applyPartScales() {
    if (this._earthGroup) {
      this._earthGroup.scale.setScalar(this._scales.earth);
    }
    if (this._orbitGroup) {
      this._orbitGroup.scale.setScalar(this._scales.orbit);
    }
    if (this._destGroup) {
      this._destGroup.scale.setScalar(
        this._scales.destination / Math.max(0.05, this._scales.orbit)
      );
    }
  }

  getEarthRadius() {
    return this._earthRadius;
  }

  getScaledEarthRadius() {
    return this._earthRadius * this._scales.earth;
  }

  getDestinationPosition() {
    return this._destPosition.clone();
  }

  getScaledDestinationPosition() {
    return this._destPosition.clone().multiplyScalar(this._scales.orbit);
  }

  /**
   * Rotate Earth and destination body gently each frame.
   * Keeps Earth spin subtle during launch so KSC stays anchored under the camera.
   * @param {number} deltaTime
   * @param {boolean} [isLaunching=false]
   */
  update(deltaTime, isLaunching = false) {
    const earthRate = isLaunching ? 0.004 : 0.018;
    if (this._earthMesh) {
      this._earthMesh.rotation.y += deltaTime * earthRate;
    }
    if (this._destMesh) {
      this._destMesh.rotation.y += deltaTime * 0.18;
    }
  }

  /** Dispose planet geometries, materials, and textures. */
  dispose() {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      this._disposeObject(child);
    }
    for (const tex of this._textures) {
      tex.dispose();
    }
    this._textures = [];
    this._earthGroup = null;
    this._earthMesh = null;
    this._padGroup = null;
    this._destGroup = null;
    this._destMesh = null;
    this._orbitGroup = null;
  }

  _buildLaunchPadMarker(site) {
    const padGroup = new THREE.Group();
    padGroup.name = `launch-pad:${site?.id ?? "ksc-lc39a"}`;

    const latDeg = site?.latitudeDeg ?? 28.6;
    const lonDeg = site?.longitudeDeg ?? -80.6;
    const pos = this.latLonToVector3(latDeg, lonDeg, this._earthRadius);
    const up = pos.clone().normalize();
    const lonRad = THREE.MathUtils.degToRad(lonDeg);
    const east = new THREE.Vector3(-Math.sin(lonRad), 0, -Math.cos(lonRad)).normalize();
    const south = east.clone().cross(up).normalize();

    padGroup.position.copy(pos);
    padGroup.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, up, south));

    // Concrete launch apron & flame deflector base
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.085, 0.025, 8),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85, metalness: 0.2 })
    );
    base.position.y = 0.01;
    padGroup.add(base);

    // Fixed Service Structure (FSS) gantry tower beside the pad
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, 0.18, 0.026),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.55, metalness: 0.35 })
    );
    tower.position.set(-0.042, 0.095, 0);
    padGroup.add(tower);

    // Umbilical swing arm extending toward the rocket mount
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.008, 0.01),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.4 })
    );
    arm.position.set(-0.02, 0.145, 0);
    padGroup.add(arm);

    // Beacon light on tower crown
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    beacon.position.set(-0.042, 0.195, 0);
    padGroup.add(beacon);

    // Crisp floating site label sprite (in browsers)
    if (typeof document !== "undefined") {
      const labelTex = this._createPadLabelTexture(site?.shortName || "KSC LC-39A");
      if (labelTex) {
        const spriteMat = new THREE.SpriteMaterial({
          map: labelTex,
          transparent: true,
          depthTest: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(-0.02, 0.31, 0);
        sprite.scale.set(0.56, 0.15, 1);
        sprite.renderOrder = 10;
        padGroup.add(sprite);
      }
    }

    return padGroup;
  }

  _addNotToScaleBadge(orbitGroup, position) {
    if (typeof document === "undefined") return;
    const tex = this._createPadLabelTexture("NOT TO SCALE");
    if (!tex) return;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      })
    );
    sprite.name = "trajectory-scale-label";
    sprite.position.copy(position);
    sprite.scale.set(0.95, 0.25, 1);
    sprite.renderOrder = 10;
    orbitGroup.add(sprite);
  }

  _createPadLabelTexture(text) {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 68;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "rgba(15, 23, 42, 0.86)";
    ctx.strokeStyle = "rgba(56, 189, 248, 0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect?.(4, 4, 248, 60, 12);
    if (!ctx.roundRect) {
      ctx.rect(4, 4, 248, 60);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 34);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._textures.push(tex);
    return tex;
  }

  _makePlaneRing(radius, axisA, axisB, color, opacity) {
    const pts = [];
    const segs = 112;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const p = axisA
        .clone()
        .multiplyScalar(Math.cos(a) * radius)
        .addScaledVector(axisB, Math.sin(a) * radius);
      pts.push(p);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.LineLoop(geo, mat);
  }

  _makeRing(radius, color, opacity, tiltX = 0) {
    const pts = [];
    const segs = 96;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const line = new THREE.LineLoop(geo, mat);
    line.rotation.x = tiltX;
    return line;
  }

  _createStarfield() {
    const count = 1100;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 65 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe2e8f0, size: 0.18 }));
  }

  _createEarthTexture() {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#0f3d7a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stylized continents
    ctx.fillStyle = "#2b6e49";
    const blobs = [
      [110, 95, 42, 34],
      [145, 165, 26, 42],
      [255, 85, 36, 26],
      [272, 145, 30, 44],
      [355, 92, 65, 36],
      [410, 178, 28, 22],
    ];
    for (const [x, y, rx, ry] of blobs) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // Polar ice caps
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, 0, canvas.width, 16);
    ctx.fillRect(0, canvas.height - 16, canvas.width, 16);

    const tex = new THREE.CanvasTexture(canvas);
    this._textures.push(tex);
    return tex;
  }

  _disposeObject(root) {
    root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}
