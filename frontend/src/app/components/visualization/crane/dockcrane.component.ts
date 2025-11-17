import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type DockCraneOptions = {
  height?: number;              // altura da estrutura
  seawardBoomLength?: number;   // sobre o navio (Z-)
  landsideBoomLength?: number;  // sobre o cais (Z+)
  gauge?: number;               // distância entre pernas (X)
  clearance?: number;           // largura livre, “porta” (Z)
};

@Component({
  selector: 'app-dock-crane',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dock-crane.component.html',
  styleUrls: ['./dock-crane.component.scss'],
})
export class DockCraneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('craneCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() toneMappingExposure = 1.05;
  @Input() enableAutoRotate = true;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;

  private craneGroup?: THREE.Group;

  private readonly railMaterial = new THREE.MeshStandardMaterial({
    color: 0xc3ccd8,
    metalness: 0.8,
    roughness: 0.3,
  });

  private readonly sleeperMaterial = new THREE.MeshStandardMaterial({
    color: 0x4c5663,
    metalness: 0.3,
    roughness: 0.7,
  });

  ngAfterViewInit(): void {
    this.initThree();

    // Grua em treliça tipo “portal” (foto de referência)
    this.craneGroup = createPortalLatticeCraneModel({
      height: 120,
      seawardBoomLength: 115,
      landsideBoomLength: 60,
      gauge: 65,
      clearance: 65,
    });

    if (this.craneGroup) this.scene.add(this.craneGroup);

    // rails apenas sob a grua
    this.addShortRailsUnderCrane(90);
    this.frameCrane();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.controls?.dispose();
    this.renderer?.dispose();
  }

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdee8f4);
    this.scene.fog = new THREE.Fog(0xd2e4f3, 200, 2500);

    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 450;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 4000);
    this.camera.position.set(240, 190, 280);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.toneMappingExposure;

    // luzes
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xdbefff, 0x1c2b3a, 0.5);
    hemi.position.set(0, 400, 0);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff3d1, 1.3);
    sun.position.set(-420, 520, 260);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -450;
    sun.shadow.camera.right = 450;
    sun.shadow.camera.top = 450;
    sun.shadow.camera.bottom = -250;
    sun.shadow.camera.near = 50;
    sun.shadow.camera.far = 1500;
    this.scene.add(sun);

    // chão
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xd1d7e0,
      roughness: 0.96,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 800),
      groundMat
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 120;
    this.controls.maxDistance = 800;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(0, 70, 0);
    this.controls.autoRotate = this.enableAutoRotate;
    this.controls.autoRotateSpeed = 0.35;
  }

  /** pequenos rails só debaixo da grua, não a atravessar o cenário todo */
  private addShortRailsUnderCrane(length = 100) {
    if (!this.craneGroup) return;

    // usa o espaçamento definido pelo modelo; se não existir, assume 72
    const trackSpacing =
      (this.craneGroup.userData?.['trackSpacing'] as number | undefined) ?? 72;

    const halfTrack = trackSpacing / 2;
    const railHeight = 0.5;
    const railWidth = 0.9;

    const railGeo = new THREE.BoxGeometry(length, railHeight, railWidth);
    const rail1 = new THREE.Mesh(railGeo, this.railMaterial);
    const rail2 = new THREE.Mesh(railGeo, this.railMaterial);

    rail1.position.set(0, railHeight / 2 + 0.02, -halfTrack);
    rail2.position.set(0, railHeight / 2 + 0.02, halfTrack);
    rail1.castShadow = rail1.receiveShadow = true;
    rail2.castShadow = rail2.receiveShadow = true;

    this.scene.add(rail1, rail2);

    // travessas com o comprimento certo para apanhar os dois carris
    const sleeperGeo = new THREE.BoxGeometry(4, 0.35, trackSpacing + 12);
    const sleepers = 8;
    for (let i = 0; i < sleepers; i++) {
      const s = new THREE.Mesh(sleeperGeo, this.sleeperMaterial);
      const x = -length / 2 + ((i + 0.5) * length) / sleepers;
      s.position.set(x, 0.2, 0);
      s.receiveShadow = s.castShadow = true;
      this.scene.add(s);
    }
  }

  private frameCrane() {
    if (!this.craneGroup) return;
    const box = new THREE.Box3().setFromObject(this.craneGroup);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 2.4;

    this.controls.target.copy(center);
    this.camera.position.set(
      center.x + dist,
      center.y + dist * 0.8,
      center.z + dist * 0.7
    );
    this.camera.updateProjectionMatrix();
  }

  private animate = () => {
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.animate);
  };
}

/* ===================================================================== */
/*  MODELO “DOCK CRANE” – mantém como tinhas (não mexi)                  */
/* ===================================================================== */

