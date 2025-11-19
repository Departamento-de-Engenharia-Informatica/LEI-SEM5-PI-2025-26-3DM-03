import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

@Component({
  selector: 'app-truck',
  standalone: true,
  templateUrl: './truck.component.html',
  styleUrls: ['./truck.component.scss'],
})
export class TruckComponent implements AfterViewInit, OnDestroy {
  @ViewChild('truckCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private readonly gltfLoader = new GLTFLoader();
  private readonly modelUrl = 'assets/models/Truck_DAF.glb';
  private truckRoot?: THREE.Group;

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  ngAfterViewInit(): void {
    this.initScene();
    this.addEnvironment();
    this.loadTruckModel();
    this.startAnimationLoop();
    window.addEventListener('resize', this.onWindowResize);
  }

  ngOnDestroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.controls?.dispose();
    this.renderer?.dispose();
    window.removeEventListener('resize', this.onWindowResize);
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe9eff7);
    this.scene.fog = new THREE.Fog(0xe9eff7, 200, 1600);

    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 450;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    this.camera.position.set(320, 190, 360);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    (this.renderer as any).outputColorSpace = THREE.SRGBColorSpace;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 120;
    this.controls.maxDistance = 800;
    this.controls.target.set(0, 60, 0);
    this.controls.update();
  }

  private onWindowResize = () => {
    if (!this.renderer || !this.camera) {
      return;
    }
    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 450;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private addEnvironment(): void {
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x5d646f,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const padMaterial = new THREE.MeshStandardMaterial({
      color: 0xdfe3e8,
      roughness: 0.8,
      metalness: 0.02,
    });
    const pad = new THREE.Mesh(new THREE.CircleGeometry(300, 64), padMaterial);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.1, 0);
    pad.receiveShadow = true;
    this.scene.add(pad);

    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0xf7c948,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const outline = new THREE.Mesh(new THREE.RingGeometry(220, 230, 80), outlineMaterial);
    outline.rotation.x = -Math.PI / 2;
    outline.position.y = 0.2;
    outline.renderOrder = 2;
    this.scene.add(outline);

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    const hemi = new THREE.HemisphereLight(0xfefefe, 0x4c5560, 0.6);
    hemi.position.set(0, 600, 0);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(380, 420, 280);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(4096, 4096);
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 1200;
    keyLight.shadow.camera.left = -600;
    keyLight.shadow.camera.right = 600;
    keyLight.shadow.camera.top = 600;
    keyLight.shadow.camera.bottom = -600;

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(-320, 260, -180);

    this.scene.add(ambient, hemi, keyLight, rimLight);
  }

  private loadTruckModel(): void {
    this.gltfLoader.load(
      this.modelUrl,
      (gltf) => {
        this.truckRoot = gltf.scene;
        this.prepareTruckModel(this.truckRoot);
        this.mirrorTrailerParts(this.truckRoot);
        this.scene.add(this.truckRoot);
      },
      undefined,
      (error) => {
        console.error('[TruckComponent] Falha ao carregar GLB Truck', error);
      }
    );
  }

  private prepareTruckModel(model: THREE.Group): void {
    model.traverse((child: THREE.Object3D) => {
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

  private mirrorTrailerParts(model: THREE.Group): void {
    const namesToMirror = ['Cube', 'truck_daf.003', 'truck_daf.002'];
    for (const name of namesToMirror) {
      const original = model.getObjectByName(name);
      if (!original) continue;
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

  private startAnimationLoop(): void {
    const render = () => {
      this.animationId = requestAnimationFrame(render);
      if (this.truckRoot) {
        this.truckRoot.rotation.y += 0.0015;
      }
      this.controls?.update();
      this.renderer?.render(this.scene, this.camera);
    };
    render();
  }
}
