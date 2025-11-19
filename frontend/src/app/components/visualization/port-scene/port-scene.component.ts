import { AfterViewInit, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import {
  DockLayout,
  LandAreaLayout,
  DockMaterialDTO,
  PortLayoutDTO,
  PortLayoutService,
  SurfaceMaterialDTO,
  ProceduralTextureDescriptor,
  WarehouseLayout,
} from '../../../services/visualization/port-layout.service';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type VesselPalette = {
  hull: number;
  deck: number;
  accent: number;
  cabin: number;
};

type DockBandInfo = {
  quayWidth: number;
  roadWidth: number;
  bufferWidth: number;
  quayZ: number;
  bufferZ: number;
  roadZ: number;
};

type DockMaterialSet = {
  top: THREE.MeshStandardMaterial;
  side: THREE.MeshStandardMaterial;
  bottom: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
};

type ContainerHotspot = {
  id: string;
  object: THREE.Object3D;
  worldPosition: THREE.Vector3;
  stackLevel: number;
  locationLabel: string;
};

@Component({
  selector: 'app-port-scene',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './port-scene.component.html',
  styleUrls: ['./port-scene.component.scss'],
})
export class PortSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas3d', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() toneMappingExposure = 1.05;
  @Input() orbitDistanceFactor = 0.9;
  @Input() orbitElevationFactor = 0.55;
  @Input() enableAutoRotate = false;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private waterGeom?: THREE.PlaneGeometry;
  private waterBase?: Float32Array;
  private clock = new THREE.Clock();
  private generatedMaterials: THREE.Material[] = [];
  private generatedTextures: THREE.Texture[] = [];
  private readonly showDebugHelpers = false;
  private readonly containerPalette: number[] = [
    0xff6b6b,
    0xffbe0b,
    0x00bbf9,
    0x48cae4,
    0x9b5de5,
    0xf15bb5,
  ];
  private readonly containerMaterials: THREE.MeshStandardMaterial[] = this.containerPalette.map(
    (hex) =>
      new THREE.MeshStandardMaterial({
        color: hex,
        metalness: 0.15,
        roughness: 0.38,
      })
  );
  private readonly containerGeometry = new THREE.BoxGeometry(34, 14, 68);
  private readonly craneMaterials = {
    boom: new THREE.MeshStandardMaterial({
      color: 0xf5c344,
      metalness: 0.42,
      roughness: 0.32,
    }),
    cabin: new THREE.MeshStandardMaterial({
      color: 0x2f3e46,
      metalness: 0.15,
      roughness: 0.55,
    }),
    counterWeight: new THREE.MeshStandardMaterial({
      color: 0xcdd5df,
      metalness: 0.3,
      roughness: 0.48,
    }),
    cable: new THREE.MeshStandardMaterial({
      color: 0x1d1d1d,
      metalness: 0.35,
      roughness: 0.6,
    }),
  };
  private readonly randomBaseSeed = 947;
  private readonly yardStripeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
  });
  private readonly foamMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private readonly bollardGeometry = new THREE.CylinderGeometry(2.2, 2.4, 4.5, 12);
  private readonly bollardMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2b2b,
    metalness: 0.55,
    roughness: 0.35,
  });
  private readonly poleGeometry = new THREE.CylinderGeometry(0.8, 0.8, 40, 8);
  private readonly poleHeadGeometry = new THREE.BoxGeometry(3.2, 1.4, 5.6);
  private readonly poleMaterial = new THREE.MeshStandardMaterial({
    color: 0xdadada,
    metalness: 0.5,
    roughness: 0.45,
  });
  private readonly fenderGeometry = new THREE.BoxGeometry(10, 5, 3);
  private readonly fenderMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.7,
  });
  private readonly lightEmissiveMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff6bf,
  });
  private readonly serviceRoadMaterial = new THREE.MeshStandardMaterial({
    color: 0x424a55,
    roughness: 0.78,
    metalness: 0.18,
  });
  private readonly bufferMaterial = new THREE.MeshStandardMaterial({
    color: 0xb3bac3,
    roughness: 0.88,
    metalness: 0.05,
  });
  private readonly guardRailMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4f5f7,
    roughness: 0.4,
    metalness: 0.2,
  });
  private readonly roadStripeMaterial = new THREE.MeshBasicMaterial({
    color: 0xfdfdfd,
    transparent: true,
    opacity: 0.7,
  });
  private readonly craneRailMaterial = new THREE.MeshStandardMaterial({
    color: 0xbec6d4,
    metalness: 0.62,
    roughness: 0.28,
  });
  private readonly railSleeperMaterial = new THREE.MeshStandardMaterial({
    color: 0x4c5663,
    metalness: 0.2,
    roughness: 0.7,
  });
  private readonly utilityBoxMaterial = new THREE.MeshStandardMaterial({
    color: 0xd6dde6,
    roughness: 0.38,
    metalness: 0.18,
  });
  private readonly cabinetDoorMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2c3a,
    roughness: 0.55,
    metalness: 0.15,
  });
  private readonly linePaintMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8d359,
    roughness: 0.4,
    metalness: 0.06,
    emissive: new THREE.Color(0x362600),
    emissiveIntensity: 0.2,
    polygonOffset: true,
    polygonOffsetFactor: -0.5,
    polygonOffsetUnits: -0.1,
    depthWrite: false,
  });
  private readonly truckCabMaterial = new THREE.MeshStandardMaterial({
    color: 0x154c79,
    roughness: 0.45,
    metalness: 0.35,
  });
  private readonly truckTrailerMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4dde5,
    roughness: 0.6,
    metalness: 0.18,
  });
  private readonly truckWheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x111112,
    roughness: 0.9,
    metalness: 0.4,
  });
  private readonly forkliftBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.55,
    metalness: 0.3,
  });
  private readonly forkliftMastMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f1f1f,
    roughness: 0.45,
    metalness: 0.4,
  });
  private readonly truckGlassMaterial = new THREE.MeshStandardMaterial({
    color: 0xcfe8ff,
    roughness: 0.15,
    metalness: 0.05,
    transparent: true,
    opacity: 0.92,
  });
  private readonly vesselPalettes: VesselPalette[] = [
    { hull: 0x10375c, deck: 0xf4f8ff, accent: 0xff595e, cabin: 0xd8e2f1 },
    { hull: 0x0b4f6c, deck: 0xf5f0e1, accent: 0xf4a259, cabin: 0xffffff },
    { hull: 0x274060, deck: 0xe9f1ff, accent: 0x4ecdc4, cabin: 0xfffbe6 },
  ];
  private gltfLoader = new GLTFLoader();
  // cache para n�o carregar o modelo muitas vezes
  private containerStackPrototype?: THREE.Group;
  private containerStackLoading?: Promise<THREE.Group>;
  private platform?: THREE.Mesh;
  private readonly portModelUrls = [
    'assets/models/port-yard.glb',
    'assets/models/untitled.glb',
  ];
  private readonly containerModelUrls = ['assets/models/containers.glb'];
  private glbContainerUnitSize = new THREE.Vector3(34, 14, 68);
  private readonly portModelTargetSpan = 3200;
  private readonly portModelVerticalOffset = 10;
  private portModel?: THREE.Group;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private containerMeshes: THREE.Mesh[] = [];
  private containerLookup = new Map<THREE.Object3D, ContainerHotspot>();
  private hoverOutline?: THREE.BoxHelper;
  private selectionOutline?: THREE.BoxHelper;
  public selectedContainer?: ContainerHotspot;
  public hoveredContainer?: ContainerHotspot;
  public totalContainers = 0;
  public featuredContainers: ContainerHotspot[] = [];
  private containerHotspots: ContainerHotspot[] = [];
  private stagedContainers: { object: THREE.Object3D; stackLevelHint?: number }[] = [];
  private glbContainerObjects: THREE.Object3D[] = [];
  private readonly warehouseModelUrls = ['assets/models/warehouse.glb', 'assets/warehouse.glb'];
  private warehousePrototype?: THREE.Group;
  private warehouseModelLoading?: Promise<THREE.Group>;
  private warehouseBaseDimensions?: THREE.Vector3;
  private baseSceneBuilt = false;
  private pointerEventsAttached = false;
  private readonly pointerMoveHandler = (event: PointerEvent) => this.onPointerMove(event);
  private readonly pointerClickHandler = (event: MouseEvent) => this.onPointerClick(event);

  constructor(private layoutApi: PortLayoutService, private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.initThree();
    this.attachPointerEvents();
    // Constru��o simplificada: plataforma + stacks GLB
    this.buildSimplePlatformWithGlbStacks();
    return;
  }

  ngOnDestroy(): void {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.controls?.dispose();
    this.renderer?.dispose();
    this.detachPointerEvents();
    if (this.hoverOutline) this.scene.remove(this.hoverOutline);
    if (this.selectionOutline) this.scene.remove(this.selectionOutline);
    this.containerGeometry.dispose();
    this.containerMaterials.forEach((mat) => mat.dispose());
    this.yardStripeMaterial.dispose();
    this.foamMaterial.dispose();
    this.bollardGeometry.dispose();
    this.bollardMaterial.dispose();
    this.poleGeometry.dispose();
    this.poleHeadGeometry.dispose();
    this.poleMaterial.dispose();
    this.lightEmissiveMaterial.dispose();
    this.serviceRoadMaterial.dispose();
    this.bufferMaterial.dispose();
    this.guardRailMaterial.dispose();
    this.roadStripeMaterial.dispose();
    this.craneRailMaterial.dispose();
    this.railSleeperMaterial.dispose();
    this.utilityBoxMaterial.dispose();
    this.cabinetDoorMaterial.dispose();
    this.linePaintMaterial.dispose();
    this.fenderGeometry.dispose();
    this.fenderMaterial.dispose();
    this.truckCabMaterial.dispose();
    this.truckTrailerMaterial.dispose();
    this.truckWheelMaterial.dispose();
    this.forkliftBodyMaterial.dispose();
    this.forkliftMastMaterial.dispose();
    this.truckGlassMaterial.dispose();
    this.resetGeneratedAssets();
  }

  // Cena simplificada: plataforma plana e alguns stacks GLB em cima
  private buildSimplePlatformWithGlbStacks() {
    this.resetGeneratedAssets();
    this.resetContainerTracking();

    // Luz ambiente j� criada em initThree(). Aqui criamos uma plataforma simples.
    const platformSize = new THREE.Vector2(1200, 700);
    const platformGeo = new THREE.BoxGeometry(platformSize.x, 6, platformSize.y);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0xa9b4c2, roughness: 0.85, metalness: 0.05 });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.set(0, -3, 0);
    platform.castShadow = false;
    platform.receiveShadow = true;
    this.scene.add(platform);
    this.platform = platform;

    // Grid leve opcional para refer�ncia visual
    if (this.showDebugHelpers) {
      const grid = new THREE.GridHelper(Math.max(platformSize.x, platformSize.y), 20, 0x666666, 0xbbbbbb);
      grid.position.y = 0.05;
      this.scene.add(grid);
    }

    // Posiciona a c�mara a enquadrar a plataforma
    const dist = platformSize.x * 0.9;
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(-dist, dist * 0.6, dist * 0.7);
    this.camera.far = Math.max(this.camera.far, dist * 6);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.controls.target);

    // Carrega o GLB e espalha alguns stacks numa grelha 3x2
    this.getContainerStackPrototype()
      .then((proto) => {
        const rows = 2;
        const cols = 3;
        const marginX = 420; // espa�amento entre stacks (para stacks maiores)
        const marginZ = 480;
        const startX = -((cols - 1) * marginX) / 2;
        const startZ = -((rows - 1) * marginZ) / 2;
        const baseY = 0; // topo da plataforma

        // Calcula a pegada (footprint) do prot�tipo para ajustar a �rea da plataforma
        const protoBox = new THREE.Box3().setFromObject(proto);
        const protoSize = new THREE.Vector3();
        protoBox.getSize(protoSize);
        const totalW = cols * protoSize.x + (cols - 1) * marginX;
        const totalD = rows * protoSize.z + (rows - 1) * marginZ;
        const pad = 200; // margem extra em torno
        const targetW = totalW + pad;
        const targetD = totalD + pad;
        if (this.platform) {
          const baseW = (platform.geometry as THREE.BoxGeometry).parameters.width;
          const baseD = (platform.geometry as THREE.BoxGeometry).parameters.depth;
          this.platform.scale.x = targetW / baseW;
          this.platform.scale.z = targetD / baseD;
        }
        // Reajusta c�mara para cobrir a nova plataforma
        const cover = Math.max(targetW, targetD);
        const newDist = cover * 0.9;
        this.controls.target.set(0, 0, 0);
        this.camera.position.set(-newDist, newDist * 0.6, newDist * 0.7);
        this.camera.far = Math.max(this.camera.far, newDist * 6);
        this.camera.updateProjectionMatrix();

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const clone = proto.clone(true);
            clone.position.set(startX + c * marginX, baseY, startZ + r * marginZ);
            // pequenas varia��es para naturalidade
            clone.rotation.y = (c % 2 === 0 ? 1 : -1) * 0.04;
            this.scene.add(clone);
            this.markContainer(clone, 3);
          }
        }
        this.finalizeContainerTracking(true);
        this.baseSceneBuilt = true;
        this.animate();
      })
      .catch((err) => {
        console.error('[PortScene] falha ao carregar GLB para plataforma', err);
        // Mesmo sem GLB, arranca render para ver plataforma
        this.baseSceneBuilt = true;
        this.animate();
      });
  }

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdfe8f5);
    this.scene.fog = new THREE.Fog(0xd2e4f3, 800, 5200);

    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 450;
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    this.camera.position.set(300, 250, 400);

  this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(width, height);
  this.renderer.shadowMap.enabled = true;
  this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.toneMappingExposure;
    this.canvas.style.cursor = 'grab';

    // Basic lights (helps later US 3.3.5)
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xdbefff, 0x1c2b3a, 0.35);
    this.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(-600, 900, 600);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  dir.shadow.camera.near = 50;
  dir.shadow.camera.far = 6000;
  dir.shadow.camera.left = -2500;
  dir.shadow.camera.right = 2500;
  dir.shadow.camera.top = 2500;
  dir.shadow.camera.bottom = -2500;
    this.scene.add(dir);
  const sunDisk = new THREE.Mesh(
    new THREE.SphereGeometry(80, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff1c1, transparent: true, opacity: 0.75 })
  );
  sunDisk.position.copy(dir.position).setLength(3600);
    this.scene.add(sunDisk);

  // Luz secundária suave para preencher sombras
  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(1200, 700, -800);
  this.scene.add(fill);

    // Orbit controls (helps 3.3.6 later)
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 140;
    this.controls.maxDistance = 2000;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.autoRotate = this.enableAutoRotate;
    this.controls.autoRotateSpeed = 0.4;
    this.controls.target.set(0, 0, 0);
  }

  private buildFromLayout(layout: PortLayoutDTO) {
    console.log('[PortScene] layout recebido', layout);
    const sceneLayout = this.hasSceneContent(layout) ? layout : this.createDemoLayout();
    if (sceneLayout !== layout) {
      console.info('[PortScene] usando layout demonstrativo enquanto não existem dados reais');
    }
    this.resetGeneratedAssets();
    this.resetContainerTracking();
    this.baseSceneBuilt = false;
    this.addBackdropElements(sceneLayout);
    // CENA BASE
    // ----------

    // --- ÁGUA (com ondulação) ---
    const segs = 200;
    this.waterGeom = new THREE.PlaneGeometry(sceneLayout.water.width, sceneLayout.water.height, segs, segs);
    this.waterBase = (this.waterGeom.attributes['position'].array as Float32Array).slice(0);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x12344f,
      roughness: 0.2,
      metalness: 0.02,
      reflectivity: 0.55,
      clearcoat: 0.8,
      clearcoatRoughness: 0.35,
      transmission: 0.65,
      thickness: 18,
      ior: 1.33,
      sheen: 0.12,
      sheenColor: new THREE.Color(0xcbe8ff),
      specularIntensity: 0.9,
    });

    const water = new THREE.Mesh(this.waterGeom, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = sceneLayout.water.y - 0.1; // ligeiramente abaixo do cais
    water.receiveShadow = true;
    this.scene.add(water);

    // --- MATERIAIS DE BET�O / ASFALTO ---
    const dockMaterialSet = this.createDockMaterialSet(sceneLayout.materials?.dock);

    // Asfalto principal dos yards: base color + ru�do para varia��o
    const yardBasePrimary = '#d4dae4';
    const yardBaseSecondary = '#b5bdc9';
    const yardTex = this.createProceduralTexture(
      {
        pattern: 'noise',
        primaryColor: yardBasePrimary,
        secondaryColor: yardBaseSecondary,
        scale: 5,
        strength: 0.5,
      },
      false
    );

    const yardTopMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(yardBasePrimary),
      roughness: 0.94,
      metalness: 0.02,
      map: yardTex,
    });

    const yardSideMat = new THREE.MeshStandardMaterial({
      color: 0xa7afba,
      roughness: 0.93,
      metalness: 0.02,
    });

    const warehouseWallMat = new THREE.MeshStandardMaterial({
      color: 0xe7dfd1,
      roughness: 0.78,
      metalness: 0.04,
    });
    const warehouseRoofMat = new THREE.MeshStandardMaterial({
      color: 0xcbb99b,
      roughness: 0.92,
      metalness: 0.02,
    });
    const warehouseBaseMat = new THREE.MeshStandardMaterial({
      color: 0x8a8b90,
      roughness: 1.0,
      metalness: 0.01,
    });

    // 1) ZONAS DE TERRA (yards / “porto em si”, ainda sem contentores)
    // ---------------------------------------------------------------
    for (const a of sceneLayout.landAreas) {
      const height = 6; // espessura da placa de betão/asfalto
      const geo = new THREE.BoxGeometry(a.width, height, a.depth);
      const mats: THREE.Material[] = [
        yardSideMat,  // +x
        yardSideMat,  // -x
        yardTopMat,   // +y (topo)
        dockMaterialSet.bottom, // -y
        yardSideMat,  // +z
        yardSideMat,  // -z
      ];

      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(a.x, a.y + height / 2, a.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.addContainerStacks(a, a.y + height);
      this.addYardMarkings(a, a.y + height);
      this.addYardLighting(a, a.y + height);
    }

    // 2.b) Armazens (StorageAreaType.Warehouse -> volumes fechados)
    this.addWarehouses(sceneLayout.warehouses ?? [], {
      wall: warehouseWallMat,
      roof: warehouseRoofMat,
      base: warehouseBaseMat,
    });

    // 2) CAIS PRINCIPAIS (docks junto à água)
    // --------------------------------------
    let firstDockCenter: THREE.Vector3 | null = null;

    for (const d of sceneLayout.docks) {
      const dockCenter = this.buildDock(d, dockMaterialSet);
      if (!firstDockCenter) {
        firstDockCenter = dockCenter.clone();
      }
    }

    // 3) CÂMARA APONTADA PARA O PORTO
    // -------------------------------
    if (firstDockCenter) {
      this.framePort(firstDockCenter, sceneLayout);
    }
    // Helpers (apenas para desenvolvimento; remover depois se quiser)
    if (this.showDebugHelpers) {
      const axes = new THREE.AxesHelper(200);
      axes.position.y = 2;
      this.scene.add(axes);
      const grid = new THREE.GridHelper(4000, 80, 0x444444, 0xcccccc);
      grid.position.y = -0.05;
      this.scene.add(grid);
    }

    this.queueModelContainers();
    this.finalizeContainerTracking(true);
    this.baseSceneBuilt = true;
    this.animate();
  }

  private attachPointerEvents() {
    if (this.pointerEventsAttached) return;
    this.pointerEventsAttached = true;
    this.zone.runOutsideAngular(() => {
      this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
      this.canvas.addEventListener('click', this.pointerClickHandler);
    });
  }

  private detachPointerEvents() {
    if (!this.pointerEventsAttached) return;
    this.pointerEventsAttached = false;
    this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);
    this.canvas.removeEventListener('click', this.pointerClickHandler);
  }

  private onPointerMove(event: PointerEvent) {
    if (!this.camera) return;
    this.updatePointer(event);
    const hovered = this.findContainerIntersection();
    if ((hovered?.id ?? null) !== (this.hoveredContainer?.id ?? null)) {
      this.zone.run(() => {
        this.hoveredContainer = hovered;
      });
    }
    if (!this.selectedContainer || hovered?.id !== this.selectedContainer.id) {
      this.updateHoverOutline(hovered?.object);
    } else {
      this.updateHoverOutline(undefined);
    }
    this.canvas.style.cursor = hovered ? 'pointer' : 'grab';
  }

  private onPointerClick(event: MouseEvent) {
    if (!this.camera) return;
    this.updatePointer(event);
    const picked = this.findContainerIntersection();
    this.zone.run(() => this.setSelectedContainer(picked));
  }

  public focusContainer(container: ContainerHotspot) {
    this.setSelectedContainer(container);
  }

  private setSelectedContainer(container?: ContainerHotspot) {
    this.selectedContainer = container;
    this.updateSelectionOutline(container?.object);
    if (container) {
      this.focusCameraOn(container);
    }
  }

  private focusCameraOn(container: ContainerHotspot) {
    if (!this.controls || !this.camera) return;
    const target = this.getObjectCenter(container.object, container.worldPosition);
    this.controls.target.copy(target);
    const cameraOffset = this.camera.position.clone().sub(target);
    const distance = cameraOffset.length();
    const desired = Math.max(180, distance * 0.65);
    cameraOffset.setLength(desired);
    const newPosition = target.clone().add(cameraOffset);
    this.camera.position.copy(newPosition);
    this.controls.update();
  }

  private getObjectCenter(object: THREE.Object3D, fallback?: THREE.Vector3): THREE.Vector3 {
    const box = new THREE.Box3().setFromObject(object);
    if (!box.isEmpty() && Number.isFinite(box.min.x)) {
      return box.getCenter(new THREE.Vector3());
    }
    if (fallback) {
      return fallback.clone();
    }
    const position = new THREE.Vector3();
    object.getWorldPosition(position);
    return position;
  }

  private updatePointer(event: PointerEvent | MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private findContainerIntersection(): ContainerHotspot | undefined {
    if (!this.containerMeshes.length) return undefined;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.containerMeshes, false);
    if (!intersections.length) return undefined;
    const mesh = intersections[0].object;
    return this.containerLookup.get(mesh) ?? undefined;
  }

  private updateHoverOutline(target?: THREE.Object3D) {
    if (!target) {
      if (this.hoverOutline) this.hoverOutline.visible = false;
      return;
    }
    if (!this.hoverOutline) {
      this.hoverOutline = new THREE.BoxHelper(target, 0xffffff);
      this.scene.add(this.hoverOutline);
    } else {
      this.hoverOutline.setFromObject(target);
      this.hoverOutline.visible = true;
    }
  }

  private updateSelectionOutline(target?: THREE.Object3D) {
    if (!target) {
      if (this.selectionOutline) this.selectionOutline.visible = false;
      return;
    }
    if (!this.selectionOutline) {
      this.selectionOutline = new THREE.BoxHelper(target, 0x06d6a0);
      this.scene.add(this.selectionOutline);
    } else {
      this.selectionOutline.setFromObject(target);
      this.selectionOutline.visible = true;
    }
  }

  private finalizeContainerTracking(clearExisting = false) {
    this.scene.updateMatrixWorld(true);
    if (clearExisting) {
      this.containerMeshes = [];
      this.containerLookup.clear();
      this.containerHotspots = [];
      this.totalContainers = 0;
      this.featuredContainers = [];
      this.hoveredContainer = undefined;
      this.selectedContainer = undefined;
      this.updateHoverOutline(undefined);
      this.updateSelectionOutline(undefined);
    }
    let index = this.containerHotspots.length + 1;
    const tempBox = new THREE.Box3();
    for (const entry of this.stagedContainers) {
      const target = entry.object;
      if (!target) continue;
      tempBox.setFromObject(target);
      let worldPosition = new THREE.Vector3();
      if (!Number.isFinite(tempBox.min.x) || tempBox.isEmpty()) {
        target.getWorldPosition(worldPosition);
      } else {
        tempBox.getCenter(worldPosition);
      }
      const meshes: THREE.Mesh[] = [];
      target.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child);
        }
      });
      if (!meshes.length && target instanceof THREE.Mesh) {
        meshes.push(target);
      }
      if (!meshes.length) {
        continue;
      }
      const id = `CNT-${index.toString().padStart(3, '0')}`;
      const stackLevel = entry.stackLevelHint ?? Math.max(1, Math.round(worldPosition.y / 14));
      const hotspot: ContainerHotspot = {
        id,
        object: target,
        worldPosition: worldPosition.clone(),
        stackLevel,
        locationLabel: `X ${worldPosition.x.toFixed(0)} | Y ${worldPosition.y.toFixed(0)} | Z ${worldPosition.z.toFixed(0)}`,
      };
      meshes.forEach((mesh) => {
        this.containerMeshes.push(mesh);
        this.containerLookup.set(mesh, hotspot);
      });
      this.containerHotspots.push(hotspot);
      index++;
    }
    this.totalContainers = this.containerHotspots.length;
    this.featuredContainers = this.containerHotspots.slice(0, 4);
    this.stagedContainers = [];
  }

  private loadReferenceModel() {
    const tryUrls = [...this.portModelUrls];
    const loadNext = () => {
      const url = tryUrls.shift();
      if (!url) {
        console.error('[PortScene] falha ao carregar modelo GLB (todas as fontes tentadas)');
        return;
      }
      this.gltfLoader.load(
        url,
        (gltf) => {
        this.portModel = gltf.scene;
        this.normalizePortModel(this.portModel);
        this.portModel.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          obj.castShadow = true;
          obj.receiveShadow = true;
        });
        this.scene.add(this.portModel);
        this.glbContainerObjects = this.extractModelContainers(this.portModel);
        if (this.baseSceneBuilt) {
          this.queueModelContainers();
          this.finalizeContainerTracking();
        }
        },
        undefined,
        (error) => {
          console.warn('[PortScene] falha ao carregar', url, error);
          loadNext();
        }
      );
    };
    loadNext();
  }
  // Helper para carregar e manter em cache o modelo de contentores individuais
  private getContainerStackPrototype(): Promise<THREE.Group> {
    if (this.containerStackPrototype) {
      return Promise.resolve(this.containerStackPrototype);
    }

    if (!this.containerStackLoading) {
      this.containerStackLoading = new Promise((resolve, reject) => {
        const tryUrls = [...this.containerModelUrls];
        const loadNext = () => {
          const url = tryUrls.shift();
          if (!url) {
            reject(new Error('Sem URL valido para GLB de contentor'));
            return;
          }
          this.gltfLoader.load(
            url,
            (gltf) => {
              const root = gltf.scene;
              this.prepareContainerPrototype(root);
              this.containerStackPrototype = root;
              resolve(root);
            },
            undefined,
            (err) => {
              console.warn('[PortScene] erro a carregar GLB', url, err);
              loadNext();
            }
          );
        };
        loadNext();
      });
    }

    return this.containerStackLoading;
  }

  private prepareContainerPrototype(root: THREE.Group) {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          obj.material = (obj.material as THREE.Material).clone();
        }
      }
    });
    const targetMax = Math.max(this.glbContainerUnitSize.x, this.glbContainerUnitSize.y, this.glbContainerUnitSize.z);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetMax / maxDim;
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);
    const normalizedBox = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    normalizedBox.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= normalizedBox.min.y;
    this.glbContainerUnitSize = normalizedBox.getSize(new THREE.Vector3());
  }

  private buildContainerStackFromPrototype(
    prototype: THREE.Group,
    columns: number,
    rows: number,
    maxLevels: number,
    seed: number
  ): { group: THREE.Group; nodes: { object: THREE.Object3D; level: number }[] } {
    const group = new THREE.Group();
    const nodes: { object: THREE.Object3D; level: number }[] = [];
    const spacingX = this.glbContainerUnitSize.x + 6;
    const spacingZ = this.glbContainerUnitSize.z + 10;
    const spacingY = this.glbContainerUnitSize.y + 4;
    const offsetX = ((columns - 1) * spacingX) / 2;
    const offsetZ = ((rows - 1) * spacingZ) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const stackHeight = 1 + ((row + col + seed) % Math.max(1, maxLevels));
        for (let level = 0; level < stackHeight; level++) {
          const color = this.containerPalette[(row + col + level + seed) % this.containerPalette.length];
          const container = this.cloneGlbContainerPrototype(prototype, color);
          container.position.set(col * spacingX - offsetX, level * spacingY, row * spacingZ - offsetZ);
          group.add(container);
          nodes.push({ object: container, level: level + 1 });
        }
      }
    }

    return { group, nodes };
  }

  private cloneGlbContainerPrototype(prototype: THREE.Group, color: number): THREE.Group {
    const clone = prototype.clone(true);
    const tint = new THREE.Color(color);
    clone.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = (obj.material as THREE.Material).clone() as THREE.MeshStandardMaterial;
        if (mat.color) {
          mat.color.copy(tint);
        }
        mat.needsUpdate = true;
        obj.material = mat;
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return clone;
  }

  private normalizePortModel(root: THREE.Object3D) {
    const targetSpan = this.portModelTargetSpan;
    const tempBox = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    tempBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetSpan / maxDim;
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    root.position.sub(center);
    root.position.y -= scaledBox.min.y;
    root.position.y += this.portModelVerticalOffset;
  }

  private extractModelContainers(root: THREE.Object3D): THREE.Object3D[] {
    const matches: THREE.Object3D[] = [];
    root.traverse((obj) => {
      if (this.isGlbContainerNode(obj)) {
        matches.push(obj);
      }
    });
    return matches;
  }

  private isGlbContainerNode(obj: THREE.Object3D): boolean {
    const name = obj.name?.toLowerCase() ?? '';
    if (!name || !name.includes('container')) {
      return false;
    }
    const parentName = obj.parent?.name?.toLowerCase() ?? '';
    if (parentName.includes('container')) {
      return false;
    }
    return true;
  }

  private buildDock(dock: DockLayout, dockMaterials: DockMaterialSet): THREE.Vector3 {
    const geo = new THREE.BoxGeometry(dock.size.length, dock.size.height, dock.size.width);
    const mats: THREE.Material[] = [
      dockMaterials.side,
      dockMaterials.side,
      dockMaterials.top,
      dockMaterials.bottom,
      dockMaterials.side,
      dockMaterials.side,
    ];

    const body = new THREE.Mesh(geo, mats);
    body.position.set(dock.position.x, dock.position.y + dock.size.height / 2, dock.position.z);
    body.rotation.y = dock.rotationY;
    body.castShadow = true;
    body.receiveShadow = true;
    this.scene.add(body);

    this.addCranesForDock(dock);
    this.addDockFenders(dock);
    this.decorateDock(dock, dockMaterials);

    // Adiciona automaticamente alguns stacks GLB de contentores nesta dock
    this.addGlbContainerStacksForDock(dock);

    return new THREE.Vector3(dock.position.x, dock.position.y, dock.position.z);
  }

  // Coloca alguns stacks GLB de contentores ao longo da dock (na zona de buffer)
  private addGlbContainerStacksForDock(dock: DockLayout) {
    const bands = this.computeDockBands(dock);
    const groundY = dock.size.height + 0.2;
    const stacksCount = Math.max(3, Math.floor(dock.size.length / 180)); // ~um stack por 180 de comprimento
    const usableLength = dock.size.length * 0.8; // evita extremos
    const startX = -usableLength / 2;
    const stepX = usableLength / Math.max(1, stacksCount - 1);

    this.getContainerStackPrototype()
      .then((proto) => {
        const trackingQueue: { object: THREE.Object3D; level: number }[] = [];
        for (let i = 0; i < stacksCount; i++) {
          const localX = startX + i * stepX;
          // alterna levemente no eixo Z dentro da banda de buffer
          const jitterZ = (i % 2 === 0 ? -1 : 1) * Math.min(4, bands.bufferWidth * 0.2);
          const localZ = bands.bufferZ + jitterZ;

          const columns = 2 + ((i + 1) % 2);
          const rows = 1 + (i % 2);
          const maxLevels = 2 + ((i + 2) % 2);
          const { group, nodes } = this.buildContainerStackFromPrototype(proto, columns, rows, maxLevels, i * 17);
          const position = this.relativeToDock(dock, new THREE.Vector3(localX, groundY, localZ));
          group.position.copy(position);
          group.rotation.y = dock.rotationY;
          group.updateMatrixWorld(true);
          this.scene.add(group);
          trackingQueue.push(...nodes);
        }
        trackingQueue.forEach(({ object, level }) => this.markContainer(object, level));
        this.finalizeContainerTracking();
      })
      .catch((err) => console.error('[PortScene] falha ao obter prot�tipo de stack GLB', err));
  }

  private hasSceneContent(layout: PortLayoutDTO): boolean {
    return (
      (layout.docks?.length ?? 0) > 0 ||
      (layout.landAreas?.length ?? 0) > 0 ||
      (layout.warehouses?.length ?? 0) > 0
    );
  }

  private createDemoLayout(): PortLayoutDTO {
    return {
      units: 'meters',

      // Espelho de �gua amplo e porto encostado a um lado
      water: { width: 3600, height: 2200, y: -2 },

      // Placas principais do yard atr�s do cais
      landAreas: [
        {
          storageAreaId: 1001,
          name: 'Main Yard North',
          x: 0,
          z: 220,
          width: 1600,
          depth: 380,
          y: 0,
        },
        {
          storageAreaId: 1002,
          name: 'Main Yard South',
          x: 0,
          z: 620,
          width: 1600,
          depth: 360,
          y: 0,
        },
      ],

      // Um �nico terminal enorme paralelo ao mar
      docks: [
        {
          dockId: 1,
          name: 'Terminal 1',
          position: { x: 0, y: 2, z: -140 },
          size: { length: 1800, width: 140, height: 9 },
          rotationY: 0,
        },
      ],

      // Armaz�ns alinhados mais atr�s
      warehouses: [
        {
          storageAreaId: 2001,
          name: 'Warehouse A',
          position: { x: -420, y: 0, z: 980 },
          size: { width: 360, depth: 180, height: 60 },
          rotationY: 0,
        },
        {
          storageAreaId: 2002,
          name: 'Warehouse B',
          position: { x: 0, y: 0, z: 980 },
          size: { width: 380, depth: 180, height: 60 },
          rotationY: 0,
        },
        {
          storageAreaId: 2003,
          name: 'Warehouse C',
          position: { x: 420, y: 0, z: 980 },
          size: { width: 360, depth: 180, height: 58 },
          rotationY: 0,
        },
      ],
    };
  }

  private addBackdropElements(layout: PortLayoutDTO) {
    const radius = Math.max(layout.water.width, layout.water.height) * 2.5;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xe8f3ff, side: THREE.BackSide })
    );
    this.scene.add(sky);

    const haze = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.45, radius * 0.65, 280, 48, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xcadcec,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
      })
    );
    haze.position.y = -60;
    this.scene.add(haze);
  }

  private addYardMarkings(area: LandAreaLayout, platformHeight: number) {
    const usableDepth = area.depth - 120;
    if (usableDepth <= 60) {
      return;
    }
    const stripes = Math.max(2, Math.floor(usableDepth / 70));
    const width = Math.max(60, area.width - 80);
    const spacing = stripes === 1 ? 0 : usableDepth / (stripes - 1);
    for (let i = 0; i < stripes; i++) {
      const geometry = new THREE.PlaneGeometry(width, 1.6);
      const mesh = new THREE.Mesh(geometry, this.yardStripeMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        area.x,
        platformHeight + 0.3,
        area.z - usableDepth / 2 + 60 + spacing * i
      );
      this.scene.add(mesh);
    }
  }

  private addYardLighting(area: LandAreaLayout, platformHeight: number) {
    const poleCount = Math.max(1, Math.floor(area.width / 220));
    const spacing = area.width / (poleCount + 1);
    for (let i = 0; i < poleCount; i++) {
      const pole = this.createLightPole();
      pole.position.set(
        area.x - area.width / 2 + spacing * (i + 1),
        platformHeight,
        area.z + area.depth / 2 - 30
      );
      this.scene.add(pole);
    }
  }

  private addWarehouses(
    warehouses: WarehouseLayout[],
    mats: { wall: THREE.Material; roof: THREE.Material; base: THREE.Material }
  ) {
    if (!warehouses?.length) {
      return;
    }
    this.getWarehousePrototype()
      .then((prototype) => {
        warehouses.forEach((w) => {
          const warehouse = this.instantiateWarehouseFromModel(prototype, w);
          this.scene.add(warehouse);
        });
      })
      .catch((err) => {
        console.warn('[PortScene] falha ao carregar modelo de warehouse, usando fallback', err);
        warehouses.forEach((w) => this.addWarehouseFallback(w, mats));
      });
  }

  private getWarehousePrototype(): Promise<THREE.Group> {
    if (this.warehousePrototype) {
      return Promise.resolve(this.warehousePrototype);
    }
    if (!this.warehouseModelLoading) {
      this.warehouseModelLoading = new Promise((resolve, reject) => {
        const tryUrls = [...this.warehouseModelUrls];
        const loadNext = () => {
          const url = tryUrls.shift();
          if (!url) {
            reject(new Error('warehouse GLB not found'));
            return;
          }
          this.gltfLoader.load(
            url,
            (gltf) => {
              const root = gltf.scene;
              root.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                  obj.castShadow = true;
                  obj.receiveShadow = true;
                }
              });
              const box = new THREE.Box3().setFromObject(root);
              const size = new THREE.Vector3();
              box.getSize(size);
              const center = new THREE.Vector3();
              box.getCenter(center);
              root.position.x -= center.x;
              root.position.z -= center.z;
              root.position.y -= box.min.y;
              this.warehouseBaseDimensions = size;
              this.warehousePrototype = root;
              resolve(root);
            },
            undefined,
            (error) => {
              console.warn('[PortScene] erro ao carregar warehouse GLB', url, error);
              loadNext();
            }
          );
        };
        loadNext();
      });
    }
    return this.warehouseModelLoading;
  }

  private instantiateWarehouseFromModel(prototype: THREE.Group, layout: WarehouseLayout): THREE.Group {
    const warehouse = prototype.clone(true);
    const dims = this.warehouseBaseDimensions ?? new THREE.Vector3(1, 1, 1);
    warehouse.scale.set(
      layout.size.width / dims.x,
      layout.size.height / dims.y,
      layout.size.depth / dims.z
    );
    warehouse.position.set(layout.position.x, layout.position.y, layout.position.z);
    warehouse.rotation.y = layout.rotationY || 0;
    warehouse.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return warehouse;
  }

  private addWarehouseFallback(
    w: WarehouseLayout,
    mats: { wall: THREE.Material; roof: THREE.Material; base: THREE.Material }
  ) {
    const geo = new THREE.BoxGeometry(w.size.width, w.size.height, w.size.depth);
    const materials: THREE.Material[] = [
      mats.wall,
      mats.wall,
      mats.roof,
      mats.base,
      mats.wall,
      mats.wall,
    ];
    const mesh = new THREE.Mesh(geo, materials);
    mesh.position.set(w.position.x, w.position.y + w.size.height / 2, w.position.z);
    mesh.rotation.y = w.rotationY || 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private addContainerStacks(area: LandAreaLayout, platformHeight: number) {
    const usableWidth = area.width - 100;
    const usableDepth = area.depth - 140;
    if (usableWidth <= 0 || usableDepth <= 0) {
      return;
    }

    const cols = Math.max(1, Math.floor(usableWidth / 80));
    const rows = Math.max(1, Math.floor(usableDepth / 100));
    const startX = area.x - usableWidth / 2;
    const startZ = area.z - usableDepth / 2;
    let placed = 0;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if ((c + r) % 2 !== 0) continue;
        const px = startX + c * (usableWidth / cols) + 40;
        const pz = startZ + r * (usableDepth / rows) + 40;
        const stackSeed = area.storageAreaId * 73 + placed * 11;
        const levels = 1 + Math.round(this.pseudoRandom(stackSeed) * 2);

        for (let level = 0; level < levels; level++) {
          const material = this.containerMaterials[(placed + level) % this.containerMaterials.length];
          const container = new THREE.Mesh(this.containerGeometry, material);
          container.position.set(px, platformHeight + 7 + level * 14, pz);
          container.castShadow = true;
          container.receiveShadow = true;
          this.scene.add(container);
          this.markContainer(container, level + 1);
        }
        placed++;
        if (placed > 80) {
          return;
        }
      }
    }
  }

  private resetGeneratedAssets() {
    this.generatedMaterials.forEach((mat) => mat.dispose());
    this.generatedTextures.forEach((tex) => tex.dispose());
    this.generatedMaterials = [];
    this.generatedTextures = [];
  }

  private resetContainerTracking() {
    this.containerMeshes = [];
    this.containerLookup.clear();
    this.containerHotspots = [];
    this.stagedContainers = [];
    this.totalContainers = 0;
    this.featuredContainers = [];
    this.hoveredContainer = undefined;
    this.selectedContainer = undefined;
    this.updateHoverOutline(undefined);
    this.updateSelectionOutline(undefined);
  }

  private computeDockBands(dock: DockLayout): DockBandInfo {
    let quayWidth = THREE.MathUtils.clamp(dock.size.width * 0.32, 16, 52);
    let roadWidth = THREE.MathUtils.clamp(dock.size.width * 0.45, 26, 95);
    const minBuffer = 6;
    const maxUsable = Math.max(minBuffer, dock.size.width - minBuffer);
    const used = quayWidth + roadWidth;
    if (used > maxUsable) {
      const shrink = maxUsable / used;
      quayWidth *= shrink;
      roadWidth *= shrink;
    }
    const bufferWidth = Math.max(minBuffer, dock.size.width - (quayWidth + roadWidth));
    const quayZ = -dock.size.width / 2 + quayWidth / 2 + 2;
    const bufferZ = quayZ + quayWidth / 2 + bufferWidth / 2;
    const roadZ = dock.size.width / 2 - roadWidth / 2 - 2;
    return { quayWidth, roadWidth, bufferWidth, quayZ, bufferZ, roadZ };
  }

  private markContainer(object: THREE.Object3D, stackLevelHint?: number) {
    this.stagedContainers.push({ object, stackLevelHint });
  }

  private queueModelContainers() {
    if (!this.glbContainerObjects.length) return;
    for (const obj of this.glbContainerObjects) {
      this.markContainer(obj);
    }
  }

  private createDockMaterialSet(desc?: DockMaterialDTO): DockMaterialSet {
    return {
      top: this.createSurfaceMaterial(desc?.top, 0xcfd6df),
      side: this.createSurfaceMaterial(desc?.side, 0x8a94a2),
      trim: this.createSurfaceMaterial(desc?.trim, 0xf8fbff),
      bottom: this.trackMaterial(
        new THREE.MeshStandardMaterial({
          color: 0x545b67,
          roughness: 0.95,
          metalness: 0.03,
        })
      ),
    };
  }

  private createSurfaceMaterial(config: SurfaceMaterialDTO | undefined, fallback: number): THREE.MeshStandardMaterial {
    const fallbackHex = `#${new THREE.Color(fallback).getHexString()}`;
    const effective: SurfaceMaterialDTO =
      config ??
      ({
        color: fallbackHex,
        roughness: 0.8,
        metalness: 0.06,
        colorMap: {
          pattern: 'noise',
          primaryColor: '#d8dde5',
          secondaryColor: '#c1c7d2',
          scale: 4,
          strength: 0.45,
        },
      } as SurfaceMaterialDTO);

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(effective.color ?? fallback),
      roughness: effective.roughness ?? 0.78,
      metalness: effective.metalness ?? 0.06,
    });

    const colorMap = this.createProceduralTexture(effective.colorMap, false);
    if (colorMap) {
      material.map = colorMap;
    }

    const roughnessMap = this.createProceduralTexture(effective.roughnessMap, true);
    if (roughnessMap) {
      material.roughnessMap = roughnessMap;
    }

    return this.trackMaterial(material);
  }

  private createProceduralTexture(
    desc?: ProceduralTextureDescriptor,
    grayscale = false
  ): THREE.CanvasTexture | undefined {
    if (!desc) {
      return undefined;
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }

    const primary = grayscale ? this.toGray(desc.primaryColor) : desc.primaryColor;
    const secondarySource = desc.secondaryColor ?? desc.primaryColor;
    const secondary = grayscale ? this.toGray(secondarySource) : secondarySource;
    switch (desc.pattern) {
      case 'stripe':
        this.paintStripeTexture(ctx, primary, secondary, desc);
        break;
      case 'grid':
        this.paintGridTexture(ctx, primary, secondary, desc);
        break;
      default:
        this.paintNoiseTexture(ctx, primary, secondary, desc);
        break;
    }

    const texture = new THREE.CanvasTexture(canvas);
    const repeat = Math.max(1, desc.scale ?? 1);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    if (desc.rotation && desc.rotation !== 0) {
      texture.center.set(0.5, 0.5);
      texture.rotation = desc.rotation;
    }
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return this.trackTexture(texture);
  }

  private paintStripeTexture(
    ctx: CanvasRenderingContext2D,
    primary: string,
    secondary: string,
    desc: ProceduralTextureDescriptor
  ) {
    const stripes = Math.max(2, Math.round((desc.scale ?? 1) * 4));
    const stripeWidth = ctx.canvas.width / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? primary : secondary;
      ctx.fillRect(i * stripeWidth, 0, stripeWidth + 1, ctx.canvas.height);
    }
  }

  private paintGridTexture(
    ctx: CanvasRenderingContext2D,
    primary: string,
    secondary: string,
    desc: ProceduralTextureDescriptor
  ) {
    const cells = Math.max(2, Math.round((desc.scale ?? 1) * 3));
    const cellSize = ctx.canvas.width / cells;
    for (let x = 0; x < cells; x++) {
      for (let y = 0; y < cells; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? primary : secondary;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize + 1, cellSize + 1);
      }
    }
  }

  private paintNoiseTexture(
    ctx: CanvasRenderingContext2D,
    primary: string,
    secondary: string,
    desc: ProceduralTextureDescriptor
  ) {
    const data = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);
    const [r1, g1, b1] = this.colorToRgb(primary);
    const [r2, g2, b2] = this.colorToRgb(secondary);
    const intensity = Math.max(0, Math.min(1, desc.strength ?? 0.5));
    for (let i = 0; i < data.data.length; i += 4) {
      const mix = Math.random() * intensity;
      data.data[i] = r1 * (1 - mix) + r2 * mix;
      data.data[i + 1] = g1 * (1 - mix) + g2 * mix;
      data.data[i + 2] = b1 * (1 - mix) + b2 * mix;
      data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
  }

  private colorToRgb(value?: string | number): [number, number, number] {
    const color = new THREE.Color(value ?? '#ffffff');
    return [Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255)];
  }

  private toGray(value?: string): string {
    const [r, g, b] = this.colorToRgb(value);
    const gray = Math.round((r + g + b) / 3);
    return `rgb(${gray},${gray},${gray})`;
  }

  private trackMaterial<T extends THREE.Material>(material: T): T {
    this.generatedMaterials.push(material);
    return material;
  }

  private trackTexture<T extends THREE.Texture>(texture?: T): T | undefined {
    if (texture) {
      this.generatedTextures.push(texture);
    }
    return texture;
  }

  private addDockFenders(dock: DockLayout) {
    const numFenders = Math.max(6, Math.floor(dock.size.length / 80));
    const startX = -dock.size.length / 2 + 20;
    const step = (dock.size.length - 40) / (numFenders - 1);

    for (let i = 0; i < numFenders; i++) {
      const fender = new THREE.Mesh(this.fenderGeometry, this.fenderMaterial);
      const localX = startX + i * step;
      fender.position.copy(
        this.relativeToDock(dock, new THREE.Vector3(localX, 2, -dock.size.width / 2 - 1.5))
      );
      fender.castShadow = true;
      fender.receiveShadow = true;
      this.scene.add(fender);
    }
  }

  private decorateDock(dock: DockLayout, dockMaterials: DockMaterialSet) {
    const bands = this.computeDockBands(dock);
    const quay = new THREE.Mesh(
      new THREE.BoxGeometry(dock.size.length * 0.98, 0.4, bands.quayWidth),
      dockMaterials.trim
    );
    quay.position.copy(
      this.relativeToDock(dock, new THREE.Vector3(0, dock.size.height + 0.25, bands.quayZ))
    );
    quay.rotation.y = dock.rotationY;
    quay.castShadow = true;
    this.scene.add(quay);

    const bufferStrip = new THREE.Mesh(
      new THREE.BoxGeometry(dock.size.length * 0.96, 0.3, bands.bufferWidth),
      this.bufferMaterial
    );
    bufferStrip.position.copy(
      this.relativeToDock(dock, new THREE.Vector3(0, dock.size.height + 0.2, bands.bufferZ))
    );
    bufferStrip.rotation.y = dock.rotationY;
    bufferStrip.receiveShadow = true;
    this.scene.add(bufferStrip);

    const guardRail = new THREE.Mesh(
      new THREE.BoxGeometry(dock.size.length * 0.96, 1.2, 0.8),
      this.guardRailMaterial
    );
    const guardLocalZ = bands.quayZ + bands.quayWidth / 2 + 0.6;
    guardRail.position.copy(
      this.relativeToDock(dock, new THREE.Vector3(0, dock.size.height + 0.7, guardLocalZ))
    );
    guardRail.rotation.y = dock.rotationY;
    guardRail.castShadow = true;
    this.scene.add(guardRail);

    const serviceRoad = new THREE.Mesh(
      new THREE.BoxGeometry(dock.size.length * 0.94, 0.35, bands.roadWidth),
      this.serviceRoadMaterial
    );
    serviceRoad.position.copy(
      this.relativeToDock(dock, new THREE.Vector3(0, dock.size.height + 0.2, bands.roadZ))
    );
    serviceRoad.rotation.y = dock.rotationY;
    serviceRoad.castShadow = true;
    serviceRoad.receiveShadow = true;
    this.scene.add(serviceRoad);

    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(dock.size.length * 0.9, 0.8),
      this.roadStripeMaterial
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.rotation.y = dock.rotationY;
    stripe.position.copy(
      this.relativeToDock(dock, new THREE.Vector3(0, dock.size.height + 0.55, bands.roadZ))
    );
    this.scene.add(stripe);

    this.addCraneRails(dock, bands);
    this.addDockDecals(dock, bands);
    this.addUtilityBoxes(dock, bands);
    this.addDockContainers(dock, bands);
    this.addDockVehicles(dock, bands);

    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(dock.size.length * 1.05, dock.size.width * 0.9),
      this.foamMaterial
    );
    foam.rotation.x = -Math.PI / 2;
    foam.rotation.y = dock.rotationY;
    foam.position.copy(
      this.relativeToDock(dock, new THREE.Vector3(0, 0.1, -dock.size.width / 2 - 10))
    );
    this.scene.add(foam);

    const bollardCount = Math.max(3, Math.floor(dock.size.length / 70));
    const step = dock.size.length / (bollardCount + 1);
    for (let i = 0; i < bollardCount; i++) {
      const bollard = new THREE.Mesh(this.bollardGeometry, this.bollardMaterial);
      bollard.position.copy(
        this.relativeToDock(
          dock,
          new THREE.Vector3(
            -dock.size.length / 2 + step * (i + 1),
            dock.size.height + 2.2,
            bands.quayZ - bands.quayWidth / 2 + 1.4
          )
        )
      );
      bollard.rotation.y = dock.rotationY;
      bollard.castShadow = true;
      bollard.receiveShadow = true;
      this.scene.add(bollard);
    }

    const poleCount = Math.max(1, Math.floor(dock.size.length / 220));
    for (let i = 0; i < poleCount; i++) {
      const pole = this.createLightPole();
      pole.position.copy(
        this.relativeToDock(
          dock,
          new THREE.Vector3(
            -dock.size.length / 2 + ((i + 1) * dock.size.length) / (poleCount + 1),
            dock.size.height,
            bands.roadZ + bands.roadWidth / 2 - 6
          )
        )
      );
      pole.rotation.y = dock.rotationY;
      this.scene.add(pole);
    }
  }

  private addCraneRails(dock: DockLayout, bands: DockBandInfo) {
    const length = dock.size.length * 0.98;
    const offsets = [
      bands.quayZ - bands.quayWidth / 2 + 1.1,
      bands.quayZ + bands.quayWidth / 2 - 1.1,
    ];

    for (const localZ of offsets) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.35, 0.9), this.craneRailMaterial);
      rail.position.copy(this.relativeToDock(dock, new THREE.Vector3(0, dock.size.height + 0.2, localZ)));
      rail.rotation.y = dock.rotationY;
      rail.castShadow = true;
      rail.receiveShadow = true;
      this.scene.add(rail);
    }

    const sleeperSpan = Math.abs(offsets[1] - offsets[0]);
    const sleeperCount = Math.max(4, Math.floor(dock.size.length / 55));
    for (let i = 0; i < sleeperCount; i++) {
      const sleeper = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 0.3, sleeperSpan + 1.2),
        this.railSleeperMaterial
      );
      const localX = -dock.size.length / 2 + ((i + 0.5) * dock.size.length) / sleeperCount;
      sleeper.position.copy(
        this.relativeToDock(
          dock,
          new THREE.Vector3(localX, dock.size.height + 0.08, (offsets[0] + offsets[1]) / 2)
        )
      );
      sleeper.rotation.y = dock.rotationY;
      sleeper.castShadow = true;
      sleeper.receiveShadow = true;
      this.scene.add(sleeper);
    }
  }

  private addDockDecals(dock: DockLayout, bands: DockBandInfo) {
    const hazardLength = dock.size.length * 0.38;
    const hazardDepth = Math.max(14, bands.bufferWidth * 0.78);
    const hazard = this.createHazardDecal(hazardLength, hazardDepth);
    const mirrored = hazard.clone();
    const hazardOffsets = [-dock.size.length * 0.24, dock.size.length * 0.24];
    const hazardY = dock.size.height + 0.4;
    const hazardZ = bands.bufferZ;
    hazardOffsets.forEach((offset, index) => {
      const decal = index === 0 ? hazard : mirrored;
      decal.position.copy(this.relativeToDock(dock, new THREE.Vector3(offset, hazardY, hazardZ)));
      decal.rotation.y = dock.rotationY;
      this.scene.add(decal);
    });

    const walkwayLine = new THREE.Mesh(
      new THREE.BoxGeometry(dock.size.length * 0.94, 0.12, 1.6),
      this.linePaintMaterial
    );
    walkwayLine.position.copy(
      this.relativeToDock(dock, new THREE.Vector3(0, dock.size.height + 0.45, bands.bufferZ - bands.bufferWidth / 2 + 0.9))
    );
    walkwayLine.rotation.y = dock.rotationY;
    walkwayLine.castShadow = false;
    walkwayLine.receiveShadow = false;
    walkwayLine.renderOrder = 6;
    this.scene.add(walkwayLine);
    const walkwayLine2 = walkwayLine.clone();
    walkwayLine2.position.copy(
      this.relativeToDock(dock, new THREE.Vector3(0, dock.size.height + 0.45, bands.quayZ + bands.quayWidth / 2 - 0.9))
    );
    this.scene.add(walkwayLine2);
    const walkwayLine3 = walkwayLine.clone();
    walkwayLine3.position.copy(
      this.relativeToDock(dock, new THREE.Vector3(0, dock.size.height + 0.45, bands.roadZ - bands.roadWidth / 2 + 1.1))
    );
    this.scene.add(walkwayLine3);

    const parkingSlots = Math.max(4, Math.floor(dock.size.length / 150));
    const parking = this.createParkingDecal(
      dock.size.length * 0.82,
      Math.max(18, bands.roadWidth * 0.92),
      parkingSlots
    );
    parking.position.copy(this.relativeToDock(dock, new THREE.Vector3(0, dock.size.height + 0.36, bands.roadZ)));
    parking.rotation.y = dock.rotationY;
    this.scene.add(parking);

    const arrowOffsets = [-dock.size.length * 0.22, dock.size.length * 0.22];
    for (const offset of arrowOffsets) {
      const arrow = this.createArrowDecal(
        Math.min(150, dock.size.length * 0.22),
        Math.max(18, bands.roadWidth * 0.28)
      );
      arrow.position.copy(this.relativeToDock(dock, new THREE.Vector3(offset, dock.size.height + 0.37, bands.roadZ)));
      arrow.rotation.y = dock.rotationY;
      this.scene.add(arrow);
    }

    const crosswalk = this.createCrosswalkDecal(
      Math.min(160, dock.size.length * 0.24),
      Math.max(24, bands.roadZ - bands.bufferZ + bands.bufferWidth * 0.8)
    );
    crosswalk.position.copy(
      this.relativeToDock(
        dock,
        new THREE.Vector3(-dock.size.length * 0.32, dock.size.height + 0.37, (bands.bufferZ + bands.roadZ) / 2)
      )
    );
    crosswalk.rotation.y = dock.rotationY;
    this.scene.add(crosswalk);

    const label = this.createDockLabelDecal(
      (dock.name || `Dock ${dock.dockId}`).toUpperCase(),
      Math.min(520, dock.size.length * 0.55),
      Math.max(18, bands.bufferWidth * 0.42)
    );
    label.position.copy(
      this.relativeToDock(dock, new THREE.Vector3(0, dock.size.height + 0.38, bands.bufferZ + bands.bufferWidth / 2 - 2))
    );
    label.rotation.y = dock.rotationY;
    this.scene.add(label);
  }

  private addUtilityBoxes(dock: DockLayout, bands: DockBandInfo) {
    const count = Math.max(1, Math.floor(dock.size.length / 220));
    const spacing = dock.size.length / (count + 1);
    for (let i = 0; i < count; i++) {
      const cabinet = this.createUtilityCabinet();
      const localX = -dock.size.length / 2 + spacing * (i + 1);
      const localZ = bands.bufferZ + bands.bufferWidth / 2 + 4;
      cabinet.position.copy(this.relativeToDock(dock, new THREE.Vector3(localX, dock.size.height, localZ)));
      cabinet.rotation.y = dock.rotationY;
      this.scene.add(cabinet);
    }
  }

  private addDockContainers(dock: DockLayout, bands: DockBandInfo) {
    const count = Math.max(3, Math.floor(dock.size.length / 140));
    const spacing = dock.size.length / (count + 1);
    for (let i = 0; i < count; i++) {
      const stack = this.createDockContainerStack(2 + (i % 2), dock.dockId * 29 + i);
      const offsetX = -dock.size.length / 2 + spacing * (i + 1);
      const offsetZ = bands.bufferZ - bands.bufferWidth / 2 + 6;
      stack.position.copy(
        this.relativeToDock(dock, new THREE.Vector3(offsetX, dock.size.height + 6, offsetZ))
      );
      stack.rotation.y = dock.rotationY;
      this.scene.add(stack);
    }
  }

  private addDockVehicles(dock: DockLayout, bands: DockBandInfo) {
    const truckCount = Math.max(1, Math.floor(dock.size.length / 260));
    const truckSpacing = dock.size.length / (truckCount + 1);
    for (let i = 0; i < truckCount; i++) {
      const truck = this.createYardTruck(i);
      const offsetX = -dock.size.length / 2 + truckSpacing * (i + 1);
      truck.position.copy(
        this.relativeToDock(dock, new THREE.Vector3(offsetX, dock.size.height + 5.2, bands.roadZ))
      );
      truck.rotation.y = dock.rotationY;
      this.scene.add(truck);
    }

    const forklifts = Math.max(2, Math.floor(dock.size.length / 180));
    for (let i = 0; i < forklifts; i++) {
      const forklift = this.createForklift();
      const offsetX =
        -dock.size.length / 2 + ((i + 0.5) * dock.size.length) / forklifts + (i % 2 === 0 ? 12 : -18);
      const offsetZ = bands.bufferZ + (i % 2 === 0 ? 6 : -6);
      forklift.position.copy(
        this.relativeToDock(dock, new THREE.Vector3(offsetX, dock.size.height + 4.2, offsetZ))
      );
      forklift.rotation.y = dock.rotationY + (i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
      this.scene.add(forklift);
    }
  }

  private createUtilityCabinet(): THREE.Group {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 10), this.utilityBoxMaterial);
    base.position.y = 1.5;
    base.castShadow = base.receiveShadow = true;

    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 6), this.utilityBoxMaterial);
    body.position.y = 7;
    body.castShadow = body.receiveShadow = true;

    const door = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 0.3), this.cabinetDoorMaterial);
    door.position.set(0, 0, 3.15);
    door.castShadow = false;
    body.add(door);

    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 8, 10), this.craneMaterials.cable);
    conduit.rotation.z = Math.PI / 2;
    conduit.position.set(0, 2.2, 5);

    group.add(base, body, conduit);
    return group;
  }

  private createDockContainerStack(levels: number, seed: number): THREE.Group {
    const group = new THREE.Group();
    const blocks = Math.max(2, levels);
    for (let i = 0; i < blocks; i++) {
      const container = new THREE.Mesh(
        this.containerGeometry,
        this.containerMaterials[(seed + i) % this.containerMaterials.length]
      );
      container.scale.set(0.9, 1, 0.9);
      container.position.set(
        (i % 2 === 0 ? -1 : 1) * 20,
        i * 14,
        this.pseudoRandom(seed + i) * 18 - 9
      );
      container.castShadow = true;
      container.receiveShadow = true;
      group.add(container);
      this.markContainer(container, i + 1);
    }

    const topper = new THREE.Mesh(
      this.containerGeometry,
      this.containerMaterials[(seed + 3) % this.containerMaterials.length]
    );
    topper.scale.set(0.6, 0.75, 0.6);
    topper.position.set(0, blocks * 14, 0);
    topper.castShadow = topper.receiveShadow = true;
    group.add(topper);
    this.markContainer(topper, blocks + 1);

    return group;
  }

  private createYardTruck(seed: number): THREE.Group {
    const group = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(24, 18, 20), this.truckCabMaterial);
    cab.position.set(-20, 9, 0);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 16), this.truckGlassMaterial);
    windshield.position.set(-18, 16, 0);
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(70, 16, 18), this.truckTrailerMaterial);
    trailer.position.set(24, 8, 0);
    const accent = new THREE.Mesh(
      new THREE.BoxGeometry(12, 6, 10),
      this.containerMaterials[(seed + 5) % this.containerMaterials.length]
    );
    accent.position.set(30, 16, 0);

    const wheelGeo = new THREE.CylinderGeometry(4, 4, 4, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const offset of [-26, -10, 8, 26]) {
      const left = new THREE.Mesh(wheelGeo, this.truckWheelMaterial);
      left.position.set(offset, 4, -9);
      const right = left.clone();
      right.position.z = 9;
      left.castShadow = left.receiveShadow = true;
      right.castShadow = right.receiveShadow = true;
      group.add(left, right);
    }

    [cab, windshield, trailer, accent].forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });

    return group;
  }

  private createForklift(): THREE.Group {
    const group = new THREE.Group();
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 14), this.forkliftBodyMaterial);
    chassis.position.y = 4;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 10), this.forkliftBodyMaterial);
    cabin.position.set(-2, 12, 0);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(2.5, 16, 8), this.forkliftMastMaterial);
    mast.position.set(6, 13, 0);
    const forks = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 16), this.forkliftMastMaterial);
    forks.position.set(10, 6, 0);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 12), this.forkliftMastMaterial);
    guard.position.set(-2, 18, 0);

    const wheelGeo = new THREE.CylinderGeometry(2.6, 2.6, 3, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelPositions: [number, number, number][] = [
      [-4, 2, -6],
      [-4, 2, 6],
      [6, 2, -6],
      [6, 2, 6],
    ];
    for (const [x, y, z] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, this.truckWheelMaterial);
      wheel.position.set(x, y, z);
      wheel.castShadow = wheel.receiveShadow = true;
      group.add(wheel);
    }

    [chassis, cabin, mast, forks, guard].forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });

    return group;
  }

  private createHazardDecal(width: number, depth: number): THREE.Mesh {
    return this.createDecalPlane(width, depth, (ctx) => {
      ctx.fillStyle = 'rgba(252, 211, 77, 0.2)';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 22;
      ctx.lineCap = 'round';
      const step = ctx.canvas.width / 10;
      for (let x = -ctx.canvas.height; x < ctx.canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, ctx.canvas.height);
        ctx.lineTo(x + ctx.canvas.height, 0);
        ctx.stroke();
      }
    }, 0.95);
  }

  private createParkingDecal(width: number, depth: number, slots: number): THREE.Mesh {
    return this.createDecalPlane(width, depth, (ctx) => {
      ctx.strokeStyle = 'rgba(244, 244, 245, 0.9)';
      ctx.lineWidth = 18;
      ctx.strokeRect(24, 24, ctx.canvas.width - 48, ctx.canvas.height - 48);
      const usable = ctx.canvas.width - 120;
      const slotWidth = usable / slots;
      for (let i = 1; i < slots; i++) {
        const x = 60 + slotWidth * i;
        ctx.beginPath();
        ctx.moveTo(x, 40);
        ctx.lineTo(x, ctx.canvas.height - 40);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255, 253, 231, 0.8)';
      ctx.lineWidth = 12;
      for (let i = 0; i < slots; i++) {
        const start = 60 + slotWidth * i;
        ctx.beginPath();
        ctx.moveTo(start + slotWidth * 0.2, ctx.canvas.height - 50);
        ctx.lineTo(start + slotWidth * 0.8, ctx.canvas.height - 110);
        ctx.stroke();
      }
    }, 0.85);
  }

  private createDockLabelDecal(text: string, width: number, depth: number): THREE.Mesh {
    const clean = text.replace(/\s+/g, ' ').trim() || 'DOCK';
    return this.createDecalPlane(width, depth, (ctx) => {
      const padding = ctx.canvas.width * 0.08;
      let fontSize = 320;
      ctx.font = `800 ${fontSize}px "Montserrat", "Arial Black", sans-serif`;
      const targetWidth = ctx.canvas.width - padding * 2;
      const metrics = ctx.measureText(clean);
      if (metrics.width > targetWidth) {
        fontSize = (fontSize * targetWidth) / metrics.width;
        ctx.font = `800 ${fontSize}px "Montserrat", "Arial Black", sans-serif`;
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 24;
      ctx.strokeStyle = 'rgba(13, 23, 38, 0.22)';
      ctx.strokeText(clean, ctx.canvas.width / 2, ctx.canvas.height / 2);
      ctx.fillStyle = 'rgba(250, 250, 250, 0.95)';
      ctx.fillText(clean, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }, 0.9);
  }

  private createArrowDecal(width: number, depth: number): THREE.Mesh {
    return this.createDecalPlane(width, depth, (ctx) => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.lineWidth = 70;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ctx.canvas.width * 0.18, ctx.canvas.height * 0.5);
      ctx.lineTo(ctx.canvas.width * 0.75, ctx.canvas.height * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ctx.canvas.width * 0.58, ctx.canvas.height * 0.35);
      ctx.lineTo(ctx.canvas.width * 0.75, ctx.canvas.height * 0.5);
      ctx.lineTo(ctx.canvas.width * 0.58, ctx.canvas.height * 0.65);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fill();
    }, 0.9);
  }

  private createCrosswalkDecal(width: number, depth: number, stripes = 8): THREE.Mesh {
    return this.createDecalPlane(width, depth, (ctx) => {
      ctx.fillStyle = 'rgba(250, 250, 250, 0.95)';
      const stripeWidth = ctx.canvas.width / (stripes * 2);
      for (let i = 0; i < stripes; i++) {
        ctx.fillRect(i * stripeWidth * 2, 0, stripeWidth, ctx.canvas.height);
      }
    }, 0.92);
  }

  private createDecalPlane(
    width: number,
    depth: number,
    painter: (ctx: CanvasRenderingContext2D) => void,
    opacity = 1
  ): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const mat = this.trackMaterial(
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
      mesh.visible = false;
      return mesh;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    painter(ctx);
    const texture = new THREE.CanvasTexture(canvas);
    this.trackTexture(texture);
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 4;
    texture.needsUpdate = true;

    const material = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
      })
    );
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 10;
    return mesh;
  }

  private createLightPole(): THREE.Group {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(this.poleGeometry, this.poleMaterial);
    pole.position.y = 20;
    const head = new THREE.Mesh(this.poleHeadGeometry, this.poleMaterial);
    head.position.y = 41;
    const lampFront = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1, 3.2), this.lightEmissiveMaterial);
    lampFront.position.set(0, 41, 3.2);
    const lampBack = lampFront.clone();
    lampBack.position.z = -3.2;
    const light = new THREE.PointLight(0xfff7c0, 0.35, 260);
    light.position.y = 41;

    group.add(pole, head, lampFront, lampBack, light);
    return group;
  }

  private addVessels(layout: PortLayoutDTO) {
    if (!layout.docks?.length) return;
    const vesselCount = Math.min(3, layout.docks.length);
    for (let i = 0; i < vesselCount; i++) {
      const dock = layout.docks[(i * 2) % layout.docks.length];
      const palette = this.vesselPalettes[i % this.vesselPalettes.length];
      const variation = this.pseudoRandom(dock.dockId * 17 + i);
      const length = Math.max(160, dock.size.length * (0.55 + variation * 0.25));
      const vessel = this.createVessel(length, palette, i);
      vessel.position.copy(
        this.relativeToDock(
          dock,
          new THREE.Vector3(0, -dock.size.height / 2 + 6, -dock.size.width / 2 - 50)
        )
      );
      vessel.rotation.y = dock.rotationY + Math.PI;
      this.scene.add(vessel);
    }
  }

  private createVessel(length: number, palette: VesselPalette, seed: number): THREE.Group {
    const group = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
      color: palette.hull,
      roughness: 0.6,
      metalness: 0.25,
    });
    const deckMat = new THREE.MeshStandardMaterial({
      color: palette.deck,
      roughness: 0.4,
      metalness: 0.1,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: palette.accent,
      roughness: 0.5,
      metalness: 0.2,
    });
    const cabinMat = new THREE.MeshStandardMaterial({
      color: palette.cabin,
      roughness: 0.35,
      metalness: 0.05,
    });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(length, 20, 64), hullMat);
    hull.position.y = 10;
    hull.castShadow = true;
    hull.receiveShadow = true;

    const bow = new THREE.Mesh(new THREE.CylinderGeometry(0, 32, 36, 4, 1), hullMat);
    bow.rotation.z = Math.PI / 2;
    bow.position.set(length / 2 + 10, 8, 0);
    bow.castShadow = true;

    const deck = new THREE.Mesh(new THREE.BoxGeometry(length * 0.65, 8, 46), deckMat);
    deck.position.set(-length * 0.05, 20, 0);
    deck.castShadow = true;

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(length * 0.2, 16, 28), cabinMat);
    bridge.position.set(-length / 4, 26, 0);
    bridge.castShadow = true;

    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 18, 16), accentMat);
    funnel.position.set(-length / 3.2, 28, -12);
    funnel.castShadow = true;

    group.add(hull, bow, deck, bridge, funnel);

    const miniStacks = 3 + Math.round(this.pseudoRandom(seed * 31) * 2);
    for (let i = 0; i < miniStacks; i++) {
      const mini = new THREE.Mesh(
        this.containerGeometry,
        this.containerMaterials[(i + seed) % this.containerMaterials.length]
      );
      mini.scale.set(0.7, 0.85, 0.55);
      const factor = miniStacks === 1 ? 0.5 : i / (miniStacks - 1);
      const x = -length * 0.25 + factor * (length * 0.5);
      mini.position.set(x, 22, (i % 2 === 0 ? 1 : -1) * 12);
      mini.castShadow = true;
      mini.receiveShadow = true;
      group.add(mini);
      this.markContainer(mini, 1);
    }

    return group;
  }

  private addCranesForDock(dock: DockLayout) {
    const length = dock.size.length;
    const craneCount = Math.max(3, Math.round(length / 260));
    const spacing = length / (craneCount + 1);
    const dockTopY = dock.position.y + dock.size.height;
    const bands = this.computeDockBands(dock);

    for (let i = 0; i < craneCount; i++) {
      const localX = -length / 2 + spacing * (i + 1);
      const offset = new THREE.Vector3(localX, dockTopY + 32, bands.quayZ);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), dock.rotationY);
      const crane = this.createCrane();
      crane.position.set(dock.position.x + offset.x, offset.y, dock.position.z + offset.z);
      crane.rotation.y = dock.rotationY;
      this.scene.add(crane);
    }
  }

  private createCrane(): THREE.Group {
    const group = new THREE.Group();
    const column = new THREE.Mesh(new THREE.BoxGeometry(20, 90, 24), this.craneMaterials.boom);
    column.position.y = 45;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 150), this.craneMaterials.boom);
    arm.position.set(0, 90, -70);
    arm.rotation.x = -Math.PI / 16;
    const counterWeight = new THREE.Mesh(new THREE.BoxGeometry(32, 22, 32), this.craneMaterials.counterWeight);
    counterWeight.position.set(0, 90, 70);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(24, 20, 24), this.craneMaterials.cabin);
    cabin.position.set(0, 70, -24);
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 18), this.craneMaterials.cabin);
    trolley.position.set(0, 80, -40);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 46, 8), this.craneMaterials.cable);
    cable.position.set(0, 55, -40);

    [column, arm, counterWeight, cabin, trolley, cable].forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });

    return group;
  }

  private pseudoRandom(seed: number): number {
    const x = Math.sin(seed + this.randomBaseSeed) * 10000;
    return x - Math.floor(x);
  }

  private relativeToDock(dock: DockLayout, offset: THREE.Vector3): THREE.Vector3 {
    const rotated = offset.clone();
    rotated.applyAxisAngle(new THREE.Vector3(0, 1, 0), dock.rotationY);
    rotated.x += dock.position.x;
    rotated.y += dock.position.y;
    rotated.z += dock.position.z;
    return rotated;
  }

  private buildFallback() {
    this.buildFromLayout(this.createDemoLayout());
  }

  private animate = () => {
    // Simple Gerstner-like ripples over the water plane
    if (this.waterGeom && this.waterBase) {
      const pos = this.waterGeom.attributes['position'] as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const base = this.waterBase;
      const t = this.clock.getElapsedTime();
      const amp = 0.6; // wave height
      const f1 = 0.0025;
      const f2 = 0.0036;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i + 0];
        const y = base[i + 1];
        const z0 = base[i + 2];
        const w = Math.sin(x * f1 + t * 1.2) * Math.cos(y * f2 - t * 0.9);
        arr[i + 2] = z0 + w * amp;
      }
      pos.needsUpdate = true;
      this.waterGeom.computeVertexNormals();
    }

    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.animate);
  };

  private framePort(center: THREE.Vector3, layout: PortLayoutDTO) {
    // Ajusta a câmara para enquadrar principal cais considerando comprimento
    const length = layout.docks[0]?.size.length || 1000;
    const dist = length * this.orbitDistanceFactor;
    this.controls.target.copy(center);
    this.camera.position.set(
      center.x - dist,
      center.y + dist * this.orbitElevationFactor,
      center.z + dist * 0.95
    );
    this.camera.far = Math.max(this.camera.far, dist * 6);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.controls.target);
  }
}









