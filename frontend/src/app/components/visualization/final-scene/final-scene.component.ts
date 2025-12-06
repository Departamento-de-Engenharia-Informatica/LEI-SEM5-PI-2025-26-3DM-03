import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPortalLatticeCraneModel } from '../crane/dockcrane.component';
import { applyTruckTrailerTexture, applyTruckWindowTexture } from '../truck/truck-texture.util';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  DockLayout,
  DockedVesselPlacement,
  LandAreaLayout,
  PortLayoutDTO,
  PortLayoutService,
  WarehouseLayout,
} from '../../../services/visualization/port-layout.service';
import { DocksService } from '../../../services/docks/docks.service';
import { StorageAreasService } from '../../../services/storage-areas/storage-areas.service';
import { DockDTO } from '../../../models/dock';
import { StorageAreaDTO } from '../../../models/storage-area';
import { AuthService } from '../../../services/auth/auth.service';

type FacilityType = 'dock' | 'yard' | 'warehouse' | 'generic';

interface FacilityHotspot {
  id: string;
  name: string;
  type: FacilityType;
  hitObject: THREE.Object3D;
  highlightObject: THREE.Object3D;
  focusPoint: THREE.Vector3;
  overlayMaterial?: FacilityOverlayMaterial;
  layoutDock?: DockLayout;
  layoutArea?: LandAreaLayout;
  layoutWarehouse?: WarehouseLayout;
}

interface CameraTween {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  startTime: number;
  duration: number;
}

interface FacilityOverlayMaterial extends THREE.MeshBasicMaterial {
  userData: FacilityOverlayMetadata;
}

interface FacilityOverlayMetadata {
  baseOpacity?: number;
  hoverOpacity?: number;
  activeOpacity?: number;
}

interface FacilityInfoCard {
  title: string;
  type: FacilityType;
  description?: string;
  generalStats: InfoStat[];
  restrictedStats?: InfoStat[];
  operations?: string[];
  updatedAt: Date;
  restrictedNote?: string;
  warning?: string;
}

interface InfoStat {
  label: string;
  value: string;
}