export function createDockCraneModel(
  opts: DockCraneOptions = {}
): THREE.Group {
  const {
    height = 115,
    seawardBoomLength = 150,
    landsideBoomLength = 60,
    gauge = 70,
    clearance = 72,
  } = opts;

  const group = new THREE.Group();
  group.name = 'DockCraneModel';

  const blue = new THREE.MeshStandardMaterial({
    color: 0x1c4f82,
    metalness: 0.55,
    roughness: 0.36,
  });

  const yellow = new THREE.MeshStandardMaterial({
    color: 0xf2b632,
    metalness: 0.5,
    roughness: 0.4,
  });

  const dark = new THREE.MeshStandardMaterial({
    color: 0x18202a,
    metalness: 0.7,
    roughness: 0.45,
  });

  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0xf4f8ff,
    metalness: 0.25,
    roughness: 0.35,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xcfe8ff,
    metalness: 0.05,
    roughness: 0.12,
    transparent: true,
    opacity: 0.9,
  });

  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x10151c,
    metalness: 0.85,
    roughness: 0.3,
  });
  const walkwayMat = new THREE.MeshStandardMaterial({
    color: 0xc2ccd8,
    metalness: 0.35,
    roughness: 0.6,
  });
  const bogieMat = new THREE.MeshStandardMaterial({
    color: 0x8c97ab,
    metalness: 0.55,
    roughness: 0.45,
  });

  const halfGauge = gauge / 2;
  const halfClearance = clearance / 2;

  // ✅ para alinhar carris com a estrutura
  group.userData = {
    trackSpacing: clearance,
    gauge,
  };

  /* 1) Pernas / portal -------------------------------------------------- */

  const legHeight = height;
  const legGeo = new THREE.BoxGeometry(6, legHeight, 5);

  // pernas “do lado água” ligeiramente inclinadas para o lado do navio
  const leg1 = new THREE.Mesh(legGeo, blue);
  leg1.position.set(-halfGauge, legHeight / 2, -halfClearance);
  leg1.rotation.z = THREE.MathUtils.degToRad(4);

  const leg2 = leg1.clone();
  leg2.position.x = halfGauge;

  // pernas “terra”
  const leg3 = new THREE.Mesh(legGeo, blue);
  leg3.position.set(-halfGauge, legHeight / 2, halfClearance);
  leg3.rotation.z = THREE.MathUtils.degToRad(-3);

  const leg4 = leg3.clone();
  leg4.position.x = halfGauge;

  [leg1, leg2, leg3, leg4].forEach((l) => {
    l.castShadow = l.receiveShadow = true;
    group.add(l);
  });

  // travessas em baixo
  const baseXGeo = new THREE.BoxGeometry(gauge + 8, 4, 6);
  const baseFront = new THREE.Mesh(baseXGeo, blue);
  baseFront.position.set(0, 4, -halfClearance - 1);
  const baseBack = baseFront.clone();
  baseBack.position.z = halfClearance + 1;

  const baseZGeo = new THREE.BoxGeometry(6, 4, clearance + 10);
  const baseLeft = new THREE.Mesh(baseZGeo, blue);
  baseLeft.position.set(-halfGauge - 1, 4, 0);
  const baseRight = baseLeft.clone();
  baseRight.position.x = halfGauge + 1;

  [baseFront, baseBack, baseLeft, baseRight].forEach((b) => {
    b.castShadow = b.receiveShadow = true;
    group.add(b);
  });

  // vigas no topo
  const topY = height - 8;
  const topFront = new THREE.Mesh(baseXGeo, blue);
  topFront.position.set(0, topY, -halfClearance - 1);
  const topBack = topFront.clone();
  topBack.position.z = halfClearance + 1;

  const topLeft = new THREE.Mesh(baseZGeo, blue);
  topLeft.position.set(-halfGauge - 1, topY, 0);
  const topRight = topLeft.clone();
  topRight.position.x = halfGauge + 1;

  [topFront, topBack, topLeft, topRight].forEach((b) => {
    b.castShadow = b.receiveShadow = true;
    group.add(b);
  });

  // diagonais (X nas laterais) para look mais robusto
  const diagGeo = new THREE.BoxGeometry(4, topY * 0.7, 3);
  const diagA = new THREE.Mesh(diagGeo, blue);
  diagA.position.set(-halfGauge * 0.6, topY * 0.7, -halfClearance);
  diagA.rotation.z = THREE.MathUtils.degToRad(30);

  const diagB = diagA.clone();
  diagB.position.x = halfGauge * 0.6;
  diagB.rotation.z = -diagA.rotation.z;

  const diagC = diagA.clone();
  diagC.position.z = halfClearance;
  const diagD = diagB.clone();
  diagD.position.z = halfClearance;

  [diagA, diagB, diagC, diagD].forEach((d) => {
    d.castShadow = d.receiveShadow = true;
    group.add(d);
  });

  // bogies + rodas nas bases (liga as pernas aos carris)
  const bogieHeight = 2.6;
  const bogieGeo = new THREE.BoxGeometry(7.2, bogieHeight, 6.4);
  // rodas com raio realista vs altura dos carris (evita atravessar o chão)
  const wheelRadius = 1.0;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 4.2, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelSpacing = 3.6;
  const bogieAnchors = [leg1, leg2, leg3, leg4];
  bogieAnchors.forEach((leg) => {
    const base = new THREE.Mesh(bogieGeo, bogieMat);
    base.position.set(leg.position.x, bogieHeight / 2 + 0.35, leg.position.z);
    base.castShadow = base.receiveShadow = true;
    group.add(base);

    const brace = new THREE.Mesh(new THREE.BoxGeometry(2.4, 6.5, 1.2), blue);
    brace.position.set(leg.position.x, bogieHeight + 3.5, leg.position.z);
    brace.castShadow = brace.receiveShadow = true;
    group.add(brace);

    for (const dir of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, dark);
      // centra as rodas para assentarem no topo do carril (~0.27)
      wheel.position.set(leg.position.x + dir * wheelSpacing, 1.35, leg.position.z);
      wheel.castShadow = wheel.receiveShadow = true;
      group.add(wheel);
    }
  });
  const bumperGeo = new THREE.BoxGeometry(gauge + 24, 1.4, 1.4);
  const bumperFront = new THREE.Mesh(bumperGeo, bogieMat);
  bumperFront.position.set(0, bogieHeight + 1.4, -halfClearance - 3);
  bumperFront.castShadow = bumperFront.receiveShadow = true;
  const bumperBack = bumperFront.clone();
  bumperBack.position.z = halfClearance + 3;
  group.add(bumperFront, bumperBack);

  /* 2) Torre A-frame (tipo das fotos, lado terra) ---------------------- */

  const mastHeight = height + 20;
  const mastBaseZ = halfClearance * 0.4;
  const mastOffsetX = halfGauge * 0.2;

  const mastLegGeo = new THREE.BoxGeometry(5, mastHeight, 4);
  const mastLeg1 = new THREE.Mesh(mastLegGeo, blue);
  mastLeg1.position.set(mastOffsetX - 8, mastHeight / 2, mastBaseZ);
  mastLeg1.rotation.z = THREE.MathUtils.degToRad(10);

  const mastLeg2 = mastLeg1.clone();
  mastLeg2.position.x = mastOffsetX + 8;
  mastLeg2.rotation.z = THREE.MathUtils.degToRad(-10);

  const mastTopMesh = new THREE.Mesh(
    new THREE.BoxGeometry(20, 4, 6),
    blue
  );
  mastTopMesh.position.set(mastOffsetX, mastHeight + 2, mastBaseZ);

  [mastLeg1, mastLeg2, mastTopMesh].forEach((m) => {
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  });

  /* 3) Boom principal e contra-braço ---------------------------------- */

  const boomThickness = 5;
  const boomDepth = 5;
  const totalBoomLength = seawardBoomLength + landsideBoomLength;
  const pivotY = (height - 8) + 10;
  const pivotZ = -halfClearance - 2;

  const boomGeo = new THREE.BoxGeometry(totalBoomLength, boomThickness, boomDepth);
  const boom = new THREE.Mesh(boomGeo, yellow);
  const boomCenterX = seawardBoomLength / 2 - landsideBoomLength / 2;
  boom.position.set(boomCenterX, pivotY, pivotZ);
  boom.castShadow = boom.receiveShadow = true;
  group.add(boom);

  const latticeGeo = new THREE.BoxGeometry(2, boomThickness * 0.9, boomDepth * 1.8);
  const latticeCount = 7;
  for (let i = 0; i < latticeCount; i++) {
    const factor = i / (latticeCount - 1);
    const x = -landsideBoomLength + factor * totalBoomLength;
    const seg = new THREE.Mesh(latticeGeo, yellow);
    seg.position.set(x, pivotY - 3, pivotZ);
    seg.rotation.z = i % 2 === 0 ? Math.PI / 5 : -Math.PI / 5;
    seg.castShadow = seg.receiveShadow = true;
    group.add(seg);
  }

  const boomRoot = new THREE.Mesh(
    new THREE.BoxGeometry(20, 18, 24),
    yellow
  );
  boomRoot.position.set(0, pivotY - 2, pivotZ + 1.5);
  boomRoot.castShadow = boomRoot.receiveShadow = true;
  group.add(boomRoot);

  const cylinderBetween = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
    material: THREE.Material | THREE.Material[]
  ) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 0.001) return new THREE.Group();
    const geo = new THREE.CylinderGeometry(radius, radius, len, 10);
    const mesh = new THREE.Mesh(geo, material);
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    mesh.position.copy(mid);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    mesh.quaternion.copy(quat);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
  

  const mastTopWorld = new THREE.Vector3(
    mastTopMesh.position.x,
    mastTopMesh.position.y,
    mastTopMesh.position.z
  );
  const boomAnchorNear = new THREE.Vector3(boomCenterX + seawardBoomLength * 0.28, pivotY - 1, pivotZ);
  const boomAnchorFar = new THREE.Vector3(boomCenterX + seawardBoomLength * 0.62, pivotY - 1, pivotZ);
  const boomAnchorBack = new THREE.Vector3(boomCenterX - landsideBoomLength * 0.35, pivotY - 1, pivotZ);

  group.add(
    cylinderBetween(mastTopWorld, boomAnchorNear, 0.8, cableMat),
    cylinderBetween(mastTopWorld, boomAnchorFar, 0.8, cableMat),
    cylinderBetween(mastTopWorld, boomAnchorBack, 0.7, cableMat)
  );

  /* 4) Trolley + spreader ---------------------------------------------- */

  const trolley = new THREE.Group();
  trolley.name = 'CraneTrolley';

  const trolleyBody = new THREE.Mesh(
    new THREE.BoxGeometry(22, 6, 14),
    dark
  );
  trolleyBody.castShadow = trolleyBody.receiveShadow = true;
  trolley.add(trolleyBody);

  const trolleyRails = new THREE.Mesh(
    new THREE.BoxGeometry(26, 1.5, 16),
    dark
  );
  trolleyRails.position.y = -4;
  trolleyRails.castShadow = trolleyRails.receiveShadow = true;
  trolley.add(trolleyRails);

  const smallCab = new THREE.Mesh(
    new THREE.BoxGeometry(9, 5, 7),
    cabinMat
  );
  smallCab.position.set(7, 5, -6);
  const smallGlass = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 3.4, 0.6),
    glassMat
  );
  smallGlass.position.set(0, 0.2, -3.7);
  smallCab.add(smallGlass);
  smallCab.castShadow = smallCab.receiveShadow = true;
  trolley.add(smallCab);

  const spreader = new THREE.Mesh(
    new THREE.BoxGeometry(36, 1.4, 8),
    yellow
  );
  spreader.position.set(0, -13, 0);
  spreader.castShadow = spreader.receiveShadow = true;
  trolley.add(spreader);

  const ropeGeo = new THREE.CylinderGeometry(0.55, 0.55, 10, 8);
  const ropeOffsets: [number, number][] = [
    [-9, -3],
    [9, -3],
    [-9, 3],
    [9, 3],
  ];
  for (const [rx, rz] of ropeOffsets) {
    const r = new THREE.Mesh(ropeGeo, cableMat);
    r.position.set(rx, -7, rz);
    r.rotation.x = Math.PI / 2;
    trolley.add(r);
  }

  const trolleyBottomLocal = trolleyRails.position.y - 0.75;
  const runwayTopY = (pivotY - boomThickness / 2 - 0.8) + 0.4;
  const trolleyY = runwayTopY - trolleyBottomLocal;

  trolley.position.set(boomCenterX + seawardBoomLength * 0.25, trolleyY, pivotZ);
  group.add(trolley);

  const runwayY = pivotY - boomThickness / 2 - 0.8;
  const runwayOffsetZ = 4.4;
  const runwayGeo = new THREE.BoxGeometry(totalBoomLength - 10, 0.8, 0.8);
  const runwayL = new THREE.Mesh(runwayGeo, dark);
  runwayL.position.set(boomCenterX, runwayY, pivotZ - runwayOffsetZ);
  const runwayR = runwayL.clone();
  runwayR.position.z = pivotZ + runwayOffsetZ;
  runwayL.castShadow = runwayL.receiveShadow = true;
  runwayR.castShadow = runwayR.receiveShadow = true;
  group.add(runwayL, runwayR);

  /* 5) Cabine principal no lado terra ---------------------------------- */

  const mainCab = new THREE.Mesh(
    new THREE.BoxGeometry(20, 11, 16),
    cabinMat
  );
  mainCab.position.set(
    halfGauge * 0.45,
    topY + 10,
    halfClearance + 18
  );
  mainCab.castShadow = mainCab.receiveShadow = true;

  const cabFront = new THREE.Mesh(
    new THREE.BoxGeometry(18, 7, 0.8),
    glassMat
  );
  cabFront.position.set(0, 0.5, 8.8);
  mainCab.add(cabFront);

  const cabSideGeo = new THREE.BoxGeometry(0.8, 7, 12);
  const cabSideL = new THREE.Mesh(cabSideGeo, glassMat);
  cabSideL.position.set(-10, 0.5, 0.5);
  const cabSideR = cabSideL.clone();
  cabSideR.position.x = 10;
  mainCab.add(cabSideL, cabSideR);

  group.add(mainCab);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(32, 1.2, 18),
    walkwayMat
  );
  deck.position.set(mainCab.position.x, mainCab.position.y - 2, mainCab.position.z + 4);
  deck.castShadow = deck.receiveShadow = true;
  group.add(deck);

  const catwalkLength = halfGauge + 18;
  const catwalk = new THREE.Mesh(
    new THREE.BoxGeometry(catwalkLength, 0.9, 5.2),
    walkwayMat
  );
  catwalk.position.set(
    mainCab.position.x - catwalkLength / 2 - 2,
    mainCab.position.y - 2.8,
    mainCab.position.z
  );
  catwalk.castShadow = catwalk.receiveShadow = true;
  group.add(catwalk);

  const postGeo = new THREE.BoxGeometry(1.1, 6, 1.1);
  const postCount: number = 4;
  for (let i = 0; i < postCount; i++) {
    const factor = postCount === 1 ? 0.5 : i / (postCount - 1);
    const px = catwalk.position.x - catwalkLength / 2 + factor * catwalkLength;
    const postL = new THREE.Mesh(postGeo, blue);
    postL.position.set(px, catwalk.position.y - 3.5, catwalk.position.z - 2.2);
    const postR = postL.clone();
    postR.position.z = catwalk.position.z + 2.2;
    [postL, postR].forEach((p) => {
      p.castShadow = p.receiveShadow = true;
      group.add(p);
    });
  }

  const braceGeo = new THREE.BoxGeometry(1.2, 16, 1.2);
  const braceL = new THREE.Mesh(braceGeo, blue);
  braceL.position.set(mainCab.position.x - 12, mainCab.position.y - 11, mainCab.position.z + 6);
  braceL.rotation.z = THREE.MathUtils.degToRad(-18);
  const braceR = braceL.clone();
  braceR.position.z = mainCab.position.z + 1.5;
  [braceL, braceR].forEach((b) => {
    b.castShadow = b.receiveShadow = true;
    group.add(b);
  });

  const ladderHeight = mainCab.position.y - 8;
  const ladder = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, ladderHeight, 0.4),
    dark
  );
  ladder.position.set(mainCab.position.x + 15, ladderHeight / 2, mainCab.position.z + 4);
  ladder.castShadow = true;
  group.add(ladder);

  const rungGeo = new THREE.BoxGeometry(2.6, 0.15, 0.4);
  const rungCount = 7;
  for (let i = 0; i < rungCount; i++) {
    const rung = new THREE.Mesh(rungGeo, dark);
    rung.position.set(
      ladder.position.x - 1.3,
      ladder.position.y - ladderHeight / 2 + 1.2 + i * (ladderHeight / (rungCount + 1)),
      ladder.position.z
    );
    rung.castShadow = true;
    group.add(rung);
  }

  const railMat = new THREE.MeshStandardMaterial({
    color: 0xf5f6f7,
    metalness: 0.4,
    roughness: 0.4,
  });
  const sideRailGeo = new THREE.BoxGeometry(0.6, 1.8, 12);
  const frontRailGeo = new THREE.BoxGeometry(18, 1.8, 0.6);

  const sideRailL = new THREE.Mesh(sideRailGeo, railMat);
  sideRailL.position.set(
    mainCab.position.x - 10.2,
    mainCab.position.y + 6.5,
    mainCab.position.z
  );
  const sideRailR = sideRailL.clone();
  sideRailR.position.x = mainCab.position.x + 10.2;

  const frontRail = new THREE.Mesh(frontRailGeo, railMat);
  frontRail.position.set(
    mainCab.position.x,
    mainCab.position.y + 6.5,
    mainCab.position.z + 7.9
  );

  [sideRailL, sideRailR, frontRail].forEach((r) => {
    r.castShadow = r.receiveShadow = true;
    group.add(r);
  });

  const catwalkSideRail = new THREE.Mesh(
    new THREE.BoxGeometry(catwalkLength, 1.4, 0.5),
    railMat
  );
  catwalkSideRail.position.set(catwalk.position.x, catwalk.position.y + 1, catwalk.position.z - 2.7);
  const catwalkSideRailR = catwalkSideRail.clone();
  catwalkSideRailR.position.z = catwalk.position.z + 2.7;

  const catwalkEndRail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 5.4), railMat);
  catwalkEndRail.position.set(catwalk.position.x + catwalkLength / 2, catwalk.position.y + 1, catwalk.position.z);
  const catwalkStartRail = catwalkEndRail.clone();
  catwalkStartRail.position.x = catwalk.position.x - catwalkLength / 2;

  [catwalkSideRail, catwalkSideRailR, catwalkEndRail, catwalkStartRail].forEach((rail) => {
    rail.castShadow = rail.receiveShadow = true;
    group.add(rail);
  });

  /* 6) Luzes ------------------------------------------------------------ */

  const lightColor = 0xfff7c0;
  const cabinLight = new THREE.PointLight(lightColor, 1.2, 120);
  cabinLight.position.set(
    mainCab.position.x,
    mainCab.position.y + 4,
    mainCab.position.z + 10
  );
  group.add(cabinLight);

  const tipLight = new THREE.PointLight(lightColor, 0.9, 160);
  tipLight.position.set(
    seawardBoomLength - landsideBoomLength * 0.25,
    pivotY - 1,
    pivotZ - 14
  );
  group.add(tipLight);

  /* 7) Centrar o modelo ------------------------------------------------- */

  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);

  group.position.x -= center.x;
  group.position.y -= box.min.y;

  return group;
}

