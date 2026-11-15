/**
 * @file src/modules/spacecraft-design/models/KennedyHangarScene.js
 * @owner Member 2 (Spacecraft Design)
 * @goal Procedural 3D Kennedy Space Center Vehicle Assembly / Integration High-Bay Hangar
 *       featuring a circular hazard-striped turntable & pedestal, NASA Kennedy Space Center
 *       signage, US flag, engineering control consoles, overhead roof trusses, and an open
 *       bay door overlooking Launch Complex 39A.
 */

import * as THREE from "three";

const FLOOR_Y = -1.85;
const HANGAR_HALF_W = 11.0;
const HANGAR_HALF_D = 12.5;
const HANGAR_H = 10.5;

export class KennedyHangarScene {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "ksc-integration-hangar";
    this._textures = [];
    this._pedestalShaft = null;
    this._pedestalCap = null;
    this._turntableLights = [];
  }

  /**
   * Build the full 3D KSC High-Bay integration hangar.
   * @returns {THREE.Group}
   */
  build() {
    this.dispose();

    const mats = this._createMaterials();

    this._buildFloorAndTurntable(mats);
    this._buildStructureAndWalls(mats);
    this._buildBackWallWithBayDoor(mats);
    this._buildOutdoorLaunchComplex(mats);
    this._buildSignageAndFlag();
    this._buildCatwalksAndEquipment(mats);
    this._buildLighting();

    return this.group;
  }

  /**
   * Adjust the central pedestal column height so it meets the bottom of the active spacecraft.
   * @param {THREE.Object3D} spacecraftGroup
   */
  fitPedestalToSpacecraft(spacecraftGroup) {
    if (!spacecraftGroup || !this._pedestalShaft || !this._pedestalCap) return;
    spacecraftGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(spacecraftGroup);
    if (box.isEmpty()) return;

    const baseTopY = FLOOR_Y + 0.14;
    const targetTopY = Math.max(baseTopY + 0.12, Math.min(-0.65, box.min.y + 0.02));
    const shaftHeight = Math.max(0.1, targetTopY - baseTopY);

    this._pedestalShaft.scale.set(1, shaftHeight, 1);
    this._pedestalShaft.position.y = baseTopY + shaftHeight / 2;
    this._pedestalCap.position.y = targetTopY;
  }

  /** Subtle animation for turntable beacon lights. */
  update(deltaTime, elapsed = 0) {
    for (let i = 0; i < this._turntableLights.length; i++) {
      const mat = this._turntableLights[i].material;
      if (mat) {
        mat.opacity = 0.72 + 0.28 * Math.sin(elapsed * 2.2 + i * 0.5);
      }
    }
  }

  /** Dispose all geometries, materials, and procedural textures. */
  dispose() {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      child.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const list = Array.isArray(obj.material) ? obj.material : [obj.material];
          list.forEach((m) => m.dispose());
        }
      });
    }
    for (const tex of this._textures) {
      tex.dispose();
    }
    this._textures = [];
    this._pedestalShaft = null;
    this._pedestalCap = null;
    this._turntableLights = [];
  }

  _createMaterials() {
    return {
      concreteFloor: new THREE.MeshStandardMaterial({
        color: 0x3b4454,
        metalness: 0.22,
        roughness: 0.42,
      }),
      wallPanel: new THREE.MeshStandardMaterial({
        color: 0x2c3648,
        metalness: 0.35,
        roughness: 0.65,
      }),
      wallUpper: new THREE.MeshStandardMaterial({
        color: 0x384357,
        metalness: 0.3,
        roughness: 0.6,
      }),
      steelBeam: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.65,
        roughness: 0.4,
      }),
      safetyYellow: new THREE.MeshStandardMaterial({
        color: 0xeab308,
        metalness: 0.25,
        roughness: 0.45,
      }),
      consoleBlue: new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        metalness: 0.35,
        roughness: 0.45,
      }),
      darkMetal: new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.72,
        roughness: 0.35,
      }),
      lightSteel: new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.65,
        roughness: 0.32,
      }),
      padConcrete: new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.1,
        roughness: 0.85,
      }),
      apronAsphalt: new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.05,
        roughness: 0.9,
      }),
      foliage: new THREE.MeshStandardMaterial({
        color: 0x2f6b3c,
        metalness: 0.0,
        roughness: 0.92,
      }),
    };
  }

  _buildFloorAndTurntable(mats) {
    // Hangar concrete floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(HANGAR_HALF_W * 2 + 2, HANGAR_HALF_D * 2 + 2),
      mats.concreteFloor
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    this.group.add(floor);

    // Subtle floor grid seams
    const gridTex = this._createFloorTileTexture();
    if (gridTex) {
      floor.material = new THREE.MeshStandardMaterial({
        map: gridTex,
        metalness: 0.24,
        roughness: 0.38,
      });
    }

    // Circular integration turntable platform
    const turntableGroup = new THREE.Group();
    turntableGroup.position.y = FLOOR_Y;

    const outerBevel = new THREE.Mesh(
      new THREE.CylinderGeometry(2.65, 2.78, 0.08, 48),
      mats.darkMetal
    );
    outerBevel.position.y = 0.04;
    turntableGroup.add(outerBevel);

    // Hazard-striped ring around the turntable perimeter
    const hazardTex = this._createHazardStripeTexture();
    const hazardMat = hazardTex
      ? new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.45, metalness: 0.25 })
      : mats.safetyYellow;
    const hazardRing = new THREE.Mesh(
      new THREE.RingGeometry(2.28, 2.62, 64),
      hazardMat
    );
    hazardRing.rotation.x = -Math.PI / 2;
    hazardRing.position.y = 0.083;
    turntableGroup.add(hazardRing);

    // Inner dark brushed-steel deck
    const innerDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(2.28, 2.28, 0.09, 48),
      mats.steelBeam
    );
    innerDeck.position.y = 0.045;
    turntableGroup.add(innerDeck);

    // Inset deck perimeter lights (matching photo)
    const lightCount = 12;
    const lampGeo = new THREE.BoxGeometry(0.14, 0.02, 0.08);
    for (let i = 0; i < lightCount; i++) {
      const a = (i / lightCount) * Math.PI * 2;
      const lamp = new THREE.Mesh(
        lampGeo,
        new THREE.MeshBasicMaterial({
          color: 0xfef3c7,
          transparent: true,
          opacity: 0.9,
        })
      );
      lamp.position.set(Math.cos(a) * 2.45, 0.086, Math.sin(a) * 2.45);
      lamp.rotation.y = -a;
      turntableGroup.add(lamp);
      this._turntableLights.push(lamp);
    }

    // Central mounting collar & telescoping pedestal supporting the spacecraft
    const pedestalBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.56, 0.14, 24),
      mats.lightSteel
    );
    pedestalBase.position.y = 0.09;
    turntableGroup.add(pedestalBase);

    this.group.add(turntableGroup);

    this._pedestalShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 1.0, 20),
      mats.lightSteel
    );
    this._pedestalShaft.position.y = FLOOR_Y + 0.35;
    this.group.add(this._pedestalShaft);

    this._pedestalCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.22, 0.07, 20),
      mats.darkMetal
    );
    this._pedestalCap.position.y = FLOOR_Y + 0.65;
    this.group.add(this._pedestalCap);
  }

  _buildStructureAndWalls(mats) {
    const wallY = FLOOR_Y + HANGAR_H / 2;

    // Left wall (-X): displays NASA KSC sign, US flag, and mission consoles
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, HANGAR_H, HANGAR_HALF_D * 2),
      mats.wallPanel
    );
    leftWall.position.set(-HANGAR_HALF_W, wallY, 0);
    this.group.add(leftWall);

    // Right wall (+X)
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, HANGAR_H, HANGAR_HALF_D * 2),
      mats.wallPanel
    );
    rightWall.position.set(HANGAR_HALF_W, wallY, 0);
    this.group.add(rightWall);

    // Front wall (+Z behind initial camera)
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(HANGAR_HALF_W * 2, HANGAR_H, 0.3),
      mats.wallPanel
    );
    frontWall.position.set(0, wallY, HANGAR_HALF_D);
    this.group.add(frontWall);

    // Hangar ceiling
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(HANGAR_HALF_W * 2, HANGAR_HALF_D * 2),
      mats.darkMetal
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = FLOOR_Y + HANGAR_H;
    this.group.add(ceiling);

    // Vertical structural steel columns along left & right walls
    const colGeo = new THREE.BoxGeometry(0.45, HANGAR_H, 0.45);
    for (let z = -10; z <= 10; z += 5) {
      const colL = new THREE.Mesh(colGeo, mats.steelBeam);
      colL.position.set(-HANGAR_HALF_W + 0.25, wallY, z);
      const colR = new THREE.Mesh(colGeo, mats.steelBeam);
      colR.position.set(HANGAR_HALF_W - 0.25, wallY, z);
      this.group.add(colL, colR);
    }

    // Overhead roof trusses & high-bay luminaire fixtures
    const trussGeo = new THREE.BoxGeometry(HANGAR_HALF_W * 2, 0.38, 0.28);
    const lampFixtureGeo = new THREE.BoxGeometry(1.1, 0.1, 0.45);
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

    for (let z = -9; z <= 9; z += 4.5) {
      const truss = new THREE.Mesh(trussGeo, mats.steelBeam);
      truss.position.set(0, FLOOR_Y + HANGAR_H - 0.45, z);
      this.group.add(truss);

      for (const lx of [-5.5, 0, 5.5]) {
        const fixture = new THREE.Mesh(lampFixtureGeo, lampGlowMat);
        fixture.position.set(lx, FLOOR_Y + HANGAR_H - 0.68, z);
        this.group.add(fixture);
      }
    }
  }

  _buildBackWallWithBayDoor(mats) {
    // Open bay door sits on the -Z back wall (x from -3.2 to +7.8, height 8.2m)
    const doorMinX = -3.2;
    const doorMaxX = 7.8;
    const doorHeight = 8.2;
    const backZ = -HANGAR_HALF_D;

    // Left pier (-11 to -3.2)
    const leftPierW = doorMinX - -HANGAR_HALF_W;
    const leftPier = new THREE.Mesh(
      new THREE.BoxGeometry(leftPierW, HANGAR_H, 0.35),
      mats.wallUpper
    );
    leftPier.position.set(-HANGAR_HALF_W + leftPierW / 2, FLOOR_Y + HANGAR_H / 2, backZ);
    this.group.add(leftPier);

    // Right pier (+7.8 to +11)
    const rightPierW = HANGAR_HALF_W - doorMaxX;
    const rightPier = new THREE.Mesh(
      new THREE.BoxGeometry(rightPierW, HANGAR_H, 0.35),
      mats.wallUpper
    );
    rightPier.position.set(doorMaxX + rightPierW / 2, FLOOR_Y + HANGAR_H / 2, backZ);
    this.group.add(rightPier);

    // Header beam above open bay door
    const headerH = HANGAR_H - doorHeight;
    const doorW = doorMaxX - doorMinX;
    const header = new THREE.Mesh(
      new THREE.BoxGeometry(doorW, headerH, 0.42),
      mats.wallUpper
    );
    header.position.set((doorMinX + doorMaxX) / 2, FLOOR_Y + doorHeight + headerH / 2, backZ);
    this.group.add(header);

    // Heavy steel bay door frame jambs
    const jambGeo = new THREE.BoxGeometry(0.45, doorHeight, 0.55);
    const jambL = new THREE.Mesh(jambGeo, mats.steelBeam);
    jambL.position.set(doorMinX, FLOOR_Y + doorHeight / 2, backZ);
    const jambR = new THREE.Mesh(jambGeo, mats.steelBeam);
    jambR.position.set(doorMaxX, FLOOR_Y + doorHeight / 2, backZ);
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(doorW + 0.5, 0.45, 0.55),
      mats.steelBeam
    );
    lintel.position.set((doorMinX + doorMaxX) / 2, FLOOR_Y + doorHeight, backZ);
    this.group.add(jambL, jambR, lintel);
  }

  _buildOutdoorLaunchComplex(mats) {
    const outGroup = new THREE.Group();
    outGroup.name = "ksc-outdoor-pad-39a";

    // Concrete crawlerway apron extending out the open bay door
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 90),
      mats.apronAsphalt
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(2, FLOOR_Y - 0.02, -HANGAR_HALF_D - 45);
    outGroup.add(apron);

    // Bright daylight Florida sky backdrop dome / cyclorama visible through the bay door
    const skyTex = this._createSkyBackdropTexture();
    const skyMat = skyTex
      ? new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ color: 0x60a5fa, side: THREE.DoubleSide });
    const skyBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(110, 52), skyMat);
    skyBackdrop.position.set(2, 14, -75);
    outGroup.add(skyBackdrop);

    // Distant Merritt Island tree line along the horizon
    const treeStrip = new THREE.Mesh(
      new THREE.BoxGeometry(95, 2.4, 3),
      mats.foliage
    );
    treeStrip.position.set(2, FLOOR_Y + 1.1, -66);
    outGroup.add(treeStrip);

    // Distant Launch Complex 39A Pad, Fixed Service Structure Gantry & Rocket
    const padX = 4.2;
    const padZ = -48;

    const padBase = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1.4, 8),
      mats.padConcrete
    );
    padBase.position.set(padX, FLOOR_Y + 0.7, padZ);
    outGroup.add(padBase);

    // Gantry lattice tower (left of rocket)
    const towerX = padX - 2.4;
    const towerH = 12.5;
    const towerFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, towerH, 1.7),
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.6,
        roughness: 0.45,
        wireframe: true,
      })
    );
    towerFrame.position.set(towerX, FLOOR_Y + 1.4 + towerH / 2, padZ);
    outGroup.add(towerFrame);

    // Umbilical swing arms
    const armGeo = new THREE.BoxGeometry(2.1, 0.18, 0.35);
    for (const ay of [5.5, 8.8, 11.2]) {
      const arm = new THREE.Mesh(armGeo, mats.lightSteel);
      arm.position.set(towerX + 1.15, FLOOR_Y + ay, padZ);
      outGroup.add(arm);
    }

    // White & black-striped Saturn/SLS-style launch vehicle on Pad 39A
    const rocketGroup = new THREE.Group();
    rocketGroup.position.set(padX + 0.6, FLOOR_Y + 1.4, padZ);

    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.15 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.2 });

    const stage1 = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.86, 5.2, 18), whiteMat);
    stage1.position.y = 2.6;
    const rollBand = new THREE.Mesh(new THREE.CylinderGeometry(0.79, 0.79, 0.9, 18), blackMat);
    rollBand.position.y = 4.6;
    const stage2 = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.78, 3.2, 18), whiteMat);
    stage2.position.y = 6.8;
    const stage3 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 2.2, 18), whiteMat);
    stage3.position.y = 9.5;
    const fairing = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.8, 18), whiteMat);
    fairing.position.y = 11.5;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.1, 8), whiteMat);
    tower.position.y = 12.8;

    rocketGroup.add(stage1, rollBand, stage2, stage3, fairing, tower);
    outGroup.add(rocketGroup);

    this.group.add(outGroup);
  }

  _buildSignageAndFlag() {
    // Large "NASA KENNEDY SPACE CENTER" wall sign on the left wall (-X)
    const signTex = this._createNasaKscBannerTexture();
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex ?? null,
      color: signTex ? 0xffffff : 0xf1f5f9,
      roughness: 0.35,
      metalness: 0.05,
    });
    const kscSign = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 3.6), signMat);
    kscSign.position.set(-HANGAR_HALF_W + 0.22, 3.2, -1.5);
    kscSign.rotation.y = Math.PI / 2;
    this.group.add(kscSign);

    // US Flag banner on the left wall beside the bay door
    const flagTex = this._createUsFlagTexture();
    const flagMat = new THREE.MeshStandardMaterial({
      map: flagTex ?? null,
      color: flagTex ? 0xffffff : 0x1e3a8a,
      roughness: 0.6,
      metalness: 0.05,
    });
    const flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.4), flagMat);
    flagMesh.position.set(-HANGAR_HALF_W + 0.22, 3.3, -8.5);
    flagMesh.rotation.y = Math.PI / 2;
    this.group.add(flagMesh);
  }

  _buildCatwalksAndEquipment(mats) {
    // Upper catwalk balcony & yellow safety railing along the left wall
    const catwalkDeck = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.12, HANGAR_HALF_D * 1.8),
      mats.steelBeam
    );
    catwalkDeck.position.set(-HANGAR_HALF_W + 0.85, 0.95, 0);
    this.group.add(catwalkDeck);

    const railTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, HANGAR_HALF_D * 1.8),
      mats.safetyYellow
    );
    railTop.position.set(-HANGAR_HALF_W + 1.5, 1.75, 0);
    const railMid = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, HANGAR_HALF_D * 1.8),
      mats.safetyYellow
    );
    railMid.position.set(-HANGAR_HALF_W + 1.5, 1.38, 0);
    this.group.add(railTop, railMid);

    for (let z = -10; z <= 10; z += 2.5) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.82, 0.06),
        mats.safetyYellow
      );
      post.position.set(-HANGAR_HALF_W + 1.5, 1.38, z);
      this.group.add(post);
    }

    // Right-side elevated maintenance platform & yellow stairs
    const rightPlatform = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.16, 6.0),
      mats.steelBeam
    );
    rightPlatform.position.set(HANGAR_HALF_W - 1.25, 0.4, -3.0);
    const rightRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 6.0),
      mats.safetyYellow
    );
    rightRail.position.set(HANGAR_HALF_W - 2.3, 1.2, -3.0);
    this.group.add(rightPlatform, rightRail);

    // Engineering control desks & blueprint monitors on the left floor
    const deskGroup = new THREE.Group();
    deskGroup.position.set(-7.6, FLOOR_Y, -1.6);
    deskGroup.rotation.y = Math.PI / 2;

    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.9, 1.0), mats.consoleBlue);
    cabinet.position.y = 0.45;
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.08, 1.15), mats.lightSteel);
    deskTop.position.y = 0.94;
    deskGroup.add(cabinet, deskTop);

    // Glowing telemetry & Moon blueprint screens
    const screenTex = this._createTelemetryMonitorTexture();
    const screenMat = new THREE.MeshBasicMaterial({
      map: screenTex ?? null,
      color: screenTex ? 0xffffff : 0x38bdf8,
    });
    for (const sx of [-1.45, 0, 1.45]) {
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.08), mats.darkMetal);
      bezel.position.set(sx, 1.52, -0.25);
      const display = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.72), screenMat);
      display.position.set(sx, 1.52, -0.2);
      deskGroup.add(bezel, display);
    }
    this.group.add(deskGroup);

    // Yellow rolling GSE tool carts
    for (const [cx, cz] of [[-7.2, 3.2], [7.8, -6.5]]) {
      const cart = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.7), mats.safetyYellow);
      cart.position.set(cx, FLOOR_Y + 0.42, cz);
      this.group.add(cart);
    }
  }

  _buildLighting() {
    // Bright hangar overhead ambient & daylight streaming from the open bay door
    const hemi = new THREE.HemisphereLight(0xf0f9ff, 0x334155, 1.25);
    const overheadKey = new THREE.DirectionalLight(0xfffbeb, 1.8);
    overheadKey.position.set(2, 8.5, 4);

    const bayDaylight = new THREE.DirectionalLight(0xe0f2fe, 2.0);
    bayDaylight.position.set(3, 5, -14);

    const leftFill = new THREE.DirectionalLight(0x93c5fd, 0.9);
    leftFill.position.set(-9, 3, 2);

    this.group.add(hemi, overheadKey, bayDaylight, leftFill);
  }

  _createCanvas(width, height) {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  _registerTexture(canvas, repeatX = 1, repeatY = 1) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (repeatX !== 1 || repeatY !== 1) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
    }
    this._textures.push(tex);
    return tex;
  }

  _createFloorTileTexture() {
    const canvas = this._createCanvas(512, 512);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#3f4959";
    ctx.fillRect(0, 0, 512, 512);

    // Subtle sheen variation + expansion joints
    ctx.strokeStyle = "rgba(15, 23, 42, 0.45)";
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    return this._registerTexture(canvas, 6, 6);
  }

  _createHazardStripeTexture() {
    const canvas = this._createCanvas(512, 64);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#eab308";
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = "#111827";
    for (let x = -64; x < 576; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 24, 0);
      ctx.lineTo(x + 56, 64);
      ctx.lineTo(x + 32, 64);
      ctx.closePath();
      ctx.fill();
    }
    return this._registerTexture(canvas, 8, 1);
  }

  _createSkyBackdropTexture() {
    const canvas = this._createCanvas(1024, 512);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#1d4ed8");
    grad.addColorStop(0.55, "#38bdf8");
    grad.addColorStop(1, "#bae6fd");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Soft Florida cumulus clouds
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    const clouds = [
      [190, 310, 90], [260, 295, 110], [340, 315, 80],
      [700, 270, 95], [780, 255, 120], [860, 280, 85],
    ];
    for (const [cx, cy, r] of clouds) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return this._registerTexture(canvas);
  }

  _createNasaKscBannerTexture() {
    const canvas = this._createCanvas(1024, 420);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    // Clean light-gray signage backdrop with steel border
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, 0, 1024, 420);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 1014, 410);

    // NASA blue meatball sphere on the left
    const cx = 230;
    const cy = 210;
    const radius = 145;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#0b3d91";
    ctx.fill();
    ctx.clip();

    // Stars inside meatball
    ctx.fillStyle = "#ffffff";
    const stars = [
      [155, 130], [185, 105], [275, 115], [305, 150],
      [140, 240], [295, 270], [210, 305], [250, 290],
    ];
    for (const [sx, sy] of stars) {
      ctx.beginPath();
      ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // White orbital ellipse
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 132, 46, -0.35, 0, Math.PI * 2);
    ctx.stroke();

    // Red vector chevron
    ctx.strokeStyle = "#fc3d21";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 125, cy + 52);
    ctx.lineTo(cx - 8, cy - 82);
    ctx.lineTo(cx + 128, cy + 32);
    ctx.stroke();
    ctx.restore();

    // Bold "NASA" lettering inside the meatball
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 76px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("NASA", cx, cy + 8);

    // "KENNEDY SPACE CENTER" text on the right
    ctx.fillStyle = "#0f172a";
    ctx.font = "800 68px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("KENNEDY", 435, 145);
    ctx.fillText("SPACE", 435, 225);
    ctx.fillText("CENTER", 435, 305);

    return this._registerTexture(canvas);
  }

  _createUsFlagTexture() {
    const canvas = this._createCanvas(390, 520);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    // Hanging vertical stripes (13 stripes)
    const stripeW = 390 / 13;
    for (let i = 0; i < 13; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#b91c1c" : "#f8fafc";
      ctx.fillRect(i * stripeW, 0, stripeW + 1, 520);
    }

    // Blue union in top-left
    ctx.fillStyle = "#1e3a8a";
    ctx.fillRect(0, 0, stripeW * 7, 250);

    // Star grid
    ctx.fillStyle = "#ffffff";
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 5; col++) {
        ctx.beginPath();
        ctx.arc(20 + col * 38, 22 + row * 40, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return this._registerTexture(canvas);
  }

  _createTelemetryMonitorTexture() {
    const canvas = this._createCanvas(512, 300);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#082f49";
    ctx.fillRect(0, 0, 512, 300);

    // Blueprint grid
    ctx.strokeStyle = "rgba(56, 189, 248, 0.2)";
    ctx.lineWidth = 1;
    for (let x = 0; x < 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 300);
      ctx.stroke();
    }
    for (let y = 0; y < 300; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Wireframe spacecraft & Moon graphic
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.strokeRect(110, 95, 90, 110);
    ctx.strokeRect(40, 125, 65, 50);
    ctx.strokeRect(205, 125, 65, 50);
    ctx.beginPath();
    ctx.arc(385, 150, 68, 0, Math.PI * 2);
    ctx.stroke();

    return this._registerTexture(canvas);
  }
}
