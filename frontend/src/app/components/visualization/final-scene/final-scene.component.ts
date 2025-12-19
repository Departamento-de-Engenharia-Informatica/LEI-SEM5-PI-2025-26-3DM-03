import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPortalLatticeCraneModel } from '../crane/dockcrane.component';
import { createGroundModule } from '../ground/ground-module';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  DockLayout,
  DockedVesselPlacement,
  LandAreaLayout,
  PortLayoutDTO,
  PortLayoutService,
  WarehouseLayout,
  CraneLayout,
} from '../../../services/visualization/port-layout.service';
import { DocksService } from '../../../services/docks/docks.service';
import { StorageAreasService } from '../../../services/storage-areas/storage-areas.service';
import { DockDTO } from '../../../models/dock';
import { StorageAreaDTO } from '../../../models/storage-area';
import { AuthService } from '../../../services/auth/auth.service';
import { ToastService } from '../../toast/toast.service';
import { applyTruckTrailerTexture, applyTruckWindowTexture } from '../truck/truck-texture.util';
import { removeEmbeddedTruckFromCargoVessel } from '../vessel/cargo-vessel-truck.util';

type FacilityType = 'dock' | 'yard' | 'warehouse' | 'crane' | 'vessel' | 'generic';
type VesselVisualState = 'waiting' | 'loading' | 'unloading';
type VesselDisplayState = VesselVisualState | 'upcoming' | 'departed';

interface FacilityHotspot {
  id: string;
  name: string;
  type: FacilityType;
  object: THREE.Object3D;
  focus?: THREE.Vector3;
  dockLayout?: DockLayout;
  yardLayout?: LandAreaLayout;
  warehouseLayout?: WarehouseLayout;
  vesselPlacement?: DockedVesselPlacement;
  vesselState?: VesselVisualState;
  dockName?: string;
  craneSpecs?: {
    designation?: string;
    height?: number;
    gauge?: number;
    clearance?: number;
  };
}

type FacilityStat = { label: string; value: string };

interface FacilityInfoCard {
  title: string;
  type: FacilityType;
  description?: string;
  generalStats: FacilityStat[];
  restrictedStats?: FacilityStat[];
  operations?: string[];
  updatedAt: Date;
  note?: string;
}

interface CameraTween {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  startTime: number;
  duration: number;
}

interface VesselVisualBinding {
  object: THREE.Group;
  label?: THREE.Sprite;
  state: VesselVisualState;
}

interface VesselAnimationState {
  object: THREE.Group;
  label?: THREE.Sprite;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startLabelPos?: THREE.Vector3;
  endLabelPos?: THREE.Vector3;
  startTime: number;
  duration: number;
  pathRight?: THREE.Vector3;
  pathForward?: THREE.Vector3;
  dragAmplitude: number;
  bobAmplitude: number;
  curve?: THREE.Curve<THREE.Vector3>;
  onComplete?: () => void;
  freezeHeadingFrom?: number;
  lockedForward?: THREE.Vector3;
}

