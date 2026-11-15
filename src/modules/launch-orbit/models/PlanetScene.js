/**
 * @file src/modules/launch-orbit/models/PlanetScene.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Renders the 3D Earth sphere, destination body (Moon or Mars), starfield,
 *       sun lighting, parking orbit ring, and transfer trajectory arc for Launch & Orbit.
 */

import * as THREE from "three";

export class PlanetScene {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "planet-scene-root";
    this._earthMesh = null;
    this._cloudsMesh = null;
    this._destMesh = null;
    this._orbitGroup = null;
    this._earthRadius = 1.8;
    this._destPosition = new THREE.Vector3();
    this._textures = [];
  }

  /**
   * Build 3D Earth sphere, atmospheric rim, lighting, and starfield background.
   * @returns {THREE.Group}
   */
  buildEarth() {
    this.dispose();

    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.55);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(18, 10, 14);
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rim.position.set(-14, -4, -10);
    this.group.add(hemi, sun, rim);

    const earthTex = this._createEarthTexture();
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex ?? null,
      color: earthTex ? 0xffffff : 0x1d4ed8,
      roughness: 0.72,
      metalness: 0.08,
    });
    this._earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(this._earthRadius, 48, 36),
      earthMat
    );
    this._earthMesh.name = "earth-sphere";
    this.group.add(this._earthMesh);

    const cloudsMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.14,
      roughness: 1.0,
    });
    this._cloudsMesh = new THREE.Mesh(
      new THREE.SphereGeometry(this._earthRadius * 1.018, 36, 24),
      cloudsMat
    );
    this.group.add(this._cloudsMesh);

    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(this._earthRadius * 1.075, 36, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
      })
    );
    this.group.add(atmo);

    this.group.add(this._createStarfield());
    return this.group;
  }

  /**
   * Render target orbit ring, transfer trajectory arc, and destination planet/moon.
   * @param {Object} orbit
   * @returns {THREE.Group}
   */
  buildOrbitRing(orbit) {
    if (this._orbitGroup) {
      this.group.remove(this._orbitGroup);
      this._disposeObject(this._orbitGroup);
    }

    const orbitGroup = new THREE.Group();
    orbitGroup.name = `orbit-visual:${orbit?.id ?? "LEO"}`;

    const leoRadius = 3.0;
    const targetRadius = orbit?.orbitRadius3D ?? 3.0;
    const inclRad = ((orbit?.inclinationDeg ?? 28.5) * Math.PI) / 180;

    // LEO parking orbit ring
    orbitGroup.add(this._makeRing(leoRadius, 0x38bdf8, 0.45, inclRad * 0.4));

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
        roughness: isMars ? 0.75 : 0.92,
        metalness: 0.06,
      });
      this._destMesh = new THREE.Mesh(
        new THREE.SphereGeometry(destRadius, 36, 28),
        destMat
      );
      destGroup.add(this._destMesh);

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
      orbitGroup.add(destGroup);

      // Curved outbound transfer trajectory arc from LEO to destination capture ring
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, leoRadius),
        new THREE.Vector3(targetRadius * 0.42, 0.85, targetRadius * 0.35),
        new THREE.Vector3(targetRadius * 0.8, 0.4, -0.9),
        new THREE.Vector3(targetRadius, 0, -(destRadius + 0.65)),
      ]);
      const arcPoints = curve.getPoints(72);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
      const arcMat = new THREE.LineBasicMaterial({
        color: isMars ? 0xf59e0b : 0x7dd3fc,
        transparent: true,
        opacity: 0.72,
      });
      orbitGroup.add(new THREE.Line(arcGeo, arcMat));
    } else if (orbit && orbit.id !== "LEO") {
      // MEO / GEO ring + transfer ellipse
      orbitGroup.add(this._makeRing(targetRadius, 0x22c55e, 0.62, inclRad * 0.25));
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, leoRadius),
        new THREE.Vector3(targetRadius * 0.65, 0.25, targetRadius * 0.5),
        new THREE.Vector3(targetRadius, 0, 0),
      ]);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      orbitGroup.add(
        new THREE.Line(
          arcGeo,
          new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.65 })
        )
      );
      this._destPosition.set(0, 0, 0);
      this._destMesh = null;
    } else {
      this._destPosition.set(0, 0, 0);
      this._destMesh = null;
    }

    this._orbitGroup = orbitGroup;
    this.group.add(orbitGroup);
    return orbitGroup;
  }

  getEarthRadius() {
    return this._earthRadius;
  }

  getDestinationPosition() {
    return this._destPosition.clone();
  }

  /** Rotate Earth and destination body gently each frame. */
  update(deltaTime) {
    if (this._earthMesh) {
      this._earthMesh.rotation.y += deltaTime * 0.12;
    }
    if (this._cloudsMesh) {
      this._cloudsMesh.rotation.y += deltaTime * 0.16;
    }
    if (this._destMesh) {
      this._destMesh.rotation.y += deltaTime * 0.18;
    }
  }

  /** Dispose planet geometries, materials, and procedural textures. */
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
    this._earthMesh = null;
    this._cloudsMesh = null;
    this._destMesh = null;
    this._orbitGroup = null;
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
