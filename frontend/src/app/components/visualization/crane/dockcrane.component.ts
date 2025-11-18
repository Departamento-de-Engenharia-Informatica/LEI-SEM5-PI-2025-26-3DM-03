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
    // Ajuste de escala realista: reduzir altura total e proporções
    // Valores originais: height 120, boom 115/60, gauge 65, clearance 65
    // Novos valores ~40% dos anteriores para aproximar intervalo 30-50 m
    this.craneGroup = createPortalLatticeCraneModel({
      height: 48,
      seawardBoomLength: 80,
      landsideBoomLength: 34,
      gauge: 48,
      clearance: 48,
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
    // Permitir aproximar mais (mais zoom)
    this.controls.minDistance = 20; // antes 120
    this.controls.maxDistance = 900;
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

  const baseTextureLoader = new THREE.TextureLoader();
  baseTextureLoader.setPath('assets/app/textures/');
  const glassOpalTexture = baseTextureLoader.load('glass_opal.png');
  glassOpalTexture.colorSpace = THREE.SRGBColorSpace;
  glassOpalTexture.wrapS = glassOpalTexture.wrapT = THREE.ClampToEdgeWrapping;
  glassOpalTexture.anisotropy = 6;

  const stairTreadTexture = baseTextureLoader.load('stair_tread.svg');
  stairTreadTexture.colorSpace = THREE.SRGBColorSpace;
  stairTreadTexture.wrapS = stairTreadTexture.wrapT = THREE.RepeatWrapping;
  stairTreadTexture.repeat.set(6, 6);
  stairTreadTexture.anisotropy = 8;

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
    map: glassOpalTexture,
  });

  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x10151c,
    metalness: 0.85,
    roughness: 0.3,
  });
  const walkwayMat = new THREE.MeshStandardMaterial({
    color: 0xf4f6f8,
    metalness: 0.45,
    roughness: 0.5,
    map: stairTreadTexture,
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

  const catwalkPostGeo = new THREE.BoxGeometry(1.1, 6, 1.1);
  const postCount: number = 4;
  for (let i = 0; i < postCount; i++) {
    const factor = postCount === 1 ? 0.5 : i / (postCount - 1);
    const px = catwalk.position.x - catwalkLength / 2 + factor * catwalkLength;
    const postL = new THREE.Mesh(catwalkPostGeo, blue);
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

  const deckTopY = deck.position.y + 0.6;
  const ladderHeight = deckTopY + 0.4;

  const railMat = new THREE.MeshStandardMaterial({
    color: 0xf5f6f7,
    metalness: 0.4,
    roughness: 0.4,
  });
  const stairFrameMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f1,
    metalness: 0.35,
    roughness: 0.45,
  });

  const rectBeamBetween = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    width: number,
    height: number,
    material: THREE.Material | THREE.Material[]
  ) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-3) return new THREE.Group();
    const beamGeo = new THREE.BoxGeometry(width, height, len);
    const beam = new THREE.Mesh(beamGeo, material as THREE.Material);
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    beam.position.copy(mid);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      dir.clone().normalize()
    );
    beam.quaternion.copy(quat);
    beam.castShadow = beam.receiveShadow = true;
    return beam;
  };

  const createStraightStairFlight = (
    stepCount: number,
    width: number,
    stepRise: number,
    stepDepth: number,
    material: THREE.Material
  ) => {
    const flight = new THREE.Group();
    for (let i = 0; i < stepCount; i++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(width, stepRise, stepDepth),
        material
      );
      step.position.set(0, stepRise * (i + 0.5), stepDepth * (i + 0.5));
      step.castShadow = step.receiveShadow = true;
      flight.add(step);
    }
    return flight;
  };

  // Nova escada tipo torre industrial (switchback), estilo da imagem
  // parâmetros base
  const stepsPerFlight = 7; // número de degraus por lanço
  const stairWidth = 2.6;
  const desiredMinFlights = 8;
  const stepRun = 0.78; // profundidade de cada degrau
  const stepRise = Math.max(1.4, Math.min(2.6, ladderHeight / (stepsPerFlight * desiredMinFlights))); // altura de cada degrau (escala da cena)
  const landingDepth = 1.35;
  const topLandingDepth = 2.2;
  const stairBaseX = halfGauge + 3.2;
  const stairBaseZ = mainCab.position.z - 4.5;
  const stairRailHeight = 1.2;
  const stairAttachX = halfGauge + 0.8;

  // helper local para construir um lanço com degraus e guardas
  const buildFlight = (
    dir: 1 | -1,
    width: number,
    steps: number,
    rise: number,
    run: number,
    mat: THREE.Material
  ) => {
    const g = new THREE.Group();
    for (let i = 0; i < steps; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(width, rise, run), mat);
      step.position.set(0, rise * (i + 0.5), dir * run * (i + 0.5));
      step.castShadow = step.receiveShadow = true;
      g.add(step);
    }
    // corrimãos laterais simples ao longo do lanço
    const railOffset = width / 2 + 0.3;
    const railLen = steps * run;
    const railGeo = new THREE.BoxGeometry(0.2, 0.2, railLen);
    const railL = new THREE.Mesh(railGeo, railMat);
    const railR = new THREE.Mesh(railGeo, railMat);
    const midY = rise * steps * 0.5 + stairRailHeight;
    railL.position.set(-railOffset, midY, dir * railLen * 0.5);
    railR.position.set( railOffset, midY, dir * railLen * 0.5);
    railL.castShadow = railL.receiveShadow = true;
    railR.castShadow = railR.receiveShadow = true;
    g.add(railL, railR);
    return g;
  };

  // constrói a torre completa com vários lanços em ziguezague
  const buildStairTower = (
    baseX: number,
    baseZ: number,
    targetHeight: number,
    attachToX: number
  ): { stairGroup: THREE.Group; topLanding: THREE.Mesh } => {
    const stairGroup = new THREE.Group();
    stairGroup.name = 'RearAccessStair';

    // base de betão
    const groundPad = new THREE.Mesh(
      new THREE.BoxGeometry(stairWidth + 2.4, 0.5, 6),
      walkwayMat
    );
    groundPad.position.set(baseX, 0.25, baseZ - 2.8);
    groundPad.castShadow = groundPad.receiveShadow = true;
    stairGroup.add(groundPad);

    const flightHeight = stepsPerFlight * stepRise;
    let flights = Math.ceil(targetHeight / flightHeight);
    if (flights % 2 !== 0) flights += 1; // terminar alinhado ao ponto de entrada

    let curY = 0;
    let curZ = baseZ;
    let dir: 1 | -1 = 1;
    let minZ = baseZ;
    let maxZ = baseZ;

    const landingThickness = 0.8;

    for (let f = 0; f < flights; f++) {
      const flight = buildFlight(dir, stairWidth, stepsPerFlight, stepRise, stepRun, walkwayMat);
      flight.position.set(baseX, curY, curZ);
      stairGroup.add(flight);

      // extremos deste lanço
      curZ = curZ + dir * (stepsPerFlight * stepRun);
      minZ = Math.min(minZ, curZ);
      maxZ = Math.max(maxZ, curZ);

      // plataforma intermédia (se não for o último lanço)
      if (f < flights - 1) {
        const landing = new THREE.Mesh(
          new THREE.BoxGeometry(stairWidth + 2.2, landingThickness, landingDepth),
          walkwayMat
        );
        const topY = curY + flightHeight - landingThickness / 2;
        landing.position.set(baseX, topY, curZ + dir * (landingDepth / 2));
        landing.castShadow = landing.receiveShadow = true;
        stairGroup.add(landing);

        minZ = Math.min(minZ, landing.position.z - landingDepth / 2);
        maxZ = Math.max(maxZ, landing.position.z + landingDepth / 2);

        const supportBeam = rectBeamBetween(
          new THREE.Vector3(attachToX, topY, landing.position.z),
          new THREE.Vector3(baseX - stairWidth / 2 - 0.2, topY, landing.position.z),
          0.25,
          0.25,
          stairFrameMat
        );
        stairGroup.add(supportBeam);

        // corrimão frontal da plataforma
        const platRail = new THREE.Mesh(
          new THREE.BoxGeometry(stairWidth + 1.6, stairRailHeight, 0.25),
          railMat
        );
        platRail.position.set(
          baseX,
          topY + stairRailHeight / 2,
          landing.position.z - dir * (landingDepth / 2)
        );
        platRail.castShadow = platRail.receiveShadow = true;
        stairGroup.add(platRail);

        // próximo lanço começa do lado oposto da plataforma
        curZ = landing.position.z + (-dir) * (landingDepth / 2);
        curY += flightHeight;
        dir = (dir === 1 ? -1 : 1);
      }
    }

    // plataforma do topo (alinhada ao eixo Z do ponto de entrada)
    const topLandingThickness = 0.8;
    const topLanding = new THREE.Mesh(
      new THREE.BoxGeometry(stairWidth + 3, topLandingThickness, topLandingDepth),
      walkwayMat
    );
    topLanding.position.set(baseX, targetHeight - topLandingThickness / 2, baseZ);
    topLanding.castShadow = topLanding.receiveShadow = true;
    stairGroup.add(topLanding);

    const topRailFront = new THREE.Mesh(
      new THREE.BoxGeometry(stairWidth + 2.2, stairRailHeight, 0.25),
      railMat
    );
    topRailFront.position.set(
      baseX,
      targetHeight + stairRailHeight / 2 - 0.4,
      baseZ + topLandingDepth / 2
    );
    const topRailRear = topRailFront.clone();
    topRailRear.position.z = baseZ - topLandingDepth / 2;
    const topRailSideL = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, stairRailHeight, topLandingDepth),
      railMat
    );
    topRailSideL.position.set(baseX - (stairWidth + 2.2) / 2, targetHeight + stairRailHeight / 2 - 0.4, baseZ);
    const topRailSideR = topRailSideL.clone();
    topRailSideR.position.x = baseX + (stairWidth + 2.2) / 2;
    [topRailFront, topRailRear, topRailSideL, topRailSideR].forEach((r) => {
      r.castShadow = r.receiveShadow = true;
      stairGroup.add(r);
    });

    const topSupport = rectBeamBetween(
      new THREE.Vector3(attachToX, targetHeight - topLandingThickness / 2, topLanding.position.z),
      new THREE.Vector3(baseX - stairWidth / 2 - 0.2, targetHeight - topLandingThickness / 2, topLanding.position.z),
      0.3,
      0.3,
      stairFrameMat
    );
    stairGroup.add(topSupport);

    const frameHeight = targetHeight + stairRailHeight + 0.8;

    // coluna de apoio junto à perna
    stairGroup.add(
      rectBeamBetween(
        new THREE.Vector3(attachToX, 0, baseZ),
        new THREE.Vector3(attachToX, frameHeight, baseZ),
        0.3,
        0.3,
        stairFrameMat
      )
    );

    // estrutura externa tipo “torre” (4 cantos + anéis)
    const towerMinX = baseX - stairWidth / 2 - 1.2;
    const towerMaxX = baseX + stairWidth / 2 + 1.2;
    const towerMinZ = minZ - 0.9;
    const towerMaxZ = Math.max(maxZ, baseZ + topLandingDepth / 2) + 0.9;

    const towerPostGeo = new THREE.BoxGeometry(0.55, frameHeight, 0.55);
    const postPositions: [number, number][] = [
      [towerMinX, towerMinZ],
      [towerMaxX, towerMinZ],
      [towerMinX, towerMaxZ],
      [towerMaxX, towerMaxZ],
    ];
    postPositions.forEach(([px, pz]) => {
      const post = new THREE.Mesh(towerPostGeo, stairFrameMat);
      post.position.set(px, frameHeight / 2, pz);
      post.castShadow = post.receiveShadow = true;
      stairGroup.add(post);
    });

    const addRing = (y: number) => {
      const corners = [
        new THREE.Vector3(towerMinX, y, towerMinZ),
        new THREE.Vector3(towerMaxX, y, towerMinZ),
        new THREE.Vector3(towerMaxX, y, towerMaxZ),
        new THREE.Vector3(towerMinX, y, towerMaxZ),
      ];
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        stairGroup.add(rectBeamBetween(a, b, 0.25, 0.25, stairFrameMat));
      }
    };
    addRing(0.6);
    const flightHeightY = stepsPerFlight * stepRise;
    for (let r = 1; r < flights; r++) addRing(r * flightHeightY - 0.3);
    addRing(targetHeight - 0.4);

    // escoras em X nas faces longas
    const braceBottomY = 0.8;
    const braceTopY = frameHeight - 0.8;
    stairGroup.add(
      rectBeamBetween(
        new THREE.Vector3(towerMinX, braceBottomY, towerMaxZ),
        new THREE.Vector3(towerMaxX, braceTopY, towerMaxZ),
        0.25,
        0.25,
        stairFrameMat
      ),
      rectBeamBetween(
        new THREE.Vector3(towerMaxX, braceBottomY, towerMaxZ),
        new THREE.Vector3(towerMinX, braceTopY, towerMaxZ),
        0.25,
        0.25,
        stairFrameMat
      ),
      rectBeamBetween(
        new THREE.Vector3(towerMinX, braceBottomY, towerMinZ),
        new THREE.Vector3(towerMaxX, braceTopY, towerMinZ),
        0.25,
        0.25,
        stairFrameMat
      ),
      rectBeamBetween(
        new THREE.Vector3(towerMaxX, braceBottomY, towerMinZ),
        new THREE.Vector3(towerMinX, braceTopY, towerMinZ),
        0.25,
        0.25,
        stairFrameMat
      )
    );

    return { stairGroup, topLanding };
  };

  const { stairGroup, topLanding } = buildStairTower(stairBaseX, stairBaseZ, ladderHeight, stairAttachX);
  group.add(stairGroup);

  const entryPlatformWidth = 12;
  const entryPlatformDepth = 8;
  const entryPlatformThickness = 1;
  const entryPlatform = new THREE.Mesh(
    new THREE.BoxGeometry(entryPlatformWidth, entryPlatformThickness, entryPlatformDepth),
    walkwayMat
  );
  entryPlatform.position.set(
    mainCab.position.x + 8.5,
    ladderHeight - entryPlatformThickness / 2,
    mainCab.position.z + 4
  );
  entryPlatform.castShadow = entryPlatform.receiveShadow = true;
  group.add(entryPlatform);

  const topLandingFrontEdge = new THREE.Vector3(
    topLanding.position.x,
    ladderHeight,
    topLanding.position.z + topLandingDepth / 2
  );
  const entryBridgeEnd = new THREE.Vector3(
    entryPlatform.position.x,
    ladderHeight,
    entryPlatform.position.z - entryPlatformDepth / 2
  );
  const bridgeWidth = 2.4;
  group.add(
    rectBeamBetween(topLandingFrontEdge, entryBridgeEnd, bridgeWidth, 0.45, walkwayMat)
  );

  const bridgeRailY = ladderHeight + stairRailHeight;
  const bridgeHalfWidth = bridgeWidth / 2 - 0.2;
  group.add(
    rectBeamBetween(
      new THREE.Vector3(topLandingFrontEdge.x - bridgeHalfWidth, bridgeRailY, topLandingFrontEdge.z),
      new THREE.Vector3(entryBridgeEnd.x - bridgeHalfWidth, bridgeRailY, entryBridgeEnd.z),
      0.2,
      0.2,
      railMat
    ),
    rectBeamBetween(
      new THREE.Vector3(topLandingFrontEdge.x + bridgeHalfWidth, bridgeRailY, topLandingFrontEdge.z),
      new THREE.Vector3(entryBridgeEnd.x + bridgeHalfWidth, bridgeRailY, entryBridgeEnd.z),
      0.2,
      0.2,
      railMat
    )
  );

  const entryRailHeight = 1.3;
  const entryRailSide = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, entryRailHeight, entryPlatformDepth),
    railMat
  );
  entryRailSide.position.set(
    entryPlatform.position.x - entryPlatformWidth / 2,
    ladderHeight + entryRailHeight / 2,
    entryPlatform.position.z
  );
  const entryRailSideRight = entryRailSide.clone();
  entryRailSideRight.position.x = entryPlatform.position.x + entryPlatformWidth / 2;
  const entryRailFront = new THREE.Mesh(
    new THREE.BoxGeometry(entryPlatformWidth, entryRailHeight, 0.3),
    railMat
  );
  entryRailFront.position.set(
    entryPlatform.position.x,
    ladderHeight + entryRailHeight / 2,
    entryPlatform.position.z + entryPlatformDepth / 2
  );
  [entryRailSide, entryRailSideRight, entryRailFront].forEach((rail) => {
    rail.castShadow = rail.receiveShadow = true;
    group.add(rail);
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

  // loader para texturas externas
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setPath('assets/app/textures/');
  const loadTexture = (
    file: string,
    repeatX = 1,
    repeatY = 1,
    wrap: THREE.Wrapping = THREE.RepeatWrapping
  ) => {
    const tex = textureLoader.load(file);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = wrap;
    tex.anisotropy = 8;
    tex.repeat.set(repeatX, repeatY);
    return tex;
  };
  const cranePaintTexture = loadTexture('crane_yellow.png', 3.5, 1.8);
  const cabPaintTexture = loadTexture('cab_paint.png', 2.4, 1.6);
  const cabBrushedTexture = loadTexture('cab_brushed.png', 2.6, 1.8);
  const canopyPaintTexture = loadTexture('cab_paint.png', 3.2, 1.2);
  const doorPaintTexture = loadTexture('door_paint.png', 1.8, 1.8);
  const glassTexture = loadTexture('glass_opal.png', 1, 1, THREE.ClampToEdgeWrapping);
  // textura para degraus/chapas de piso (usar asset existente)
  const checkerPlateTexture = new THREE.TextureLoader().load('assets/textures/stairs.png');
  checkerPlateTexture.colorSpace = THREE.SRGBColorSpace;
  checkerPlateTexture.wrapS = checkerPlateTexture.wrapT = THREE.RepeatWrapping;
  checkerPlateTexture.anisotropy = 8;
  checkerPlateTexture.repeat.set(6, 6);

  // materiais aproximados à foto
  const orange = new THREE.MeshStandardMaterial({
    color: 0xf2c53d,
    metalness: 0.45,
    roughness: 0.38,
    map: cranePaintTexture,
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
    map: glassTexture,
  });
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x151a20,
    metalness: 0.85,
    roughness: 0.3,
  });

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

  // =============================================================
  // Helper: torre de escadas quadrada com corrimão + estrutura
  // =============================================================
  type StairTowerOpts = {
    center: THREE.Vector3;
    side: number;
    baseY: number;
    totalHeight: number;
    stepRise: number;
    treadDepth: number;
    stairWidth: number;
    stepMat: THREE.Material;
    railMat: THREE.Material;
    frameMat: THREE.Material;
  };

  function buildSquareStairTower(opts: StairTowerOpts): {
    group: THREE.Group;
    topCenter: THREE.Vector3;
    topY: number;
  } {
    const {
      center,
      side,
      baseY,
      totalHeight,
      stepRise,
      treadDepth,
      stairWidth,
      stepMat,
      railMat,
      frameMat,
    } = opts;

    const group = new THREE.Group();
    group.name = 'SquareSpiralStairTower';

    const stepThickness = 0.28;
    const railHeight = 1.0;

    // quantos degraus cabem na altura total
    const stepCount = Math.max(1, Math.floor(totalHeight / stepRise));
    // quantos degraus por lado (4 lados do quadrado)
    const stepsPerSide = Math.max(3, Math.floor(stepCount / 4));

    const half = side / 2 - stairWidth * 0.3;

    // cantos do quadrado em coordenadas locais (relativas ao center)
    const corners = [
      new THREE.Vector3(-half, 0, -half), // 0: frente esquerda (Z-)
      new THREE.Vector3( half, 0, -half), // 1: frente direita
      new THREE.Vector3( half, 0,  half), // 2: trás direita (Z+)
      new THREE.Vector3(-half, 0,  half), // 3: trás esquerda
    ];

    const stepGeo = new THREE.BoxGeometry(stairWidth, stepThickness, treadDepth);

    // pontos do corrimão (topo dos postes) para depois ligar com rectBeamBetween
    const railPointsPerSide: THREE.Vector3[][] = [[], [], [], []];

    let lastStepWorld = new THREE.Vector3();

    for (let i = 0; i < stepCount; i++) {
      const sideIndex = Math.floor(i / stepsPerSide) % 4;
      const tOnSide = (i % stepsPerSide) / stepsPerSide;

      const a = corners[sideIndex];
      const b = corners[(sideIndex + 1) % 4];

      const pxLocal = THREE.MathUtils.lerp(a.x, b.x, tOnSide);
      const pzLocal = THREE.MathUtils.lerp(a.z, b.z, tOnSide);
      const py = baseY + i * stepRise + stepThickness / 2;

      const step = new THREE.Mesh(stepGeo, stepMat);

      // rodar o degrau conforme o lado (para alinhar com a direcção da marcha)
      switch (sideIndex) {
        case 0: // frente (Z-), caminhamos em +X
          step.rotation.y = Math.PI / 2;
          break;
        case 2: // trás (Z+), caminhamos em -X
          step.rotation.y = -Math.PI / 2;
          break;
        default: // lados, caminhar em ±Z
          step.rotation.y = 0;
      }

      step.position.set(center.x + pxLocal, py, center.z + pzLocal);
      step.castShadow = step.receiveShadow = true;
      group.add(step);

      // offset para o lado "de fora" da torre (normal ao lado)
      let railX = pxLocal;
      let railZ = pzLocal;
      const railOffset = stairWidth * 0.55;

      if (sideIndex === 0) railZ -= railOffset;       // frente, Z-
      else if (sideIndex === 1) railX += railOffset;  // direita, X+
      else if (sideIndex === 2) railZ += railOffset;  // trás, Z+
      else if (sideIndex === 3) railX -= railOffset;  // esquerda, X-

      const postHeight = railHeight;
      const postGeo = new THREE.BoxGeometry(0.18, postHeight, 0.18);
      const post = new THREE.Mesh(postGeo, railMat);
      const postWorld = new THREE.Vector3(
        center.x + railX,
        py + postHeight / 2,
        center.z + railZ
      );
      post.position.copy(postWorld);
      post.castShadow = post.receiveShadow = true;
      group.add(post);

      // guardar ponto do topo do poste para depois fazer corrimão contínuo
      const railTop = postWorld.clone();
      railTop.y += postHeight * 0.4;
      railPointsPerSide[sideIndex].push(railTop);

      // guardar posição do último degrau para a ponte de acesso
      lastStepWorld.set(center.x + pxLocal, py + postHeight, center.z + pzLocal);
    }

    // corrimão horizontal em cada lado, ligando postes consecutivos
    for (let sideIndex = 0; sideIndex < 4; sideIndex++) {
      const pts = railPointsPerSide[sideIndex];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        group.add(rectBeamBetween(a, b, 0.16, 0.16, railMat));
      }
    }

    // estrutura exterior da torre: 4 colunas + anéis horizontais
    const frameHalf = side / 2 + 0.8;
    const frameBottomY = baseY;
    const frameTopY = baseY + stepCount * stepRise + 1.5;
    const frameHeight = frameTopY - frameBottomY;

    const cornerOffsets: [number, number][] = [
      [-frameHalf, -frameHalf],
      [ frameHalf, -frameHalf],
      [ frameHalf,  frameHalf],
      [-frameHalf,  frameHalf],
    ];

    const framePostGeo = new THREE.BoxGeometry(0.28, frameHeight, 0.28);
    const frameCorners: THREE.Vector3[] = [];

    cornerOffsets.forEach(([ox, oz]) => {
      const post = new THREE.Mesh(framePostGeo, frameMat);
      post.position.set(
        center.x + ox,
        frameBottomY + frameHeight / 2,
        center.z + oz
      );
      post.castShadow = post.receiveShadow = true;
      group.add(post);
      frameCorners.push(
        new THREE.Vector3(post.position.x, frameBottomY, post.position.z),
        new THREE.Vector3(post.position.x, frameTopY, post.position.z)
      );
    });

    // anéis horizontais em vários níveis
    const ringLevels = 4;
    for (let i = 0; i <= ringLevels; i++) {
      const y =
        frameBottomY + (i * (frameTopY - frameBottomY)) / ringLevels;
      const cFL = new THREE.Vector3(center.x - frameHalf, y, center.z - frameHalf);
      const cFR = new THREE.Vector3(center.x + frameHalf, y, center.z - frameHalf);
      const cBR = new THREE.Vector3(center.x + frameHalf, y, center.z + frameHalf);
      const cBL = new THREE.Vector3(center.x - frameHalf, y, center.z + frameHalf);

      group.add(
        rectBeamBetween(cFL, cFR, 0.24, 0.24, frameMat),
        rectBeamBetween(cFR, cBR, 0.24, 0.24, frameMat),
        rectBeamBetween(cBR, cBL, 0.24, 0.24, frameMat),
        rectBeamBetween(cBL, cFL, 0.24, 0.24, frameMat)
      );
    }

    return {
      group,
      topCenter: lastStepWorld.clone(),
      topY: frameTopY,
    };
  }

  // =============================================================
  // Helper: escada em zig-zag (switchback) encostada ao pilar
  // =============================================================
  function buildZigZagStairTower(params: {
    originX: number;
    originZ: number;
    baseY: number;
    totalHeight: number;
    stairWidth: number;
    stepRise: number;
    stepRun: number;
    landingDepth: number;
    stepMat: THREE.Material;
    railMat: THREE.Material;
    frameMat: THREE.Material;
  }): { group: THREE.Group; topCenter: THREE.Vector3; bounds: {minZ:number; maxZ:number} } {
    const { originX, originZ, baseY, totalHeight, stairWidth, stepRise, stepRun, landingDepth, stepMat, railMat, frameMat } = params;
    const g = new THREE.Group(); g.name = 'ZigZagStairTower';

    const stepsPerFlight = 8;
    const flightHeight = stepsPerFlight * stepRise;
    const flights = Math.max(1, Math.ceil(totalHeight / flightHeight));

    let curY = baseY;
    let curZ = originZ;
    let dir: 1 | -1 = 1; // primeiro lanço para Z+
    let minZ = originZ, maxZ = originZ;
    const stepThickness = stepRise; // visual

    for (let f = 0; f < flights; f++) {
      const remaining = totalHeight - (curY - baseY);
      const stepsThis = f === flights - 1 ? Math.max(1, Math.ceil(remaining / stepRise)) : stepsPerFlight;
      // degraus
      for (let i = 0; i < stepsThis; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(stairWidth, stepThickness, stepRun), stepMat);
        step.position.set(originX, curY + stepRise * (i + 0.5), curZ + dir * stepRun * (i + 0.5));
        step.castShadow = step.receiveShadow = true;
        g.add(step);
      }
      // corrimões simples em ambos os lados do lanço
      const railOffset = stairWidth/2 + 0.25;
      const start = new THREE.Vector3(originX, curY + stepRise * 0.5 + 0.6, curZ + dir * stepRun * 0.5);
      const end = new THREE.Vector3(originX, curY + stepsThis * stepRise - stepRise * 0.5 + 0.6, curZ + dir * (stepsThis * stepRun - stepRun * 0.5));
      g.add(
        rectBeamBetween(new THREE.Vector3(originX - railOffset, start.y, start.z), new THREE.Vector3(originX - railOffset, end.y, end.z), 0.16, 0.16, railMat),
        rectBeamBetween(new THREE.Vector3(originX + railOffset, start.y, start.z), new THREE.Vector3(originX + railOffset, end.y, end.z), 0.16, 0.16, railMat)
      );

      curY += stepsThis * stepRise;
      curZ += dir * stepsThis * stepRun;
      minZ = Math.min(minZ, curZ); maxZ = Math.max(maxZ, curZ);

      if (f < flights - 1) {
        const land = new THREE.Mesh(new THREE.BoxGeometry(stairWidth + 1.2, 0.3, landingDepth), stepMat);
        land.position.set(originX, curY - 0.15, curZ + dir * (landingDepth / 2));
        land.castShadow = land.receiveShadow = true; g.add(land);
        // guarda frontal do patamar
        g.add(rectBeamBetween(
          new THREE.Vector3(originX - (stairWidth/2), land.position.y + 0.8, land.position.z + dir * (landingDepth/2)),
          new THREE.Vector3(originX + (stairWidth/2), land.position.y + 0.8, land.position.z + dir * (landingDepth/2)),
          0.16, 0.16, railMat
        ));
        curZ += dir * landingDepth; minZ = Math.min(minZ, curZ); maxZ = Math.max(maxZ, curZ);
        dir = dir === 1 ? -1 : 1;
      }
    }

    // armação exterior simples
    const frameMinX = originX - (stairWidth/2) - 0.8;
    const frameMaxX = originX + (stairWidth/2) + 0.8;
    const frameMinZ = minZ - 0.8; const frameMaxZ = maxZ + 0.8;
    const frameHeight = totalHeight + 1.2; const frameBottomY = baseY;
    const postGeo = new THREE.BoxGeometry(0.28, frameHeight, 0.28);
    const posts = [
      new THREE.Vector3(frameMinX, frameBottomY + frameHeight/2, frameMinZ),
      new THREE.Vector3(frameMaxX, frameBottomY + frameHeight/2, frameMinZ),
      new THREE.Vector3(frameMinX, frameBottomY + frameHeight/2, frameMaxZ),
      new THREE.Vector3(frameMaxX, frameBottomY + frameHeight/2, frameMaxZ),
    ];
    posts.forEach(p => { const m = new THREE.Mesh(postGeo, frameMat); m.position.copy(p); m.castShadow = m.receiveShadow = true; g.add(m); });
    const rings = 3;
    for (let i=0;i<=rings;i++){
      const y = frameBottomY + (i * frameHeight)/rings - frameHeight/2 + (frameBottomY + frameHeight/2);
      g.add(
        rectBeamBetween(new THREE.Vector3(frameMinX, y, frameMinZ), new THREE.Vector3(frameMaxX, y, frameMinZ), 0.24, 0.24, frameMat),
        rectBeamBetween(new THREE.Vector3(frameMaxX, y, frameMinZ), new THREE.Vector3(frameMaxX, y, frameMaxZ), 0.24, 0.24, frameMat),
        rectBeamBetween(new THREE.Vector3(frameMaxX, y, frameMaxZ), new THREE.Vector3(frameMinX, y, frameMaxZ), 0.24, 0.24, frameMat),
        rectBeamBetween(new THREE.Vector3(frameMinX, y, frameMaxZ), new THREE.Vector3(frameMinX, y, frameMinZ), 0.24, 0.24, frameMat)
      );
    }

    return { group: g, topCenter: new THREE.Vector3(originX, baseY + totalHeight, curZ), bounds: {minZ, maxZ} };
  }

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
  // Redimensionar cabine para proporção mais humana (antes 26 x 14 x 18)
  // Novo alvo ~ (18 x 11 x 14) metros assumindo 1 unidade = 1 m.
  const cabW = 18, cabH = 11, cabD = 14;
  const cabBodyMat = new THREE.MeshStandardMaterial({
    color: 0xd9dbdf,
    metalness: 0.65,
    roughness: 0.3,
    map: cabBrushedTexture,
  });
  const cabPaintMat = new THREE.MeshStandardMaterial({
    color: 0xf1bd20,
    metalness: 0.4,
    roughness: 0.5,
    map: cabPaintTexture,
  });
  const operatorCab = new THREE.Group();
  const cabBody = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabD), cabBodyMat);
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
  // remover a "tampa" frontal (painel superior inclinado)
  operatorCab.add(winSeaward, winDown, winLeft, winRight);

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
    map: doorPaintTexture,
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

  // Telhado com módulos detalhados e passadiço técnico
  const canopyGroup = new THREE.Group();
  const canopyBaseY = cabH / 2 + 0.3;
  const podHeight = 1.2;
  const podSpacingX = cabW / 2 - 3.0;
  const podLength = cabD + 6;
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xb47e1a, metalness: 0.55, roughness: 0.35 });
  const roofWalkwayMat = new THREE.MeshStandardMaterial({ color: 0xcbd4dd, metalness: 0.3, roughness: 0.55 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xf7f9fc, metalness: 0.2, roughness: 0.4 });
  const ventMat = new THREE.MeshStandardMaterial({ color: 0xbac3cc, metalness: 0.65, roughness: 0.3 });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xfff5c3,
    emissive: 0xffb347,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.85,
  });

  const buildCanopyPod = (sign: number) => {
    const pod = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.6, podHeight, podLength), cabPaintMat);
    base.position.set(0, podHeight / 2, 0);
    base.castShadow = base.receiveShadow = true;
    pod.add(base);

    const capLayers = 3;
    for (let i = 0; i < capLayers; i++) {
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(4.2 - i * 0.9, 0.2, podLength - 1.2),
        cabPaintMat
      );
      cap.position.set(0, podHeight + 0.2 + i * 0.2, 0);
      cap.castShadow = cap.receiveShadow = true;
      pod.add(cap);
    }

    const ribSegments = 5;
    for (let i = 0; i <= ribSegments; i++) {
      const z = -podLength / 2 + (i * podLength) / ribSegments;
      const sideRibL = rectBeamBetween(
        new THREE.Vector3(-2.4, podHeight * 0.1, z),
        new THREE.Vector3(-2.4, podHeight + 0.45, z),
        0.25,
        0.25,
        ribMat
      );
      const sideRibR = rectBeamBetween(
        new THREE.Vector3(2.4, podHeight * 0.1, z),
        new THREE.Vector3(2.4, podHeight + 0.45, z),
        0.25,
        0.25,
        ribMat
      );
      pod.add(sideRibL, sideRibR);
    }

    const endBraceFront = rectBeamBetween(
      new THREE.Vector3(-2.2, podHeight * 0.1, -podLength / 2 + 0.4),
      new THREE.Vector3(2.2, podHeight + 0.5, -podLength / 2 + 0.4),
      0.35,
      0.35,
      ribMat
    );
    const endBraceBack = rectBeamBetween(
      new THREE.Vector3(2.2, podHeight * 0.1, podLength / 2 - 0.4),
      new THREE.Vector3(-2.2, podHeight + 0.5, podLength / 2 - 0.4),
      0.35,
      0.35,
      ribMat
    );
    pod.add(endBraceFront, endBraceBack);
    pod.position.set(sign * podSpacingX, canopyBaseY, 0);
    canopyGroup.add(pod);
  };
  buildCanopyPod(-1);
  buildCanopyPod(1);

  const canopySkin = new THREE.Mesh(
    new THREE.BoxGeometry(podSpacingX * 2 - 1, 0.25, podLength + 2),
    cabPaintMat
  );
  canopySkin.position.set(0, canopyBaseY + podHeight * 0.55, 0);
  canopySkin.rotation.x = THREE.MathUtils.degToRad(3);
  canopySkin.castShadow = canopySkin.receiveShadow = true;
  canopyGroup.add(canopySkin);

  const braceZs = [-podLength / 2 + 1.2, podLength / 2 - 1.2];
  braceZs.forEach((z) => {
    canopyGroup.add(
      rectBeamBetween(
        new THREE.Vector3(-podSpacingX, canopyBaseY + podHeight * 0.2, z),
        new THREE.Vector3(podSpacingX, canopyBaseY + podHeight * 0.2, z),
        0.45,
        0.45,
        ribMat
      )
    );
  });

  const walkwayY = canopyBaseY + podHeight + 0.9;
  const walkwayLength = podLength - 4;
  const walkwayWidth = podSpacingX * 2 - 3.2;
  const walkwayHalfW = walkwayWidth / 2;
  const walkwayHalfL = walkwayLength / 2;
  const walkwayDeck = new THREE.Mesh(new THREE.BoxGeometry(walkwayWidth, 0.25, walkwayLength), roofWalkwayMat);
  walkwayDeck.position.set(0, walkwayY, 0);
  walkwayDeck.castShadow = walkwayDeck.receiveShadow = true;
  canopyGroup.add(walkwayDeck);

  [-walkwayHalfL, walkwayHalfL].forEach((z) => {
    canopyGroup.add(
      rectBeamBetween(
        new THREE.Vector3(-podSpacingX + 0.3, canopyBaseY + podHeight * 0.8, z),
        new THREE.Vector3(-walkwayHalfW, walkwayY, z),
        0.3,
        0.3,
        ribMat
      ),
      rectBeamBetween(
        new THREE.Vector3(podSpacingX - 0.3, canopyBaseY + podHeight * 0.8, z),
        new THREE.Vector3(walkwayHalfW, walkwayY, z),
        0.3,
        0.3,
        ribMat
      )
    );
  });

  const addRail = (a: THREE.Vector3, b: THREE.Vector3) =>
    canopyGroup.add(rectBeamBetween(a, b, 0.18, 0.18, railMat));
  const postPositions = 4;
  for (let i = 0; i <= postPositions; i++) {
    const z = -walkwayHalfL + (i * walkwayLength) / postPositions;
    canopyGroup.add(
      rectBeamBetween(
        new THREE.Vector3(-walkwayHalfW, walkwayY, z),
        new THREE.Vector3(-walkwayHalfW, walkwayY + 1.2, z),
        0.18,
        0.18,
        railMat
      ),
      rectBeamBetween(
        new THREE.Vector3(walkwayHalfW, walkwayY, z),
        new THREE.Vector3(walkwayHalfW, walkwayY + 1.2, z),
        0.18,
        0.18,
        railMat
      )
    );
  }
  addRail(
    new THREE.Vector3(-walkwayHalfW, walkwayY + 1.2, -walkwayHalfL),
    new THREE.Vector3(-walkwayHalfW, walkwayY + 1.2, walkwayHalfL)
  );
  addRail(
    new THREE.Vector3(walkwayHalfW, walkwayY + 1.2, -walkwayHalfL),
    new THREE.Vector3(walkwayHalfW, walkwayY + 1.2, walkwayHalfL)
  );
  addRail(
    new THREE.Vector3(-walkwayHalfW, walkwayY + 1.2, -walkwayHalfL),
    new THREE.Vector3(walkwayHalfW, walkwayY + 1.2, -walkwayHalfL)
  );
  addRail(
    new THREE.Vector3(-walkwayHalfW, walkwayY + 1.2, walkwayHalfL),
    new THREE.Vector3(walkwayHalfW, walkwayY + 1.2, walkwayHalfL)
  );

  const ventOffsets = [-walkwayHalfL + 2, 0, walkwayHalfL - 2];
  ventOffsets.forEach((z) => {
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 24), ventMat);
    vent.position.set(0, walkwayY + 0.8, z);
    vent.castShadow = vent.receiveShadow = true;
    const ventCap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 24), ventMat);
    ventCap.position.set(0, walkwayY + 1.5, z);
    canopyGroup.add(vent, ventCap);
  });

  const beaconOffsetsX = [-walkwayHalfW + 0.5, walkwayHalfW - 0.5];
  const beaconOffsetsZ = [-walkwayHalfL + 0.7, walkwayHalfL - 0.7];
  beaconOffsetsX.forEach((x) => {
    beaconOffsetsZ.forEach((z) => {
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 14), beaconMat);
      beacon.position.set(x, walkwayY + 1.4, z);
      beacon.castShadow = true as any;
      canopyGroup.add(beacon);
    });
  });

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

  // === Torre de escadas quadrada tipo porto (substitui a escada vertical) ===
  const stairStepMat = new THREE.MeshStandardMaterial({
    color: 0xbfc6cf,
    metalness: 0.5,
    roughness: 0.45,
    map: checkerPlateTexture,
  });
  const stairRailMat = new THREE.MeshStandardMaterial({
    color: 0xf5f6f7,
    metalness: 0.35,
    roughness: 0.45,
  });
  const stairFrameMat = new THREE.MeshStandardMaterial({
    color: 0xe2e6ee,
    metalness: 0.4,
    roughness: 0.5,
  });

  // nível do piso à frente da porta da cabine
  const entryLevelY = slewGroup.position.y + operatorCab.position.y;

  // centro da torre de escadas: encostada ao pilar direito do portal
  const stairCenter = new THREE.Vector3(
    halfGauge + 7, // mesmo ao lado da perna direita
    0,
    0              // a meio em Z
  );

  // altura útil da torre: praticamente até ao nível de entrada da cabina
  const targetTowerHeight = entryLevelY - 1.0;

  const stairTower = buildZigZagStairTower({
    originX: stairCenter.x,
    originZ: stairCenter.z,
    baseY: 0,
    totalHeight: targetTowerHeight,
    stairWidth: 1.4,
    stepRise: 0.55,
    stepRun: 1.25,
    landingDepth: 2.4,
    stepMat: stairStepMat,
    railMat: stairRailMat,
    frameMat: stairFrameMat,
  });
  group.add(stairTower.group);

  const topPlat = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 4.2), stairStepMat);
  // Encosta exactamente ao nível da porta da cabine
  topPlat.position.set(stairTower.topCenter.x, entryLevelY, stairTower.topCenter.z);
  topPlat.castShadow = topPlat.receiveShadow = true;
  group.add(topPlat);

  const bridgeWalkwayMat = new THREE.MeshStandardMaterial({
    color: 0xc2ccd8,
    metalness: 0.35,
    roughness: 0.6,
  });
  const guardMat = stairRailMat;
  // Com torre mais próxima, a plataforma já quase toca na porta.
  // Criar um passadiço curto robusto (ou zero gap se estiver colado).
  const bridgeStart = new THREE.Vector3(topPlat.position.x, topPlat.position.y + 0.05, topPlat.position.z);
  const bridgeEnd = new THREE.Vector3(operatorCab.position.x + cabW / 2, bridgeStart.y, operatorCab.position.z);
  const bridgeSpan = bridgeEnd.clone().sub(bridgeStart).length();
  if (bridgeSpan > 0.6) { // só se ainda houver distância relevante
    const bridgeWidth = 1.8;
    const bridgeDeck = rectBeamBetween(bridgeStart, bridgeEnd, bridgeWidth, 0.35, bridgeWalkwayMat);
    group.add(bridgeDeck);
    const railYOffset = 0.85;
    const railHalfW = bridgeWidth / 2 - 0.12;
    group.add(
      rectBeamBetween(
        new THREE.Vector3(bridgeStart.x, bridgeStart.y + railYOffset, bridgeStart.z - railHalfW),
        new THREE.Vector3(bridgeEnd.x, bridgeEnd.y + railYOffset, bridgeEnd.z - railHalfW),
        0.18, 0.18, guardMat
      ),
      rectBeamBetween(
        new THREE.Vector3(bridgeStart.x, bridgeStart.y + railYOffset, bridgeStart.z + railHalfW),
        new THREE.Vector3(bridgeEnd.x, bridgeEnd.y + railYOffset, bridgeEnd.z + railHalfW),
        0.18, 0.18, guardMat
      )
    );
  }

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