@Component({
  selector: 'app-final-scene',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './final-scene.component.html',
  styleUrls: ['./final-scene.component.scss'],
})
export class FinalSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas3d', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sceneWrapper', { static: true }) private wrapperRef!: ElementRef<HTMLDivElement>;

  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private waterGeom?: THREE.PlaneGeometry;
  private waterBase?: Float32Array;
  private readonly scene = new THREE.Scene();
  private readonly clock = new THREE.Clock();
  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];
  private readonly disposableTextures: THREE.Texture[] = [];
  private readonly gltfLoader = new GLTFLoader();
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly waterLevelY = 60;
  private readonly quayEdgeZ = 360;
  private readonly cargoVesselClearance = 22;
  private readonly cargoVesselFreeboard = -8;
  private readonly cargoVesselTargetLength = 300;
  private readonly cargoVesselBeamScale = 0.7;
  private readonly cargoVesselModelUrls = ['assets/models/cargo_vessel.glb', 'assets/cargo_vessel.glb'];
  private readonly deckWidth = 1500;
  private readonly deckDepth = 1240;
  private readonly deckHeight = 75;
  private readonly deckMarginToEdge = 120;
  private readonly apronDepth = 220;
  private readonly warehouseBaseZ = -820;
  private readonly serviceRoadCenterZ = -560;
  private readonly serviceRoadDepth = 280;
  private readonly logisticsRoadTextureUrl = 'assets/textures/estrada.jpg';
  private logisticsRoadTexture?: THREE.Texture;
  private readonly showLogisticsTrucks = false;
  private readonly warehouseRowSpacing = 240;
  private readonly warehouseFootprintScale = 0.75;
  private readonly warehouseHeightScale = 2;
  private readonly uniformWarehouseLayoutSize = { width: 280, depth: 180, height: 45 } as const;
  private readonly containerStackDensity = 0.75;
  private readonly truckModelUrl = 'assets/models/Truck_DAF.glb';
  private readonly truckTrailerTextureUrl = 'assets/textures/azul.jpg';
  private readonly truckWindowTextureUrl = 'assets/textures/vidro.jpg';
  private readonly cameraMoveSpeed = 260;
  private readonly containerStackUrls = ['assets/models/containers.glb'];
  private containerStackPrototype?: THREE.Group;
  private containerStackLoading?: Promise<THREE.Group>;
  private containerUnitSize = new THREE.Vector3(40, 16, 80);
  private readonly containerColors = [0xff8c5f, 0x00c2ff, 0xff4f81, 0x7dd87d, 0xffbf69, 0x9b5de5];
  private readonly warehouseModelUrls = ['assets/models/warehouse.glb', 'assets/warehouse.glb'];
  private warehousePrototype?: THREE.Group;
  private warehouseLoading?: Promise<THREE.Group>;
  private warehouseBaseDimensions?: THREE.Vector3;
  private truckPrototype?: THREE.Group;
  private truckLoading?: Promise<THREE.Group>;
  private truckTrailerTexture?: THREE.Texture;
  private truckWindowTexture?: THREE.Texture;
  private cargoVesselPrototype?: THREE.Group;
  private cargoVesselLoading?: Promise<THREE.Group>;
  private cargoVesselHalfBeam = 0;
  private readonly maxBerthLanes = 1;
  private readonly vesselWaitingLeadMs = 10 * 60 * 1000;
  private readonly layoutRefreshMs = 30_000;
  private readonly vesselArrivalAnimationMs = 24_000;
  private readonly vesselDepartureAnimationMs = 24_000;
  private readonly vesselDepartureExitDistance = 2400;
  private layoutData?: PortLayoutDTO;
  private dynamicVesselGroups: THREE.Object3D[] = [];
  private vesselBindings = new Map<string, VesselVisualBinding>();
  private vesselAnimations: VesselAnimationState[] = [];
  private dockNameSprites: THREE.Sprite[] = [];
  private vesselLabelSprites: THREE.Sprite[] = [];
  private dockSpanInfo?: { minEdge: number; maxEdge: number; span: number };
  private readonly dockDeckSlots = [-360, 360];
  private dockDeckOverrides = new Map<number, number>();
  private readonly enablePlaceholderCargoVessels = false;
  private dockServiceLanes: THREE.Object3D[] = [];
  private dynamicWarehouseMeshes: THREE.Object3D[] = [];
  private dynamicCraneMeshes: THREE.Object3D[] = [];
  private containerYardRoads: THREE.Mesh[] = [];
  private staticContainerStacks: THREE.Group[] = [];
  private logisticsVehicles: THREE.Object3D[] = [];
  private warehousePlacementRequestId = 0;
  private containerPlacementRequestId = 0;
  private storageAreaCache = new Map<number, StorageAreaDTO>();
  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private pointerEventsAttached = false;
  private readonly pointerMoveHandler = (event: PointerEvent) => this.onScenePointerMove(event);
  private readonly pointerClickHandler = (event: MouseEvent) => this.onScenePointerClick(event);
  private readonly vesselAnimBase = new THREE.Vector3();
  private readonly vesselAnimOffset = new THREE.Vector3();
  private readonly vesselAnimLabelBase = new THREE.Vector3();
  private readonly vesselAnimTangent = new THREE.Vector3();
  private readonly vesselAnimRight = new THREE.Vector3();
  private readonly vesselAnimUp = new THREE.Vector3(0, 1, 0);
  private facilityHotspots: FacilityHotspot[] = [];
  private readonly persistentFacilityHotspots: FacilityHotspot[] = [];
  private facilityLookup = new Map<THREE.Object3D, FacilityHotspot>();
  private hoveredFacility?: FacilityHotspot;
  selectedFacility?: FacilityHotspot;
  private facilitySelectionOutline?: THREE.BoxHelper;
  private selectionSpotlight?: THREE.SpotLight;
  private readonly selectionSpotTarget = new THREE.Object3D();
  private selectionFillLights: THREE.SpotLight[] = [];
  private readonly minSpotlightGroupSize = 1;
  private ambientLight?: THREE.AmbientLight;
  private hemiLight?: THREE.HemisphereLight;
  private sunLight?: THREE.DirectionalLight;
  private readonly initialCameraPosition = new THREE.Vector3();
  private readonly initialCameraTarget = new THREE.Vector3();
  private readonly ambientBaseIntensity = 0.35;
  private readonly ambientDimIntensity = 0;
  private readonly hemiBaseIntensity = 0.55;
  private readonly hemiDimIntensity = 0.01;
  private readonly sunBaseIntensity = 2.1;
  private readonly sunDimIntensity = 0.02;
  private readonly backgroundBaseColor = new THREE.Color(0xaed4ff);
  private readonly backgroundDimColor = new THREE.Color(0x020305);
  private cameraTween?: CameraTween;
  infoOverlayVisible = false;
  facilityInfoCard?: FacilityInfoCard;
  private facilityInfoRequestId = 0;
  canViewRestrictedInfo = false;
  canSelectOperationalAssets = false;
  canViewVesselStatuses = false;
  private lastAccessDeniedToastAt = 0;
  private readonly accessDeniedCooldownMs = 2500;
  private sceneReady = false;
  private authSubscription?: Subscription;
  readonly cameraKeyState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };
  readonly facilityTypeLabels: Record<FacilityType, string> = {
    dock: 'Cais / Terminal',
    yard: 'Zona de Armazenamento',
    warehouse: 'Armazém',
    crane: 'Grua STS',
    vessel: 'Navio',
    generic: 'Elemento 3D',
  };
  private readonly vesselStatusColors: Record<VesselVisualState, number> = {
    waiting: 0x2ecc71,
    loading: 0x1f78ff,
    unloading: 0xff5c5c,
  };
  private readonly vesselStatusText: Record<VesselVisualState, string> = {
    waiting: 'Em espera',
    loading: 'Carga',
    unloading: 'Descarga',
  };
  readonly vesselStatusLegend: {
    key: VesselVisualState;
    label: string;
    description: string;
    color: string;
    icon: string;
  }[] = [
    {
      key: 'waiting',
      label: 'Em espera',
      description: 'Navio autorizado e a aguardar janela de cais (10 min antes).',
      color: '#2ecc71',
      icon: '⏸️',
    },
    {
      key: 'unloading',
      label: 'Descarga',
      description: 'Primeira metade da janela de atracação dedicada a descarregar carga.',
      color: '#ff5c5c',
      icon: '🪫',
    },
    {
      key: 'loading',
      label: 'Carga',
      description: 'Segunda metade da janela de atracação dedicada a carregar carga.',
      color: '#1f78ff',
      icon: '🔋',
    },
  ];
  fullscreenActive = false;
  panelInfoVisible = false;
  private layoutRefreshHandle?: number;

  constructor(
    private zone: NgZone,
    private layoutApi: PortLayoutService,
    private docksService: DocksService,
    private storageAreas: StorageAreasService,
    private auth: AuthService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    this.updateRoleCapabilities();
    this.authSubscription = this.auth.loggedIn$.subscribe(() => {
      this.updateRoleCapabilities();
      this.cdr.markForCheck();
    });
  }

  private updateRoleCapabilities() {
    const prevStatusVisibility = this.canViewVesselStatuses;
    this.canViewRestrictedInfo = this.auth.hasAny(['authority', 'operator']);
    this.canSelectOperationalAssets = this.auth.hasAny(['authority', 'operator']);
    this.canViewVesselStatuses = this.auth.hasAny(['operator']);
    if (this.selectedFacility && !this.canInteractWithFacility(this.selectedFacility)) {
      this.selectedFacility = undefined;
      this.highlightFacility(undefined);
      if (this.infoOverlayVisible) {
        this.closeInfoOverlay();
      }
    }
    if (this.hoveredFacility && !this.canInteractWithFacility(this.hoveredFacility)) {
      this.hoveredFacility = undefined;
    }
    if (prevStatusVisibility !== this.canViewVesselStatuses && this.sceneReady) {
      this.loadPortAssignments();
    }
  }

  ngAfterViewInit(): void {
    this.initRenderer();
    this.setupSelectionSpotlight();
    this.buildScene();
    this.attachInputListeners();
    this.attachPointerEvents();
    this.loadPortAssignments();
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    this.layoutRefreshHandle = window.setInterval(() => this.loadPortAssignments(), this.layoutRefreshMs);

    this.zone.runOutsideAngular(() => {
      this.animate();
      window.addEventListener('resize', this.handleResize, { passive: true });
    });
    this.sceneReady = true;
  }

  ngOnDestroy(): void {
    this.sceneReady = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.detachInputListeners();
    this.detachPointerEvents();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.clearDynamicVessels();
    this.clearDockLabels();
    this.clearDockServiceLanes();
    this.clearDynamicWarehouses();
    this.clearDynamicCranes();
    this.clearContainerYardRoads();
    this.clearStaticContainerStacks();
    this.clearLogisticsVehicles();
    this.disposableGeometries.forEach((geom) => geom.dispose());
    this.disposableMaterials.forEach((mat) => mat.dispose());
    this.disposableTextures.forEach((tex) => tex.dispose());
    this.truckTrailerTexture?.dispose();
    this.truckWindowTexture?.dispose();
    this.authSubscription?.unsubscribe();
    this.facilitySelectionOutline?.geometry.dispose?.();
    if (this.facilitySelectionOutline) {
      (this.facilitySelectionOutline.material as THREE.Material).dispose?.();
    }
    if (this.selectionSpotlight) {
      this.scene.remove(this.selectionSpotlight);
      this.scene.remove(this.selectionSpotTarget);
    }
    if (this.selectionFillLights.length) {
      this.selectionFillLights.forEach((light) => this.scene.remove(light));
      this.selectionFillLights = [];
    }
    if (this.layoutRefreshHandle) {
      window.clearInterval(this.layoutRefreshHandle);
      this.layoutRefreshHandle = undefined;
    }
  }

  private attachInputListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private detachInputListeners() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private attachPointerEvents() {
    if (this.pointerEventsAttached) return;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    this.pointerEventsAttached = true;
    this.zone.runOutsideAngular(() => {
      canvas.addEventListener('pointermove', this.pointerMoveHandler);
      canvas.addEventListener('click', this.pointerClickHandler);
    });
  }

  private detachPointerEvents() {
    if (!this.pointerEventsAttached) return;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    this.pointerEventsAttached = false;
    canvas.removeEventListener('pointermove', this.pointerMoveHandler);
    canvas.removeEventListener('click', this.pointerClickHandler);
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    let handled = false;
    if (key === 'w') {
      this.cameraKeyState.forward = true;
      handled = true;
    } else if (key === 's') {
      this.cameraKeyState.backward = true;
      handled = true;
    } else if (key === 'a') {
      this.cameraKeyState.left = true;
      handled = true;
    } else if (key === 'd') {
      this.cameraKeyState.right = true;
      handled = true;
    } else if (key === 'i') {
      this.toggleInfoOverlay(event);
      handled = true;
    } else if (key === 'escape') {
      this.exitFullscreenIfActive();
      this.clearSelectionFocus();
      handled = true;
    } else if (key === 'z') {
      this.clearSelectionFocus();
      handled = true;
    }
    if (handled) {
      event.preventDefault();
    }
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (key === 'w') {
      this.cameraKeyState.forward = false;
    } else if (key === 's') {
      this.cameraKeyState.backward = false;
    } else if (key === 'a') {
      this.cameraKeyState.left = false;
    } else if (key === 'd') {
      this.cameraKeyState.right = false;
    }
  };

  toggleFullscreen() {
    const wrapper = this.wrapperRef?.nativeElement;
    if (!wrapper) {
      return;
    }
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen?.().catch((err) => console.warn('[FinalScene] Fullscreen falhou', err));
    } else {
      document.exitFullscreen?.();
    }
  }

  private exitFullscreenIfActive() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }

  private handleFullscreenChange = () => {
    this.fullscreenActive = !!document.fullscreenElement;
  };

  private toggleInfoOverlay(event?: KeyboardEvent) {
    if (event?.repeat) return;
    this.infoOverlayVisible = !this.infoOverlayVisible;
    if (this.infoOverlayVisible) {
      if (!this.selectedFacility) {
        this.selectedFacility = this.hoveredFacility ?? this.getFirstAccessibleFacility();
      }
      if (this.selectedFacility) {
        this.refreshFacilityInfo(this.selectedFacility);
      }
    } else {
      this.facilityInfoCard = undefined;
      this.cdr.detectChanges();
    }
  }

  closeInfoOverlay() {
    if (!this.infoOverlayVisible) return;
    this.infoOverlayVisible = false;
    this.facilityInfoCard = undefined;
    this.cdr.detectChanges();
  }

  private onScenePointerMove(event: PointerEvent) {
    this.updatePointer(event);
    const hoveredCandidate = this.pickFacility();
    const hovered = hoveredCandidate && this.canInteractWithFacility(hoveredCandidate) ? hoveredCandidate : undefined;
    const canvas = this.canvasRef?.nativeElement;
    if (canvas) {
      if (hoveredCandidate && !hovered) {
        canvas.style.cursor = 'not-allowed';
      } else if (hovered) {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'grab';
      }
    }
    if (hovered?.id !== this.hoveredFacility?.id) {
      this.hoveredFacility = hovered;
      if (!this.selectedFacility || hovered?.id !== this.selectedFacility.id) {
        this.highlightFacility(hovered);
      }
    }
  }

  private onScenePointerClick(event: MouseEvent) {
    this.updatePointer(event);
    const picked = this.pickFacility();
    if (!picked) return;
    if (!this.canInteractWithFacility(picked)) {
      this.handleRestrictedFacilityClick(picked);
      return;
    }
    this.setSelectedFacility(picked);
  }

  private updatePointer(event: PointerEvent | MouseEvent) {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private pickFacility(): FacilityHotspot | undefined {
    if (!this.camera || !this.facilityHotspots.length) return undefined;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const objects = this.facilityHotspots.map((f) => f.object);
    const hit = this.raycaster.intersectObjects(objects, true)[0];
    if (!hit) return undefined;
    let target: THREE.Object3D | null = hit.object;
    while (target) {
      const facility = this.facilityLookup.get(target);
      if (facility) {
        return facility;
      }
      target = target.parent;
    }
    return undefined;
  }

  private setSelectedFacility(facility: FacilityHotspot) {
    if (!this.canInteractWithFacility(facility)) {
      return;
    }
    this.selectedFacility = facility;
    this.focusCameraOn(facility);
    this.highlightFacility(facility);
    this.updateSelectionSpotlightTarget(facility);
    if (this.infoOverlayVisible) {
      this.refreshFacilityInfo(facility);
    }
  }

  private getFirstAccessibleFacility(): FacilityHotspot | undefined {
    return this.facilityHotspots.find((facility) => this.canInteractWithFacility(facility));
  }

  private canInteractWithFacility(facility?: FacilityHotspot): facility is FacilityHotspot {
    if (!facility) return false;
    if (this.isOperationalAsset(facility)) {
      return this.canSelectOperationalAssets;
    }
    return true;
  }

  private isOperationalAsset(facility: FacilityHotspot): boolean {
    return facility.type === 'vessel' || facility.type === 'crane';
  }

  private handleRestrictedFacilityClick(facility: FacilityHotspot) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastAccessDeniedToastAt < this.accessDeniedCooldownMs) {
      return;
    }
    this.lastAccessDeniedToastAt = now;
    const label = facility.type === 'vessel' ? 'navios' : 'recursos operacionais';
    this.zone.run(() => this.toast.info(`Apenas operadores logísticos ou autoridades podem selecionar ${label}.`));
  }

  private focusCameraOn(facility: FacilityHotspot) {
    if (!this.camera || !this.controls) return;
    const focus = facility.focus ?? this.getObjectCenter(facility.object);
    const offset = this.camera.position.clone().sub(this.controls.target);
    const endTarget = focus.clone();
    const endPos = focus.clone().add(offset);
    this.startCameraTween(endPos, endTarget, 650);
  }

  private highlightFacility(target?: FacilityHotspot) {
    if (!target) {
      if (this.facilitySelectionOutline) this.facilitySelectionOutline.visible = false;
      return;
    }
    if (!this.facilitySelectionOutline) {
      this.facilitySelectionOutline = new THREE.BoxHelper(target.object, 0x06d6a0);
      this.scene.add(this.facilitySelectionOutline);
    }
    this.facilitySelectionOutline.setFromObject(target.object);
    this.facilitySelectionOutline.visible = true;
  }

  private clearSelectionFocus() {
    this.selectedFacility = undefined;
    this.highlightFacility(undefined);
    this.updateSelectionSpotlightTarget(undefined);
    this.resetCameraToInitial();
  }

  private resetCameraToInitial() {
    if (!this.camera || !this.controls) return;
    this.startCameraTween(this.initialCameraPosition, this.initialCameraTarget, 700);
  }

  private initRenderer() {
    const canvas = this.canvasRef.nativeElement;
    const bounds = canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(bounds?.width || canvas.clientWidth || window.innerWidth, 640);
    const height = Math.max(bounds?.height || 600, 480);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;

    this.camera = new THREE.PerspectiveCamera(48, width / height, 1, 6000);
    this.camera.position.set(-900, 520, 720);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.controls.minDistance = 320;
    this.controls.maxDistance = 2200;
    this.controls.target.set(0, 80, 0);
    this.controls.update();

    this.initialCameraPosition.copy(this.camera.position);
    this.initialCameraTarget.copy(this.controls.target);
  }

  private setupSelectionSpotlight() {
    this.selectionSpotTarget.name = 'FacilitySpotTarget';
    this.scene.add(this.selectionSpotTarget);

    const spot = new THREE.SpotLight(
      0xffffff,
      220,
      1800,
      THREE.MathUtils.degToRad(24),
      0.38,
      0.7
    );
    spot.penumbra = 0.4;
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.camera.near = 30;
    spot.shadow.camera.far = 1800;
    spot.visible = false;
    spot.target = this.selectionSpotTarget;
    this.scene.add(spot);
    this.selectionSpotlight = spot;

    const fillConfigs = [
      { offset: new THREE.Vector3(420, 240, 180), intensity: 220 },
      { offset: new THREE.Vector3(-380, 240, -140), intensity: 220 },
    ];
    this.selectionFillLights = fillConfigs.map((cfg, idx) => {
      const fill = new THREE.SpotLight(
        0xffffff,
        cfg.intensity,
        1800,
        THREE.MathUtils.degToRad(30),
        0.5,
        0.8
      );
      fill.penumbra = 0.45;
      fill.castShadow = false;
      fill.visible = false;
      fill.userData['offset'] = cfg.offset.clone();
      fill.target = this.selectionSpotTarget;
      this.scene.add(fill);
      return fill;
    });
  }

  private buildScene() {
    this.scene.background = this.backgroundBaseColor.clone();
    this.scene.fog = new THREE.Fog(0xd8ecff, 1200, 3600);

    this.addLights();
    this.addWater();
    this.addPlatform();
    this.addServiceRoad();
    this.addDockDetails();
  }

  private addLights() {
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x8fb3cc, this.hemiBaseIntensity);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, this.ambientBaseIntensity);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4da, this.sunBaseIntensity);
    this.sunLight.position.set(-420, 960, 180);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(4096, 4096);
    this.sunLight.shadow.camera.near = 100;
    this.sunLight.shadow.camera.far = 2500;
    this.sunLight.shadow.camera.left = -1400;
    this.sunLight.shadow.camera.right = 1400;
    this.sunLight.shadow.camera.top = 1200;
    this.sunLight.shadow.camera.bottom = -800;
    this.scene.add(this.sunLight);
  }

  private addWater() {
    this.waterGeom = this.trackGeometry(new THREE.PlaneGeometry(4200, 4200, 220, 220));
    const positionAttr = this.waterGeom.getAttribute('position') as THREE.BufferAttribute;
    this.waterBase = new Float32Array(positionAttr.array as Float32Array);
    const waterMaterial = this.trackMaterial(
      new THREE.MeshPhysicalMaterial({
        color: 0x6fb7ff,
        roughness: 0.08,
        metalness: 0.35,
        transmission: 0.45,
        opacity: 0.95,
        transparent: true,
        reflectivity: 0.9,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        ior: 1.33,
        thickness: 12
      })
    );

    const water = new THREE.Mesh(this.waterGeom, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = this.waterLevelY;
    water.receiveShadow = true;
    this.scene.add(water);
  }

  private addPlatform() {
    const deckOffsetZ = this.getDeckOffsetZ();
    const dockFloorTileSize = 260;
    const deckTexture = this.createDockFloorTexture(this.deckWidth / dockFloorTileSize, this.deckDepth / dockFloorTileSize);
    const apronTexture = this.createDockFloorTexture(this.deckWidth / dockFloorTileSize, Math.max(this.apronDepth / dockFloorTileSize, 1));
    const deck = new THREE.Mesh(
      this.trackGeometry(new THREE.BoxGeometry(this.deckWidth, this.deckHeight, this.deckDepth)),
      this.trackMaterial(
        new THREE.MeshStandardMaterial({
          map: deckTexture,
          color: 0xffffff,
          roughness: 0.72,
          metalness: 0.12,
        })
      )
    );
    deck.position.y = this.deckHeight / 2;
    deck.position.z = deckOffsetZ;
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.scene.add(deck);

    const apronHeight = this.deckHeight * 1.0;
    const apron = new THREE.Mesh(
      this.trackGeometry(new THREE.BoxGeometry(this.deckWidth, apronHeight, this.apronDepth)),
      this.trackMaterial(
        new THREE.MeshStandardMaterial({
          map: apronTexture,
          color: 0xffffff,
          roughness: 0.75,
          metalness: 0.08,
        })
      )
    );
    apron.position.set(0, this.deckHeight - apronHeight / 2 + 1, this.quayEdgeZ - this.apronDepth / 2);
    apron.castShadow = true;
    apron.receiveShadow = true;
    this.scene.add(apron);

  }

  private addServiceRoad() {
    const moduleWidth = this.deckWidth - 120;
    const startX = -moduleWidth / 2;
    const endX = moduleWidth / 2;
    const module = createGroundModule({
      width: moduleWidth,
      depth: this.serviceRoadDepth + 40,
      height: 4,
      textureUrl: 'assets/textures/floor.png',
      textureRepeat: { x: Math.max(moduleWidth / 260, 1), y: Math.max((this.serviceRoadDepth + 40) / 260, 1) },
      road: {
        width: moduleWidth,
        depth: this.serviceRoadDepth,
        textureUrl: 'assets/textures/textura-da-estrada-do-asfalto-com-marcacoes-109441328.jpg',
        textureRepeat: { x: Math.max(moduleWidth / 260, 1), y: Math.max(this.serviceRoadDepth / 160, 1) },
      },
    });
    const box = module.geometry as THREE.BoxGeometry;
    const height = box?.parameters?.height ?? 0;
    module.position.set(0, this.deckHeight - height / 2 + 0.2, this.serviceRoadCenterZ);
    this.scene.add(module);
    if (this.showLogisticsTrucks) {
      this.loadLogisticsTruck();
    }
  }

  private loadLogisticsTruck() {
    this.clearLogisticsVehicles();
    this.getTruckPrototype()
      .then((prototype) => {
        const truck = prototype.clone(true);
        const roadHalfWidth = (this.deckWidth - 120) / 2;
        const offsetX = -roadHalfWidth + 280;
        const offsetZ = this.serviceRoadCenterZ + 95;
        truck.position.set(offsetX, this.deckHeight + 40, offsetZ);
        truck.rotation.y = Math.PI / 2;
        this.scene.add(truck);
        this.logisticsVehicles.push(truck);
      })
      .catch((error) => console.warn('[FinalScene] Falha ao carregar camião na estrada principal', error));
  }

  private getTruckPrototype(): Promise<THREE.Group> {
    if (this.truckPrototype) {
      return Promise.resolve(this.truckPrototype);
    }
    if (!this.truckLoading) {
      this.truckLoading = new Promise((resolve, reject) => {
        this.gltfLoader.load(
          this.truckModelUrl,
          (gltf) => {
            const root = gltf.scene;
            this.prepareTruckPrototype(root);
            this.truckPrototype = root;
            resolve(root);
          },
          undefined,
          (error) => reject(error)
        );
      });
    }
    return this.truckLoading;
  }

  private prepareTruckPrototype(model: THREE.Group) {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const material = child.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        if (Array.isArray(material)) {
          material.forEach((mat) => (mat.envMapIntensity = 1.1));
        } else if (material) {
          material.envMapIntensity = 1.1;
        }
      }
    });
    this.mirrorTruckParts(model);
    applyTruckTrailerTexture(model, this.getTruckTrailerTexture());
    applyTruckWindowTexture(model, this.getTruckWindowTexture());

    const baseBox = new THREE.Box3().setFromObject(model);
    const size = baseBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetSpan = 220;
    const scale = targetSpan / maxDim;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -scaledBox.min.y, -center.z);
    model.position.y += Math.max(4, scaledBox.getSize(new THREE.Vector3()).y * 0.02);
  }

  private mirrorTruckParts(model: THREE.Group) {
    const namesToMirror = ['Cube', 'truck_daf.003', 'truck_daf.002'];
    namesToMirror.forEach((name) => {
      const original = model.getObjectByName(name);
      if (!original) {
        return;
      }
      const mirrored = original.clone(true);
      mirrored.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map((mat) => mat.clone());
          } else if (obj.material) {
            obj.material = obj.material.clone();
          }
        }
      });
      mirrored.scale.x *= -1;
      original.parent?.add(mirrored);
    });
  }

  private getTruckTrailerTexture(): THREE.Texture {
    if (this.truckTrailerTexture) {
      return this.truckTrailerTexture;
    }
    const texture = this.textureLoader.load(this.truckTrailerTextureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    texture.anisotropy = 4;
    this.truckTrailerTexture = texture;
    return texture;
  }

  private getTruckWindowTexture(): THREE.Texture {
    if (this.truckWindowTexture) {
      return this.truckWindowTexture;
    }
    const texture = this.textureLoader.load(this.truckWindowTextureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.center.set(0.5, 0.5);
    texture.rotation = Math.PI / 2;
    texture.needsUpdate = true;
    texture.anisotropy = 4;
    this.truckWindowTexture = texture;
    return texture;
  }

  private rebuildContainerStacks(docks: DockLayout[]) {
    const requestId = ++this.containerPlacementRequestId;
    this.clearStaticContainerStacks();
    if (!docks.length) {
      return;
    }
    this.getContainerStackPrototype()
      .then((prototype) => {
        if (requestId !== this.containerPlacementRequestId) {
          return;
        }
        const baseSpacingX = this.containerUnitSize.x + 4;
        const baseSpacingZ = this.containerUnitSize.z + 6;
        const slotMargin = 16;
        const sortedDocks = [...docks].sort((a, b) => this.mapDockToDeckX(a) - this.mapDockToDeckX(b));
        const slotCenters = new Map<number, { center: number; width: number }>();
        const deckLeftBound = -this.deckWidth / 2 + this.deckMarginToEdge + slotMargin;
        const deckRightBound = this.deckWidth / 2 - this.deckMarginToEdge - slotMargin;
        sortedDocks.forEach((dock, idx) => {
          const currentCenter = this.mapDockToDeckX(dock) + 120;
          const currentRoadWidth = THREE.MathUtils.clamp(this.convertLayoutDistance(dock.size.width * 0.12, 28, 70), 20, 80);
          const currentHalf = currentRoadWidth / 2;
          const prevDock = sortedDocks[idx - 1];
          const prevRoadCenter = prevDock ? this.mapDockToDeckX(prevDock) + 120 : undefined;
          const prevRoadWidth = prevDock
            ? THREE.MathUtils.clamp(this.convertLayoutDistance(prevDock.size.width * 0.12, 28, 70), 20, 80)
            : undefined;
          const leftEdge = prevDock && prevRoadCenter && prevRoadWidth
            ? prevRoadCenter + prevRoadWidth / 2 + slotMargin
            : deckLeftBound;
          const rightEdge = Math.min(currentCenter - currentHalf - slotMargin, deckRightBound);
          if (rightEdge > leftEdge) {
            const slotWidth = rightEdge - leftEdge;
            slotCenters.set(dock.dockId, { center: leftEdge + slotWidth / 2, width: slotWidth });
          }
        });
        const lastDock = sortedDocks[sortedDocks.length - 1];
        if (lastDock) {
          const lastCenter = this.mapDockToDeckX(lastDock) + 120;
          const lastRoadWidth = THREE.MathUtils.clamp(this.convertLayoutDistance(lastDock.size.width * 0.12, 28, 70), 20, 80);
          const leftEdge = lastCenter + lastRoadWidth / 2 + slotMargin;
          const rightEdge = deckRightBound;
          if (rightEdge > leftEdge) {
            const width = rightEdge - leftEdge;
            slotCenters.set(lastDock.dockId, { center: leftEdge + width / 2, width });
          }
        }
        docks.forEach((dock, index) => {
          const dockCenterX = this.mapDockToDeckX(dock);
          const plannedLaneWidth = THREE.MathUtils.clamp(this.convertLayoutDistance(dock.size.length * 0.35, 180, 420), 160, 520);
          const laneWidth = plannedLaneWidth;
          const rearLimit = this.serviceRoadCenterZ + this.serviceRoadDepth / 2 + 60;
          const frontLimit = this.quayEdgeZ - this.apronDepth - 25;
          const availableSpan = Math.max(150, frontLimit - rearLimit);
          const targetDepth = THREE.MathUtils.clamp(
            this.convertLayoutDistance(dock.size.width * 0.55, 180, 340),
            140,
            availableSpan - 30
          );
          const slotInfo = slotCenters.get(dock.dockId);
          if (!slotInfo) {
            return;
          }
          const widthAllowance = Math.max(slotInfo.width, baseSpacingX * 1.5);
          const usableWidth = Math.max(widthAllowance - 16, baseSpacingX);
          const usableDepth = Math.max(targetDepth - 30, baseSpacingZ * 1.1);
          const rawColumnSlots = Math.max(1, Math.floor(usableWidth / baseSpacingX));
          const dockLength = Math.max(dock.size?.length ?? 120, 60);
          const proportionalColumnCap = Math.max(3, Math.round(dockLength / 280));
          const columnCount = Math.max(1, Math.min(rawColumnSlots, proportionalColumnCap));
          const depthSlots = Math.max(1, Math.floor(usableDepth / (baseSpacingZ * 0.85)));
          const depthCap = Math.max(3, Math.round((dock.size.width ?? 80) / 60));
          const rowCount = Math.min(depthSlots, depthCap);
          const heightFactor = THREE.MathUtils.clamp(Math.round((dock.size.width ?? 80) / 60), 3, 6);
          const stack = this.buildContainerStack(
            prototype,
            columnCount,
            rowCount,
            heightFactor,
            index * 23,
            this.containerStackDensity
          );
          stack.rotation.y = (dock.rotationY ?? 0) + Math.PI / 2;

          stack.updateMatrixWorld(true);
          const baseSize = new THREE.Box3().setFromObject(stack).getSize(new THREE.Vector3());
          const scaleX = Math.min(1, (widthAllowance - slotMargin * 0.5) / Math.max(baseSize.x, 1));
          const scaleZ = Math.min(1, targetDepth / Math.max(baseSize.z, 1));
          stack.scale.set(scaleX, 1, scaleZ);
          const finalHalfWidth = (baseSize.x * scaleX) / 2;
          const deckMinX = -this.deckWidth / 2 + this.deckMarginToEdge + finalHalfWidth + slotMargin / 2;
          const deckMaxX = this.deckWidth / 2 - this.deckMarginToEdge - finalHalfWidth - slotMargin / 2;
          const leftClearance = slotInfo.center - slotInfo.width / 2 + slotMargin / 2;
          const rightClearance = slotInfo.center + slotInfo.width / 2 - slotMargin / 2;
          const usableCenterMin = leftClearance + finalHalfWidth;
          const usableCenterMax = rightClearance - finalHalfWidth;
          const centerZ = frontLimit - targetDepth / 2 - 10;
          const preferredX = THREE.MathUtils.clamp(slotInfo.center, usableCenterMin, usableCenterMax);
          const clampedX = THREE.MathUtils.clamp(preferredX, deckMinX, deckMaxX);
          stack.position.set(clampedX, this.deckHeight, centerZ - 150);
          this.scene.add(stack);
          this.staticContainerStacks.push(stack);
        });
      })
      .catch((error) => console.warn('[FinalScene] Falha ao posicionar contentores', error));
  }

  private addDockDetails() {
    const bollardGeo = this.trackGeometry(new THREE.CylinderGeometry(4, 4, 8, 16));
    const bollardMat = this.trackMaterial(new THREE.MeshStandardMaterial({ color: 0xfaf3c0, roughness: 0.3 }));
    for (let i = -6; i <= 6; i++) {
      const bollard = new THREE.Mesh(bollardGeo, bollardMat);
      bollard.position.set(i * 110, this.deckHeight + 6, this.quayEdgeZ - 10);
      bollard.castShadow = true;
      this.scene.add(bollard);
    }

    const dockPlane = new THREE.Mesh(new THREE.PlaneGeometry(this.deckWidth - 180, 220), new THREE.MeshBasicMaterial({ visible: false }));
    dockPlane.rotation.x = -Math.PI / 2;
    dockPlane.position.set(0, this.deckHeight + 1, this.quayEdgeZ - 40);
    this.scene.add(dockPlane);
    this.registerFacilityHotspot({
      id: 'dock-primary',
      name: 'North Pier 1',
      type: 'dock',
      object: dockPlane,
      dockLayout: {
        dockId: 1,
        name: 'North Pier 1',
        position: { x: 0, y: this.deckHeight, z: this.quayEdgeZ },
        rotationY: 0,
        size: { length: this.deckWidth, width: 180, height: this.deckHeight },
      },
    });

  }

  private clearDockServiceLanes() {
    this.dockServiceLanes.forEach((lane) => this.scene.remove(lane));
    this.dockServiceLanes = [];
  }

  private clearContainerYardRoads() {
    this.containerYardRoads.forEach((lane) => {
      this.scene.remove(lane);
      lane.geometry.dispose();
      const mat = lane.material as THREE.MeshStandardMaterial;
      if (mat.map) {
        mat.map.dispose();
      }
      mat.dispose();
    });
    this.containerYardRoads = [];
  }

  private clearStaticContainerStacks() {
    this.staticContainerStacks.forEach((stack) => {
      this.scene.remove(stack);
      stack.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat.dispose?.());
          } else {
            (obj.material as THREE.Material)?.dispose?.();
          }
        }
      });
    });
    this.staticContainerStacks = [];
  }

  private clearLogisticsVehicles() {
    this.logisticsVehicles.forEach((vehicle) => this.scene.remove(vehicle));
    this.logisticsVehicles = [];
  }

  private rebuildDockModules(docks: DockLayout[]) {
    this.clearDockServiceLanes();
    this.clearContainerYardRoads();
    if (!docks.length) {
      return;
    }
    const elevation = this.deckHeight + 1.5;
    docks.forEach((dock) => {
      const width = this.convertLayoutDistance(dock.size.length, 200, this.deckWidth - this.deckMarginToEdge * 2);
      const depth = this.convertLayoutDistance(dock.size.width, 80, this.apronDepth);
      const geometry = this.trackGeometry(new THREE.PlaneGeometry(width, depth));
      const material = this.trackMaterial(new THREE.MeshBasicMaterial({ visible: false }));
      const module = new THREE.Mesh(geometry, material);
      module.rotation.x = -Math.PI / 2;
      module.position.set(this.mapDockToDeckX(dock), elevation, this.quayEdgeZ - depth / 2);
      this.scene.add(module);
      this.dockServiceLanes.push(module);
      this.registerFacilityHotspot(
        {
          id: `dock-lane-${dock.dockId}`,
          name: dock.name ?? `Dock ${dock.dockId}`,
          type: 'dock',
          object: module,
          dockLayout: dock,
        },
        { persistent: false }
      );
    });
    this.createContainerYardRoads(docks);
  }

  private createContainerYardRoads(docks: DockLayout[]) {
    if (!docks.length) {
      return;
    }
    const startZ = this.serviceRoadCenterZ + this.serviceRoadDepth / 2 + 12;
    const endZ = this.quayEdgeZ - this.apronDepth - 4;
    const length = Math.max(140, endZ - startZ);
    const texture = this.getLogisticsRoadTexture();
    docks.forEach((dock) => {
      const width = THREE.MathUtils.clamp(this.convertLayoutDistance(dock.size.width * 0.12, 28, 70), 20, 80);
      const map = this.trackTexture(texture.clone());
      map.repeat.set(Math.max(width / 90, 1), Math.max(length / 160, 1));
      const material = this.trackMaterial(
        new THREE.MeshStandardMaterial({
          map,
          color: 0xffffff,
          roughness: 0.9,
          metalness: 0.05,
        })
      );
      material.polygonOffset = true;
      material.polygonOffsetFactor = -0.2;
      material.polygonOffsetUnits = -1;
      const geometry = this.trackGeometry(new THREE.PlaneGeometry(width, length));
      const lane = new THREE.Mesh(geometry, material);
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(this.mapDockToDeckX(dock) + 120, this.deckHeight + 0.84, startZ + length / 2);
      lane.receiveShadow = true;
      this.scene.add(lane);
      this.containerYardRoads.push(lane);
    });
  }

  private clearDynamicWarehouses() {
    this.dynamicWarehouseMeshes.forEach((warehouse) => this.scene.remove(warehouse));
    this.dynamicWarehouseMeshes = [];
  }

  private updateWarehousePlacements(warehouses: WarehouseLayout[], dockMap: Map<number, DockLayout>) {
    this.clearDynamicWarehouses();
    const requestId = ++this.warehousePlacementRequestId;
    if (!warehouses.length) {
      return;
    }

    this.getWarehousePrototype()
      .then((prototype) => {
        if (requestId !== this.warehousePlacementRequestId) {
          return;
        }
        const dockSlotCounters = new Map<number, number>();
        let unassignedSlot = 0;
        warehouses.forEach((layout, index) => {
          const dock = this.resolveWarehouseDock(layout, dockMap);
          let slotIndex: number;
          if (dock) {
            slotIndex = dockSlotCounters.get(dock.dockId) ?? 0;
            dockSlotCounters.set(dock.dockId, slotIndex + 1);
          } else {
            slotIndex = unassignedSlot++;
          }
          const zBase = dock ? this.warehouseBaseZ : this.warehouseBaseZ - 120;
          const z = this.computeWarehouseZ(slotIndex, zBase);
          const targetX = dock ? this.mapDockToDeckX(dock) : this.mapLayoutXToDeckCoord(layout.position?.x ?? 0);
          const size = new THREE.Vector3(
            this.convertLayoutDistance(
              this.uniformWarehouseLayoutSize.width,
              60,
              this.deckWidth * 0.22
            ),
            THREE.MathUtils.clamp(
              this.uniformWarehouseLayoutSize.height,
              28,
              110
            ) * this.warehouseHeightScale,
            this.convertLayoutDistance(this.uniformWarehouseLayoutSize.depth, 60, 220)
          );
          size.x *= this.warehouseFootprintScale;
          size.z *= this.warehouseFootprintScale;
          const placement = {
            position: new THREE.Vector3(targetX, this.deckHeight, z),
            size,
            rotation: dock?.rotationY ?? 0,
          };
          const warehouse = this.instantiateWarehouse(prototype, { ...placement, storageId: layout.storageAreaId });
          this.scene.add(warehouse);
          this.dynamicWarehouseMeshes.push(warehouse);
          const storageInfo = this.storageAreaCache.get(layout.storageAreaId);
          this.addWarehouseFillVisuals({ ...placement, storageId: layout.storageAreaId }, storageInfo);
          this.registerFacilityHotspot(
            {
              id: `warehouse-layout-${layout.storageAreaId}-${index}`,
              name: layout.name || `Warehouse ${layout.storageAreaId}`,
              type: 'warehouse',
              object: warehouse,
              warehouseLayout: layout,
              dockLayout: dock,
            },
            { persistent: false }
          );
        });
      })
      .catch((error) => console.warn('[FinalScene] Falha ao posicionar armazéns dinâmicos', error));
  }

  private resolveWarehouseDock(layout: WarehouseLayout, dockMap: Map<number, DockLayout>): DockLayout | undefined {
    const ids = layout.servedDockIds ?? [];
    for (const id of ids) {
      const dock = dockMap.get(id);
      if (dock) {
        return dock;
      }
    }
    return undefined;
  }

  private convertLayoutDistance(length: number | undefined, min: number, max: number): number {
    if (!Number.isFinite(length)) {
      return (min + max) / 2;
    }
    const scale = this.getLayoutToDeckScale();
    const converted = length! * scale;
    return THREE.MathUtils.clamp(converted, min, max);
  }

  private getLayoutToDeckScale(): number {
    const span = this.dockSpanInfo;
    if (!span || !isFinite(span.span) || span.span <= 0) {
      return 1;
    }
    const deckSpan = this.deckWidth - this.deckMarginToEdge * 2;
    return deckSpan / span.span;
  }

  private clearDynamicCranes() {
    this.dynamicCraneMeshes.forEach((crane) => this.scene.remove(crane));
    this.dynamicCraneMeshes = [];
  }

  private updateCranes(cranes: CraneLayout[], dockMap: Map<number, DockLayout>) {
    this.clearDynamicCranes();
    if (!cranes.length) {
      this.spawnFallbackCranes();
      return;
    }

    const totalPerDock = new Map<number, number>();
    cranes.forEach((crane) => {
      if (typeof crane.dockId === 'number' && dockMap.has(crane.dockId)) {
        totalPerDock.set(crane.dockId, (totalPerDock.get(crane.dockId) ?? 0) + 1);
      }
    });
    const placedPerDock = new Map<number, number>();
    let fallbackIndex = 0;

    cranes.forEach((layout, index) => {
      const dock = typeof layout.dockId === 'number' ? dockMap.get(layout.dockId) : undefined;
      const craneMesh = this.createCraneMesh(layout);
      let position: THREE.Vector3;
      let rotation = Math.PI;
      const verticalOffset = 0;
      const deckBaseY = this.deckHeight + verticalOffset;
      let baseY = deckBaseY;

      if (dock) {
        const total = totalPerDock.get(dock.dockId) ?? 1;
        const seq = placedPerDock.get(dock.dockId) ?? 0;
        placedPerDock.set(dock.dockId, seq + 1);
        const deckLength = this.convertLayoutDistance(dock.size.length, 200, this.deckWidth - 200);
        const spacing = deckLength / (total + 1);
        const localX = -deckLength / 2 + spacing * (seq + 1);
        const baseX = this.mapDockToDeckX(dock);
        baseY = dock.position.y + dock.size.height + verticalOffset;
        baseY = Math.max(baseY, deckBaseY);
        position = new THREE.Vector3(baseX + localX, baseY, this.quayEdgeZ - 40);
        rotation = dock.rotationY ?? Math.PI;
      } else if (layout.position) {
        baseY = (layout.position.y ?? this.deckHeight) + verticalOffset;
        baseY = Math.max(baseY, deckBaseY);
        position = new THREE.Vector3(this.mapLayoutXToDeckCoord(layout.position.x), baseY, this.quayEdgeZ - 40);
      } else {
        const offsetX = -600 + fallbackIndex * 400;
        fallbackIndex++;
        position = new THREE.Vector3(offsetX, baseY, this.quayEdgeZ - 40);
      }

      craneMesh.position.copy(position);
      craneMesh.rotation.y = typeof layout.rotationY === 'number' ? layout.rotationY : rotation;
      this.scene.add(craneMesh);
      this.dynamicCraneMeshes.push(craneMesh);
      this.registerFacilityHotspot(
        {
          id: `crane-${layout.code ?? index}`,
          name: layout.name || layout.code || `Crane ${index + 1}`,
          type: 'crane',
          object: craneMesh,
          craneSpecs: {
            designation: layout.name ?? layout.code,
            height: layout.height,
            gauge: layout.gauge,
            clearance: layout.clearance,
          },
          dockLayout: dock,
        },
        { persistent: false }
      );
    });
  }

  private createCraneMesh(layout?: CraneLayout): THREE.Group {
    const crane = createPortalLatticeCraneModel({
      height: layout?.height ?? 90,
      seawardBoomLength: 150,
      landsideBoomLength: 80,
      gauge: layout?.gauge ?? 74,
      clearance: layout?.clearance ?? 70,
    });
    const baseHeight = 90;
    const targetHeight = Math.max(40, layout?.height ?? baseHeight);
    crane.scale.setScalar(targetHeight / baseHeight);
    return crane;
  }

  private spawnFallbackCranes() {
    const offsets = [-360, 360];
    offsets.forEach((x, index) => {
      const crane = this.createCraneMesh();
      crane.position.set(x, this.deckHeight + 20, this.quayEdgeZ - 40);
      crane.rotation.y = Math.PI;
      this.scene.add(crane);
      this.dynamicCraneMeshes.push(crane);
      this.registerFacilityHotspot(
        {
          id: `crane-fallback-${index}`,
          name: index === 0 ? 'Grua STS Oeste' : 'Grua STS Este',
          type: 'crane',
          object: crane,
        },
        { persistent: false }
      );
    });
  }

  private mapLayoutXToDeckCoord(worldX: number): number {
    const span = this.dockSpanInfo ?? { minEdge: -this.deckWidth / 2, span: this.deckWidth };
    const ratio = span.span > 0 ? (worldX - span.minEdge) / span.span : 0.5;
    const deckSpan = this.deckWidth - this.deckMarginToEdge * 2;
    return (ratio - 0.5) * deckSpan;
  }

  private computeWarehouseZ(slotIndex: number, base: number): number {
    return base - slotIndex * this.warehouseRowSpacing;
  }

  private getWarehousePrototype(): Promise<THREE.Group> {
    if (this.warehousePrototype) {
      return Promise.resolve(this.warehousePrototype);
    }
    if (!this.warehouseLoading) {
      this.warehouseLoading = new Promise((resolve, reject) => {
        const urls = [...this.warehouseModelUrls];
        const loadNext = () => {
          const url = urls.shift();
          if (!url) {
            reject(new Error('Sem modelo GLB de armazém disponível'));
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
              const center = new THREE.Vector3();
              box.getSize(size);
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
              console.warn('[FinalScene] erro ao carregar warehouse modelo', url, error);
              loadNext();
            }
          );
        };
        loadNext();
      });
    }

    return this.warehouseLoading;
  }

  private instantiateWarehouse(
    prototype: THREE.Group,
    placement: { position: THREE.Vector3; size: THREE.Vector3; rotation?: number; storageId?: number }
  ): THREE.Group {
    const warehouse = prototype.clone(true);
    const dims = this.warehouseBaseDimensions ?? new THREE.Vector3(1, 1, 1);
    warehouse.scale.set(placement.size.x / dims.x, placement.size.y / dims.y, placement.size.z / dims.z);
    warehouse.position.copy(placement.position);
    warehouse.rotation.y = placement.rotation ?? 0;
    warehouse.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return warehouse;
  }

  private addWarehouseFillVisuals(
    placement: { position: THREE.Vector3; size: THREE.Vector3; storageId?: number },
    storage?: StorageAreaDTO
  ) {
    if (!storage || storage.maxCapacityTEU <= 0) {
      return;
    }
    const ratio = THREE.MathUtils.clamp(storage.currentOccupancyTEU / storage.maxCapacityTEU, 0, 1);
    const footprintScale = 0.7;
    const fillHeight = Math.max(placement.size.y * 0.05, placement.size.y * ratio);
    const fillColor = this.getWarehouseFillColor(ratio);
    const fillGeometry = new THREE.BoxGeometry(
      placement.size.x * footprintScale,
      fillHeight,
      placement.size.z * footprintScale
    );
    const fillMaterial = new THREE.MeshStandardMaterial({
      color: fillColor,
      transparent: true,
      opacity: 0.55,
      roughness: 0.35,
      metalness: 0.1,
      emissive: new THREE.Color(fillColor).multiplyScalar(0.5),
      emissiveIntensity: 0.12,
    });
    const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
    fillMesh.position.set(placement.position.x, placement.position.y + fillHeight / 2, placement.position.z);
    this.scene.add(fillMesh);
    this.dynamicWarehouseMeshes.push(fillMesh);

    const percent = Math.round(ratio * 100);
    const capacityLabel = `${this.formatNumber(storage.currentOccupancyTEU)} / ${this.formatNumber(storage.maxCapacityTEU)} TEU`;
    const label = this.createLabelSprite(`${percent}%\n${capacityLabel}`, {
      background: 'rgba(4,9,18,0.92)',
      color: '#f4f7fb',
      scale: 170,
    });
    label.position.set(
      placement.position.x,
      placement.position.y + placement.size.y + 90,
      placement.position.z
    );
    label.userData['warehouseLabel'] = placement.storageId ?? storage.id;
    this.scene.add(label);
    this.dynamicWarehouseMeshes.push(label);
  }

  private getCargoVesselPrototype(): Promise<THREE.Group> {
    if (this.cargoVesselPrototype) {
      return Promise.resolve(this.cargoVesselPrototype);
    }

    if (!this.cargoVesselLoading) {
      this.cargoVesselLoading = new Promise((resolve, reject) => {
        const urls = [...this.cargoVesselModelUrls];
        const loadNext = () => {
          const url = urls.shift();
          if (!url) {
            reject(new Error('Sem modelo GLB de navio disponA-vel'));
            return;
          }
          this.gltfLoader.load(
            url,
            (gltf) => {
              const root = gltf.scene;
              this.prepareCargoVesselPrototype(root);
              this.cargoVesselPrototype = root;
              resolve(root);
            },
            undefined,
            (error) => {
              console.warn('[FinalScene] erro ao carregar cargo vessel modelo', url, error);
              loadNext();
            }
          );
        };
        loadNext();
      });
    }

    return this.cargoVesselLoading;
  }

  private prepareCargoVesselPrototype(root: THREE.Group) {
    removeEmbeddedTruckFromCargoVessel(root);
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    const initialBox = new THREE.Box3().setFromObject(root);
    const initialSize = initialBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(initialSize.x, initialSize.y, initialSize.z) || 1;
    const scale = this.cargoVesselTargetLength / maxDim;
    root.scale.set(scale, scale, scale * this.cargoVesselBeamScale);
    root.updateMatrixWorld(true);

    const sizedBox = new THREE.Box3().setFromObject(root);
    const sizedDims = sizedBox.getSize(new THREE.Vector3());
    if (sizedDims.z > sizedDims.x) {
      root.rotation.y = Math.PI / 2;
      root.updateMatrixWorld(true);
    }

    const finalBox = new THREE.Box3().setFromObject(root);
    const center = finalBox.getCenter(new THREE.Vector3());
    root.position.set(-center.x, -finalBox.min.y, -center.z);
    const finalSize = finalBox.getSize(new THREE.Vector3());
    this.cargoVesselHalfBeam = finalSize.z / 2;
  }

  private animate = () => {
    const delta = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;
    if (this.waterGeom && this.waterBase) {
      const attr = this.waterGeom.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const baseZ = this.waterBase[i + 2];
        const baseX = this.waterBase[i];
        const baseY = this.waterBase[i + 1];
        const wave = Math.sin(baseX * 0.002 + elapsed * 0.6) + Math.cos(baseY * 0.0025 - elapsed * 0.9);
        arr[i + 2] = baseZ + wave * 1.4;
      }
      attr.needsUpdate = true;
      this.waterGeom.computeVertexNormals();
    }

    this.updateCameraKeyboardMovement(delta);
    this.updateCameraTween();
    this.updateVesselAnimations();
    this.updateSelectionSpotlight();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.animate);
  };

  private handleResize = () => {
    if (!this.renderer || !this.camera) {
      return;
    }
    const canvas = this.canvasRef.nativeElement;
    const bounds = canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(bounds?.width || window.innerWidth, 640);
    const height = Math.max(bounds?.height || 600, 480);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private updateCameraKeyboardMovement(delta: number) {
    if (!this.camera || !this.controls) {
      return;
    }
    const forwardAxis = (this.cameraKeyState.forward ? 1 : 0) - (this.cameraKeyState.backward ? 1 : 0);
    const strafeAxis = (this.cameraKeyState.right ? 1 : 0) - (this.cameraKeyState.left ? 1 : 0);
    if (forwardAxis === 0 && strafeAxis === 0) {
      return;
    }

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() === 0) {
      forward.set(0, 0, -1);
    }
    forward.normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const move = new THREE.Vector3();
    move.addScaledVector(forward, forwardAxis);
    move.addScaledVector(right, strafeAxis);
    if (move.lengthSq() === 0) {
      return;
    }
    move.normalize().multiplyScalar(this.cameraMoveSpeed * delta);
    this.camera.position.add(move);
    this.controls.target.add(move);
  }

  private updateCameraTween() {
    if (!this.cameraTween || !this.camera || !this.controls) return;
    const elapsed = performance.now() - this.cameraTween.startTime;
    const t = Math.min(1, elapsed / this.cameraTween.duration);
    const eased = 1 - Math.pow(1 - t, 3);
    this.camera.position.lerpVectors(this.cameraTween.startPos, this.cameraTween.endPos, eased);
    this.controls.target.lerpVectors(this.cameraTween.startTarget, this.cameraTween.endTarget, eased);
    if (t >= 1) {
      this.cameraTween = undefined;
    }
  }

  private updateVesselAnimations() {
    if (!this.vesselAnimations.length) {
      return;
    }
    const now = performance.now();
    this.vesselAnimations = this.vesselAnimations.filter((anim) => {
      const elapsed = now - anim.startTime;
      const t = Math.min(1, elapsed / anim.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      let basePos: THREE.Vector3;
      let pathRight = anim.pathRight;
      let forward = anim.pathForward;
      if (anim.curve) {
        basePos = anim.curve.getPoint(eased, this.vesselAnimBase);
        const tangent = anim.curve.getTangent(eased, this.vesselAnimTangent);
        this.vesselAnimRight.crossVectors(this.vesselAnimUp, tangent);
        if (this.vesselAnimRight.lengthSq() === 0) {
          this.vesselAnimRight.set(1, 0, 0);
        } else {
          this.vesselAnimRight.normalize();
        }
        pathRight = this.vesselAnimRight;
        forward = tangent.clone();
      } else {
        basePos = this.vesselAnimBase.lerpVectors(anim.startPos, anim.endPos, eased);
      }
      if (!forward || forward.lengthSq() === 0) {
        forward = new THREE.Vector3(1, 0, 0);
      }
      if (anim.freezeHeadingFrom !== undefined && eased >= anim.freezeHeadingFrom) {
        if (!anim.lockedForward) {
          anim.lockedForward = forward.clone();
        }
        forward = anim.lockedForward.clone();
      }
      const dragPhase = eased * Math.PI;
      const lateral = Math.sin(dragPhase) * anim.dragAmplitude;
      const bob = Math.sin(dragPhase * 2) * anim.bobAmplitude;
      this.vesselAnimOffset.copy(basePos);
      if (pathRight) {
        this.vesselAnimOffset.addScaledVector(pathRight, lateral);
      }
      this.vesselAnimOffset.y += bob;
      anim.object.position.copy(this.vesselAnimOffset);
      if (forward) {
        const heading = Math.atan2(forward.x, forward.z);
        anim.object.rotation.y = heading;
      }
      if (anim.label) {
        const labelBase = this.computeLabelPosition(this.vesselAnimOffset.x, this.vesselAnimOffset.z);
        labelBase.y += bob;
        anim.label.position.copy(labelBase);
      }
      if (t >= 1) {
        anim.object.position.copy(anim.endPos);
        if (anim.label) {
          anim.label.position.copy(this.computeLabelPosition(anim.endPos.x, anim.endPos.z));
        }
        anim.onComplete?.();
        return false;
      }
      return true;
    });
  }

  private trackMaterial<T extends THREE.Material>(material: T): T {
    this.disposableMaterials.push(material);
    return material;
  }

  private trackGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.disposableGeometries.push(geometry);
    return geometry;
  }

  private trackTexture<T extends THREE.Texture>(texture: T): T {
    this.disposableTextures.push(texture);
    return texture;
  }

  private queueVesselArrivalAnimation(vessel: THREE.Group, label: THREE.Sprite | undefined, endPos: THREE.Vector3) {
    this.cancelVesselAnimationFor(vessel);
    const avoidanceOffset = this.computeArrivalAvoidanceOffset(endPos.z);
    if (avoidanceOffset) {
      const startPos = vessel.position.clone();
      const dockingTarget = new THREE.Vector3(endPos.x, endPos.y, endPos.z);
      const swingOut = new THREE.Vector3(endPos.x - 260, endPos.y, endPos.z + avoidanceOffset);
      const alignPoint = new THREE.Vector3(endPos.x - 120, endPos.y, endPos.z + avoidanceOffset);
      const forwardSet = new THREE.Vector3(endPos.x + 20, endPos.y, endPos.z + avoidanceOffset * 0.7);
      const reverseStart = new THREE.Vector3(endPos.x + 15, endPos.y, endPos.z + avoidanceOffset * 0.2);
      const approachCurve = new THREE.CatmullRomCurve3([
        startPos.clone(),
        swingOut,
        alignPoint,
        forwardSet,
        reverseStart.clone(),
      ]);
      const reverseLine = new THREE.LineCurve3(reverseStart.clone(), dockingTarget.clone());
      const curvePath = new THREE.CurvePath<THREE.Vector3>();
      curvePath.add(approachCurve);
      curvePath.add(reverseLine);
      const animation: VesselAnimationState = {
        object: vessel,
        label,
        startPos,
        endPos: dockingTarget.clone(),
        startTime: performance.now(),
        duration: this.vesselArrivalAnimationMs,
        dragAmplitude: 18,
        bobAmplitude: 6,
        curve: curvePath,
        freezeHeadingFrom: 0.65,
      };
      this.vesselAnimations.push(animation);
      return;
    }
    const pathVector = new THREE.Vector3().subVectors(endPos, vessel.position);
    const distance = pathVector.length();
    const pathDir = distance > 0.001 ? pathVector.clone().normalize() : new THREE.Vector3(0, 0, 1);
    const pathRight = new THREE.Vector3(pathDir.z, 0, -pathDir.x);
    if (pathRight.lengthSq() === 0) {
      pathRight.set(1, 0, 0);
    }
    pathRight.normalize();
    const dragFactor = Math.min(1, distance / 900);
    const dragAmplitude = 18 * dragFactor;
    const bobAmplitude = 6 * dragFactor;
    const animation: VesselAnimationState = {
      object: vessel,
      label,
      startPos: vessel.position.clone(),
      endPos: endPos.clone(),
      startTime: performance.now(),
      duration: this.vesselArrivalAnimationMs,
      pathRight,
      pathForward: pathDir.clone(),
      dragAmplitude,
      bobAmplitude,
    };
    this.vesselAnimations.push(animation);
  }

  private computeArrivalAvoidanceOffset(targetZ: number): number | undefined {
    if (!this.vesselBindings.size) {
      return undefined;
    }
    const spacing = this.cargoVesselHalfBeam * 2 + this.cargoVesselClearance + 80;
    const conflicts = Array.from(this.vesselBindings.values()).filter(
      (binding) => binding.state !== 'waiting' && Math.abs(binding.object.position.z - targetZ) < spacing
    );
    if (!conflicts.length) {
      return undefined;
    }
    const sign = targetZ >= this.quayEdgeZ ? 1 : -1;
    return sign * spacing * conflicts.length;
  }

  private queueVesselDepartureAnimation(binding: VesselVisualBinding) {
    const vessel = binding.object;
    const label = binding.label;
    this.cancelVesselAnimationFor(vessel);
    const startPos = vessel.position.clone();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(vessel.quaternion);
    forward.y = 0;
    if (forward.lengthSq() === 0) {
      forward.set(0, 0, 1);
    } else {
      forward.normalize();
    }
    const right = new THREE.Vector3().crossVectors(this.vesselAnimUp, forward);
    if (right.lengthSq() === 0) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }
    const lateralDirection = startPos.z >= this.quayEdgeZ ? 1 : -1;
    const turnSide = -lateralDirection;
    const turnNormal = right.multiplyScalar(turnSide);
    const arcDirection = turnSide;
    const turnRadius = Math.max(this.cargoVesselHalfBeam * 2, 220);
    const leadDistance = Math.min(turnRadius * 0.35, 60);
    const leadPoint = startPos.clone().add(forward.clone().multiplyScalar(leadDistance));
    const center = leadPoint.clone().add(turnNormal.clone().multiplyScalar(turnRadius));
    const startVec = leadPoint.clone().sub(center);
    const arcSegments = 24;
    const arcAngle = Math.PI;
    const arcPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= arcSegments; i++) {
      const angle = (arcAngle * i) / arcSegments * arcDirection;
      const rotated = startVec.clone().applyAxisAngle(this.vesselAnimUp, angle);
      const point = center.clone().add(rotated);
      point.y = startPos.y;
      arcPoints.push(point);
    }
    const arcEnd = arcPoints[arcPoints.length - 1].clone();
    const exitDir =
      arcPoints.length >= 2
        ? arcEnd.clone().sub(arcPoints[arcPoints.length - 2]).setY(0).normalize()
        : forward.clone().applyAxisAngle(this.vesselAnimUp, -Math.PI * arcDirection).normalize();
    const exitPoint = arcEnd.clone().add(exitDir.multiplyScalar(this.vesselDepartureExitDistance));
    const controlPoints = [startPos, leadPoint, ...arcPoints, exitPoint];
    const curve = new THREE.CatmullRomCurve3(controlPoints);
    const endPos = exitPoint.clone();
    const animation: VesselAnimationState = {
      object: vessel,
      label,
      startPos,
      endPos,
      startLabelPos: label ? label.position.clone() : undefined,
      endLabelPos: label ? this.computeLabelPosition(endPos.x, endPos.z) : undefined,
      startTime: performance.now(),
      duration: this.vesselDepartureAnimationMs,
      dragAmplitude: 16,
      bobAmplitude: 7,
      curve,
      onComplete: () => {
        this.scene.remove(vessel);
        this.removeLabelSprite(label);
      },
    };
    this.vesselAnimations.push(animation);
  }

  private getLogisticsRoadTexture(): THREE.Texture {
    if (this.logisticsRoadTexture) {
      return this.logisticsRoadTexture;
    }
    const base = this.textureLoader.load(this.logisticsRoadTextureUrl);
    base.colorSpace = THREE.SRGBColorSpace;
    base.wrapS = THREE.RepeatWrapping;
    base.wrapT = THREE.RepeatWrapping;
    const maxAniso = this.renderer?.capabilities.getMaxAnisotropy();
    if (maxAniso && maxAniso > 0) {
      base.anisotropy = Math.min(8, maxAniso);
    }
    this.logisticsRoadTexture = this.trackTexture(base);
    return this.logisticsRoadTexture;
  }

  private getDeckOffsetZ(): number {
    return this.quayEdgeZ - this.deckMarginToEdge - this.deckDepth / 2;
  }

  private createDockFloorTexture(repeatX: number, repeatY: number): THREE.Texture {
    const texture = this.trackTexture(this.textureLoader.load('assets/textures/floor.png'));
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    const maxAnisotropy = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : texture.anisotropy;
    texture.anisotropy = maxAnisotropy;
    texture.repeat.set(Math.max(repeatX, 1), Math.max(repeatY, 1));
    texture.needsUpdate = true;
    return texture;
  }

  private getContainerStackPrototype(): Promise<THREE.Group> {
    if (this.containerStackPrototype) {
      return Promise.resolve(this.containerStackPrototype);
    }
    if (!this.containerStackLoading) {
      this.containerStackLoading = new Promise((resolve, reject) => {
        const queue = [...this.containerStackUrls];
        const loadNext = () => {
          const url = queue.shift();
          if (!url) {
            reject(new Error('Sem modelo GLB de contentores disponível'));
            return;
          }
          this.gltfLoader.load(
            url,
            (gltf) => {
              this.prepareContainerPrototype(gltf.scene);
              this.containerStackPrototype = gltf.scene;
              resolve(gltf.scene);
            },
            undefined,
            (error) => {
              console.warn('[FinalScene] erro ao carregar containers', url, error);
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
      }
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 55 / maxDim;
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);
    const normalized = new THREE.Box3().setFromObject(root);
    const center = normalized.getCenter(new THREE.Vector3());
    root.position.set(-center.x, -normalized.min.y, -center.z);
    this.containerUnitSize = normalized.getSize(new THREE.Vector3());
  }

  private buildContainerStack(
    prototype: THREE.Group,
    columns: number,
    rows: number,
    maxLevels: number,
    seed: number,
    density = 1
  ): THREE.Group {
    const group = new THREE.Group();
    const spacingX = this.containerUnitSize.x + 4;
    const spacingZ = this.containerUnitSize.z + 6;
    const spacingY = this.containerUnitSize.y + 1.8;
    const offsetX = ((columns - 1) * spacingX) / 2;
    const offsetZ = ((rows - 1) * spacingZ) / 2;
    const fillRatio = THREE.MathUtils.clamp(density, 0.2, 1);
    const levelFactor = 0.6 + fillRatio * 0.4;
    let placed = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const slotNoise = (Math.sin((seed + row * 37 + col * 17) * 12.9898) + 1) / 2;
        if (slotNoise > fillRatio && placed > 0) {
          continue;
        }
        const maxStack = Math.max(1, Math.min(3, Math.round(maxLevels * levelFactor)));
        const stackHeight = Math.max(1, 1 + ((row * 3 + col * 5 + seed) % maxStack));
        for (let level = 0; level < stackHeight; level++) {
          const color = this.containerColors[(row + col + level + seed) % this.containerColors.length];
          const container = this.cloneContainerPrototype(prototype, color);
          container.position.set(col * spacingX - offsetX, level * spacingY, row * spacingZ - offsetZ);
          group.add(container);
        }
        placed++;
      }
    }
    if (placed === 0) {
      const container = this.cloneContainerPrototype(prototype, this.containerColors[seed % this.containerColors.length]);
      container.position.set(0, 0, 0);
      group.add(container);
    }
    return group;
  }

  private cloneContainerPrototype(prototype: THREE.Group, color: number): THREE.Group {
    const clone = prototype.clone(true);
    const tint = new THREE.Color(color);
    clone.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const material = obj.material as THREE.Material;
        const mat = material.clone() as THREE.MeshStandardMaterial;
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

  private loadPortAssignments() {
    const layoutPromise = firstValueFrom(this.layoutApi.getLayout());
    const storagePromise = this.storageAreas
      .getAll()
      .then((areas) => {
        this.storageAreaCache.clear();
        areas.forEach((area) => this.storageAreaCache.set(area.id, area));
      })
      .catch((err) => {
        console.warn('[FinalScene] Falha ao carregar storage areas', err);
        this.storageAreaCache.clear();
      });

    Promise.all([layoutPromise, storagePromise])
      .then(([layout]) => this.zone.runOutsideAngular(() => this.applyLayoutAssignments(layout)))
      .catch((err) => console.warn('[FinalScene] Falha ao carregar layout dinâmico', err));
  }

  private applyLayoutAssignments(layout: PortLayoutDTO) {
    this.layoutData = layout;
    this.resetFacilityHotspots();
    const docks = layout.docks ?? [];
    this.dockSpanInfo = this.computeDockSpan(docks);
    this.computeDockDeckOverrides(docks);
    this.updateDockLabels(docks);
    const dockMap = new Map<number, DockLayout>(docks.map((d) => [d.dockId, d]));
    this.rebuildDockModules(docks);
    this.updateWarehousePlacements(layout.warehouses ?? [], dockMap);
    this.updateCranes(layout.cranes ?? [], dockMap);
    this.rebuildContainerStacks(docks);
    const previousBindings = this.prepareVesselBindingsForUpdate();

    const vesselEntries = (layout.activeVessels ?? [])
      .filter((v): v is DockedVesselPlacement => !!v && typeof v.dockId === 'number')
      .map((v) => {
        const state = this.getVesselDisplayState(v);
        const key = this.getVesselKey(v);
        return { vessel: v, state, key };
      });

    const departedKeys = new Set<string>(
      vesselEntries.filter((entry) => entry.state === 'departed').map((entry) => entry.key)
    );

    const classified = vesselEntries.filter(
      (entry): entry is { vessel: DockedVesselPlacement; state: VesselVisualState; key: string } =>
        entry.state !== 'upcoming' && entry.state !== 'departed'
    );

    if (!classified.length || !docks.length) {
      this.disposeUnusedVessels(previousBindings, departedKeys);
      return;
    }

    const berthed = classified.filter((entry) => entry.state === 'loading' || entry.state === 'unloading');
    const waiting = classified.filter((entry) => entry.state === 'waiting');
    if (berthed.length) {
      this.placeAssignedCargoVesselsFromLayout(berthed, dockMap, previousBindings);
    }
    if (waiting.length) {
      this.placeWaitingCargoVesselsFromLayout(waiting, dockMap, previousBindings);
    }
    this.disposeUnusedVessels(previousBindings, departedKeys);
  }

  private clearDynamicVessels() {
    this.vesselBindings.forEach((binding) => this.disposeVesselBinding(binding));
    this.vesselBindings.clear();
    this.dynamicVesselGroups = [];
    this.vesselLabelSprites = [];
    this.vesselAnimations = [];
  }

  private getVesselKey(placement: DockedVesselPlacement): string {
    if (typeof placement.notificationId === 'number') {
      return `notification-${placement.notificationId}`;
    }
    const arrival = placement.arrivalDate ?? 'unknown';
    return `vessel-${placement.vesselId}-${arrival}`;
  }

  private prepareVesselBindingsForUpdate(): Map<string, VesselVisualBinding> {
    const previous = this.vesselBindings;
    this.vesselBindings = new Map();
    this.dynamicVesselGroups = [];
    this.vesselLabelSprites = [];
    return previous;
  }

  private disposeUnusedVessels(previous: Map<string, VesselVisualBinding>, departedKeys?: Set<string>) {
    previous.forEach((binding, key) => {
      if (departedKeys && departedKeys.has(key)) {
        this.queueVesselDepartureAnimation(binding);
        departedKeys.delete(key);
      } else {
        this.disposeVesselBinding(binding);
      }
    });
  }

  private disposeVesselBinding(binding: VesselVisualBinding) {
    this.cancelVesselAnimationFor(binding.object);
    this.scene.remove(binding.object);
    this.removeLabelSprite(binding.label);
  }

  private cancelVesselAnimationFor(target: THREE.Object3D) {
    if (!this.vesselAnimations.length) {
      return;
    }
    this.vesselAnimations = this.vesselAnimations.filter((anim) => anim.object !== target);
  }

  private removeLabelSprite(label?: THREE.Sprite) {
    if (!label) {
      return;
    }
    this.scene.remove(label);
    this.vesselLabelSprites = this.vesselLabelSprites.filter((sprite) => sprite !== label);
  }

  private clearDockLabels() {
    for (const sprite of this.dockNameSprites) {
      this.scene.remove(sprite);
    }
    this.dockNameSprites = [];
  }

  private resetFacilityHotspots() {
    this.facilityLookup.clear();
    if (this.persistentFacilityHotspots.length) {
      this.facilityHotspots = [...this.persistentFacilityHotspots];
      this.persistentFacilityHotspots.forEach((hotspot) => this.facilityLookup.set(hotspot.object, hotspot));
    } else {
      this.facilityHotspots = [];
    }
    this.selectedFacility = undefined;
    this.hoveredFacility = undefined;
    if (this.facilitySelectionOutline) {
      this.scene.remove(this.facilitySelectionOutline);
      this.facilitySelectionOutline = undefined;
    }
    this.updateSelectionSpotlightTarget(undefined);
  }

  private updateDockLabels(docks: DockLayout[]) {
    this.clearDockLabels();
    if (!docks.length) return;
    docks.forEach((dock) => {
      const label = this.createLabelSprite(dock.name || `Dock ${dock.dockId}`, {
        background: 'rgba(255,255,255,0.9)',
        color: '#0d1b2a',
        scale: 110,
      });
      const x = this.mapDockToDeckX(dock);
      label.position.set(x, this.deckHeight + 70, this.quayEdgeZ - 130);
      this.scene.add(label);
      this.dockNameSprites.push(label);
    });
  }

  private computeDockSpan(docks: DockLayout[]): { minEdge: number; maxEdge: number; span: number } {
    if (!docks.length) {
      return { minEdge: -this.deckWidth / 2, maxEdge: this.deckWidth / 2, span: this.deckWidth };
    }
    let minEdge = Infinity;
    let maxEdge = -Infinity;
    docks.forEach((dock) => {
      const min = dock.position.x - dock.size.length / 2;
      const max = dock.position.x + dock.size.length / 2;
      minEdge = Math.min(minEdge, min);
      maxEdge = Math.max(maxEdge, max);
    });
    if (!isFinite(minEdge) || !isFinite(maxEdge)) {
      minEdge = -this.deckWidth / 2;
      maxEdge = this.deckWidth / 2;
    }
    return { minEdge, maxEdge, span: Math.max(1, maxEdge - minEdge) };
  }

  private mapDockToDeckX(dock: DockLayout): number {
    if (this.dockDeckOverrides.has(dock.dockId)) {
      return this.dockDeckOverrides.get(dock.dockId)!;
    }
    const span = this.dockSpanInfo ?? this.computeDockSpan(this.layoutData?.docks ?? []);
    const ratio = span.span > 0 ? (dock.position.x - span.minEdge) / span.span : 0.5;
    const deckSpan = this.deckWidth - this.deckMarginToEdge * 2;
    return (ratio - 0.5) * deckSpan;
  }

  private computeDockDeckOverrides(docks: DockLayout[]) {
    this.dockDeckOverrides.clear();
    if (!docks.length) return;
    if (docks.length <= this.dockDeckSlots.length) {
      const sorted = [...docks].sort((a, b) => a.position.x - b.position.x);
      sorted.forEach((dock, idx) => {
        this.dockDeckOverrides.set(dock.dockId, this.dockDeckSlots[idx]);
      });
    }
  }

  private placeAssignedCargoVesselsFromLayout(
    assignments: { vessel: DockedVesselPlacement; state: VesselVisualState }[],
    dockMap: Map<number, DockLayout>,
    previousBindings: Map<string, VesselVisualBinding>
  ) {
    const ordered = [...assignments].sort((a, b) => {
      const vesselA = a.vessel;
      const vesselB = b.vessel;
      if (vesselA.dockId === vesselB.dockId) {
        return (vesselA.sequenceOnDock ?? 0) - (vesselB.sequenceOnDock ?? 0);
      }
      return vesselA.dockId - vesselB.dockId;
    });

    const prepared = ordered.map((entry) => {
      const key = this.getVesselKey(entry.vessel);
      const reused = previousBindings.get(key);
      if (reused) {
        previousBindings.delete(key);
        this.removeLabelSprite(reused.label);
      }
      return { entry, key, reused };
    });

    this.getCargoVesselPrototype()
      .then((prototype) => {
        const berthZBase = this.quayEdgeZ + this.cargoVesselHalfBeam + this.cargoVesselClearance;
        const laneSpacing = this.cargoVesselHalfBeam * 2 + this.cargoVesselClearance + 18;
        prepared.forEach(({ entry, key, reused }) => {
          const info = entry.vessel;
          const dock = dockMap.get(info.dockId);
          if (!dock) return;
          const baseX = this.mapDockToDeckX(dock);
          const seq = typeof info.sequenceOnDock === 'number' ? info.sequenceOnDock : 0;
          const laneIndex = Math.max(0, Math.min(this.maxBerthLanes - 1, seq));
          const z = berthZBase + laneIndex * laneSpacing;
          let vessel: THREE.Group;
          if (reused) {
            vessel = reused.object;
          } else {
            vessel = this.instantiateCargoVessel(prototype);
            vessel.rotation.y = Math.PI / 2;
            this.scene.add(vessel);
          }
          if (this.canViewVesselStatuses) {
            this.applyVesselStatusColor(vessel, entry.state);
          }
          const targetPos = new THREE.Vector3(baseX, this.waterLevelY + this.cargoVesselFreeboard, z);
          const labelOptions: { status?: VesselVisualState } | undefined = this.canViewVesselStatuses
            ? { status: entry.state }
            : undefined;
          const label = this.addVesselLabel(info, dock, baseX, z, labelOptions);
          if (reused && reused.state === 'waiting') {
            this.queueVesselArrivalAnimation(vessel, label, targetPos);
          } else {
            this.cancelVesselAnimationFor(vessel);
            vessel.position.copy(targetPos);
            label.position.copy(this.computeLabelPosition(targetPos.x, targetPos.z));
          }
          this.dynamicVesselGroups.push(vessel);
          this.vesselBindings.set(key, { object: vessel, label, state: entry.state });
          this.registerFacilityHotspot(
            {
              id: `vessel-${info.notificationId ?? info.vesselId}-berth-${entry.state}-${Math.random().toString(36).slice(2)}`,
              name: info.vesselName ?? `Navio ${info.vesselId}`,
              type: 'vessel',
              object: vessel,
              focus: targetPos.clone(),
              vesselPlacement: info,
              vesselState: entry.state,
              dockName: dock.name ?? `Dock ${dock.dockId}`,
            },
            { persistent: false }
          );
        });
      })
      .catch((err) => console.warn('[FinalScene] Falha ao preparar navios aprovados', err));
  }

  private placeWaitingCargoVesselsFromLayout(
    assignments: { vessel: DockedVesselPlacement; state: VesselVisualState }[],
    dockMap: Map<number, DockLayout>,
    previousBindings: Map<string, VesselVisualBinding>
  ) {
    if (!assignments.length) {
      return;
    }
    const waitingOriginX = -1100;
    const waitingOriginZ = this.quayEdgeZ + this.cargoVesselHalfBeam + this.cargoVesselClearance + 60;
    const laneSpacingZ = this.cargoVesselHalfBeam * 2 + this.cargoVesselClearance + 140;
    const vesselsSorted = [...assignments].sort(
      (a, b) => this.getArrivalTime(a.vessel) - this.getArrivalTime(b.vessel)
    );

    const prepared = vesselsSorted.map((entry) => {
      const key = this.getVesselKey(entry.vessel);
      const reused = previousBindings.get(key);
      if (reused) {
        previousBindings.delete(key);
        this.removeLabelSprite(reused.label);
        this.cancelVesselAnimationFor(reused.object);
      }
      return { entry, key, reused };
    });

    this.getCargoVesselPrototype()
      .then((prototype) => {
        prepared.forEach(({ entry, key, reused }, idx) => {
          const info = entry.vessel;
          const x = waitingOriginX;
          const z = waitingOriginZ + idx * laneSpacingZ;
          let vessel: THREE.Group;
          if (reused) {
            vessel = reused.object;
          } else {
            vessel = this.instantiateCargoVessel(prototype);
            vessel.rotation.y = Math.PI / 2;
            this.scene.add(vessel);
          }
          if (this.canViewVesselStatuses) {
            this.applyVesselStatusColor(vessel, 'waiting');
          }
          vessel.position.set(x, this.waterLevelY + this.cargoVesselFreeboard, z);
          this.dynamicVesselGroups.push(vessel);
          const dock = dockMap.get(info.dockId);
          let label: THREE.Sprite | undefined;
          if (dock) {
            const labelOptions: { status?: VesselVisualState } | undefined = this.canViewVesselStatuses
              ? { status: 'waiting' }
              : undefined;
            label = this.addVesselLabel(info, dock, x, z, labelOptions);
            this.registerFacilityHotspot(
              {
                id: `vessel-${info.notificationId ?? info.vesselId}-waiting-${Math.random().toString(36).slice(2)}`,
                name: info.vesselName ?? `Navio ${info.vesselId}`,
                type: 'vessel',
                object: vessel,
                focus: vessel.position.clone(),
                vesselPlacement: info,
                vesselState: 'waiting',
                dockName: dock.name ?? `Dock ${dock.dockId}`,
              },
              { persistent: false }
            );
          }
          this.vesselBindings.set(key, { object: vessel, label, state: 'waiting' });
        });
      })
      .catch((err) => console.warn('[FinalScene] Falha ao preparar navios em espera', err));
  }

  private addVesselLabel(
    info: DockedVesselPlacement,
    dock: DockLayout,
    x: number,
    z: number,
    opts?: { status?: VesselVisualState }
  ): THREE.Sprite {
    const dockName = dock.name ?? `Dock ${dock.dockId}`;
    let text = `${info.vesselName ?? info.vesselId} — ${dockName}`;
    const statusIcon =
      opts?.status === 'waiting' ? '⏸️' : opts?.status === 'loading' ? '🔋' : opts?.status === 'unloading' ? '🪫' : '';
    const background = opts?.status ? this.getStatusCssColor(opts.status) : 'rgba(9,25,53,0.92)';
    const textColor = opts?.status === 'waiting' ? '#0f1f32' : '#f4f7fb';
    const label = this.createLabelSprite(text, {
      background,
      color: textColor,
      scale: 160,
      footerIcon: statusIcon,
    });
    label.position.copy(this.computeLabelPosition(x, z));
    this.scene.add(label);
    this.vesselLabelSprites.push(label);
    return label;
  }

  private computeLabelPosition(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, this.waterLevelY + this.cargoVesselFreeboard + 90, z - this.cargoVesselHalfBeam * 0.4);
  }

  private getStatusCssColor(status: VesselVisualState): string {
    const hex = this.vesselStatusColors[status];
    return `#${hex.toString(16).padStart(6, '0')}`;
  }

  private getWarehouseFillColor(ratio: number): number {
    if (ratio <= 0.33) {
      return 0x2ecc71;
    }
    if (ratio <= 0.66) {
      return 0xf1c40f;
    }
    return 0xe74c3c;
  }

  private createLabelSprite(
    text: string,
    opts?: {
      background?: string;
      color?: string;
      scale?: number;
      footerIcon?: string;
    }
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    const hasFooter = !!opts?.footerIcon;
    const fontColor = opts?.color ?? '#0f1f32';
    const baseFontSize = 64;
    const lineHeight = baseFontSize + 12;
    const textLines = lines.length ? lines : [''];
    const textBlockHeight = textLines.length * lineHeight;
    const footerHeight = hasFooter ? lineHeight + 30 : 0;
    const paddingY = 60;
    const backgroundHeight = textBlockHeight + paddingY * 2 + footerHeight;
    const rectY = canvas.height / 2 - backgroundHeight / 2;
    const rectHeight = Math.min(canvas.height - 40, backgroundHeight);
    this.paintRoundedRect(
      ctx,
      30,
      rectY,
      canvas.width - 60,
      rectHeight,
      36,
      opts?.background ?? 'rgba(255,255,255,0.95)'
    );
    ctx.fillStyle = fontColor;
    ctx.font = `bold ${baseFontSize}px "Inter", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textStartY = rectY + paddingY + lineHeight / 2;
    textLines.forEach((line, index) => {
      const y = textStartY + index * lineHeight - (hasFooter ? footerHeight / 2 : 0);
      ctx.fillText(line, canvas.width / 2, y);
    });
    if (hasFooter) {
      ctx.font = 'bold 84px "Inter", "Segoe UI", sans-serif';
      ctx.fillText(opts.footerIcon ?? '', canvas.width / 2, rectY + rectHeight - lineHeight / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    this.disposableTextures.push(texture);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.disposableMaterials.push(material);
    const sprite = new THREE.Sprite(material);
    const scale = opts?.scale ?? 140;
    const multilineFactor = Math.max(1, textLines.length * 0.45);
    const footerFactor = hasFooter ? 0.3 : 0;
    const heightMultiplier = 0.3 + multilineFactor * 0.2 + footerFactor;
    sprite.scale.set(scale, Math.max(50, scale * heightMultiplier), 1);
    return sprite;
  }

  private paintRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillStyle: string
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.restore();
  }

  private getVesselDisplayState(vessel: DockedVesselPlacement): VesselDisplayState {
    const now = Date.now();
    const arrival = vessel.arrivalDate ? Date.parse(vessel.arrivalDate) : NaN;
    const departure = vessel.departureDate ? Date.parse(vessel.departureDate) : NaN;
    if (!Number.isNaN(departure) && now > departure) {
      return 'departed';
    }
    if (Number.isNaN(arrival)) {
      return 'loading';
    }
    if (now < arrival - this.vesselWaitingLeadMs) {
      return 'upcoming';
    }
    if (now < arrival) {
      return 'waiting';
    }
    if (Number.isNaN(departure) || departure <= arrival) {
      return 'loading';
    }
    const window = departure - arrival;
    const midpoint = arrival + window / 2;
    if (now <= midpoint) {
      return 'unloading';
    }
    return 'loading';
  }

  private getArrivalTime(vessel: DockedVesselPlacement): number {
    const ts = vessel.arrivalDate ? Date.parse(vessel.arrivalDate) : NaN;
    return Number.isNaN(ts) ? Infinity : ts;
  }

  private placeCargoVessels(offsets: number[]) {
    this.getCargoVesselPrototype()
      .then((prototype) => {
        const berthZ = this.quayEdgeZ + this.cargoVesselHalfBeam + this.cargoVesselClearance;
        offsets.forEach((x) => {
          const vessel = this.instantiateCargoVessel(prototype);
          vessel.position.set(x, this.waterLevelY + this.cargoVesselFreeboard, berthZ);
          vessel.rotation.y = Math.PI / 2;
          this.scene.add(vessel);
        });
      })
      .catch((error) => console.warn('[FinalScene] Falha ao carregar cargo_vessel GLB', error));
  }

  private instantiateCargoVessel(prototype: THREE.Group): THREE.Group {
    const vessel = prototype.clone(true);
    vessel.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return vessel;
  }

  private applyVesselStatusColor(vessel: THREE.Group, status: VesselVisualState) {
    const tint = new THREE.Color(this.vesselStatusColors[status]);
    vessel.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map((mat) => this.cloneAndTintMaterial(mat, tint));
        } else if (obj.material) {
          obj.material = this.cloneAndTintMaterial(obj.material as THREE.Material, tint);
        }
      }
    });
  }

  private cloneAndTintMaterial(material: THREE.Material, tint: THREE.Color): THREE.Material {
    const cloned = material.clone() as THREE.MeshStandardMaterial;
    if ((cloned as THREE.MeshStandardMaterial).color) {
      (cloned as THREE.MeshStandardMaterial).color.copy(tint);
    }
    cloned.needsUpdate = true;
    return cloned;
  }

  private refreshFacilityInfo(facility: FacilityHotspot) {
    const requestId = ++this.facilityInfoRequestId;
    this.facilityInfoCard = this.createBaseInfoCard(facility);
    this.cdr.detectChanges();
    this.buildFacilityInfoCard(facility)
      .then((card) => {
        if (requestId !== this.facilityInfoRequestId) return;
        this.facilityInfoCard = card;
        this.cdr.detectChanges();
      })
      .catch(() => {
        if (requestId !== this.facilityInfoRequestId) return;
        this.facilityInfoCard = this.createBaseInfoCard(facility);
        this.facilityInfoCard.note = 'Não foi possível sincronizar com o backend.';
        this.cdr.detectChanges();
      });
  }

  private createBaseInfoCard(facility: FacilityHotspot): FacilityInfoCard {
    const center = this.getObjectCenter(facility.object);
    return {
      title: facility.name,
      type: facility.type,
      description: 'A obter dados atualizados...',
      generalStats: [
        { label: 'Coordenadas', value: `${center.x.toFixed(0)} / ${center.y.toFixed(0)} / ${center.z.toFixed(0)}` },
      ],
      updatedAt: new Date(),
    };
  }

  private async buildFacilityInfoCard(facility: FacilityHotspot): Promise<FacilityInfoCard> {
    switch (facility.type) {
      case 'dock':
        return this.buildDockInfoCard(facility);
      case 'yard':
        return this.buildYardInfoCard(facility);
      case 'warehouse':
        return this.buildWarehouseInfoCard(facility);
      case 'crane':
        return this.buildCraneInfoCard(facility);
      case 'vessel':
        return this.buildVesselInfoCard(facility);
      default:
        return this.createBaseInfoCard(facility);
    }
  }

  private async buildDockInfoCard(facility: FacilityHotspot): Promise<FacilityInfoCard> {
    const info = facility.dockLayout;
    let details: DockDTO | null = null;
    if (info?.dockId) {
      try {
        details = await this.docksService.getById(info.dockId);
      } catch (err) {
        console.warn('[FinalScene] Falha ao obter dock', err);
      }
    }
    const stats: FacilityStat[] = [this.createCoordinateStat(facility)];
    const restricted: FacilityStat[] = [];
    if (info) {
      const backend = this.extractBackendStats(info, {
        skipKeys: ['name'],
        labelOverrides: {
          dockId: 'ID do cais',
          'position.x': 'Posição X (layout)',
          'position.y': 'Posição Y (layout)',
          'position.z': 'Posição Z (layout)',
          'size.length': 'Comprimento (layout)',
          'size.width': 'Largura (layout)',
          'size.height': 'Altura (layout)',
          rotationY: 'Rotação Y',
        },
        numberDigits: { rotationY: 2 },
      });
      stats.push(...backend.general);
      restricted.push(...backend.restricted);
    }
    if (details) {
      const backend = this.extractBackendStats(details, {
        skipKeys: ['name'],
        restrictedKeys: ['maxDraft'],
        labelOverrides: {
          id: 'ID no sistema',
          location: 'Localização',
          length: 'Comprimento (registo)',
          depth: 'Profundidade (registo)',
          maxDraft: 'Calado máximo',
          allowedVesselTypes: 'Tipos autorizados',
        },
      });
      stats.push(...backend.general);
      restricted.push(...backend.restricted);
    }
    return {
      title: facility.name,
      type: 'dock',
      description: details?.location ?? (info ? this.describeDock(info) : 'Terminal de cais'),
      generalStats: stats,
      restrictedStats: this.canViewRestrictedInfo && restricted.length ? restricted : undefined,
      updatedAt: new Date(),
    };
  }

  private async buildVesselInfoCard(facility: FacilityHotspot): Promise<FacilityInfoCard> {
    const placement = facility.vesselPlacement;
    const status = facility.vesselState ?? 'waiting';
    const stats: FacilityStat[] = [];
    if (facility.dockName) {
      stats.push({ label: 'Cais', value: facility.dockName });
    }
    stats.push(this.createCoordinateStat(facility));
    const restricted: FacilityStat[] = [];
    if (this.canViewRestrictedInfo) {
      restricted.push({ label: 'Estado operacional', value: this.vesselStatusText[status] });
      if (placement?.arrivalDate) {
        restricted.push({ label: 'ETA', value: this.formatDateTime(placement.arrivalDate) });
      }
      if (placement?.departureDate) {
        restricted.push({ label: 'ETD', value: this.formatDateTime(placement.departureDate) });
      }
    }
    if (placement) {
      const backend = this.extractBackendStats(placement, {
        skipKeys: ['vesselName', 'arrivalDate', 'departureDate'],
        restrictedKeys: ['status', 'officerId'],
        labelOverrides: {
          notificationId: 'Notificação',
          dockId: 'Cais ID',
          vesselId: 'ID interno do navio',
          officerId: 'Oficial responsável',
          displayLength: 'Comprimento em cena',
          estimatedBeam: 'Boca estimada',
          sequenceOnDock: 'Sequência no cais',
          status: 'Estado da API',
        },
        numberDigits: {
          displayLength: 0,
          estimatedBeam: 0,
        },
      });
      stats.push(...backend.general);
      restricted.push(...backend.restricted);
    }

    const operations: string[] = [];
    switch (status) {
      case 'waiting':
        operations.push('Em fundeadouro controlado, a aguardar janela de cais.');
        break;
      case 'unloading':
        operations.push('Operações de descarga em progresso (primeira metade do slot).');
        break;
      case 'loading':
        operations.push('Operações de carga em progresso (segunda metade do slot).');
        break;
    }

    return {
      title: facility.name,
      type: 'vessel',
      description: this.canViewRestrictedInfo && placement?.status
        ? placement.status
        : `Navio atribuído ao ${facility.dockName ?? 'cais'}`,
      generalStats: stats,
      restrictedStats: this.canViewRestrictedInfo && restricted.length ? restricted : undefined,
      operations: this.canViewRestrictedInfo ? operations : undefined,
      updatedAt: new Date(),
    };
  }

  private async buildYardInfoCard(facility: FacilityHotspot): Promise<FacilityInfoCard> {
    const info = facility.yardLayout;
    let storage: StorageAreaDTO | null = null;
    if (info?.storageAreaId) {
      try {
        storage = await this.storageAreas.getById(info.storageAreaId);
      } catch (err) {
        console.warn('[FinalScene] Falha ao obter storage area', err);
      }
    }
    const stats: FacilityStat[] = [];
    if (info) {
      stats.push({ label: 'Área (m²)', value: `${this.formatNumber(info.width * info.depth)} m²` });
    }
    stats.push(this.createCoordinateStat(facility));
    if (info) {
      const backend = this.extractBackendStats(info, {
        skipKeys: ['name'],
        labelOverrides: {
          storageAreaId: 'ID zona de armazenamento',
          width: 'Largura (layout)',
          depth: 'Profundidade (layout)',
          x: 'Posição X (layout)',
          z: 'Posição Z (layout)',
          y: 'Altura (layout)',
          servedDockIds: 'Cais servidos',
        },
      });
      stats.push(...backend.general);
    }
    const restricted: FacilityStat[] = [];
    if (storage) {
      const backend = this.extractBackendStats(storage, {
        skipKeys: ['id'],
        restrictedKeys: ['currentOccupancyTEU'],
        labelOverrides: {
          type: 'Tipo de armazenamento',
          location: 'Localização',
          maxCapacityTEU: 'Capacidade máxima (TEU)',
          currentOccupancyTEU: 'Ocupação atual (TEU)',
          servedDockIds: 'Cais atribuídos',
        },
      });
      stats.push(...backend.general);
      restricted.push(...backend.restricted);
    }
    return {
      title: facility.name,
      type: 'yard',
      description: storage?.type ?? 'Zona de contentores',
      generalStats: stats,
      restrictedStats: this.canViewRestrictedInfo && restricted.length ? restricted : undefined,
      updatedAt: new Date(),
    };
  }

  private async buildWarehouseInfoCard(facility: FacilityHotspot): Promise<FacilityInfoCard> {
    const info = facility.warehouseLayout;
    const stats: FacilityStat[] = [this.createCoordinateStat(facility)];
    if (info) {
      stats.push({
        label: 'Pegada (m)',
        value: `${this.formatNumber(info.size.width)} x ${this.formatNumber(info.size.depth)} m`,
      });
      const backend = this.extractBackendStats(info, {
        skipKeys: ['name'],
        labelOverrides: {
          storageAreaId: 'ID zona de armazenamento',
          'position.x': 'Posição X (layout)',
          'position.y': 'Posição Y (layout)',
          'position.z': 'Posição Z (layout)',
          'size.width': 'Largura (layout)',
          'size.depth': 'Profundidade (layout)',
          'size.height': 'Altura (layout)',
          rotationY: 'Rotação Y',
        },
        numberDigits: { rotationY: 2 },
      });
      stats.push(...backend.general);
    }
    return {
      title: facility.name,
      type: 'warehouse',
      description: info ? `${info.size.width} x ${info.size.depth} m` : 'Armazém',
      generalStats: stats,
      updatedAt: new Date(),
    };
  }

  private async buildCraneInfoCard(facility: FacilityHotspot): Promise<FacilityInfoCard> {
    const specs = facility.craneSpecs;
    const stats: FacilityStat[] = [this.createCoordinateStat(facility)];
    if (specs) {
      const backend = this.extractBackendStats(specs, {
        labelOverrides: {
          designation: 'Designação',
          height: 'Altura (m)',
          gauge: 'Gauge (m)',
          clearance: 'Clearance (m)',
        },
      });
      stats.push(...backend.general);
    }
    return {
      title: facility.name,
      type: 'crane',
      description: specs?.designation ?? 'Grua de cais',
      generalStats: stats,
      updatedAt: new Date(),
    };
  }

  private formatNumber(value: number | undefined, digits = 0): string {
    if (value === undefined || Number.isNaN(value)) {
      return '—';
    }
    return value.toLocaleString('pt-PT', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  private formatDateTime(value?: string | number | null): string {
    if (!value) {
      return '—';
    }
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleString('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  private formatVector(vec: THREE.Vector3): string {
    return `${vec.x.toFixed(0)} / ${vec.y.toFixed(0)} / ${vec.z.toFixed(0)}`;
  }

  private createCoordinateStat(facility: FacilityHotspot): FacilityStat {
    return {
      label: 'Coordenadas',
      value: this.formatVector(this.getObjectCenter(facility.object)),
    };
  }

  private extractBackendStats(
    payload: unknown,
    options?: {
      skipKeys?: string[];
      restrictedKeys?: string[];
      labelOverrides?: Record<string, string>;
      numberDigits?: Record<string, number>;
    }
  ): { general: FacilityStat[]; restricted: FacilityStat[] } {
    if (!payload || typeof payload !== 'object') {
      return { general: [], restricted: [] };
    }
    const skip = new Set(options?.skipKeys ?? []);
    const restricted = new Set(options?.restrictedKeys ?? []);
    const entries = this.flattenPayload(payload as Record<string, unknown>);
    const general: FacilityStat[] = [];
    const restrictedStats: FacilityStat[] = [];
    for (const [key, value] of entries) {
      if (skip.has(key) || value === undefined) {
        continue;
      }
      const stat: FacilityStat = {
        label: this.humanizeBackendKey(key, options?.labelOverrides),
        value: this.formatBackendValue(key, value, options?.numberDigits),
      };
      if (restricted.has(key)) {
        restrictedStats.push(stat);
      } else {
        general.push(stat);
      }
    }
    return { general, restricted: restrictedStats };
  }

  private flattenPayload(payload: Record<string, unknown>, prefix = ''): [string, unknown][] {
    const entries: [string, unknown][] = [];
    Object.entries(payload).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        entries.push(...this.flattenPayload(value as Record<string, unknown>, path));
      } else {
        entries.push([path, value]);
      }
    });
    return entries;
  }

  private humanizeBackendKey(key: string, overrides?: Record<string, string>): string {
    if (overrides?.[key]) {
      return overrides[key];
    }
    return key
      .split('.')
      .map((segment) => {
        const spaced = segment.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
        return spaced.charAt(0).toUpperCase() + spaced.slice(1);
      })
      .join(' · ');
  }

  private formatBackendValue(key: string, value: unknown, digitsMap?: Record<string, number>): string {
    if (value === null || value === undefined) {
      return '—';
    }
    if (Array.isArray(value)) {
      if (!value.length) {
        return '—';
      }
      return value
        .map((entry) => {
          if (entry === null || entry === undefined) {
            return '—';
          }
          if (typeof entry === 'number') {
            const digits = digitsMap?.[key] ?? (Number.isInteger(entry) ? 0 : 2);
            return this.formatNumber(entry, digits);
          }
          if (typeof entry === 'string') {
            return entry;
          }
          if (typeof entry === 'boolean') {
            return entry ? 'Sim' : 'Não';
          }
          if (typeof entry === 'object') {
            return this.stringifyObjectValue(entry as Record<string, unknown>);
          }
          return String(entry);
        })
        .join(', ');
    }
    if (typeof value === 'number') {
      const digits = digitsMap?.[key] ?? (Number.isInteger(value) ? 0 : 2);
      return this.formatNumber(value, digits);
    }
    if (value instanceof Date) {
      return value.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
    }
    if (typeof value === 'boolean') {
      return value ? 'Sim' : 'Não';
    }
    if (typeof value === 'object') {
      return this.stringifyObjectValue(value as Record<string, unknown>);
    }
    return String(value);
  }

  private stringifyObjectValue(value: Record<string, unknown>): string {
    const named = (value as { name?: unknown }).name;
    if (typeof named === 'string' && named.trim()) {
      return named;
    }
    const coded = (value as { code?: unknown }).code;
    if (typeof coded === 'string' && coded.trim()) {
      return coded;
    }
    const identifier = (value as { id?: unknown }).id;
    if (typeof identifier === 'string' || typeof identifier === 'number') {
      return `#${identifier}`;
    }
    return JSON.stringify(value);
  }

  private registerFacilityHotspot(hotspot: FacilityHotspot, options?: { persistent?: boolean }) {
    this.facilityHotspots.push(hotspot);
    this.facilityLookup.set(hotspot.object, hotspot);
    if (options?.persistent !== false) {
      this.persistentFacilityHotspots.push(hotspot);
    }
  }

  private getObjectCenter(object: THREE.Object3D): THREE.Vector3 {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) {
      const v = new THREE.Vector3();
      object.getWorldPosition(v);
      return v;
    }
    return box.getCenter(new THREE.Vector3());
  }

  private startCameraTween(endPos: THREE.Vector3, endTarget: THREE.Vector3, duration = 650) {
    if (!this.camera || !this.controls) return;
    this.cameraTween = {
      startPos: this.camera.position.clone(),
      endPos: endPos.clone(),
      startTarget: this.controls.target.clone(),
      endTarget: endTarget.clone(),
      startTime: performance.now(),
      duration,
    };
  }

  private updateSelectionSpotlightTarget(facility?: FacilityHotspot) {
    if (!this.selectionSpotlight) return;
    const hasGroup = this.facilityHotspots.length >= this.minSpotlightGroupSize;
    if (!facility || !hasGroup) {
      this.selectionSpotlight.visible = false;
      return;
    }
    const center = facility.focus ?? this.getObjectCenter(facility.object);
    this.selectionSpotTarget.position.copy(center);
    this.selectionSpotTarget.updateMatrixWorld(true);
    this.selectionSpotlight.visible = true;
    this.selectionFillLights.forEach((fill) => {
      const offset: THREE.Vector3 = (fill.userData['offset'] as THREE.Vector3 | undefined) ?? new THREE.Vector3();
      fill.position.set(
        this.selectionSpotTarget.position.x + offset.x,
        this.selectionSpotTarget.position.y + offset.y,
        this.selectionSpotTarget.position.z + offset.z
      );
      fill.target.updateMatrixWorld(true);
      fill.visible = true;
    });
  }

  private describeDock(dock: DockLayout): string {
    return `${this.formatNumber(dock.size.length)} x ${this.formatNumber(dock.size.width)} m`;
  }

  private updateSelectionSpotlight() {
    if (!this.selectionSpotlight || !this.camera) return;
    const active = !!this.selectedFacility && this.facilityHotspots.length >= this.minSpotlightGroupSize;
    if (!active) {
      this.selectionSpotlight.visible = false;
      if (this.ambientLight) {
        this.ambientLight.intensity = this.ambientBaseIntensity;
      }
      if (this.hemiLight) {
        this.hemiLight.intensity = this.hemiBaseIntensity;
      }
      if (this.sunLight) {
        this.sunLight.intensity = this.sunBaseIntensity;
      }
      this.selectionFillLights.forEach((fill) => (fill.visible = false));
      this.scene.background = this.backgroundBaseColor;
      return;
    }
    const targetPos = this.selectionSpotTarget.position;
    this.selectionSpotlight.position.set(targetPos.x, targetPos.y + 520, targetPos.z);
    this.selectionSpotlight.target.position.copy(this.selectionSpotTarget.position);
    this.selectionSpotlight.target.updateMatrixWorld(true);
    this.selectionSpotlight.visible = true;
    this.selectionFillLights.forEach((fill) => {
      const offset: THREE.Vector3 = (fill.userData['offset'] as THREE.Vector3 | undefined) ?? new THREE.Vector3();
      fill.position.set(
        targetPos.x + offset.x,
        targetPos.y + offset.y,
        targetPos.z + offset.z
      );
      fill.target.position.copy(this.selectionSpotTarget.position);
      fill.target.updateMatrixWorld(true);
      fill.visible = true;
    });
    if (this.ambientLight) {
      this.ambientLight.intensity = this.ambientDimIntensity;
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = this.hemiDimIntensity;
    }
    if (this.sunLight) {
      this.sunLight.intensity = this.sunDimIntensity;
    }
    this.scene.background = this.backgroundDimColor;
  }
}
