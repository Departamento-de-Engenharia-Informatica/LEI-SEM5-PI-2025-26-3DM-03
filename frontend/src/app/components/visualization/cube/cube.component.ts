import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-cube',
  standalone: true,
  imports: [],
  templateUrl: './cube.component.html',
  styleUrls: ['./cube.component.scss'],
})
export class Cube implements AfterViewInit {
  @ViewChild('myCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  // Propriedades
  @Input() public rotationSpeedX: number = 0.05; // velocidade da ondulação
  @Input() public rotationSpeedY: number = 0.01; // não uso aqui mas fica se precisares
  @Input() public size: number = 200;

  @Input() public cameraZ: number = 14;
  @Input() public fieldOfView: number = 30;
  @Input('nearClipping') public nearClippingPane: number = 1;
  @Input('farClipping') public farClippingPane: number = 1000;

  controls!: OrbitControls;

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  private loader = new THREE.TextureLoader();
  private ship!: THREE.Group;
  private ocean!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private renderer!: THREE.WebGLRenderer;
  private scene: THREE.Scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private wavePhase = 0;

  private getAspectRatio(): number {
    return this.canvas.clientWidth / this.canvas.clientHeight;
  }

  // ================= SCENE / CAMERA / RENDERER =====================
  private createScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 40, 150);

    this.ship = this.buildShip();
    this.ship.scale.setScalar(this.size / 200);
    this.scene.add(this.ship);

    this.ocean = this.buildOcean();
    this.scene.add(this.ocean);

    this.addLights();

    const aspectRatio = this.getAspectRatio();
    this.camera = new THREE.PerspectiveCamera(
      this.fieldOfView,
      aspectRatio,
      this.nearClippingPane,
      this.farClippingPane,
    );
    this.camera.position.set(8, 6, this.cameraZ);
    this.camera.lookAt(0, 0.8, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);

    // Versões novas do three.js
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 30;
    this.controls.target.set(0, 0.8, 0);
    this.controls.update();
  }

  private addLights(): void {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x24527a, 1.2);
    hemiLight.position.set(0, 20, 0);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
    sunLight.position.set(12, 18, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 80;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);

    this.scene.add(hemiLight, sunLight, ambientLight);
  }

  // ===================== SHIP =====================================