/* ===================================================================== */
/*  STS Crane Model (placeholder para reaproveitares se quiseres)        */
/* ===================================================================== */

export function createSTSCraneModel(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'STSCrane';

  // aqui podes colar a tua implementação antiga, se precisares
  return group;
}

/* ===================================================================== */
/*  Portal Lattice Crane – versão ligada / coerente                      */
/* ===================================================================== */

export function createPortalLatticeCraneModel(
  opts: DockCraneOptions = {}
): THREE.Group {
  const {
    height = 110,           // topo do portal
    seawardBoomLength = 115,// lança principal (lado navio, Z-)
    landsideBoomLength = 50,// mastro traseiro (Z+)
    gauge = 65,
    clearance = 65,
  } = opts;

  const group = new THREE.Group();
  group.name = 'PortalLatticeCrane';

  // materiais aproximados à foto
  const orange = new THREE.MeshStandardMaterial({
    color: 0xf2c53d,
    metalness: 0.45,
    roughness: 0.38,
  });
  const blueCab = new THREE.MeshStandardMaterial({
    color: 0x1e7fbe,
    metalness: 0.35,
    roughness: 0.5,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x18202a,
    metalness: 0.7,
    roughness: 0.45,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x7fbfff,
    metalness: 0,
    roughness: 0.12,
    transmission: 0.95,
    thickness: 1.2,
    ior: 1.5,
    attenuationColor: new THREE.Color(0x9dd7ff),
    attenuationDistance: 14,
    transparent: true,
    opacity: 1.0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.04,
    side: THREE.DoubleSide,
  });
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x151a20,
    metalness: 0.85,
    roughness: 0.3,
  });

  // pequena textura procedural de pintura com grão (CanvasTexture)
  const makePaintTexture = (hex: number, noise = 0.05, w = 256, h = 256) => {
    const cnv = document.createElement('canvas');
    cnv.width = w; cnv.height = h;
    const ctx = cnv.getContext('2d');
    if (!ctx) return undefined;
    const base = new THREE.Color(hex);
    ctx.fillStyle = `#${base.getHexString()}`;
    ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 255 * noise;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i+1] = Math.max(0, Math.min(255, data[i+1] + n));
      data[i+2] = Math.max(0, Math.min(255, data[i+2] + n));
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cnv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  };

  const yellowTexture = makePaintTexture(0xf2c53d, 0.03);
  if (yellowTexture) {
    orange.map = yellowTexture;
    orange.needsUpdate = true;
  }

  // helper local para vigas rectangulares entre 2 pontos neste modelo
  const rectBeamBetween = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    w: number,
    h: number,
    material: THREE.Material | THREE.Material[]
  ) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-3) return new THREE.Group();
    const geo = new THREE.BoxGeometry(w, h, len);
    const mesh = new THREE.Mesh(geo, material as THREE.Material);
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    mesh.position.copy(mid);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), dir.clone().normalize());
    mesh.quaternion.copy(quat);
    (mesh as any).castShadow = (mesh as any).receiveShadow = true;
    return mesh;
  };

  const halfGauge = gauge / 2;
  const halfClear = clearance / 2;

  group.userData = { trackSpacing: clearance, gauge };

  const cylinderBetween = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
    material: THREE.Material | THREE.Material[]
  ) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-3) return new THREE.Group();
    const geo = new THREE.CylinderGeometry(radius, radius, len, 10);
    const mesh = new THREE.Mesh(geo, material);
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    mesh.position.copy(mid);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    mesh.quaternion.copy(quat);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };

  /* 1) Portal (pernas + travessas + bogies) ---------------------------- */

  const legGeo = new THREE.BoxGeometry(6, height, 6);
  const leg1 = new THREE.Mesh(legGeo, orange);
  leg1.position.set(-halfGauge, height / 2, -halfClear);
  const leg2 = leg1.clone();
  leg2.position.x = halfGauge;
  const leg3 = leg1.clone();
  leg3.position.z = halfClear;
  const leg4 = leg2.clone();
  leg4.position.z = halfClear;
  [leg1, leg2, leg3, leg4].forEach((l) => {
    l.castShadow = l.receiveShadow = true;
    group.add(l);
  });

  const baseXGeo = new THREE.BoxGeometry(gauge + 8, 5, 6);
  const baseFront = new THREE.Mesh(baseXGeo, orange);
  baseFront.position.set(0, 4, -halfClear - 1);
  const baseBack = baseFront.clone();
  baseBack.position.z = halfClear + 1;

  const baseZGeo = new THREE.BoxGeometry(6, 5, clearance + 10);
  const baseLeft = new THREE.Mesh(baseZGeo, orange);
  baseLeft.position.set(-halfGauge - 1, 4, 0);
  const baseRight = baseLeft.clone();
  baseRight.position.x = halfGauge + 1;
  [baseFront, baseBack, baseLeft, baseRight].forEach((b) => {
    b.castShadow = b.receiveShadow = true;
    group.add(b);
  });

  const topY = height - 6;
  const topFront = new THREE.Mesh(baseXGeo, orange);
  topFront.position.set(0, topY, -halfClear - 1);
  const topBack = topFront.clone();
  topBack.position.z = halfClear + 1;
  const topLeft = new THREE.Mesh(baseZGeo, orange);
  topLeft.position.set(-halfGauge - 1, topY, 0);
  const topRight = topLeft.clone();
  topRight.position.x = halfGauge + 1;
  [topFront, topBack, topLeft, topRight].forEach((b) => {
    b.castShadow = b.receiveShadow = true;
    group.add(b);
  });

  // joelhos/escoras nos quatro cantos para ligar pernas às vigas de topo
  const kneeOffset = 0.6;
  const legTopY = topY - 2.5;
  const knees: Array<[THREE.Vector3, THREE.Vector3]> = [
    [new THREE.Vector3(-halfGauge, legTopY, -halfClear), new THREE.Vector3(-halfGauge - 1 + kneeOffset, topY - kneeOffset, -halfClear - 1 + kneeOffset)],
    [new THREE.Vector3( halfGauge, legTopY, -halfClear), new THREE.Vector3( halfGauge + 1 - kneeOffset, topY - kneeOffset, -halfClear - 1 + kneeOffset)],
    [new THREE.Vector3(-halfGauge, legTopY,  halfClear), new THREE.Vector3(-halfGauge - 1 + kneeOffset, topY - kneeOffset,  halfClear + 1 - kneeOffset)],
    [new THREE.Vector3( halfGauge, legTopY,  halfClear), new THREE.Vector3( halfGauge + 1 - kneeOffset, topY - kneeOffset,  halfClear + 1 - kneeOffset)]
  ];
  knees.forEach(([a,b]) => group.add(rectBeamBetween(a,b,1.4,1.4,orange)));

  // bogies e rodas
  const bogieH = 2.4;
  const bogieGeo = new THREE.BoxGeometry(7.2, bogieH, 6.4);
  const wheelGeo = new THREE.CylinderGeometry(1.0, 1.0, 4.0, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  [leg1, leg2, leg3, leg4].forEach((leg) => {
    const bogie = new THREE.Mesh(bogieGeo, dark);
    bogie.position.set(leg.position.x, bogieH / 2 + 0.35, leg.position.z);
    bogie.castShadow = bogie.receiveShadow = true;
    group.add(bogie);
    for (const dir of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, dark);
      w.position.set(leg.position.x + dir * 3.4, 1.25, leg.position.z);
      w.castShadow = w.receiveShadow = true;
      group.add(w);
    }
    // placas laterais do bogie (estrutura)
    const sidePlateGeo = new THREE.BoxGeometry(7.2, 1.0, 0.5);
    const plateL = new THREE.Mesh(sidePlateGeo, dark); plateL.position.set(leg.position.x, bogieH - 0.2, leg.position.z - 3.0);
    const plateR = plateL.clone(); plateR.position.z = leg.position.z + 3.0;
    plateL.castShadow = plateR.castShadow = true; plateL.receiveShadow = plateR.receiveShadow = true;
    group.add(plateL, plateR);
  });

  // pára-choques frontais e traseiros para deslocação sobre carris
  const bumperGeo = new THREE.BoxGeometry(gauge + 20, 1.4, 1.4);
  const bumperFront = new THREE.Mesh(bumperGeo, dark);
  bumperFront.position.set(0, bogieH + 1.2, -halfClear - 3);
  const bumperBack = bumperFront.clone(); bumperBack.position.z = halfClear + 3;
  bumperFront.castShadow = bumperBack.castShadow = true; bumperFront.receiveShadow = bumperBack.receiveShadow = true;
  group.add(bumperFront, bumperBack);

  /* 2) Plataforma giratória / torre ------------------------------------ */

  const ringHeight = 4;
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 14, ringHeight, 36),
    dark
  );
  // levanta ligeiramente a coroa para permitir colunas visíveis de apoio
  ring.position.set(0, topY + ringHeight / 2 + 2, 0);
  ring.castShadow = ring.receiveShadow = true;
  group.add(ring);
  // colunas que apoiam a coroa sobre a moldura superior
  const colGeo = new THREE.BoxGeometry(2.2, (ring.position.y - ringHeight/2) - topY, 2.2);
  const colY = topY + ((ring.position.y - ringHeight/2) - topY)/2;
  const cols = [
    new THREE.Vector3(-10, colY, -8), new THREE.Vector3(10, colY, -8),
    new THREE.Vector3(-10, colY,  8), new THREE.Vector3(10, colY,  8)
  ];
  cols.forEach(p=>{ const c = new THREE.Mesh(colGeo, dark); c.position.copy(p); c.castShadow = c.receiveShadow = true; group.add(c); });
  
  // Moldura rígida imediatamente sob a coroa (quadrado) + diagonais
  const ringFrameY = ring.position.y - ringHeight / 2 + 0.2;
  const rfFL = new THREE.Vector3(-10, ringFrameY, -8);
  const rfFR = new THREE.Vector3( 10, ringFrameY, -8);
  const rfBL = new THREE.Vector3(-10, ringFrameY,  8);
  const rfBR = new THREE.Vector3( 10, ringFrameY,  8);
  [
    [rfFL, rfFR], [rfBL, rfBR], // frentes e traseiras (X)
    [rfFL, rfBL], [rfFR, rfBR], // lados (Z)
    [rfFL, rfBR], [rfFR, rfBL]  // diagonais em X
  ].forEach(([a,b]) => group.add(rectBeamBetween(a as THREE.Vector3, b as THREE.Vector3, 1.0, 1.0, dark)));
  
  // Travamentos para compactar e reforçar o portal (faces e topo)
  const levelLow = height * 0.42;
  const levelHigh = height * 0.68;
  // faces Z (frente e trás) – diagonais em X
  group.add(rectBeamBetween(new THREE.Vector3(-halfGauge, levelLow, -halfClear), new THREE.Vector3( halfGauge, levelHigh, -halfClear), 0.9, 0.9, orange));
  group.add(rectBeamBetween(new THREE.Vector3(-halfGauge, levelHigh, -halfClear), new THREE.Vector3( halfGauge, levelLow, -halfClear), 0.9, 0.9, orange));
  group.add(rectBeamBetween(new THREE.Vector3(-halfGauge, levelLow,  halfClear), new THREE.Vector3( halfGauge, levelHigh,  halfClear), 0.9, 0.9, orange));
  group.add(rectBeamBetween(new THREE.Vector3(-halfGauge, levelHigh,  halfClear), new THREE.Vector3( halfGauge, levelLow,  halfClear), 0.9, 0.9, orange));
  // faces X (esquerda e direita) – diagonais em Z
  group.add(rectBeamBetween(new THREE.Vector3(-halfGauge, levelLow, -halfClear), new THREE.Vector3(-halfGauge, levelHigh,  halfClear), 0.9, 0.9, orange));
  group.add(rectBeamBetween(new THREE.Vector3(-halfGauge, levelHigh, -halfClear), new THREE.Vector3(-halfGauge, levelLow,   halfClear), 0.9, 0.9, orange));
  group.add(rectBeamBetween(new THREE.Vector3( halfGauge, levelLow, -halfClear), new THREE.Vector3( halfGauge, levelHigh,  halfClear), 0.9, 0.9, orange));
  group.add(rectBeamBetween(new THREE.Vector3( halfGauge, levelHigh, -halfClear), new THREE.Vector3( halfGauge, levelLow,   halfClear), 0.9, 0.9, orange));
  // travessas intermédias (X) à meia altura nas frentes
  group.add(rectBeamBetween(new THREE.Vector3(-halfGauge, levelLow, -halfClear), new THREE.Vector3( halfGauge, levelLow, -halfClear), 1.2, 0.9, orange));
  group.add(rectBeamBetween(new THREE.Vector3(-halfGauge, levelLow,  halfClear), new THREE.Vector3( halfGauge, levelLow,  halfClear), 1.2, 0.9, orange));
  // reforço no plano do topo: diagonais sobre o rectângulo superior
  const topDiagY = topY + 0.6;
  group.add(rectBeamBetween(new THREE.Vector3(-halfGauge - 1, topDiagY, -halfClear - 1), new THREE.Vector3( halfGauge + 1, topDiagY,  halfClear + 1), 0.8, 0.8, orange));
  group.add(rectBeamBetween(new THREE.Vector3(-halfGauge - 1, topDiagY,  halfClear + 1), new THREE.Vector3( halfGauge + 1, topDiagY, -halfClear - 1), 0.8, 0.8, orange));
  // travamento inferior cruzado (acima dos bogies)
  const lowY = 6.0;
  group.add(rectBeamBetween(new THREE.Vector3(-halfGauge - 1, lowY, -halfClear - 1), new THREE.Vector3( halfGauge + 1, lowY,  halfClear + 1), 0.8, 0.8, orange));
  group.add(rectBeamBetween(new THREE.Vector3(-halfGauge - 1, lowY,  halfClear + 1), new THREE.Vector3( halfGauge + 1, lowY, -halfClear - 1), 0.8, 0.8, orange));

  // Reforço central: pratos da coroa e vigas principais tipo "caixa"
  const ringR = 14;
  const upperPlate = new THREE.Mesh(new THREE.CylinderGeometry(ringR + 3, ringR + 3, 0.8, 36), dark);
  upperPlate.position.set(0, ring.position.y + ringHeight / 2 + 0.4, 0);
  const lowerPlate = new THREE.Mesh(new THREE.CylinderGeometry(ringR + 2.5, ringR + 2.5, 0.8, 36), dark);
  lowerPlate.position.set(0, ring.position.y - ringHeight / 2 - 0.4, 0);
  upperPlate.castShadow = lowerPlate.castShadow = true; upperPlate.receiveShadow = lowerPlate.receiveShadow = true;
  group.add(upperPlate, lowerPlate);

  // vigas primárias cruzadas sob/ao nível da coroa (distribuição de carga)
  group.add(rectBeamBetween(
    new THREE.Vector3(-halfGauge, ringFrameY, 0),
    new THREE.Vector3( halfGauge, ringFrameY, 0),
    2.4, 2.0, orange
  ));
  group.add(rectBeamBetween(
    new THREE.Vector3(0, ringFrameY, -halfClear),
    new THREE.Vector3(0, ringFrameY,  halfClear),
    2.0, 2.4, orange
  ));

  // nervuras radiais entre a coroa e a moldura (8 direções)
  const ringCenter = new THREE.Vector3(0, ring.position.y, 0);
  const rimPointToward = (target: THREE.Vector3) => {
    const v = new THREE.Vector3().subVectors(target, ringCenter); v.y = 0;
    const len = v.length() || 1; v.multiplyScalar((ringR - 1) / len);
    return new THREE.Vector3(ringCenter.x + v.x, ringCenter.y, ringCenter.z + v.z);
  };
  const midF = rfFL.clone().add(rfFR).multiplyScalar(0.5);
  const midB = rfBL.clone().add(rfBR).multiplyScalar(0.5);
  const midL = rfFL.clone().add(rfBL).multiplyScalar(0.5);
  const midR = rfFR.clone().add(rfBR).multiplyScalar(0.5);
  const ribTargets = [rfFL, rfFR, rfBL, rfBR, midF, midB, midL, midR];
  ribTargets.forEach(t => {
    const a = rimPointToward(t as THREE.Vector3);
    const b = (t as THREE.Vector3).clone(); b.y = ringFrameY;
    group.add(rectBeamBetween(a, b, 1.0, 1.1, dark));
  });

  const slewGroup = new THREE.Group();
  slewGroup.name = 'SlewGroup';
  // sobe o conjunto giratório em conformidade com a nova altura da coroa
  slewGroup.position.set(0, ring.position.y + ringHeight / 2 + 1, 0);
  group.add(slewGroup);

  const turret = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 26), orange);
  turret.position.set(0, 3, 0);
  turret.castShadow = turret.receiveShadow = true;
  slewGroup.add(turret);

  // Cabine única e mais realista com janelas e acabamento com grão
  const cabW = 26, cabH = 14, cabD = 18;
  const cabPaintMat = new THREE.MeshStandardMaterial({
    color: 0xf1bd20,
    metalness: 0.4,
    roughness: 0.5,
    map: makePaintTexture(0xf1bd20, 0.04),
  });
  const operatorCab = new THREE.Group();
  const cabBody = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabD), cabPaintMat);
  cabBody.castShadow = cabBody.receiveShadow = true;
  operatorCab.add(cabBody);
  const cabFloor = new THREE.Mesh(
    new THREE.BoxGeometry(cabW - 2, 0.6, cabD - 2),
    new THREE.MeshStandardMaterial({ color: 0x444b54, metalness: 0.2, roughness: 0.8 })
  );
  cabFloor.position.set(0, -cabH / 2 + 0.3, 0);
  operatorCab.add(cabFloor);
  const consoleBase = new THREE.Mesh(
    new THREE.BoxGeometry(9, 3, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x1f242c, metalness: 0.35, roughness: 0.45 })
  );
  consoleBase.position.set(1.5, -1.4, -cabD / 2 + 3.2);
  consoleBase.rotation.x = THREE.MathUtils.degToRad(-4);
  operatorCab.add(consoleBase);
  const consolePanel = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 2.2, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x173247, emissive: 0x0a1d2c, metalness: 0.15, roughness: 0.5 })
  );
  consolePanel.position.set(1.5, 0.6, -cabD / 2 + 2.7);
  consolePanel.rotation.x = THREE.MathUtils.degToRad(-22);
  operatorCab.add(consolePanel);
  const leverMat = new THREE.MeshStandardMaterial({ color: 0xcfd2d8, metalness: 0.65, roughness: 0.35 });
  const leverL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.3, 16), leverMat);
  leverL.rotation.z = Math.PI / 2;
  leverL.position.set(-0.8, -0.6, -cabD / 2 + 2.6);
  const leverR = leverL.clone();
  leverR.position.x = 2.8;
  operatorCab.add(leverL, leverR);
  const seatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.8, 18), dark);
  seatBase.position.set(-3.2, -cabH / 2 + 1.6, 0.8);
  const seatCushion = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 1.2, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x1e2c36, metalness: 0.2, roughness: 0.6 })
  );
  seatCushion.position.set(-3.2, -cabH / 2 + 2.6, 0.8);
  const seatBack = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 3.2, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x273a49, metalness: 0.2, roughness: 0.55 })
  );
  seatBack.position.set(-3.2, -cabH / 2 + 4.2, -0.2);
  seatBack.rotation.x = THREE.MathUtils.degToRad(-8);
  operatorCab.add(seatBase, seatCushion, seatBack);
  const winSeaward = new THREE.Mesh(new THREE.PlaneGeometry(cabW - 6, 6), glass);
  winSeaward.position.set(0, -0.2, -cabD / 2 - 0.51); // ligeiro offset para evitar z-fighting
  winSeaward.rotation.y = Math.PI;
  const winDown = new THREE.Mesh(new THREE.PlaneGeometry(cabW - 10, 4), glass);
  winDown.position.set(0, -cabH / 2 + 2, -cabD / 2 - 0.35);
  winDown.rotation.y = Math.PI;
  winDown.rotation.x = THREE.MathUtils.degToRad(-65);
  const winLeft = new THREE.Mesh(new THREE.PlaneGeometry(cabD - 6, 5), glass);
  winLeft.position.set(-cabW / 2 - 0.51, 0.5, 0);
  winLeft.rotation.y = Math.PI / 2;
  const winRight = winLeft.clone();
  winRight.position.set(cabW / 2 + 0.51, 0.5, 0);
  winRight.rotation.y = -Math.PI / 2;
  const winRoof = new THREE.Mesh(new THREE.PlaneGeometry(cabW - 8, 3), glass);
  winRoof.position.set(0, cabH / 2 - 0.1, -cabD / 2 - 0.3);
  winRoof.rotation.x = THREE.MathUtils.degToRad(78);
  winRoof.rotation.y = Math.PI;
  operatorCab.add(winSeaward, winDown, winLeft, winRight, winRoof);

  // molduras finas das janelas para evitar look de "buraco" na chapa
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x9a1f0f, metalness: 0.2, roughness: 0.6 });
  const halfFrontW = (cabW - 6) / 2, frontH = 6;
  operatorCab.add(
    rectBeamBetween(new THREE.Vector3(-halfFrontW,  frontH/2, -cabD/2 - 0.5), new THREE.Vector3( halfFrontW,  frontH/2, -cabD/2 - 0.5), 0.2, 0.2, frameMat),
    rectBeamBetween(new THREE.Vector3(-halfFrontW, -frontH/2, -cabD/2 - 0.5), new THREE.Vector3( halfFrontW, -frontH/2, -cabD/2 - 0.5), 0.2, 0.2, frameMat),
    rectBeamBetween(new THREE.Vector3(-halfFrontW, -frontH/2, -cabD/2 - 0.5), new THREE.Vector3(-halfFrontW,  frontH/2, -cabD/2 - 0.5), 0.2, 0.2, frameMat),
    rectBeamBetween(new THREE.Vector3( halfFrontW, -frontH/2, -cabD/2 - 0.5), new THREE.Vector3( halfFrontW,  frontH/2, -cabD/2 - 0.5), 0.2, 0.2, frameMat)
  );
  // Porta lateral de acesso alinhada ao passadiço
  const doorHeight = 9;
  const doorWidth = 6;
  const doorThickness = 0.45;
  const doorBottomY = -cabH / 2 + 0.5;
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0xa45c12,
    metalness: 0.4,
    roughness: 0.55,
    map: makePaintTexture(0xa45c12, 0.06),
  });
  const cabDoor = new THREE.Mesh(new THREE.BoxGeometry(doorThickness, doorHeight, doorWidth), doorMat);
  cabDoor.position.set(cabW / 2 + doorThickness / 2, doorBottomY + doorHeight / 2, 0);
  cabDoor.castShadow = cabDoor.receiveShadow = true;
  operatorCab.add(cabDoor);
  const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x3b3125, metalness: 0.45, roughness: 0.5 });
  const doorFrameTop = rectBeamBetween(
    new THREE.Vector3(cabW / 2, doorBottomY + doorHeight, -doorWidth / 2 - 0.05),
    new THREE.Vector3(cabW / 2, doorBottomY + doorHeight, doorWidth / 2 + 0.05),
    0.25,
    0.25,
    doorFrameMat
  );
  const doorFrameBottom = rectBeamBetween(
    new THREE.Vector3(cabW / 2, doorBottomY, -doorWidth / 2 - 0.05),
    new THREE.Vector3(cabW / 2, doorBottomY, doorWidth / 2 + 0.05),
    0.2,
    0.2,
    doorFrameMat
  );
  const doorFrameFront = rectBeamBetween(
    new THREE.Vector3(cabW / 2, doorBottomY, -doorWidth / 2 - 0.05),
    new THREE.Vector3(cabW / 2, doorBottomY + doorHeight, -doorWidth / 2 - 0.05),
    0.25,
    0.25,
    doorFrameMat
  );
  const doorFrameBack = rectBeamBetween(
    new THREE.Vector3(cabW / 2, doorBottomY, doorWidth / 2 + 0.05),
    new THREE.Vector3(cabW / 2, doorBottomY + doorHeight, doorWidth / 2 + 0.05),
    0.25,
    0.25,
    doorFrameMat
  );
  operatorCab.add(doorFrameTop, doorFrameBottom, doorFrameFront, doorFrameBack);
  const doorWindow = new THREE.Mesh(new THREE.PlaneGeometry(doorWidth - 1.2, 2.6), glass);
  doorWindow.position.set(cabW / 2 + doorThickness / 2 + 0.02, doorBottomY + doorHeight * 0.65, 0);
  doorWindow.rotation.y = Math.PI / 2;
  operatorCab.add(doorWindow);
  const doorHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 16), leverMat);
  doorHandle.rotation.z = Math.PI / 2;
  doorHandle.position.set(cabW / 2 + doorThickness + 0.2, doorBottomY + doorHeight * 0.35, 1.6);
  operatorCab.add(doorHandle);

  // Telhado com dois módulos compridos interligados por pilares
  const canopyGroup = new THREE.Group();
  const canopyBaseY = cabH / 2 + 0.3;
  const podHeight = 0.9;
  const podSpacingX = (cabW / 2) - 3.0;
  const podLength = cabD + 6;
  const podMat = new THREE.MeshStandardMaterial({
    color: 0xf5c849,
    metalness: 0.35,
    roughness: 0.45,
    map: makePaintTexture(0xf5c849, 0.025),
  });
  const podGeo = new THREE.BoxGeometry(4.4, podHeight, podLength);
  const podLeft = new THREE.Mesh(podGeo, podMat);
  podLeft.position.set(-podSpacingX, canopyBaseY + podHeight, 0);
  const podRight = podLeft.clone();
  podRight.position.x = podSpacingX;
  podLeft.castShadow = podRight.castShadow = true;
  podLeft.receiveShadow = podRight.receiveShadow = true;
  canopyGroup.add(podLeft, podRight);

  const pillarZs = [-podLength / 2 + 2, -2, 2, podLength / 2 - 2];
  pillarZs.forEach((z, idx) => {
    canopyGroup.add(
      rectBeamBetween(
        new THREE.Vector3(-podSpacingX, canopyBaseY, z),
        new THREE.Vector3(-podSpacingX, canopyBaseY + podHeight * 0.5, z),
        0.5,
        0.5,
        dark
      ),
      rectBeamBetween(
        new THREE.Vector3(podSpacingX, canopyBaseY, z),
        new THREE.Vector3(podSpacingX, canopyBaseY + podHeight * 0.5, z),
        0.5,
        0.5,
        dark
      )
    );
    const tie = rectBeamBetween(
      new THREE.Vector3(-podSpacingX, canopyBaseY + podHeight * 0.6, z),
      new THREE.Vector3(podSpacingX, canopyBaseY + podHeight * 0.6, z),
      0.35,
      0.35,
      dark
    );
    canopyGroup.add(tie);
    if (idx < pillarZs.length - 1) {
      const nextZ = pillarZs[idx + 1];
      canopyGroup.add(
        rectBeamBetween(
          new THREE.Vector3(-podSpacingX, canopyBaseY + podHeight * 0.6, z),
          new THREE.Vector3(-podSpacingX, canopyBaseY + podHeight * 0.6, nextZ),
          0.3,
          0.3,
          dark
        ),
        rectBeamBetween(
          new THREE.Vector3(podSpacingX, canopyBaseY + podHeight * 0.6, z),
          new THREE.Vector3(podSpacingX, canopyBaseY + podHeight * 0.6, nextZ),
          0.3,
          0.3,
          dark
        )
      );
    }
  });
  const canopySkin = new THREE.Mesh(new THREE.BoxGeometry(cabW - 6, 0.35, cabD + 4), cabPaintMat);
  canopySkin.position.set(0, canopyBaseY + podHeight * 0.65, 0);
  canopySkin.rotation.x = THREE.MathUtils.degToRad(2.5);
  canopySkin.castShadow = canopySkin.receiveShadow = true;
  canopyGroup.add(canopySkin);
  operatorCab.add(canopyGroup);
  // posicionada ligeiramente atrás do pivot e centrada lateralmente
  operatorCab.position.set(12, 11, 10);
  operatorCab.castShadow = true as any;
  slewGroup.add(operatorCab);

  // Plinto/base sob a cabine + ancoragens ao turret para evitar flutuar
  const cabBase = new THREE.Mesh(new THREE.BoxGeometry(cabW + 4, 1.2, cabD + 4), dark);
  cabBase.position.set(operatorCab.position.x, operatorCab.position.y - cabH/2 - 1, operatorCab.position.z);
  cabBase.castShadow = cabBase.receiveShadow = true;
  slewGroup.add(cabBase);
  const tTop = turret.position.y + 3;
  const turFL = new THREE.Vector3(-18, tTop,  12);
  const turFR = new THREE.Vector3( 18, tTop,  12);
  const turBL = new THREE.Vector3(-18, tTop, -12);
  const turBR = new THREE.Vector3( 18, tTop, -12);
  const cabBL = new THREE.Vector3(operatorCab.position.x - cabW/2, cabBase.position.y + 0.6, operatorCab.position.z - cabD/2);
  const cabBR = new THREE.Vector3(operatorCab.position.x + cabW/2, cabBase.position.y + 0.6, operatorCab.position.z - cabD/2);
  // duas escoras para a frente, duas para trás
  slewGroup.add(
    rectBeamBetween(cabBL, turFL, 1.0, 1.0, dark),
    rectBeamBetween(cabBR, turFR, 1.0, 1.0, dark),
    rectBeamBetween(new THREE.Vector3(operatorCab.position.x - cabW/2, cabBase.position.y + 0.6, operatorCab.position.z + cabD/2), turBL, 1.0, 1.0, dark),
    rectBeamBetween(new THREE.Vector3(operatorCab.position.x + cabW/2, cabBase.position.y + 0.6, operatorCab.position.z + cabD/2), turBR, 1.0, 1.0, dark)
  );

  // Vigas longitudinais no topo (duas ao comprido) com travessas
  const roofGroup = new THREE.Group();
  const cabTopY = operatorCab.position.y + cabH / 2;
  const roofY = cabTopY + 2; // um pouco acima do topo da cabine
  const roofLen = 26; // extensão para trás (Z+)
  const railXOff = 8.5; // afastamento lateral
  const railGeo = new THREE.BoxGeometry(0.8, 0.8, roofLen);
  const roofRailL = new THREE.Mesh(railGeo, orange);
  const startZ = operatorCab.position.z + cabD / 2;
  roofRailL.position.set(-railXOff, roofY, startZ + roofLen / 2);
  const roofRailR = roofRailL.clone();
  roofRailR.position.x = railXOff;
  roofRailL.castShadow = roofRailL.receiveShadow = true;
  roofRailR.castShadow = roofRailR.receiveShadow = true;
  roofGroup.add(roofRailL, roofRailR);

  // travessas entre as duas vigas
  for (let i = 0; i <= 4; i++) {
    const z = startZ + (i * roofLen) / 4;
    const a = new THREE.Vector3(-railXOff, roofY, z);
    const b = new THREE.Vector3( railXOff, roofY, z);
    roofGroup.add(rectBeamBetween(a, b, 0.7, 0.7, orange));
  }
  slewGroup.add(roofGroup);

  // (sem módulo traseiro extra — existe apenas a operatorCab)

  // Torre de polias (sheave tower) junto ao pivot
  const towerX = 0;
  const towerZ = -2;
  const towerBaseY = 6;
  const towerTopY = 22;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.2, towerTopY - towerBaseY, 1.2), orange);
  tower.position.set(towerX, (towerTopY + towerBaseY) / 2, towerZ);
  tower.castShadow = tower.receiveShadow = true;
  slewGroup.add(tower);
  const sheaveMat = dark;
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 20), sheaveMat);
    t.rotation.z = Math.PI / 2;
    t.position.set(towerX, towerBaseY + 1.5 + i * ((towerTopY - towerBaseY) / 6), towerZ);
    t.castShadow = t.receiveShadow = true;
    slewGroup.add(t);
  }

  // Cabos dos dois lados desde o topo da torre até às vigas longitudinais
  const apex = new THREE.Vector3(towerX, towerTopY + 1.5, towerZ);
  const cabTopY2 = operatorCab.position.y + cabH / 2;
  const roofY2 = cabTopY2 + 2;
  const startZ2 = operatorCab.position.z + cabD / 2;
  const railFrontL = new THREE.Vector3(-railXOff, roofY2, startZ2);
  const railFrontR = new THREE.Vector3( railXOff, roofY2, startZ2);
  const railBackL  = new THREE.Vector3(-railXOff, roofY2, startZ2 + roofLen);
  const railBackR  = new THREE.Vector3( railXOff, roofY2, startZ2 + roofLen);
  slewGroup.add(
    cylinderBetween(apex, railFrontL, 0.35, cableMat),
    cylinderBetween(apex, railFrontR, 0.35, cableMat),
    cylinderBetween(apex, railBackL,  0.35, cableMat),
    cylinderBetween(apex, railBackR,  0.35, cableMat)
  );

  // Acesso: escada pela direita até plataforma junto à lateral da cabine
  const ladderX = operatorCab.position.x + cabW / 2 + 4;
  const ladderZ = operatorCab.position.z;
  // nível da plataforma ao nível do piso da cabine
  const ladderTopY = slewGroup.position.y + operatorCab.position.y;
  const ladderH = ladderTopY - 0.5;
  const ladderSide = new THREE.Mesh(new THREE.BoxGeometry(0.6, ladderH, 0.4), dark);
  ladderSide.position.set(ladderX - 0.6, ladderH/2, ladderZ);
  const ladderSideR = ladderSide.clone(); ladderSideR.position.x = ladderX + 0.6;
  group.add(ladderSide, ladderSideR);
  const rungGeo = new THREE.BoxGeometry(1.6, 0.15, 0.35);
  const rungs = Math.max(8, Math.floor(ladderH / 2.0));
  for (let i=0;i<rungs;i++){
    const y = 1.0 + i * (ladderH / (rungs+1));
    const rung = new THREE.Mesh(rungGeo, dark);
    rung.position.set(ladderX, y, ladderZ);
    rung.castShadow = true; group.add(rung);
  }
  // plataforma de acesso junto à lateral direita da cabine
  const plat = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 4), new THREE.MeshStandardMaterial({color:0xc2ccd8, metalness:0.35, roughness:0.6}));
  plat.position.set(operatorCab.position.x + cabW / 2 + 2, ladderTopY - 0.5, operatorCab.position.z);
  plat.castShadow = plat.receiveShadow = true; group.add(plat);
  // guarda na aresta externa (lado fora)
  const guard = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 0.4), new THREE.MeshStandardMaterial({color:0xf5f6f7, metalness:0.4, roughness:0.4}));
  guard.position.set(plat.position.x + 5.0, plat.position.y + 0.9, plat.position.z);
  guard.rotation.y = Math.PI / 2;
  group.add(guard);

  // ponte/c passadiço entre a plataforma e a cabine (sem lacunas)
  const walkwayMat = new THREE.MeshStandardMaterial({color:0xc2ccd8, metalness:0.35, roughness:0.6});
  const guardMat = new THREE.MeshStandardMaterial({color:0xf5f6f7, metalness:0.4, roughness:0.4});
  const bridgeStart = new THREE.Vector3(plat.position.x - 5, plat.position.y, plat.position.z);
  // liga directamente à parede direita da cabine
  const bridgeEnd = new THREE.Vector3(operatorCab.position.x + cabW/2, plat.position.y, operatorCab.position.z);
  group.add(rectBeamBetween(bridgeStart, bridgeEnd, 2.2, 0.35, walkwayMat));
  // guarda-corpos no passadiço
  const railYOffset = 0.9;
  const railZOff = 1.1;
  group.add(rectBeamBetween(
    new THREE.Vector3(bridgeStart.x, bridgeStart.y + railYOffset, bridgeStart.z - railZOff),
    new THREE.Vector3(bridgeEnd.x,   bridgeEnd.y   + railYOffset, bridgeEnd.z   - railZOff),
    0.2, 0.8, guardMat
  ));
  group.add(rectBeamBetween(
    new THREE.Vector3(bridgeStart.x, bridgeStart.y + railYOffset, bridgeStart.z + railZOff),
    new THREE.Vector3(bridgeEnd.x,   bridgeEnd.y   + railYOffset, bridgeEnd.z   + railZOff),
    0.2, 0.8, guardMat
  ));

  // escoras adicionais ligando a coroa (lateral) às vigas superiores
  const topFL = new THREE.Vector3(-halfGauge - 1, topY, -halfClear - 1);
  const topFR = new THREE.Vector3( halfGauge + 1, topY, -halfClear - 1);
  const topBL = new THREE.Vector3(-halfGauge - 1, topY,  halfClear + 1);
  const topBR = new THREE.Vector3( halfGauge + 1, topY,  halfClear + 1);
  const ringFL = new THREE.Vector3(-10, ring.position.y + 1, -8);
  const ringFR = new THREE.Vector3( 10, ring.position.y + 1, -8);
  const ringBL = new THREE.Vector3(-10, ring.position.y + 1,  8);
  const ringBR = new THREE.Vector3( 10, ring.position.y + 1,  8);
  [
    [topFL, ringFL], [topFR, ringFR], [topBL, ringBL], [topBR, ringBR]
  ].forEach(([a,b]) => group.add(rectBeamBetween(a as THREE.Vector3, b as THREE.Vector3, 1.0, 1.0, orange)));

  /* 3) Grupo de lança (pivot comum) ------------------------------------ */

  const boomPivot = new THREE.Group();
  boomPivot.name = 'BoomPivot';
  // um pouco acima do turret e mais para a frente (lado navio)
  boomPivot.position.set(0, 6, -8);
  slewGroup.add(boomPivot);

  // suporte (forqueta) do pivot preso ao turret + pino
  const forkL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 10, 6), dark); forkL.position.set(-6, 5, -6.5);
  const forkR = forkL.clone(); forkR.position.x = 6;
  const forkBase = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 8), dark); forkBase.position.set(0, 1.5, -6.5);
  forkL.castShadow=forkR.castShadow=forkBase.castShadow=true; forkL.receiveShadow=forkR.receiveShadow=forkBase.receiveShadow=true;
  slewGroup.add(forkL, forkR, forkBase);
  const pivotPin = new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,14,18), dark); pivotPin.rotation.z = Math.PI/2; pivotPin.position.set(0, 6, -6.5); pivotPin.castShadow=pivotPin.receiveShadow=true; slewGroup.add(pivotPin);
  // reforços do garfo do pivot (travessa superior e diagonais)
  const yokeTop = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 2.2), dark);
  yokeTop.position.set(0, 10, -6.5);
  yokeTop.castShadow = yokeTop.receiveShadow = true; slewGroup.add(yokeTop);
  const forkDiag1 = rectBeamBetween(new THREE.Vector3(-6, 5, -6.5), new THREE.Vector3(6, 9.5, -6.5), 0.9, 0.9, dark);
  const forkDiag2 = rectBeamBetween(new THREE.Vector3( 6, 5, -6.5), new THREE.Vector3(-6, 9.5, -6.5), 0.9, 0.9, dark);
  slewGroup.add(forkDiag1, forkDiag2);

  // Lança principal em treliça (vai em Z-)
  const boom = new THREE.Group();
  boom.name = 'LatticeBoom';
  const boomHeight = 4.6;
  const chordThick = 2.0;
  const boomSideOffset = 1.6;

  const boomChordGeo = new THREE.BoxGeometry(chordThick, chordThick, seawardBoomLength);
  const boomTopChord = new THREE.Mesh(boomChordGeo, orange);
  boomTopChord.position.set(0, boomHeight, -seawardBoomLength / 2);
  const boomBotChord = new THREE.Mesh(boomChordGeo, orange);
  boomBotChord.position.set(0, 0, -seawardBoomLength / 2);
  boom.add(boomTopChord, boomBotChord);

  const boomPanelGeo = new THREE.BoxGeometry(0.7, boomHeight + chordThick * 0.6, seawardBoomLength * 0.96);
  const boomSideL = new THREE.Mesh(boomPanelGeo, orange);
  boomSideL.position.set(-boomSideOffset, boomHeight / 2 - 0.1, -seawardBoomLength / 2);
  boomSideL.castShadow = boomSideL.receiveShadow = true;
  const boomSideR = boomSideL.clone();
  boomSideR.position.x = boomSideOffset;
  boom.add(boomSideL, boomSideR);

  const boomSegs = 9;
  for (let i = 0; i <= boomSegs; i++) {
    const z = -(i * seawardBoomLength) / boomSegs;
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, boomHeight, 1.2),
      orange
    );
    post.position.set(0, boomHeight / 2, z);
    boom.add(post);

    if (i < boomSegs) {
      const z0 = -(i * seawardBoomLength) / boomSegs;
      const z1 = -((i + 1) * seawardBoomLength) / boomSegs;
      const midZ = (z0 + z1) / 2;
      const diagLeft = cylinderBetween(
        new THREE.Vector3(-boomSideOffset, 0, z0),
        new THREE.Vector3(-boomSideOffset, boomHeight, z1),
        0.55,
        orange
      );
      const diagRight = cylinderBetween(
        new THREE.Vector3(boomSideOffset, boomHeight, z0),
        new THREE.Vector3(boomSideOffset, 0, z1),
        0.55,
        orange
      );
      const crossA = cylinderBetween(
        new THREE.Vector3(-boomSideOffset, 0, z0),
        new THREE.Vector3(boomSideOffset, boomHeight, z1),
        0.45,
        orange
      );
      const crossB = cylinderBetween(
        new THREE.Vector3(boomSideOffset, 0, z0),
        new THREE.Vector3(-boomSideOffset, boomHeight, z1),
        0.45,
        orange
      );
      boom.add(diagLeft, diagRight, crossA, crossB);
      const tieTop = rectBeamBetween(
        new THREE.Vector3(-boomSideOffset, boomHeight, midZ),
        new THREE.Vector3(boomSideOffset, boomHeight, midZ),
        0.7,
        0.7,
        orange
      );
      const tieBot = rectBeamBetween(
        new THREE.Vector3(-boomSideOffset, 0, midZ),
        new THREE.Vector3(boomSideOffset, 0, midZ),
        0.7,
        0.7,
        orange
      );
      boom.add(tieTop, tieBot);
    }
  }

  const boomSpine = rectBeamBetween(
    new THREE.Vector3(0, boomHeight + 0.8, 0),
    new THREE.Vector3(0, boomHeight + 0.4, -seawardBoomLength * 0.95),
    0.8,
    0.8,
    orange
  );
  boom.add(boomSpine);
  const boomRootGusset = new THREE.Mesh(
    new THREE.BoxGeometry(boomSideOffset * 2 + 1.2, boomHeight + 1.4, 4.6),
    dark
  );
  boomRootGusset.position.set(0, boomHeight / 2, -2.3);
  boomRootGusset.castShadow = boomRootGusset.receiveShadow = true;
  boom.add(boomRootGusset);

  boom.castShadow = boom.receiveShadow = true;
  boomPivot.add(boom);

  // Mastro traseiro (landsid e em Z+)
  const mast = new THREE.Group();
  mast.name = 'BackMast';
  const mastBaseY = 0;
  const mastTopY = 14;

  const mastTopChord = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.0, landsideBoomLength),
    orange
  );
  mastTopChord.position.set(0, mastTopY, landsideBoomLength / 2);
  const mastBotChord = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.0, landsideBoomLength),
    orange
  );
  mastBotChord.position.set(0, mastBaseY, landsideBoomLength / 2);
  mast.add(mastTopChord, mastBotChord);

  const mastSegs = 4;
  for (let i = 0; i <= mastSegs; i++) {
    const z = (i * landsideBoomLength) / mastSegs;
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, mastTopY - mastBaseY, 0.8),
      orange
    );
    post.position.set(0, (mastTopY + mastBaseY) / 2, z);
    mast.add(post);

    if (i < mastSegs) {
      const z0 = (i * landsideBoomLength) / mastSegs;
      const z1 = ((i + 1) * landsideBoomLength) / mastSegs;
      const d1 = cylinderBetween(
        new THREE.Vector3(0, mastBaseY, z0),
        new THREE.Vector3(0, mastTopY, z1),
        0.35,
        orange
      );
      const d2 = cylinderBetween(
        new THREE.Vector3(0, mastTopY, z0),
        new THREE.Vector3(0, mastBaseY, z1),
        0.35,
        orange
      );
      mast.add(d1, d2);
    }
  }
  mast.position.set(0, 2, 0); // ligeiro offset para ficar acima do turret
  boomPivot.add(mast);
  // base do mastro e pino de ligação
  const mastBase = new THREE.Mesh(new THREE.BoxGeometry(8,4,8), dark); mastBase.position.set(0, 2, 2.5); mastBase.castShadow=mastBase.receiveShadow=true; boomPivot.add(mastBase);
  const mastPin = new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.0,10,18), dark); mastPin.rotation.z=Math.PI/2; mastPin.position.set(0, 2, 2.5); mastPin.castShadow=mastPin.receiveShadow=true; boomPivot.add(mastPin);

  // Cabos estruturais: topo do mastro -> dois pontos da lança
  const mastTopAnchor = new THREE.Vector3(0, mastTopY + 2, landsideBoomLength);
  const boomCableAnchor1 = new THREE.Vector3(
    0,
    boomHeight,
    -seawardBoomLength * 0.35
  );
  const boomCableAnchor2 = new THREE.Vector3(
    0,
    boomHeight,
    -seawardBoomLength * 0.75
  );

  boomPivot.add(
    cylinderBetween(mastTopAnchor, boomCableAnchor1, 0.5, cableMat),
    cylinderBetween(mastTopAnchor, boomCableAnchor2, 0.5, cableMat)
  );

  // Cabeça da lança a 60 graus (para cima) + cabo e gancho
  const boomTip = new THREE.Vector3(0, boomHeight, -seawardBoomLength);
  const headAngle = THREE.MathUtils.degToRad(60);
  const headLen = 12;
  const headEnd = new THREE.Vector3(
    boomTip.x,
    boomTip.y + Math.sin(headAngle) * headLen,
    boomTip.z - Math.cos(headAngle) * headLen
  );
  // pequena viga que representa a "cabeça" inclinada
  boomPivot.add(cylinderBetween(boomTip, headEnd, 0.7, orange));
  // polia no topo
  const sheave = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3.8, 24), dark);
  sheave.rotation.z = Math.PI / 2;
  sheave.position.copy(headEnd);
  sheave.castShadow = sheave.receiveShadow = true;
  boomPivot.add(sheave);

  // tambor/motor de içar (winch) e cabo até à cabeça
  const winchPos = new THREE.Vector3(0, boomHeight + 2, -seawardBoomLength * 0.45);
  const winchHousing = new THREE.Mesh(new THREE.BoxGeometry(6,3,4), dark); winchHousing.position.copy(winchPos); winchHousing.castShadow = winchHousing.receiveShadow = true; boomPivot.add(winchHousing);
  const winchDrum = new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,5,20), dark); winchDrum.rotation.x = Math.PI/2; winchDrum.position.copy(winchPos).add(new THREE.Vector3(0,0,0)); boomPivot.add(winchDrum);
  boomPivot.add(cylinderBetween(winchPos, headEnd, 0.35, cableMat));

  // cabo vertical a partir da cabeça inclinada
  const hookPos = headEnd.clone().add(new THREE.Vector3(0, -22, 0));
  boomPivot.add(cylinderBetween(headEnd, hookPos, 0.4, cableMat));

  // gancho simples (haste + curva)
  const hookGroup = new THREE.Group();
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 2.8, 16), dark);
  shank.position.y = 1.4;
  const curve = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.25, 14, 24, Math.PI * 1.1), dark);
  curve.rotation.x = Math.PI / 2; // curva no plano XZ
  curve.position.y = 0.3;
  hookGroup.add(shank, curve);
  hookGroup.position.copy(hookPos);
  hookGroup.castShadow = true as any;
  boomPivot.add(hookGroup);

  /* 4) Centralizar ------------------------------------------------------ */

  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);

  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= box.min.y;

  return group;
}
