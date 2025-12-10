import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createGroundModule } from './ground-module';

@Component({
  selector: 'app-ground-demo',
  standalone: true,
  templateUrl: './ground.component.html',
  styleUrls: ['./ground.component.scss'],
})
export class GroundComponent implements AfterViewInit, OnDestroy {
  @ViewChild('groundCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    this.initScene();
    this.animate();
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.canvasRef.nativeElement);
  }

  ngOnDestroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.controls?.dispose();
    this.renderer?.dispose();
    this.resizeObserver?.disconnect();
  }

  private initScene(): void {
    const canvas = this.canvasRef.nativeElement;
    const { clientWidth: width, clientHeight: height } = canvas;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xddeaf7);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 4000);
    this.camera.position.set(600, 260, 600);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this.addLights();
    this.addGround();
  }

  private addLights(): void {
    const hemi = new THREE.HemisphereLight(0xffffff, 0xb0c4d6, 0.6);
    this.scene.add(hemi);

    const directional = new THREE.DirectionalLight(0xfff3da, 1.4);
    directional.position.set(-500, 800, 300);
    directional.castShadow = true;
    directional.shadow.mapSize.set(2048, 2048);
    this.scene.add(directional);

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambient);
  }

  private addGround(): void {
    const module = createGroundModule({
      width: 1600,
      depth: 1000,
      height: 20,
      road: {
        width: 1400,
        depth: 260,
      },
    });
    module.position.y = -10;
    this.scene.add(module);

  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  };

  private onResize(): void {
    if (!this.renderer || !this.camera) return;
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
