import * as THREE from "three";

import { Scene } from "./Scene";
import { Camera } from "./Camera";
import { Renderer } from "./Renderer";
import { CameraController } from "./CameraController";
import { World } from "../world/World";

/**
 * Engine
 *
 * هسته اصلی موتور Three.js.
 *
 * مسئول:
 * - ساخت Scene
 * - ساخت Camera
 * - ساخت Renderer
 * - ساخت CameraController
 * - ساخت World
 * - مدیریت Animation Loop
 * - مدیریت Delta Time
 * - مدیریت Resize
 *
 * Delta Time:
 * مدت زمانی است که از فریم قبلی تا فریم فعلی گذشته است.
 *
 * این مقدار بعداً برای:
 * - انیمیشن ساختمان‌ها
 * - حرکت آبجکت‌ها
 * - Animation
 * - سیستم‌های زمان‌محور
 *
 * استفاده خواهد شد.
 */
export class Engine {
  public readonly scene: Scene;
  public readonly camera: Camera;
  public readonly renderer: Renderer;
  public readonly world: World;

  // کنترل دوربین
  private readonly cameraController: CameraController;

  // Clock مرکزی موتور
  //
  // تمام سیستم‌هایی که به زمان نیاز دارند
  // باید از Delta Time همین Clock استفاده کنند.
  private readonly clock: THREE.Clock;

  // شناسه Animation Frame
  private animationFrameId: number | null = null;

  constructor() {
    // -----------------------------
    // Clock
    // -----------------------------

    // Clock باید یک بار ساخته شود
    // و در تمام طول عمر Engine استفاده شود.
    this.clock = new THREE.Clock();

    // -----------------------------
    // Scene
    // -----------------------------

    this.scene = new Scene();

    // -----------------------------
    // World
    // -----------------------------

    this.world = new World();

    // اضافه کردن World به Scene
    this.scene.instance.add(this.world.group);

    // -----------------------------
    // Camera
    // -----------------------------

    this.camera = new Camera(window.innerWidth / window.innerHeight);

    // -----------------------------
    // Camera Controller
    // -----------------------------

    this.cameraController = new CameraController(this.camera.instance);

    // -----------------------------
    // Renderer
    // -----------------------------

    this.renderer = new Renderer();

    // گوش دادن به تغییر اندازه صفحه
    window.addEventListener("resize", this.handleResize);
  }

  /**
   * شروع Animation Loop
   */
  public start(): void {
    // اگر Loop از قبل فعال است،
    // دوباره آن را شروع نکن.
    if (this.animationFrameId !== null) {
      return;
    }

    // Clock را از ابتدا شروع می‌کنیم.
    this.clock.start();

    this.animate();
  }

  /**
   * حلقه اصلی رندر
   */
  private animate = (): void => {
    // درخواست Frame بعدی
    this.animationFrameId = requestAnimationFrame(this.animate);

    // -----------------------------
    // Delta Time
    // -----------------------------

    // مدت زمان گذشته از فریم قبلی
    // بر حسب ثانیه.
    //
    // مثال:
    // 60 FPS ≈ 0.016 ثانیه
    // 30 FPS ≈ 0.033 ثانیه
    const deltaTime = this.clock.getDelta();

    // -----------------------------
    // Camera
    // -----------------------------

    // به‌روزرسانی حرکت دوربین
    this.cameraController.update();
    // -----------------------------
    // World
    // -----------------------------

    // فاصله فعلی دوربین از Target.
    // این مقدار مستقیماً از CameraController
    // گرفته می‌شود تا تعداد Chunkهای فعال
    // با Zoom هماهنگ باشد.
    const cameraDistance = this.cameraController.getDistance();

    // به‌روزرسانی World
    //
    // cameraPosition:
    // موقعیت دوربین
    //
    // cameraDistance:
    // فاصله Zoom دوربین
    //
    // deltaTime:
    // زمان گذشته از فریم قبلی
    this.world.update(this.camera.instance.position, cameraDistance, deltaTime);
    // -----------------------------
    // Render
    // -----------------------------

    // رندر صحنه
    this.renderer.render(this.scene.instance, this.camera.instance);
  };

  /**
   * مدیریت تغییر اندازه صفحه
   */
  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // به‌روزرسانی Camera
    this.camera.resize(width / height);

    // به‌روزرسانی Renderer
    this.renderer.resize(width, height);
  };

  /**
   * متوقف کردن Animation Loop
   */
  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);

      this.animationFrameId = null;
    }

    // Clock را هم متوقف می‌کنیم.
    this.clock.stop();
  }

  /**
   * آزاد کردن منابع Engine
   */
  public dispose(): void {
    // توقف Animation Loop
    this.stop();

    // حذف Event مربوط به Resize
    window.removeEventListener("resize", this.handleResize);

    // آزاد کردن Camera Controller
    this.cameraController.dispose();

    // آزاد کردن Renderer
    this.renderer.instance.dispose();

    // آزاد کردن World
    this.world.dispose();
  }
}
