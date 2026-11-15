/**
 * @file src/modules/launch-orbit/models/PlanetScene.js
 * @owner Member 3 (Launch & Orbit)
 * @goal Renders the 3D Earth/planet sphere, starfield, lighting, and target orbit ring
 *       used during Launch & Orbit simulation.
 */

import * as THREE from 'three';

export class PlanetScene {
  constructor() {
    this.group = new THREE.Group();
    this._earth = null;
    this._atmosphere = null;
    this._starfield = null;
    this._orbitRing = null;
    this._disposables = [];
  }

  /**
   * Build 3D Earth sphere, atmosphere glow, and starfield background.
   * @returns {THREE.Group}
   */
  buildEarth() {
    // ── Earth sphere ──
    const earthGeo = new THREE.SphereGeometry(1, 64, 32);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x1e5fa8,
      roughness: 0.85,
      metalness: 0.05,
    });
    this._earth = new THREE.Mesh(earthGeo, earthMat);
    this.group.add(this._earth);
    this._disposables.push(earthGeo, earthMat);

    // ── Atmosphere glow (slightly larger transparent shell, BackSide) ──
    const atmoGeo = new THREE.SphereGeometry(1.05, 64, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x5ab9ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this._atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    this.group.add(this._atmosphere);
    this._disposables.push(atmoGeo, atmoMat);

    // ── Lighting ──
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(5, 3, 5);
    this.group.add(sun);
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    this.group.add(ambient);

    // ── Starfield ──
    const starCount = 1500;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 50 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      sizeAttenuation: true,
    });
    this._starfield = new THREE.Points(starGeo, starMat);
    this.group.add(this._starfield);
    this._disposables.push(starGeo, starMat);

    return this.group;
  }

  /**
   * Render a visual orbit ring around Earth for the selected target orbit.
   * @param {Object} orbit
   * @returns {THREE.Object3D}
   */
  buildOrbitRing(orbit) {
    // Dispose previous ring if any
    if (this._orbitRing) {
      this.group.remove(this._orbitRing);
      this._orbitRing.traverse((obj) => {
        obj.geometry?.dispose?.();
        obj.material?.dispose?.();
      });
      this._orbitRing = null;
    }

    const radius = orbit?.visualizationRadius ?? 1.5;
    const inclinationDeg = orbit?.inclinationDeg ?? 0;

    // Build a closed circle in the XZ plane.
    const segments = 128;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(a) * radius,
        0,
        Math.sin(a) * radius,
      ));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0x66ccff,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Line(geo, mat);
    // Tilt the ring by inclination — rotate about the X axis (the line of nodes).
    ring.rotation.x = THREE.MathUtils.degToRad(inclinationDeg);

    this._orbitRing = ring;
    this.group.add(ring);
    return ring;
  }

  /**
   * Rotate Earth and update orbital scene visuals each frame.
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (this._earth) this._earth.rotation.y += deltaTime * 0.05;
    if (this._orbitRing?.material) {
      // Gentle pulse so the target orbit reads as "active".
      this._orbitRing.material.opacity =
        0.55 + 0.15 * (0.5 + 0.5 * Math.sin(performance.now() * 0.001));
    }
  }

  /** Dispose planet geometries and textures. */
  dispose() {
    for (const d of this._disposables) d?.dispose?.();
    this._disposables = [];
    if (this._orbitRing) {
      this._orbitRing.traverse((obj) => {
        obj.geometry?.dispose?.();
        obj.material?.dispose?.();
      });
      this._orbitRing = null;
    }
    this.group.clear();
  }
}