type VesselRenderInfo = {
  data: DockedVesselPlacement;
  waiting: boolean;
};

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
  private readonly waterLevelY = 52;
  private readonly quayEdgeZ = 360;
  private readonly cargoVesselClearance = 22;
  private readonly cargoVesselFreeboard = 6;
  private readonly cargoVesselTargetLength = 480;
  private readonly cargoVesselModelUrls = ['assets/models/cargo_vessel.glb', 'assets/cargo_vessel.glb'];
  private readonly rendererPixelRatioCap = 1.35;
  private readonly enableShadows = false;
  private readonly waterNormalFrameSkip = 2;
  private waterNormalCounter = 0;
  private readonly deckWidth = 1500;
  private readonly deckDepth = 1350;
  private readonly deckHeight = 60;
  private readonly deckMarginToEdge = 15;
  private readonly apronDepth = 220;
  private readonly logisticsRoadDepth = 320;
  private readonly logisticsRoadWidthOffset = 0;
  private readonly logisticsRoadCenterZ = -550;
  private readonly containerLaneZ = [-420, -320, -220, -120, -20, 80];
  private readonly containerLaneX = [-320, 0, 320];
  private readonly containerLaneHeights = [7, 6, 5, 4, 3, 2];
  private currentLogisticsRoadCenterZ = this.logisticsRoadCenterZ;
  private currentLogisticsRoadCenterX = 0;
  private currentLogisticsRoadWidth = this.deckWidth - this.logisticsRoadWidthOffset;
  private currentLogisticsRoadDepth = this.logisticsRoadDepth;
  private readonly logisticsRoadContainerWidthTrim = 40;
  private readonly logisticsRoadFrontClearance = 25;
  private readonly cameraMoveSpeed = 260;
  private containerStackPrototype?: THREE.Group;
  private containerStackLoading?: Promise<THREE.Group>;
  private readonly containerStackUrls = ['assets/models/containers.glb'];
  private readonly containerTargetSpan = 55;
  private readonly containerColors = [0xff8c5f, 0x00c2ff, 0xff4f81, 0x7dd87d, 0xffbf69, 0x9b5de5];
  private containerUnitSize = new THREE.Vector3(40, 16, 80);
  private readonly containerCols = 4;
  private readonly containerRows = 3;
  private readonly warehouseModelUrls = ['assets/models/warehouse.glb', 'assets/warehouse.glb'];
  private warehousePrototype?: THREE.Group;
  private warehouseLoading?: Promise<THREE.Group>;
  private warehouseBaseDimensions?: THREE.Vector3;
  private cargoVesselPrototype?: THREE.Group;
  private cargoVesselLoading?: Promise<THREE.Group>;
  private cargoVesselHalfBeam = 0;
  private readonly maxBerthLanes = 1;
  private readonly vesselWaitingLeadMs = 60 * 60 * 1000;
  private readonly vesselWaitingExtraOffset = 280;
  private layoutData?: PortLayoutDTO;
  private dynamicVesselGroups: THREE.Object3D[] = [];
  private dockNameSprites: THREE.Sprite[] = [];
  private vesselLabelSprites: THREE.Sprite[] = [];
  private warehouseInstances: THREE.Group[] = [];
  private dockSpanInfo?: { minEdge: number; maxEdge: number; span: number };
  private readonly dockDeckSlots = [-360, 360];
  private dockDeckOverrides = new Map<number, number>();
  private readonly enablePlaceholderCargoVessels = false;
  private readonly logisticsRoadTextureUrl = 'assets/textures/textura-da-estrada-do-asfalto-com-marcacoes-109441328.jpg';
  private readonly containerRoadTextureUrl = 'assets/textures/estrada.jpg';
  private logisticsRoadTexture?: THREE.Texture;
  private containerRoadTexture?: THREE.Texture;
  private readonly truckModelUrls = ['assets/models/Truck_DAF.glb', 'assets/Truck_DAF.glb'];
  private readonly truckTargetSpan = 220;
  private truckPrototype?: THREE.Group;
  private truckLoading?: Promise<THREE.Group>;
  private readonly truckTrailerTextureUrl = 'assets/textures/azul.jpg';
  private truckTrailerTexture?: THREE.Texture;
  private readonly truckWindowTextureUrl = 'assets/textures/vidro.jpg';
  private truckWindowTexture?: THREE.Texture;
  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private facilityOverlayMeshes: THREE.Mesh<THREE.BufferGeometry, FacilityOverlayMaterial>[] = [];
  private facilityLookup = new Map<THREE.Object3D, FacilityHotspot>();
  private facilityHitTargets: THREE.Object3D[] = [];
  private facilityHotspots: FacilityHotspot[] = [];
  private hoveredFacility?: FacilityHotspot;
  private facilitySelectionOutline?: THREE.BoxHelper;
  private cameraTween?: CameraTween;
  private pointerEventsAttached = false;
  infoOverlayVisible = false;
  facilityInfoCard?: FacilityInfoCard;
  private facilityInfoRequestId = 0;
  canViewRestrictedInfo = false;
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
    generic: 'Elemento 3D',
  };
  fullscreenActive = false;
  selectedFacility?: FacilityHotspot;
  private readonly handleScenePointerMove = (event: PointerEvent) => this.onScenePointerMove(event);
  private readonly handleScenePointerClick = (event: MouseEvent) => this.onScenePointerClick(event);

  constructor(
    private zone: NgZone,
    private layoutApi: PortLayoutService,
    private docksService: DocksService,
    private storageAreasService: StorageAreasService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.updateRestrictedAccessFlag();
    this.authSubscription = this.auth.loggedIn$.subscribe(() => this.updateRestrictedAccessFlag());
  }

  ngAfterViewInit(): void {
    this.initRenderer();
    this.buildScene();
    this.attachScenePointerEvents();
    this.rebuildFacilityHotspots();
    this.loadPortAssignments();
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);

    this.zone.runOutsideAngular(() => {
      this.animate();
      window.addEventListener('resize', this.handleResize, { passive: true });
    });
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.detachScenePointerEvents();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.clearFacilityHotspots();
    this.clearDynamicVessels();
    this.clearDockLabels();
    if (this.facilitySelectionOutline) {
      this.scene.remove(this.facilitySelectionOutline);
      this.facilitySelectionOutline.geometry.dispose();
      (this.facilitySelectionOutline.material as THREE.Material).dispose();
      this.facilitySelectionOutline = undefined;
    }
    this.authSubscription?.unsubscribe();
    this.disposableGeometries.forEach((geom) => geom.dispose());
    this.disposableMaterials.forEach((mat) => mat.dispose());
    this.disposableTextures.forEach((tex) => tex.dispose());
  }

  private attachScenePointerEvents() {
    if (this.pointerEventsAttached) {
      return;
    }
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      return;
    }
    this.pointerEventsAttached = true;
    this.zone.runOutsideAngular(() => {
      canvas.addEventListener('pointermove', this.handleScenePointerMove);
      canvas.addEventListener('click', this.handleScenePointerClick);
    });
  }

  private detachScenePointerEvents() {
    if (!this.pointerEventsAttached) {
      return;
    }
    this.pointerEventsAttached = false;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      return;
    }
    canvas.removeEventListener('pointermove', this.handleScenePointerMove);
    canvas.removeEventListener('click', this.handleScenePointerClick);
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent) {
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
      if (!event.repeat) {
        this.zone.run(() => this.toggleInfoOverlay());
      }
      handled = true;
    }
    if (handled) {
      event.preventDefault();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onWindowKeyUp(event: KeyboardEvent) {
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
  }

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

  private handleFullscreenChange = () => {
    this.fullscreenActive = !!document.fullscreenElement;
  };

  closeInfoOverlay() {
    this.infoOverlayVisible = false;
    this.facilityInfoCard = undefined;
    this.cdr.detectChanges();
  }

  private openInfoOverlay() {
    this.infoOverlayVisible = true;
    if (!this.selectedFacility) {
      if (this.hoveredFacility) {
        this.setSelectedFacility(this.hoveredFacility, false);
      } else {
        const fallback = this.findGenericIntersection();
        if (fallback) {
          this.setSelectedFacility(this.buildGenericFacility(fallback), false);
        }
      }
    }
    if (this.selectedFacility) {
      this.refreshFacilityInfo(this.selectedFacility);
    }
    this.cdr.detectChanges();
  }

  private toggleInfoOverlay() {
    if (this.infoOverlayVisible) {
      this.closeInfoOverlay();
      return;
    }
    this.openInfoOverlay();
  }

  private onScenePointerMove(event: PointerEvent) {
    this.updatePointerFromEvent(event);
    const hovered = this.findFacilityIntersection();
    this.setHoveredFacility(hovered);
  }

  private onScenePointerClick(event: MouseEvent) {
    this.updatePointerFromEvent(event);
    const picked = this.findFacilityIntersection();
    if (picked) {
      this.zone.run(() => this.setSelectedFacility(picked));
      return;
    }
    const fallbackObject = this.findGenericIntersection();
    if (fallbackObject) {
      const generic = this.buildGenericFacility(fallbackObject);
      this.zone.run(() => this.setSelectedFacility(generic));
    }
  }

  private updatePointerFromEvent(event: PointerEvent | MouseEvent) {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private findFacilityIntersection(): FacilityHotspot | undefined {
    if (!this.camera || !this.facilityHitTargets.length) {
      return undefined;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.facilityHitTargets, true);
    for (const hit of intersections) {
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        const facility = this.facilityLookup.get(node);
        if (facility) {
          return facility;
        }
        node = node.parent;
      }
    }
    return undefined;
  }

  private findGenericIntersection(): THREE.Object3D | undefined {
    if (!this.camera) {
      return undefined;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.scene.children, true);
    const hit = intersections.find((i) => i.object && i.object.visible);
    return hit?.object;
  }

  private setHoveredFacility(facility?: FacilityHotspot) {
    if (facility === this.hoveredFacility) {
      return;
    }
    if (this.hoveredFacility && this.hoveredFacility !== this.selectedFacility) {
      this.applyFacilityOverlayState(this.hoveredFacility, 'idle');
    }
    this.hoveredFacility = facility;
    if (this.hoveredFacility && this.hoveredFacility !== this.selectedFacility) {
      this.applyFacilityOverlayState(this.hoveredFacility, 'hover');
    }
    const canvas = this.canvasRef?.nativeElement;
    if (canvas) {
      canvas.style.cursor = facility ? 'pointer' : 'grab';
    }
  }

  private setSelectedFacility(facility?: FacilityHotspot, animate = true) {
    if (this.selectedFacility === facility) {
      if (facility && animate) {
        this.startCameraFocusTransition(facility.focusPoint);
      }
      if (facility) {
        this.refreshFacilityInfo(facility);
      }
      return;
    }
    if (this.selectedFacility) {
      this.applyFacilityOverlayState(this.selectedFacility, 'idle');
    }
    this.selectedFacility = facility;
    if (this.selectedFacility) {
      this.applyFacilityOverlayState(this.selectedFacility, 'active');
      this.updateFacilitySelectionOutline(this.selectedFacility.highlightObject);
      if (animate) {
        this.startCameraFocusTransition(this.selectedFacility.focusPoint);
      }
    } else {
      this.updateFacilitySelectionOutline(undefined);
    }
    if (this.hoveredFacility && this.hoveredFacility !== this.selectedFacility) {
      this.applyFacilityOverlayState(this.hoveredFacility, 'hover');
    }
    if (this.infoOverlayVisible && this.selectedFacility) {
      this.refreshFacilityInfo(this.selectedFacility);
    }
  }

  private applyFacilityOverlayState(facility: FacilityHotspot, state: 'idle' | 'hover' | 'active') {
    if (!facility.overlayMaterial) {
      return;
    }
    const meta = facility.overlayMaterial.userData as FacilityOverlayMetadata | undefined;
    const base = meta?.baseOpacity ?? 0.08;
    const hover = meta?.hoverOpacity ?? 0.2;
    const active = meta?.activeOpacity ?? 0.32;
    const next =
      state === 'active' ? active : state === 'hover' ? hover : base;
    facility.overlayMaterial.opacity = next;
  }

  private refreshFacilityInfo(facility?: FacilityHotspot) {
    const requestId = ++this.facilityInfoRequestId;
    if (!facility) {
      this.facilityInfoCard = undefined;
      this.cdr.detectChanges();
      return;
    }
    const immediateCard = this.createBaseInfoCard(facility);
    this.facilityInfoCard = immediateCard;
    this.cdr.detectChanges();
    this.buildFacilityInfoCard(facility)
      .then((card) => {
        if (this.facilityInfoRequestId !== requestId) {
          return;
        }
        this.facilityInfoCard = card;
        this.cdr.detectChanges();
      })
      .catch((error) => {
        console.warn('[FinalScene] Falha ao obter dados de instalação', error);
        if (this.facilityInfoRequestId !== requestId) {
          return;
        }
        this.facilityInfoCard = {
          title: facility.name,
          type: facility.type,
          description: 'Sem dados atualizados para esta instalação.',
          generalStats: [{ label: 'Estado', value: 'Não foi possível sincronizar com o backend.' }],
          updatedAt: new Date(),
          warning: 'Volte a tentar mais tarde para atualizar a informação.',
          restrictedNote: !this.canViewRestrictedInfo
            ? 'Informação operacional restrita a Autoridades Portuárias e Operadores Logísticos.'
            : undefined,
        };
        this.cdr.detectChanges();
      });
  }

  private createBaseInfoCard(facility: FacilityHotspot): FacilityInfoCard {
    const center = this.getObjectCenter(facility.highlightObject);
    return {
      title: facility.name,
      type: facility.type,
      description: 'A obter dados atualizados...',
      generalStats: [
        {
          label: 'Coordenadas',
          value: `${this.formatNumber(center.x)} / ${this.formatNumber(center.y)} / ${this.formatNumber(center.z)}`,
        },
      ],
      updatedAt: new Date(),
    };
  }

  private buildFacilityInfoCard(facility: FacilityHotspot): Promise<FacilityInfoCard> {
    switch (facility.type) {
      case 'dock':
        return this.buildDockInfoCard(facility);
      case 'yard':
        return this.buildYardInfoCard(facility);
      case 'warehouse':
        return this.buildWarehouseInfoCard(facility);
      case 'generic':
        return this.buildGenericInfoCard(facility);
      default:
        return this.buildGenericInfoCard(facility);
    }
  }

  private async buildDockInfoCard(facility: FacilityHotspot): Promise<FacilityInfoCard> {
    const layoutDock = facility.layoutDock;
    let dockDetails: DockDTO | null = null;
    if (layoutDock?.dockId) {
      try {
        dockDetails = await this.docksService.getById(layoutDock.dockId);
      } catch (err) {
        console.warn('[FinalScene] Falha ao carregar detalhes do cais', err);
      }
    }
    const generalStats: InfoStat[] = [];
    if (dockDetails) {
      generalStats.push({ label: 'Comprimento útil', value: `${this.formatNumber(dockDetails.length)} m` });
      generalStats.push({ label: 'Largura', value: `${this.formatNumber(dockDetails.depth)} m` });
      generalStats.push({ label: 'Calado máx.', value: `${this.formatNumber(dockDetails.maxDraft)} m` });
      if (dockDetails.location) {
        generalStats.push({ label: 'Localização', value: dockDetails.location });
      }
    } else if (layoutDock) {
      generalStats.push({ label: 'Extensão', value: `${this.formatNumber(layoutDock.size.length)} m` });
      generalStats.push({ label: 'Faixa operacional', value: `${this.formatNumber(layoutDock.size.width)} m` });
    } else {
      generalStats.push({ label: 'Configuração', value: 'Terminal demonstrativo' });
    }
    const assignment = this.findDockAssignment(layoutDock?.dockId);
    const restrictedStats: InfoStat[] = [];
    if (this.canViewRestrictedInfo && assignment) {
      restrictedStats.push({
        label: 'Navio',
        value: assignment.vesselName ?? assignment.vesselId,
      });
      if (assignment.status) {
        restrictedStats.push({ label: 'Estado', value: assignment.status });
      }
      restrictedStats.push({ label: 'ETA', value: this.formatDate(assignment.arrivalDate) });
      if (assignment.departureDate) {
        restrictedStats.push({ label: 'ETD', value: this.formatDate(assignment.departureDate) });
      }
      restrictedStats.push({
        label: 'Sequência',
        value: `#${(assignment.sequenceOnDock ?? 0) + 1}`,
      });
    }
    return {
      title: dockDetails?.name ?? layoutDock?.name ?? facility.name,
      type: 'dock',
      description:
        dockDetails?.location ??
        (layoutDock ? `Terminal operativo com ${this.formatNumber(layoutDock.size.length)} m` : 'Terminal operativo'),
      generalStats,
      restrictedStats: restrictedStats.length ? restrictedStats : undefined,
      operations: this.canViewRestrictedInfo && assignment ? this.describeDockOperations(assignment) : undefined,
      updatedAt: new Date(),
      restrictedNote: !this.canViewRestrictedInfo
        ? 'Dados operacionais visíveis apenas para Autoridades Portuárias e Operadores Logísticos.'
        : undefined,
    };
  }

  private async buildYardInfoCard(facility: FacilityHotspot): Promise<FacilityInfoCard> {
    const area = facility.layoutArea;
    const storage = area?.storageAreaId ? await this.tryGetStorageArea(area.storageAreaId) : null;
    const generalStats: InfoStat[] = [];
    if (area) {
      generalStats.push({ label: 'Designação', value: area.name ?? 'Zona de armazenamento' });
      generalStats.push({ label: 'Dimensão', value: `${this.formatNumber(area.width)} x ${this.formatNumber(area.depth)} m` });
    }
    if (storage?.location) {
      generalStats.push({ label: 'Localização', value: storage.location });
    }
    if (storage?.type) {
      generalStats.push({ label: 'Tipo', value: storage.type });
    }
    const restrictedStats: InfoStat[] = [];
    if (this.canViewRestrictedInfo && storage) {
      restrictedStats.push({
        label: 'Capacidade utilizada',
        value: `${this.formatNumber(storage.currentOccupancyTEU)} / ${this.formatNumber(storage.maxCapacityTEU)} TEU (${this.formatPercentage(storage.currentOccupancyTEU, storage.maxCapacityTEU)})`,
      });
      if (storage.servedDockIds?.length) {
        restrictedStats.push({
          label: 'Docas servidas',
          value: storage.servedDockIds.map((id) => `#${id}`).join(', '),
        });
      }
    }
    return {
      title: facility.name,
      type: 'yard',
      description:
        storage?.location ??
        (area ? `Área de contentores com ${this.formatNumber(area.width)}x${this.formatNumber(area.depth)} m` : 'Zona logística'),
      generalStats,
      restrictedStats: restrictedStats.length ? restrictedStats : undefined,
      operations: this.canViewRestrictedInfo && storage ? this.describeYardOperations(storage) : undefined,
      updatedAt: new Date(),
      restrictedNote: !this.canViewRestrictedInfo
        ? 'Dados de capacidade apenas para Autoridades Portuárias e Operadores Logísticos.'
        : undefined,
    };
  }

  private async buildWarehouseInfoCard(facility: FacilityHotspot): Promise<FacilityInfoCard> {
    const warehouse = facility.layoutWarehouse;
    const storage = warehouse?.storageAreaId ? await this.tryGetStorageArea(warehouse.storageAreaId) : null;
    const generalStats: InfoStat[] = [];
    if (warehouse) {
      generalStats.push({
        label: 'Dimensão',
        value: `${this.formatNumber(warehouse.size.width)} x ${this.formatNumber(warehouse.size.depth)} x ${this.formatNumber(
          warehouse.size.height
        )} m`,
      });
      generalStats.push({
        label: 'Posição',
        value: `(${this.formatNumber(warehouse.position.x)}, ${this.formatNumber(warehouse.position.z)})`,
      });
    }
    if (storage?.location) {
      generalStats.push({ label: 'Localização', value: storage.location });
    }
    const restrictedStats: InfoStat[] = [];
    if (this.canViewRestrictedInfo && storage) {
      restrictedStats.push({
        label: 'Capacidade (TEU)',
        value: `${this.formatNumber(storage.currentOccupancyTEU)} / ${this.formatNumber(storage.maxCapacityTEU)}`,
      });
      if (storage.type) {
        restrictedStats.push({ label: 'Tipologia', value: storage.type });
      }
    }
    return {
      title: facility.name,
      type: 'warehouse',
      description:
        storage?.location ??
        (warehouse ? `Armazém modular com pé-direito de ${this.formatNumber(warehouse.size.height)} m` : 'Armazém logístico'),
      generalStats,
      restrictedStats: restrictedStats.length ? restrictedStats : undefined,
      operations: this.canViewRestrictedInfo && storage ? this.describeWarehouseOperations(storage) : undefined,
      updatedAt: new Date(),
      restrictedNote: !this.canViewRestrictedInfo
        ? 'Dados de operação interna apenas para Autoridades Portuárias e Operadores Logísticos.'
        : undefined,
    };
  }

  private async buildGenericInfoCard(facility: FacilityHotspot): Promise<FacilityInfoCard> {
    const center = this.getObjectCenter(facility.highlightObject);
    const generalStats: InfoStat[] = [
      { label: 'Coordenadas', value: `${this.formatNumber(center.x)} / ${this.formatNumber(center.y)} / ${this.formatNumber(center.z)}` },
    ];
    const sizeBox = new THREE.Box3().setFromObject(facility.highlightObject);
    if (!sizeBox.isEmpty()) {
      const size = sizeBox.getSize(new THREE.Vector3());
      generalStats.push({
        label: 'Dimensão aprox.',
        value: `${this.formatNumber(size.x)} x ${this.formatNumber(size.y)} x ${this.formatNumber(size.z)} m`,
      });
    }
    return {
      title: facility.name,
      type: 'generic',
      description: 'Elemento visual do cenário. Sem dados adicionais disponíveis.',
      generalStats,
      updatedAt: new Date(),
    };
  }

  private async tryGetStorageArea(id: number): Promise<StorageAreaDTO | null> {
    try {
      return await this.storageAreasService.getById(id);
    } catch (err) {
      console.warn('[FinalScene] Falha ao obter StorageArea', id, err);
      return null;
    }
  }

  private findDockAssignment(dockId?: number): DockedVesselPlacement | undefined {
    if (!dockId || !this.layoutData?.activeVessels?.length) {
      return undefined;
    }
    const matches = this.layoutData.activeVessels.filter((v) => v.dockId === dockId);
    if (!matches.length) {
      return undefined;
    }
    return matches.sort((a, b) => (a.sequenceOnDock ?? 0) - (b.sequenceOnDock ?? 0))[0];
  }

  private describeDockOperations(assignment: DockedVesselPlacement): string[] {
    const operations: string[] = [];
    const vessel = assignment.vesselName ?? assignment.vesselId;
    operations.push(`Operação com ${vessel}`);
    if (assignment.status) {
      operations.push(`Estado reportado: ${assignment.status}`);
    }
    if (assignment.departureDate) {
      operations.push(`Preparar ETD ${this.formatDate(assignment.departureDate)}`);
    }
    return operations;
  }

  private describeYardOperations(area: StorageAreaDTO): string[] {
    const operations: string[] = [];
    const ratio = area.maxCapacityTEU > 0 ? area.currentOccupancyTEU / area.maxCapacityTEU : 0;
    if (ratio >= 0.9) {
      operations.push('Prioridade máxima à expedição e rotação de contentores.');
    } else if (ratio >= 0.6) {
      operations.push('Balancear receção e expedição para manter o nível saudável.');
    } else {
      operations.push('Capacidade disponível para novas receções.');
    }
    if (area.servedDockIds?.length) {
      operations.push(`Coordenar fluxos com docas ${area.servedDockIds.map((id) => `#${id}`).join(', ')}.`);
    }
    return operations;
  }

  private describeWarehouseOperations(area: StorageAreaDTO): string[] {
    const operations: string[] = this.describeYardOperations(area);
    operations.push('Monitorizar climatização e inventário interno.');
    return operations;
  }

  private formatNumber(value: number | undefined, fractionDigits = 0): string {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return '—';
    }
    return value.toLocaleString('pt-PT', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  }

  private formatPercentage(value: number, total: number): string {
    if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) {
      return '0%';
    }
    return `${((value / total) * 100).toFixed(0)}%`;
  }

  private formatDate(value?: string | null): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private updateRestrictedAccessFlag() {
    this.canViewRestrictedInfo = this.auth.hasAny(['authority', 'operator']);
  }

  private deriveObjectLabel(object: THREE.Object3D): string {
    const tryName = (node?: THREE.Object3D | null) =>
      node?.name && node.name.trim() ? node.name.trim() : undefined;
    return (
      tryName(object) ||
      tryName(object.parent) ||
      (object.type ? `Elemento ${object.type}` : 'Elemento 3D')
    );
  }

  private updateFacilitySelectionOutline(target?: THREE.Object3D) {
    if (!target) {
      if (this.facilitySelectionOutline) {
        this.facilitySelectionOutline.visible = false;
      }
      return;
    }
    if (!this.facilitySelectionOutline) {
      this.facilitySelectionOutline = new THREE.BoxHelper(target, 0x7df4c0);
      this.scene.add(this.facilitySelectionOutline);
    } else {
      this.facilitySelectionOutline.setFromObject(target);
      this.facilitySelectionOutline.visible = true;
    }
  }

  private startCameraFocusTransition(focus: THREE.Vector3) {
    if (!this.camera || !this.controls) {
      return;
    }
    const startTarget = this.controls.target.clone();
    const startPos = this.camera.position.clone();
    const horizontalOffset = new THREE.Vector3(
      startPos.x - startTarget.x,
      0,
      startPos.z - startTarget.z
    );
    if (horizontalOffset.lengthSq() < 25) {
      horizontalOffset.set(0, 0, 400);
    }
    const verticalDelta = startPos.y - startTarget.y;
    const endTarget = focus.clone();
    const endPos = new THREE.Vector3(
      endTarget.x + horizontalOffset.x,
      endTarget.y + verticalDelta,
      endTarget.z + horizontalOffset.z
    );
    this.cameraTween = {
      startPos,
      endPos,
      startTarget,
      endTarget,
      startTime: performance.now(),
      duration: 750,
    };
  }

  private updateCameraTween() {
    if (!this.cameraTween || !this.camera || !this.controls) {
      return;
    }
    const now = performance.now();
    const elapsed = now - this.cameraTween.startTime;
    const t = Math.min(1, elapsed / this.cameraTween.duration);
    const eased = 1 - Math.pow(1 - t, 3);
    this.camera.position.lerpVectors(this.cameraTween.startPos, this.cameraTween.endPos, eased);
    this.controls.target.lerpVectors(this.cameraTween.startTarget, this.cameraTween.endTarget, eased);
    if (t >= 1) {
      this.cameraTween = undefined;
    }
  }

  private rebuildFacilityHotspots(layout?: PortLayoutDTO) {
    const previousSelectionId = this.selectedFacility?.id;
    this.clearFacilityHotspots(false);
    const docks = layout?.docks ?? [];
    this.createDockFacilityHotspots(docks);
    const landAreas = layout?.landAreas ?? [];
    this.createYardFacilityHotspots(landAreas);
    this.registerWarehouseHotspots(layout?.warehouses ?? []);
    if (previousSelectionId) {
      const restored = this.facilityHotspots.find((f) => f.id === previousSelectionId);
      if (restored) {
        this.setSelectedFacility(restored, false);
      } else {
        this.setSelectedFacility(undefined, false);
      }
    } else {
      this.setSelectedFacility(undefined, false);
    }
  }

  private clearFacilityHotspots(resetSelection = true) {
    for (const overlay of this.facilityOverlayMeshes) {
      this.scene.remove(overlay);
      overlay.geometry.dispose();
      overlay.material.dispose();
    }
    this.facilityOverlayMeshes = [];
    this.facilityLookup.clear();
    this.facilityHitTargets = [];
    this.facilityHotspots = [];
    this.hoveredFacility = undefined;
    this.selectedFacility = undefined;
    this.updateFacilitySelectionOutline(undefined);
    if (resetSelection) {
      this.refreshFacilityInfo(undefined);
    }
    if (resetSelection) {
      const canvas = this.canvasRef?.nativeElement;
      if (canvas) {
        canvas.style.cursor = 'grab';
      }
    }
  }

  private createDockFacilityHotspots(docks: DockLayout[]) {
    const deckSpan = this.deckWidth - this.deckMarginToEdge * 2;
    const depth = Math.max(120, this.apronDepth * 0.9);
    if (!docks.length) {
      const overlay = this.createFacilityOverlay(
        deckSpan,
        depth,
        new THREE.Vector3(0, this.deckHeight + 2, this.quayEdgeZ - depth / 2),
        0x25b4ff,
        { baseOpacity: 0.08, hoverOpacity: 0.2, activeOpacity: 0.35 }
      );
      this.registerFacilityHotspot({
        id: 'dock-default',
        name: 'Terminal Principal',
        type: 'dock',
        hitObject: overlay.mesh,
        highlightObject: overlay.mesh,
        overlayMaterial: overlay.material,
      });
      return;
    }
    const span = this.dockSpanInfo ?? this.computeDockSpan(docks);
    docks.forEach((dock, index) => {
      const widthRatio = span.span > 0 ? dock.size.length / span.span : 1 / docks.length;
      const width = THREE.MathUtils.clamp(widthRatio * deckSpan, 140, deckSpan);
      const centerX = this.mapDockToDeckX(dock);
      const overlay = this.createFacilityOverlay(
        width,
        depth,
        new THREE.Vector3(centerX, this.deckHeight + 2, this.quayEdgeZ - depth / 2),
        0x25b4ff,
        { baseOpacity: 0.08, hoverOpacity: 0.2, activeOpacity: 0.35 }
      );
      this.registerFacilityHotspot({
        id: `dock-${dock.dockId ?? index}`,
        name: dock.name ?? `Cais ${dock.dockId ?? index + 1}`,
        type: 'dock',
        hitObject: overlay.mesh,
        highlightObject: overlay.mesh,
        overlayMaterial: overlay.material,
        layoutDock: dock,
      });
    });
  }

  private createYardFacilityHotspots(areas: LandAreaLayout[]) {
    const bounds = this.computeYardBounds();
    if (!bounds) {
      return;
    }
    if (areas.length) {
      areas.forEach((area, index) => {
        const overlay = this.createFacilityOverlay(
          Math.max(40, area.width),
          Math.max(40, area.depth),
          new THREE.Vector3(area.x, bounds.center.y, area.z),
          0xffb703,
          { baseOpacity: 0.06, hoverOpacity: 0.18, activeOpacity: 0.3 }
        );
        this.registerFacilityHotspot({
          id: `yard-${area.storageAreaId ?? index}`,
          name: area.name ?? `Zona ${index + 1}`,
          type: 'yard',
          hitObject: overlay.mesh,
          highlightObject: overlay.mesh,
          overlayMaterial: overlay.material,
          layoutArea: area,
        });
      });
      return;
    }

    const slots = 3;
    const gap = 18;
    const totalDepth = bounds.depth - gap * (slots - 1);
    const slotDepth = Math.max(80, totalDepth / slots);
    const startZ = bounds.center.z - (slotDepth * slots + gap * (slots - 1)) / 2 + slotDepth / 2;
    for (let index = 0; index < slots; index++) {
      const center = new THREE.Vector3(bounds.center.x, bounds.center.y, startZ + index * (slotDepth + gap));
      const overlay = this.createFacilityOverlay(bounds.width, slotDepth, center, 0xffb703, {
        baseOpacity: 0.06,
        hoverOpacity: 0.18,
        activeOpacity: 0.3,
      });
      this.registerFacilityHotspot({
        id: `yard-${index}`,
        name: `Zona de Contentores ${index + 1}`,
        type: 'yard',
        hitObject: overlay.mesh,
        highlightObject: overlay.mesh,
        overlayMaterial: overlay.material,
      });
    }
  }

  private registerWarehouseHotspots(warehouses: WarehouseLayout[]) {
    if (!this.warehouseInstances.length) {
      return;
    }
    this.warehouseInstances.forEach((warehouse, index) => {
      const layoutWarehouse = warehouses[index];
      const label = layoutWarehouse?.name ?? `Armazém ${String.fromCharCode(65 + index)}`;
      const id = layoutWarehouse?.storageAreaId
        ? `warehouse-${layoutWarehouse.storageAreaId}`
        : `warehouse-${index}`;
      this.registerFacilityHotspot({
        id,
        name: label,
        type: 'warehouse',
        hitObject: warehouse,
        highlightObject: warehouse,
        layoutWarehouse,
      });
    });
  }

  private createFacilityOverlay(
    width: number,
    depth: number,
    center: THREE.Vector3,
    color: number,
    metadata?: FacilityOverlayMetadata
  ) {
    const geometry = new THREE.PlaneGeometry(width, depth);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    }) as FacilityOverlayMaterial;
    material.userData = metadata ?? { baseOpacity: 0.08 };
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(center);
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    this.facilityOverlayMeshes.push(mesh);
    return { mesh, material };
  }

  private registerFacilityHotspot(config: {
    id: string;
    name: string;
    type: FacilityType;
    hitObject: THREE.Object3D;
    highlightObject?: THREE.Object3D;
    focusPoint?: THREE.Vector3;
    overlayMaterial?: FacilityOverlayMaterial;
    layoutDock?: DockLayout;
    layoutArea?: LandAreaLayout;
    layoutWarehouse?: WarehouseLayout;
  }) {
    const highlightObject = config.highlightObject ?? config.hitObject;
    const focusPoint = config.focusPoint ?? this.computeObjectCenter(highlightObject);
    const facility: FacilityHotspot = {
      id: config.id,
      name: config.name,
      type: config.type,
      hitObject: config.hitObject,
      highlightObject,
      focusPoint,
      overlayMaterial: config.overlayMaterial,
      layoutDock: config.layoutDock,
      layoutArea: config.layoutArea,
      layoutWarehouse: config.layoutWarehouse,
    };
    this.facilityHotspots.push(facility);
    this.facilityHitTargets.push(config.hitObject);
    config.hitObject.traverse((obj) => this.facilityLookup.set(obj, facility));
  }

  private buildGenericFacility(object: THREE.Object3D): FacilityHotspot {
    const focusPoint = this.getObjectCenter(object);
    const readableName = this.deriveObjectLabel(object);
    return {
      id: `generic-${object.uuid}`,
      name: readableName,
      type: 'generic',
      hitObject: object,
      highlightObject: object,
      focusPoint,
    };
  }

  private computeObjectCenter(object: THREE.Object3D): THREE.Vector3 {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) {
      const position = new THREE.Vector3();
      object.getWorldPosition(position);
      return position;
    }
    return box.getCenter(new THREE.Vector3());
  }

  private getObjectCenter(object: THREE.Object3D, fallback?: THREE.Vector3): THREE.Vector3 {
    const box = new THREE.Box3().setFromObject(object);
    if (!box.isEmpty()) {
      return box.getCenter(new THREE.Vector3());
    }
    if (fallback) {
      return fallback.clone();
    }
    const position = new THREE.Vector3();
    object.getWorldPosition(position);
    return position;
  }

  private computeYardBounds(): { width: number; depth: number; center: THREE.Vector3 } | undefined {
    if (!this.containerLaneX.length || !this.containerLaneZ.length) {
      return undefined;
    }
    const paddingX = this.containerUnitSize.x * 1.4;
    const paddingZ = this.containerUnitSize.z * 0.8;
    const minX = Math.min(...this.containerLaneX) - paddingX;
    const maxX = Math.max(...this.containerLaneX) + paddingX;
    const minZ = Math.min(...this.containerLaneZ) - paddingZ;
    const maxZ = Math.max(...this.containerLaneZ) + paddingZ;
    return {
      width: maxX - minX,
      depth: maxZ - minZ,
      center: new THREE.Vector3(
        (minX + maxX) / 2,
        this.deckHeight + 2,
        (minZ + maxZ) / 2
      ),
    };
  }

  private initRenderer() {
    const canvas = this.canvasRef.nativeElement;
    const bounds = canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(bounds?.width || canvas.clientWidth || window.innerWidth, 640);
    const height = Math.max(bounds?.height || 600, 480);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'mediump',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.rendererPixelRatioCap));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = this.enableShadows;

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
    canvas.style.cursor = 'grab';
  }

  private buildScene() {
    this.scene.background = new THREE.Color(0xaed4ff);
    this.scene.fog = new THREE.Fog(0xd8ecff, 1200, 3600);

    this.addLights();
    this.addWater();
    this.addPlatform();
    this.addWarehouses();
    this.addLogisticsRoad();
    this.addLogisticsTrucks();
    this.addContainerRoads();
    this.addRoadConnections();
    this.addContainerFields();
    this.addCranes();
    this.addDockDetails();
  }

  private addLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8fb3cc, 0.55);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4da, 2.1);
    sun.position.set(-420, 960, 180);
    if (this.enableShadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.near = 100;
      sun.shadow.camera.far = 2500;
      sun.shadow.camera.left = -1400;
      sun.shadow.camera.right = 1400;
      sun.shadow.camera.top = 1200;
      sun.shadow.camera.bottom = -800;
    }
    this.scene.add(sun);
  }

  private addWater() {
    this.waterGeom = this.trackGeometry(new THREE.PlaneGeometry(4200, 4200, 140, 140));
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
    if (this.enableShadows) {
      water.receiveShadow = true;
    }
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

    const apron = new THREE.Mesh(
      this.trackGeometry(new THREE.PlaneGeometry(this.deckWidth, this.apronDepth)),
      this.trackMaterial(
        new THREE.MeshStandardMaterial({
          map: apronTexture,
          color: 0xffffff,
          roughness: 0.75,
          metalness: 0.08,
        })
      )
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(0, this.deckHeight + 1, this.quayEdgeZ - this.apronDepth / 2);
    apron.receiveShadow = true;
    this.scene.add(apron);

  }

  private addDockDetails() {
    const bollardGeo = this.trackGeometry(new THREE.CylinderGeometry(4, 4, 8, 16));
    const bollardMat = this.trackMaterial(new THREE.MeshStandardMaterial({ color: 0xfaf3c0, roughness: 0.3 }));
    for (let i = -6; i <= 6; i++) {
      const bollard = new THREE.Mesh(bollardGeo, bollardMat);
      bollard.position.set(i * 110, 70, 360);
      bollard.castShadow = true;
      this.scene.add(bollard);
    }

  }

  private addLogisticsRoad() {
    const baseRoadWidth = this.deckWidth - this.logisticsRoadWidthOffset;
    const containerTrim = Math.min(this.logisticsRoadContainerWidthTrim, baseRoadWidth - 100);
    const roadWidth = baseRoadWidth - containerTrim;
    const roadCenterX = -containerTrim / 2;
    let centerZ = this.logisticsRoadCenterZ;
    let depth = this.logisticsRoadDepth;
    const elevation = this.deckHeight + 1.5;

    const halfDepth = depth / 2;
    const spacingZ = this.containerUnitSize.z + 4;
    const halfRowSpan = Math.max(0, ((this.containerRows - 1) * spacingZ) / 2);
    const containerFrontExtent = halfRowSpan + this.containerUnitSize.z / 2 + this.logisticsRoadFrontClearance;
    const containerMinZ = Math.min(...this.containerLaneZ) - containerFrontExtent;
    const farEdge = centerZ + halfDepth;
    if (farEdge > containerMinZ) {
      const overlap = farEdge - containerMinZ;
      depth = Math.max(30, depth - overlap);
      centerZ -= overlap / 2;
    }
    this.currentLogisticsRoadCenterZ = centerZ;

    const roadTexture = this.getLogisticsRoadTexture();
    roadTexture.repeat.set(Math.max(roadWidth / 260, 1), Math.max(depth / 160, 1));
    const roadMaterial = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        map: roadTexture,
        color: 0xffffff,
        roughness: 0.85,
        metalness: 0.08,
      })
    );
    const road = new THREE.Mesh(this.trackGeometry(new THREE.PlaneGeometry(roadWidth, depth)), roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(roadCenterX, elevation, centerZ);
    road.receiveShadow = true;
    this.scene.add(road);
    this.currentLogisticsRoadCenterX = roadCenterX;
    this.currentLogisticsRoadWidth = roadWidth;
    this.currentLogisticsRoadDepth = depth;
  }

  private addContainerRoads() {
    const laneZ = this.containerLaneZ;
    const laneX = this.containerLaneX;
    if (laneZ.length < 2 || laneX.length < 2) {
      return;
    }
    const baseY = this.deckHeight + 1.2;
    const xSpan = laneX[laneX.length - 1] - laneX[0] + 260;
    const zSpan = laneZ[laneZ.length - 1] - laneZ[0] + 260;
    const verticalWidth = 40;
    const zCenter = laneZ[0] + (laneZ[laneZ.length - 1] - laneZ[0]) / 2;
    const baseTexture = this.getContainerRoadTexture();

    for (let i = 0; i < laneX.length - 1; i++) {
      const midX = (laneX[i] + laneX[i + 1]) / 2;
      const verticalTexture = baseTexture.clone();
      this.trackTexture(verticalTexture);
      verticalTexture.wrapS = THREE.ClampToEdgeWrapping;
      verticalTexture.wrapT = THREE.ClampToEdgeWrapping;
      verticalTexture.repeat.set(1, 1);
      verticalTexture.center.set(0.5, 0.5);
      verticalTexture.rotation = Math.PI / 2;
      const strip = new THREE.Mesh(
        this.trackGeometry(new THREE.PlaneGeometry(verticalWidth, zSpan)),
        this.trackMaterial(
          new THREE.MeshStandardMaterial({
            map: verticalTexture,
            color: 0xffffff,
            roughness: 0.85,
            metalness: 0.08,
          })
        )
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(midX, baseY + 0.05, zCenter);
      strip.receiveShadow = true;
        this.scene.add(strip);
    }
  }

  private addRoadConnections() {
    const laneX = this.containerLaneX;
    if (laneX.length < 2) {
      return;
    }
    const baseTexture = this.getContainerRoadTexture();
    const startZ = this.currentLogisticsRoadCenterZ + this.currentLogisticsRoadDepth / 2 - 1;
    const targetZ = Math.min(...this.containerLaneZ) - this.containerUnitSize.z / 2 - 2;
    const depth = targetZ - startZ;
    if (depth <= 4) {
      return;
    }
    const connectors: number[] = [];
    for (let i = 0; i < laneX.length - 1; i++) {
      connectors.push((laneX[i] + laneX[i + 1]) / 2);
    }
    connectors.forEach((x) => {
      const width = 45;
      const texture = baseTexture.clone();
      this.trackTexture(texture);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.repeat.set(1, 1);
      texture.center.set(0.5, 0.5);
      texture.rotation = Math.PI / 2;
      const connector = new THREE.Mesh(
        this.trackGeometry(new THREE.PlaneGeometry(width, depth)),
        this.trackMaterial(
          new THREE.MeshStandardMaterial({
            map: texture,
            color: 0xffffff,
            roughness: 0.85,
            metalness: 0.08,
          })
        )
      );
      connector.rotation.x = -Math.PI / 2;
      connector.position.set(x, this.deckHeight + 1.3, startZ + depth / 2);
      connector.receiveShadow = true;
      this.scene.add(connector);
    });
  }

  private addLogisticsTrucks() {
    const roadZ = this.currentLogisticsRoadCenterZ;
    const laneOffset = 48;
    const elevation = this.deckHeight + 1.5;

    this.getTruckPrototype()
      .then((prototype) => {
        const centerX = this.currentLogisticsRoadCenterX;
        const halfWidth = Math.max(20, this.currentLogisticsRoadWidth / 2);
        const laneSpacing = Math.min(Math.max(halfWidth - 30, 40), 220);
        const trucks = [
          {
            position: new THREE.Vector3(
              centerX,
              elevation,
              roadZ + this.currentLogisticsRoadDepth / 2 - 40
            ),
            rotation: Math.PI / 2,
          },
          {
            position: new THREE.Vector3(centerX - laneSpacing * 0.8, elevation, roadZ - laneOffset * 0.7),
            rotation: -Math.PI / 2 - 0.05,
          },
        ];
        trucks.forEach((config) => {
          const truck = this.instantiateTruck(prototype);
          truck.position.copy(config.position);
          truck.rotation.y = config.rotation;
          this.scene.add(truck);
        });
      })
      .catch((error) => console.warn('[FinalScene] Falha ao carregar Truck_DAF GLB', error));
  }

  private addWarehouses() {
    const placements: { position: THREE.Vector3; size: THREE.Vector3; rotation?: number }[] = [
      { position: new THREE.Vector3(-460, 60, -820), size: new THREE.Vector3(320, 150, 240), rotation: 0 },
      { position: new THREE.Vector3(60, 60, -820), size: new THREE.Vector3(320, 150, 240), rotation: 0 },
      { position: new THREE.Vector3(580, 60, -820), size: new THREE.Vector3(320, 150, 240), rotation: 0 },
    ];

    this.getWarehousePrototype()
      .then((prototype) => {
        placements.forEach((placement) => {
          const warehouse = this.instantiateWarehouse(prototype, placement);
          this.scene.add(warehouse);
          this.warehouseInstances.push(warehouse);
        });
        this.rebuildFacilityHotspots(this.layoutData);
      })
      .catch((error) => console.warn('[FinalScene] Falha ao carregar warehouse GLB', error));
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
    placement: { position: THREE.Vector3; size: THREE.Vector3; rotation?: number }
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
    root.scale.setScalar(scale);
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
      this.waterNormalCounter++;
      if (this.waterNormalCounter >= this.waterNormalFrameSkip) {
        this.waterGeom.computeVertexNormals();
        this.waterNormalCounter = 0;
      }
    }

    this.updateCameraKeyboardMovement(delta);
    this.updateCameraTween();
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

  private getLogisticsRoadTexture(): THREE.Texture {
    if (this.logisticsRoadTexture) {
      return this.logisticsRoadTexture;
    }
    const texture = this.textureLoader.load(this.logisticsRoadTextureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    const maxAnisotropy = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : texture.anisotropy;
    texture.anisotropy = maxAnisotropy;
    this.logisticsRoadTexture = this.trackTexture(texture);
    return this.logisticsRoadTexture;
  }

  private getContainerRoadTexture(): THREE.Texture {
    if (this.containerRoadTexture) {
      return this.containerRoadTexture;
    }
    const texture = this.textureLoader.load(this.containerRoadTextureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    const maxAnisotropy = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : texture.anisotropy;
    texture.anisotropy = maxAnisotropy;
    this.containerRoadTexture = this.trackTexture(texture);
    return this.containerRoadTexture;
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

  private addContainerFields() {
    const laneZ = this.containerLaneZ;
    const laneX = this.containerLaneX;
    const laneHeights = this.containerLaneHeights;
    const placements: { transforms: THREE.Matrix4[]; color: number }[] = [];
    const perColor = new Map<number, THREE.Matrix4[]>();

    laneZ.forEach((z, idxZ) => {
      laneX.forEach((x, idxX) => {
        const cols = this.containerCols;
        const rows = this.containerRows;
        const baseMax = laneHeights[idxZ % laneHeights.length];
        let maxLevels = Math.max(2, baseMax - Math.max(0, idxX - 1));
        if (idxZ === 0) {
          maxLevels = Math.max(1, baseMax - idxX - (idxX === 2 ? 2 : idxX));
        }
        const rotation = placementRotation(idxX, idxZ);
        this.buildContainerTransforms(cols, rows, maxLevels, idxZ * 19 + idxX * 7).forEach((transform, idx) => {
          const color = this.pickContainerColor(idxX + idx, idxZ, maxLevels);
          if (!perColor.has(color)) perColor.set(color, []);
          const matrix = new THREE.Matrix4()
            .makeRotationFromEuler(new THREE.Euler(0, rotation, 0))
            .premultiply(transform);
          const pos = new THREE.Vector3().setFromMatrixPosition(transform);
          matrix.setPosition(pos.add(new THREE.Vector3(x, 60, z)));
          perColor.get(color)!.push(matrix);
        });
      });
    });

    this.buildInstancedContainers(perColor);

    function placementRotation(ix: number, iz: number): number {
      return (ix % 2 === 0 ? 1 : -1) * 0.05 + (iz % 2 === 0 ? 0.02 : -0.08);
    }
  }

  private addCranes() {
    const offsets = [-360, 360];
    const craneZ = 250;
    offsets.forEach((x) => {
      const crane = createPortalLatticeCraneModel({
        height: 90,
        seawardBoomLength: 150,
        landsideBoomLength: 80,
        gauge: 74,
        clearance: 70,
      });
      crane.position.set(x, 60, craneZ);
      crane.scale.setScalar(1.4);
      crane.rotation.y = Math.PI;
      this.scene.add(crane);
    });
    if (this.enablePlaceholderCargoVessels) {
      this.placeCargoVessels(offsets);
    }
  }

  private loadPortAssignments() {
    firstValueFrom(this.layoutApi.getLayout())
      .then((layout) => this.zone.runOutsideAngular(() => this.applyLayoutAssignments(layout)))
      .catch((err) => console.warn('[FinalScene] Falha ao carregar layout dinâmico', err));
  }

  private applyLayoutAssignments(layout: PortLayoutDTO) {
    this.layoutData = layout;
    const docks = layout.docks ?? [];
    this.dockSpanInfo = this.computeDockSpan(docks);
    this.computeDockDeckOverrides(docks);
    this.updateDockLabels(docks);
    this.rebuildFacilityHotspots(layout);
    this.clearDynamicVessels();

    const vesselsToRender = (layout.activeVessels ?? [])
      .map((info) => this.buildVesselRenderInfo(info))
      .filter((entry): entry is VesselRenderInfo => !!entry);
    if (!vesselsToRender.length || !docks.length) {
      return;
    }

    const dockMap = new Map<number, DockLayout>(docks.map((d) => [d.dockId, d]));
    this.placeAssignedCargoVesselsFromLayout(vesselsToRender, dockMap);
  }

  private clearDynamicVessels() {
    for (const obj of this.dynamicVesselGroups) {
      this.scene.remove(obj);
    }
    this.dynamicVesselGroups = [];
    for (const sprite of this.vesselLabelSprites) {
      this.scene.remove(sprite);
    }
    this.vesselLabelSprites = [];
  }

  private clearDockLabels() {
    for (const sprite of this.dockNameSprites) {
      this.scene.remove(sprite);
    }
    this.dockNameSprites = [];
  }

  private updateDockLabels(docks: DockLayout[]) {
    this.clearDockLabels();
    if (!docks.length) return;
    docks.forEach((dock) => {
      const label = this.createLabelSprite(dock.name || `Dock ${dock.dockId}`, {
        background: 'rgba(255,255,255,0.9)',
        color: '#0d1b2a',
        scale: 140,
      });
      const x = this.mapDockToDeckX(dock);
      label.position.set(x, this.deckHeight + 120, this.quayEdgeZ - 130);
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
    assignments: VesselRenderInfo[],
    dockMap: Map<number, DockLayout>
  ) {
    const ordered = [...assignments].sort((a, b) => {
      if (a.data.dockId === b.data.dockId) {
        return (a.data.sequenceOnDock ?? 0) - (b.data.sequenceOnDock ?? 0);
      }
      return a.data.dockId - b.data.dockId;
    });

    this.getCargoVesselPrototype()
      .then((prototype) => {
        const berthZBase = this.quayEdgeZ + this.cargoVesselHalfBeam + this.cargoVesselClearance;
        const laneSpacing = this.cargoVesselHalfBeam * 2 + this.cargoVesselClearance + 18;
        ordered.forEach((info) => {
          const dock = dockMap.get(info.data.dockId);
          if (!dock) return;
          const baseX = this.mapDockToDeckX(dock);
          const seq = typeof info.data.sequenceOnDock === 'number' ? info.data.sequenceOnDock : 0;
          const laneIndex = Math.max(0, Math.min(this.maxBerthLanes - 1, seq));
          const waitingOffset = info.waiting ? this.vesselWaitingExtraOffset : 0;
          const z = berthZBase + laneIndex * laneSpacing + waitingOffset;
          const vessel = this.instantiateCargoVessel(prototype);
          vessel.position.set(baseX, this.waterLevelY + this.cargoVesselFreeboard, z);
          vessel.rotation.y = Math.PI / 2;
          this.scene.add(vessel);
          this.dynamicVesselGroups.push(vessel);
          this.addVesselLabel(info.data, dock, baseX, z, info.waiting);
        });
      })
      .catch((err) => console.warn('[FinalScene] Falha ao preparar navios aprovados', err));
  }

  private addVesselLabel(info: DockedVesselPlacement, dock: DockLayout, x: number, z: number, waiting = false) {
    const statusPrefix = waiting ? 'Aguardando · ' : '';
    const label = this.createLabelSprite(`${statusPrefix}${info.vesselName ?? info.vesselId} — ${dock.name ?? `Dock ${dock.dockId}`}`, {
      background: 'rgba(9,25,53,0.92)',
      color: '#f4f7fb',
      scale: 160,
    });
    label.position.set(x, this.waterLevelY + this.cargoVesselFreeboard + 90, z - this.cargoVesselHalfBeam * 0.4);
    this.scene.add(label);
    this.vesselLabelSprites.push(label);
  }

  private createLabelSprite(
    text: string,
    opts?: { background?: string; color?: string; scale?: number }
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.paintRoundedRect(
      ctx,
      30,
      canvas.height / 2 - 70,
      canvas.width - 60,
      140,
      36,
      opts?.background ?? 'rgba(255,255,255,0.95)'
    );
    ctx.fillStyle = opts?.color ?? '#0f1f32';
    ctx.font = 'bold 64px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
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
    sprite.scale.set(scale, Math.max(40, scale * 0.35), 1);
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

  private buildContainerStack(
    prototype: THREE.Group,
    columns: number,
    rows: number,
    maxLevels: number,
    seed: number
  ): THREE.Group {
    const group = new THREE.Group();
    const spacingX = this.containerUnitSize.x + 3;
    const spacingZ = this.containerUnitSize.z + 4;
    const spacingY = this.containerUnitSize.y + 1.5;
    const offsetX = ((columns - 1) * spacingX) / 2;
    const offsetZ = ((rows - 1) * spacingZ) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const maxAllowed = Math.max(1, maxLevels);
        const stackHeight = Math.max(2, 1 + ((row + col * 2 + seed) % maxAllowed));
        for (let level = 0; level < stackHeight; level++) {
          const color = this.containerColors[(row + col + level + seed) % this.containerColors.length];
          const container = this.cloneContainerPrototype(prototype, color);
          container.position.set(
            col * spacingX - offsetX,
            level * spacingY,
            row * spacingZ - offsetZ
          );
          group.add(container);
        }
      }
    }

    return group;
  }

  private buildVesselRenderInfo(info: DockedVesselPlacement): VesselRenderInfo | undefined {
    if (!info || typeof info.dockId !== 'number') {
      return undefined;
    }
    const now = Date.now();
    const arrival = info.arrivalDate ? Date.parse(info.arrivalDate) : NaN;
    const departure = info.departureDate ? Date.parse(info.departureDate) : NaN;
    if (!Number.isNaN(departure) && now > departure) {
      return undefined;
    }
    if (!Number.isNaN(arrival)) {
      if (now < arrival - this.vesselWaitingLeadMs) {
        return undefined;
      }
      const waiting = now < arrival;
      return { data: info, waiting };
    }
    return { data: info, waiting: false };
  }

  private cloneContainerPrototype(prototype: THREE.Group, color: number): THREE.Group {
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
              const root = gltf.scene;
              this.prepareGlbContainerPrototype(root);
              this.containerStackPrototype = root;
              resolve(root);
            },
            undefined,
            (err) => {
              console.warn('[FinalScene] Falha ao carregar modelo', url, err);
              loadNext();
            }
          );
        };
        loadNext();
      });
    }

    return this.containerStackLoading;
  }

  private prepareGlbContainerPrototype(root: THREE.Group) {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if ((mesh as any).isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = this.containerTargetSpan / maxDim;
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);

    const normalizedBox = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    normalizedBox.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= normalizedBox.min.y;
    this.containerUnitSize = normalizedBox.getSize(new THREE.Vector3());
  }

  private getTruckPrototype(): Promise<THREE.Group> {
    if (this.truckPrototype) {
      return Promise.resolve(this.truckPrototype);
    }

    if (!this.truckLoading) {
      this.truckLoading = new Promise((resolve, reject) => {
        const urls = [...this.truckModelUrls];
        const loadNext = () => {
          const url = urls.shift();
          if (!url) {
            reject(new Error('Sem modelo GLB de camião disponível'));
            return;
          }
          this.gltfLoader.load(
            url,
            (gltf) => {
              try {
                const prepared = this.prepareTruckPrototype(gltf.scene);
                this.truckPrototype = prepared;
                resolve(prepared);
              } catch (e) {
                reject(e);
              }
            },
            undefined,
            (error) => {
              console.warn('[FinalScene] erro ao carregar modelo Truck', url, error);
              loadNext();
            }
          );
        };
        loadNext();
      });
    }

    return this.truckLoading;
  }

  private prepareTruckPrototype(source: THREE.Group): THREE.Group {
    source.traverse((child) => {
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

    this.mirrorTruckParts(source);
    this.applyTruckTexture(source);
    this.applyTruckWindowMaterial(source);

    const initialBox = new THREE.Box3().setFromObject(source);
    const size = initialBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = this.truckTargetSpan / maxDim;
    source.scale.setScalar(scale);
    source.updateMatrixWorld(true);

    const pivot = new THREE.Group();
    const scaledBox = new THREE.Box3().setFromObject(source);
    const center = scaledBox.getCenter(new THREE.Vector3());
    source.position.set(-center.x, -scaledBox.min.y, -center.z);
    const height = scaledBox.getSize(new THREE.Vector3()).y;
    source.position.y += Math.max(4, height * 0.02);
    pivot.add(source);
    pivot.updateMatrixWorld(true);
    return pivot;
  }

  private mirrorTruckParts(model: THREE.Group): void {
    const namesToMirror = ['Cube', 'truck_daf.003', 'truck_daf.002'];
    for (const name of namesToMirror) {
      const original = model.getObjectByName(name);
      if (!original) {
        continue;
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
    }
  }

  private instantiateTruck(prototype: THREE.Group): THREE.Group {
    const truck = prototype.clone(true);
    truck.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map((mat) => (mat as THREE.Material).clone());
        } else if (obj.material) {
          obj.material = (obj.material as THREE.Material).clone();
        }
      }
    });
    return truck;
  }

  private getTruckTrailerTexture(): THREE.Texture {
    if (this.truckTrailerTexture) {
      return this.truckTrailerTexture;
    }
    const texture = this.textureLoader.load(this.truckTrailerTextureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    const maxAnisotropy = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : null;
    if (maxAnisotropy && maxAnisotropy > 0) {
      texture.anisotropy = Math.min(8, maxAnisotropy);
    }
    this.truckTrailerTexture = texture;
    this.disposableTextures.push(texture);
    return texture;
  }

  private applyTruckTexture(model: THREE.Group): void {
    const texture = this.getTruckTrailerTexture();
    applyTruckTrailerTexture(model, texture);
  }

  private getTruckWindowTexture(): THREE.Texture {
    if (this.truckWindowTexture) {
      return this.truckWindowTexture;
    }
    const texture = this.textureLoader.load(this.truckWindowTextureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
    texture.center.set(0.5, 0.5);
    texture.rotation = Math.PI / 2;
    texture.needsUpdate = true;
    const maxAnisotropy = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : null;
    if (maxAnisotropy && maxAnisotropy > 0) {
      texture.anisotropy = Math.min(8, maxAnisotropy);
    }
    this.truckWindowTexture = texture;
    this.disposableTextures.push(texture);
    return texture;
  }

  private applyTruckWindowMaterial(model: THREE.Group): void {
    const texture = this.getTruckWindowTexture();
    applyTruckWindowTexture(model, texture);
  }
}
  private buildContainerTransforms(
    cols: number,
    rows: number,
    maxLevels: number,
    seed: number
  ): THREE.Matrix4[] {
    const transforms: THREE.Matrix4[] = [];
    const spacingX = this.containerUnitSize.x + 6;
    const spacingZ = this.containerUnitSize.z + 10;
    const spacingY = this.containerUnitSize.y + 4;
    const offsetX = ((cols - 1) * spacingX) / 2;
    const offsetZ = ((rows - 1) * spacingZ) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const stackHeight = 1 + ((row + col + seed) % Math.max(1, maxLevels));
        for (let level = 0; level < stackHeight; level++) {
          const matrix = new THREE.Matrix4();
          const position = new THREE.Vector3(
            col * spacingX - offsetX,
            level * spacingY,
            row * spacingZ - offsetZ
          );
          matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
          transforms.push(matrix);
        }
      }
    }

    return transforms;
  }
  private buildInstancedContainers(perColor: Map<number, THREE.Matrix4[]>) {
    perColor.forEach((matrices, color) => {
      if (!matrices.length) {
        return;
      }
      const geometry = new THREE.BoxGeometry(
        this.containerUnitSize.x,
        this.containerUnitSize.y,
        this.containerUnitSize.z
      );
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.25,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      matrices.forEach((matrix, idx) => mesh.setMatrixAt(idx, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      if (this.enableShadows) {
        mesh.castShadow = mesh.receiveShadow = true;
      }
      this.scene.add(mesh);
    });
  }