// ===================== SHIP =====================================
private buildShip(): THREE.Group {
  const group = new THREE.Group();

  // --- medidas base do navio ---
  const hullLength = 12.3;
  const hullWidth = 3.8;
  const hullHeight = 1.4;  // altura total do casco
  const waterlineHeight = 0.55; // divisão entre parte submersa e parte exposta
  const deckLength = 7.2;
  const deckWidth = 2.4;

  // ============================================================
  // CASCO CURVO (Shape + Extrude) — dois materiais (topo e fundo)
  // ============================================================

  const halfL = hullLength / 2;
  const halfW = hullWidth / 2;
  const rounded = 2.0;

  const hullShape = new THREE.Shape();
  hullShape.moveTo(-halfL + rounded, -halfW);
  hullShape.lineTo(halfL - rounded, -halfW);
  hullShape.quadraticCurveTo(halfL + rounded, 0, halfL - rounded, halfW);
  hullShape.lineTo(-halfL + rounded, halfW);
  hullShape.quadraticCurveTo(-halfL - rounded, 0, -halfL + rounded, -halfW);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: hullHeight,
    bevelEnabled: false,
  };

  const hullGeometry = new THREE.ExtrudeGeometry(hullShape, extrudeSettings);
  hullGeometry.rotateX(-Math.PI / 2);
  hullGeometry.translate(0, -hullHeight, 0);

  // Divisão entre parte submersa e parte exposta
  const upperColor = new THREE.MeshStandardMaterial({
    color: 0xFF0000, // vermelho — acima da água
    metalness: 0.35,
    roughness: 0.65,
  });

  const lowerColor = new THREE.MeshStandardMaterial({
    color: 0x000000, // preto — submerso
    metalness: 0.45,
    roughness: 0.55,
  });

  // Geo fica duplicado mas com clipping planes
  const upperHull = new THREE.Mesh(hullGeometry, upperColor);
  upperHull.castShadow = true;
  upperHull.receiveShadow = true;
  upperHull.material.clippingPlanes = [
    new THREE.Plane(new THREE.Vector3(0, -1, 0), waterlineHeight)
  ];
  upperHull.material.clipShadows = true;

  const lowerHull = new THREE.Mesh(hullGeometry, lowerColor);
  lowerHull.castShadow = true;
  lowerHull.receiveShadow = true;
  lowerHull.material.clippingPlanes = [
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -(waterlineHeight))
  ];
  lowerHull.material.clipShadows = true;

  group.add(lowerHull, upperHull);

  // ============================================================
  // CONVÉS
  // ============================================================

  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b4a5a,
    metalness: 0.25,
    roughness: 0.8,
  });

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(deckLength, 0.35, deckWidth),
    deckMaterial,
  );

  const deckTopY = 0.25 + 0.35 / 2; // topo exato do convés
  deck.position.set(0.8, 0.25, 0);

  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // ============================================================
  // CABINE (agora encostada ao convés, sem flutuar)
  // ============================================================

  const bridgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8f8ff,
    metalness: 0.1,
    roughness: 0.85,
  });

  const bridgeHeight = 1.4;
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, bridgeHeight, 2.0),
    bridgeMaterial,
  );

  bridge.position.set(
    -hullLength / 2 + 2.2,
    deckTopY + bridgeHeight / 2,   // TOCA NO CONVÉS ❤
    0
  );

  bridge.castShadow = true;
  bridge.receiveShadow = true;
  group.add(bridge);

  const bridgeTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.2, 2.1),
    new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.5,
      metalness: 0.4,
    }),
  );

  bridgeTop.position.set(
    bridge.position.x,
    bridge.position.y + bridgeHeight / 2 + 0.1,
    0
  );

  bridgeTop.castShadow = true;
  bridgeTop.receiveShadow = true;
  group.add(bridgeTop);

  // Janelas
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x9fd4ff,
    metalness: 0.1,
    roughness: 0.1,
  });

  const wGeo = new THREE.BoxGeometry(0.4, 0.4, 0.02);

  for (let i = -1; i <= 1; i++) {
    const w = new THREE.Mesh(wGeo, windowMaterial);
    w.position.set(
      bridge.position.x - 1.15,
      bridge.position.y,
      i * 0.55,
    );
    w.castShadow = true;
    group.add(w);
  }

  // Chaminé
  const funnel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.38, 1.0, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.5,
      roughness: 0.35,
    }),
  );

  funnel.position.set(
    bridge.position.x + 0.15,
    bridgeTop.position.y + 0.6,
    -0.35,
  );

  funnel.castShadow = true;
  group.add(funnel);

  // ============================================================
  // GRUA
  // ============================================================
  const craneMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4a460,
    metalness: 0.4,
    roughness: 0.6,
  });

  const craneBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    craneMaterial,
  );
  craneBase.position.set(3.4, 0.6, -deckWidth / 2 + 0.2);
  craneBase.castShadow = true;
  craneBase.receiveShadow = true;
  group.add(craneBase);

  const craneArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 1.6, 0.25),
    craneMaterial,
  );
  craneArm.position.set(3.4, 1.5, -deckWidth / 2 + 0.2);
  craneArm.rotation.z = -Math.PI / 6;
  craneArm.castShadow = true;
  craneArm.receiveShadow = true;
  group.add(craneArm);

  const craneCable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8),
    new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.4,
      metalness: 0.1,
    }),
  );
  craneCable.position.set(4.2, 1.0, -deckWidth / 2 + 0.2);
  craneCable.castShadow = true;
  craneCable.receiveShadow = true;
  group.add(craneCable);

  const spreader = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.08, 0.5),
    craneMaterial,
  );
  spreader.position.set(4.2, 0.5, -deckWidth / 2 + 0.2);
  spreader.castShadow = true;
  spreader.receiveShadow = true;
  group.add(spreader);

  // ============================================================
  // CONTENTORES (3 colunas, dentro das bordas)
  // ============================================================
  const containerColors = [
    0x1f77b4,
    0xff7f0e,
    0x2ca02c,
    0xd62728,
    0x9467bd,
    0x8c564b,
  ];

  const createContainer = (
    x: number,
    y: number,
    z: number,
    color: number,
  ) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.4,
      roughness: 0.55,
    });
    const container = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.6, 0.9),
      material,
    );
    container.position.set(x, y, z);
    container.castShadow = true;
    container.receiveShadow = true;
    return container;
  };

  const rows = [-1.0, 0, 1.0];
  const baseXStart = 0;
  const stepX = 1.8;
  const columns = 3;

  rows.forEach((z, rowIdx) => {
    for (let col = 0; col < columns; col++) {
      const baseX = baseXStart + col * stepX;
      const height = col === 1 ? 3 : 2;
      for (let level = 0; level < height; level++) {
        const color =
          containerColors[(col + level + rowIdx) % containerColors.length];
        const box = createContainer(
          baseX,
          0.55 + level * 0.63,
          z,
          color,
        );
        group.add(box);
      }
    }
  });

  // ============================================================
  // BORDAS (muretes) no limite do casco
  // ============================================================
  const bulwarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x22333b,
    metalness: 0.2,
    roughness: 0.8,
  });

  const sideWallHeight = 0.35;
  const wallThickness = 0.08;

  const sideWallLength = deckLength;
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(sideWallLength, sideWallHeight, wallThickness),
    bulwarkMaterial,
  );
  leftWall.position.set(
    deck.position.x,
    0.6,
    hullWidth / 2 - wallThickness / 2,
  );
  leftWall.castShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(sideWallLength, sideWallHeight, wallThickness),
    bulwarkMaterial,
  );
  rightWall.position.set(
    deck.position.x,
    0.6,
    -hullWidth / 2 + wallThickness / 2,
  );
  rightWall.castShadow = true;
  group.add(rightWall);

  const frontBackWidth = hullWidth - 2 * wallThickness;

  const frontWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, sideWallHeight, frontBackWidth),
    bulwarkMaterial,
  );
  frontWall.position.set(
    deck.position.x + deckLength / 2 - wallThickness / 2,
    0.6,
    0,
  );
  frontWall.castShadow = true;
  group.add(frontWall);

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, sideWallHeight, frontBackWidth),
    bulwarkMaterial,
  );
  backWall.position.set(
    deck.position.x - deckLength / 2 + wallThickness / 2,
    0.6,
    0,
  );
  backWall.castShadow = true;
  group.add(backWall);

  group.position.y = 0.12;
  return group;
}



  // ===================== OCEAN ====================================
  private buildOcean(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> {
    // Normal map opcional – se não tiveres a textura, podes tirar este bloco
    let waterNormal: THREE.Texture | null = null;
    try {
      waterNormal = this.loader.load('assets/textures/water_normal.jpg');
      waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;
      waterNormal.repeat.set(6, 6);
    } catch {
      waterNormal = null;
    }

    const oceanGeometry = new THREE.PlaneGeometry(120, 120, 80, 80);
    const oceanMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f6ed4,
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: 0.97,
      normalMap: waterNormal || undefined,
      normalScale: waterNormal ? new THREE.Vector2(0.7, 0.35) : undefined,
    });

    const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.4;
    ocean.receiveShadow = true;

    return ocean;
  }

  // ===================== ANIMAÇÃO =================================
  private animateShip() {
    this.wavePhase += this.rotationSpeedX * 0.6;

    const bob = Math.sin(this.wavePhase) * 0.07;
    const roll = Math.sin(this.wavePhase * 0.8) * 0.045;
    const pitch = Math.cos(this.wavePhase * 0.6) * 0.03;

    this.ship.position.y = 0.3 + bob;
    this.ship.rotation.z = roll;
    this.ship.rotation.x = pitch;

    // Ondas do mar
    if (this.ocean) {
      const geo = this.ocean.geometry;
      const pos = geo.attributes['position'] as THREE.BufferAttribute;

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);

        const wave1 = Math.sin(x * 0.15 + this.wavePhase * 1.2);
        const wave2 = Math.cos(y * 0.18 + this.wavePhase * 0.8);
        const height = (wave1 + wave2) * 0.12;

        pos.setZ(i, height);
      }

      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }
  }

  private render() {
    requestAnimationFrame(() => this.render());
    this.animateShip();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  ngAfterViewInit(): void {
    this.createScene();
    this.render();
  }
}
