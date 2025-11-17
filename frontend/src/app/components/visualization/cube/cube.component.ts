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
  @Input() public rotationSpeedY: number = 0.01;
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
    (this.renderer as any).outputColorSpace = THREE.SRGBColorSpace;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.localClippingEnabled = true;



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

  // ===================== SHIP (novo) =====================================
private buildShip(): THREE.Group {
  const group = new THREE.Group();

  // ---------- TEXTURAS ----------
  const hullDiffuseTex = this.loader.load('assets/textures/hull_diffuse.jpg');
  hullDiffuseTex.wrapS = hullDiffuseTex.wrapT = THREE.RepeatWrapping;
  hullDiffuseTex.repeat.set(4, 1); // alonga no comprimento

  const hullLowerTex = this.loader.load('assets/textures/hull_lower.jpg');
  hullLowerTex.wrapS = hullLowerTex.wrapT = THREE.RepeatWrapping;
  hullLowerTex.repeat.set(4, 1);

  const deckTex = this.loader.load('assets/textures/deck_metal.jpg');
  deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping;
  deckTex.repeat.set(6, 2);

  const bridgeTex = this.loader.load('assets/textures/bridge_smooth.jpg');
  bridgeTex.wrapS = bridgeTex.wrapT = THREE.RepeatWrapping;

  const containerTex = this.loader.load('assets/textures/container_ridges.jpg');
  containerTex.wrapS = containerTex.wrapT = THREE.RepeatWrapping;
  containerTex.repeat.set(2, 1);

  // ----------------- Dimensões base -----------------
  const hullLength = 12.5;
  const hullWidth = 3.2;
  const hullHeight = 1.4;
  const deckInset = 0.4;

  const halfL = hullLength / 2;
  const halfW = hullWidth / 2;

  // =================================================
  // MATERIAIS
  // =================================================

  // Casco acima de água (vermelho texturado)
  const hullRedMaterial = new THREE.MeshStandardMaterial({
    map: hullDiffuseTex,
    color: 0xffffff,
    metalness: 0.35,
    roughness: 0.55,
  });

  // Parte submersa (hull_lower texturado)
  const hullBlackMaterial = new THREE.MeshStandardMaterial({
    map: hullLowerTex,
    color: 0xffffff,
    metalness: 0.35,
    roughness: 0.6,
  });

  // Convés
  const deckMaterial = new THREE.MeshStandardMaterial({
    map: deckTex,
    color: 0xffffff,
    metalness: 0.3,
    roughness: 0.8,
  });

  // Roof da ponte
  const bridgeRoofMaterial = new THREE.MeshStandardMaterial({
    map: deckTex,
    color: 0xffffff,
    metalness: 0.25,
    roughness: 0.7,
  });

  // Estrutura da ponte (cockpit)
  const bridgeMaterial = new THREE.MeshStandardMaterial({
    map: bridgeTex,
    color: 0xffffff,
    metalness: 0.15,
    roughness: 0.85,
  });

  // Janelas
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x9fd4ff,
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.9,
  });

  const mastMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.3,
    roughness: 0.5,
  });

  // =================================================
  // CASCO PRINCIPAL + PARTE SUBMERSA
  // =================================================

  const hullGeometry = new THREE.BoxGeometry(hullLength, hullHeight, hullWidth);

  const mainHull = new THREE.Mesh(hullGeometry, hullRedMaterial);
  mainHull.castShadow = true;
  mainHull.receiveShadow = true;
  group.add(mainHull);

  // Parte submersa (faixa preta texturada)
  const underwaterHeight = hullHeight * 0.7;
  const underwaterGeometry = new THREE.BoxGeometry(
    hullLength * 0.98,
    underwaterHeight,
    hullWidth * 0.94,
  );

  const redBottomY = -hullHeight / 2;
  const underwaterTopY = redBottomY + 0.02;
  const underwaterCenterY = underwaterTopY - underwaterHeight / 2;

  const underwaterHull = new THREE.Mesh(underwaterGeometry, hullBlackMaterial);
  underwaterHull.position.set(0, underwaterCenterY, 0);
  underwaterHull.castShadow = true;
  underwaterHull.receiveShadow = true;
  group.add(underwaterHull);

  // ============================================================
  // PROA ARREDONDADA – VERMELHA + PRETA EM BAIXO
  // ============================================================
  const bowRadius = hullWidth / 2;
  const bowLength = hullHeight;

  const bowGeo = new THREE.CylinderGeometry(
    bowRadius,
    bowRadius,
    bowLength,
    32
  );
  bowGeo.rotateY(Math.PI / 2);

  const bow = new THREE.Mesh(bowGeo, hullRedMaterial);
  bow.position.set(-halfL, 0, 0);
  bow.castShadow = true;
  bow.receiveShadow = true;
  group.add(bow);

  const underwaterBowGeo = new THREE.CylinderGeometry(
    bowRadius * 0.94,
    bowRadius * 0.94,
    underwaterHeight,
    32
  );
  underwaterBowGeo.rotateY(Math.PI / 2);

  const underwaterBow = new THREE.Mesh(underwaterBowGeo, hullBlackMaterial);
  underwaterBow.position.set(-halfL, underwaterCenterY, 0);
  underwaterBow.castShadow = true;
  underwaterBow.receiveShadow = true;
  group.add(underwaterBow);

  // =================================================
  // POPA – BLOCO TRASEIRO (VERMELHO + PRETO)
  // =================================================
  const stern = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, hullHeight * 0.95, hullWidth * 1.05),
    hullRedMaterial,
  );
  stern.position.set(halfL + 0.8, 0, 0);
  stern.castShadow = true;
  stern.receiveShadow = true;
  group.add(stern);

  const underwaterSternGeo = new THREE.BoxGeometry(
    1.6 * 0.98,
    underwaterHeight * 0.95,
    hullWidth * 0.94,
  );
  const underwaterStern = new THREE.Mesh(underwaterSternGeo, hullBlackMaterial);
  underwaterStern.position.set(halfL + 0.8, underwaterCenterY, 0);
  underwaterStern.castShadow = true;
  underwaterStern.receiveShadow = true;
  group.add(underwaterStern);

  // =================================================
  // CONVÉS
  // =================================================
  const deckLength = hullLength - deckInset * 2.2;
  const deckWidth = hullWidth - deckInset * 0.8;
  const deckHeight = 0.25;
  const deckTopY = hullHeight / 2 + deckHeight / 2 - 0.02;

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(deckLength, deckHeight, deckWidth),
    deckMaterial,
  );
  deck.position.set(0.5, deckTopY, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // =================================================
  // PONTE / COCKPIT COM 3 ANDARES
  // =================================================
  const bridgeBaseX = halfL - 2.0;
  const bridgeBaseY = deckTopY;

  const lowerH = 0.8;
  const middleH = 0.8;
  const upperH = 0.8;

  const lowerBridge = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, lowerH, 2.4),
    bridgeMaterial,
  );
  lowerBridge.position.set(
    bridgeBaseX,
    bridgeBaseY + lowerH / 2,
    0,
  );
  lowerBridge.castShadow = true;
  lowerBridge.receiveShadow = true;
  group.add(lowerBridge);

  const middleBridge = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, middleH, 2.2),
    bridgeMaterial,
  );
  middleBridge.position.set(
    bridgeBaseX,
    lowerBridge.position.y + lowerH / 2 + middleH / 2,
    0,
  );
  middleBridge.castShadow = true;
  middleBridge.receiveShadow = true;
  group.add(middleBridge);

  const upperBridge = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, upperH, 2.0),
    bridgeMaterial,
  );
  upperBridge.position.set(
    bridgeBaseX,
    middleBridge.position.y + middleH / 2 + upperH / 2,
    0,
  );
  upperBridge.castShadow = true;
  upperBridge.receiveShadow = true;
  group.add(upperBridge);

  const bridgeRoof = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.18, 2.1),
    bridgeRoofMaterial,
  );
  bridgeRoof.position.set(
    bridgeBaseX,
    upperBridge.position.y + upperH / 2 + 0.09,
    0,
  );
  bridgeRoof.castShadow = true;
  bridgeRoof.receiveShadow = true;
  group.add(bridgeRoof);

  // =================================================
  // JANELAS – 2.º andar + vidro corrido no 3.º
  // =================================================
  const wGeo = new THREE.BoxGeometry(0.35, 0.35, 0.03);

  for (let i = -1; i <= 1; i++) {
    const w = new THREE.Mesh(wGeo, windowMaterial);
    w.position.set(
      bridgeBaseX - 1.05,
      middleBridge.position.y,
      i * 0.55,
    );
    w.castShadow = true;
    group.add(w);
  }

  const wideWindowGeo = new THREE.BoxGeometry(
    0.04,
    0.45,
    1.8,
  );
  const frontOffset = 2.1 / 2 + 0.02;
  const wideWindow = new THREE.Mesh(wideWindowGeo, windowMaterial);
  wideWindow.position.set(
    bridgeBaseX - frontOffset,
    upperBridge.position.y,
    0,
  );
  wideWindow.castShadow = true;
  wideWindow.receiveShadow = true;
  group.add(wideWindow);

  // =================================================
  // ANTENAS – TOPO DA PONTE + PROA
  // =================================================
  const smallAntGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.7, 10);
  const topAntBaseY = bridgeRoof.position.y + 0.35;
  [-0.5, 0, 0.5].forEach((offsetZ) => {
    const ant = new THREE.Mesh(smallAntGeo, mastMat);
    ant.position.set(bridgeBaseX - 0.2, topAntBaseY, offsetZ);
    ant.castShadow = true;
    ant.receiveShadow = true;
    group.add(ant);
  });

  const mainAntenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 2.0, 12),
    mastMat,
  );
  mainAntenna.position.set(-halfL - bowLength * 0.25, deckTopY + 0.9, 0);
  mainAntenna.castShadow = true;
  mainAntenna.receiveShadow = true;
  group.add(mainAntenna);

  const antBarGeo = new THREE.BoxGeometry(0.45, 0.06, 0.06);
  const antBar1 = new THREE.Mesh(antBarGeo, mastMat);
  antBar1.position.set(
    mainAntenna.position.x,
    mainAntenna.position.y + 0.6,
    0,
  );
  antBar1.castShadow = true;
  group.add(antBar1);

  const antBar2 = new THREE.Mesh(antBarGeo, mastMat);
  antBar2.position.set(
    mainAntenna.position.x,
    mainAntenna.position.y + 0.3,
    0.0,
  );
  antBar2.castShadow = true;
  group.add(antBar2);

  // =================================================
  // MURETES / BORDAS DO CONVÉS
  // =================================================
  const bulwarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x22333b,
    metalness: 0.2,
    roughness: 0.8,
  });

  const wallHeight = 0.3;
  const wallThickness = 0.06;

  const sideLength = deckLength;
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(sideLength, wallHeight, wallThickness),
    bulwarkMaterial,
  );
  leftWall.position.set(
    deck.position.x,
    deckTopY + wallHeight / 2,
    halfW - wallThickness / 2,
  );
  leftWall.castShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(sideLength, wallHeight, wallThickness),
    bulwarkMaterial,
  );
  rightWall.position.set(
    deck.position.x,
    deckTopY + wallHeight / 2,
    -halfW + wallThickness / 2,
  );
  rightWall.castShadow = true;
  group.add(rightWall);

  const frontBackWidth = hullWidth - 2 * wallThickness;
  const frontWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, frontBackWidth),
    bulwarkMaterial,
  );
  frontWall.position.set(
    deck.position.x + sideLength / 2 - wallThickness / 2,
    deckTopY + wallHeight / 2,
    0,
  );
  frontWall.castShadow = true;
  group.add(frontWall);

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, frontBackWidth),
    bulwarkMaterial,
  );
  backWall.position.set(
    deck.position.x - sideLength / 2 + wallThickness / 2,
    deckTopY + wallHeight / 2,
    0,
  );
  backWall.castShadow = true;
  group.add(backWall);

  // =================================================
  // (OPCIONAL) CONTENTORES – FICAM COMENTADOS
  // =================================================
  /*
  const containerColors = [
    0xff7043,
    0x43a047,
    0x1e88e5,
    0xef5350,
    0xffffff,
  ];

  const containerLength = 1.4;
  const containerHeight = 0.55;
  const containerWidth = 0.75;

  const containerBaseY = deckTopY + containerHeight / 2;

  const cols = 5;
  const rows = 4;

  const startX = -4.0;
  const gapX = 1.5;
  const startZ = -1.2;
  const gapZ = containerWidth + 0.05;

  const stackPattern: number[][] = [
    [2, 3, 3, 2, 1],
    [1, 2, 3, 3, 2],
    [0, 1, 2, 3, 2],
    [0, 1, 2, 2, 1],
  ];

  const makeContainer = (x: number, y: number, z: number, color: number) => {
    const mat = new THREE.MeshStandardMaterial({
      map: containerTex,
      color,
      metalness: 0.35,
      roughness: 0.55,
    });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(containerLength, containerHeight, containerWidth),
      mat,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const stackH = stackPattern[r][c];
      if (stackH === 0) continue;

      const x = startX + c * gapX;
      const z = startZ + r * gapZ;

      for (let h = 0; h < stackH; h++) {
        const color =
          containerColors[(r + c + h) % containerColors.length];
        const y = containerBaseY + h * (containerHeight + 0.02);
        const cont = makeContainer(x, y, z, color);
        group.add(cont);
      }
    }
  }
  */

  // offset global do navio
  group.position.y = 0.12;

  return group;
}

  // ===================== OCEAN ====================================
  private buildOcean(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> {
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
