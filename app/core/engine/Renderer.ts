import * as THREE from "three";

/**
 * ==========================================
 * Renderer
 * ==========================================
 *
 * مسئول ساخت WebGLRenderer و نمایش Scene است.
 *
 * Performance از همین لایه کنترل می‌شود:
 *
 * - Antialias
 * - Device Pixel Ratio
 * - Resize
 * - Color Management
 *
 * هدف:
 *
 * اجرای مناسب روی:
 * - PC قدرتمند
 * - Laptop
 * - Tablet
 * - Mobile
 * - Mobileهای قدیمی‌تر
 * ==========================================
 */

export class Renderer {
  public readonly instance: THREE.WebGLRenderer;

  /**
   * حداکثر Pixel Ratio
   *
   * اجازه نمی‌دهیم دستگاه‌هایی با DPR بسیار بالا
   * تعداد پیکسل‌های رندر را بیش از حد افزایش دهند.
   */
  private static readonly MAX_PIXEL_RATIO = 1.5;

  constructor() {
    // ------------------------------------------
    // ساخت Renderer
    // ------------------------------------------

    this.instance = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });

    // ------------------------------------------
    // Background
    // ------------------------------------------

    this.instance.setClearColor(0x87ceeb, 1);

    // ------------------------------------------
    // Color Management
    // ------------------------------------------

    this.instance.outputColorSpace = THREE.SRGBColorSpace;

    // ------------------------------------------
    // Pixel Ratio
    // ------------------------------------------

    this.updatePixelRatio();

    // ------------------------------------------
    // اندازه اولیه
    // ------------------------------------------

    this.resize(window.innerWidth, window.innerHeight);
  }

  /**
   * ==========================================
   * Pixel Ratio
   * ==========================================
   *
   * DPR واقعی دستگاه را می‌خوانیم،
   * ولی برای Performance سقف می‌گذاریم.
   */
  private updatePixelRatio(): void {
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      Renderer.MAX_PIXEL_RATIO,
    );

    this.instance.setPixelRatio(pixelRatio);
  }

  /**
   * ==========================================
   * Resize
   * ==========================================
   */
  public resize(width: number, height: number): void {
    this.updatePixelRatio();

    this.instance.setSize(width, height, false);
  }

  /**
   * ==========================================
   * Render
   * ==========================================
   */
  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.instance.render(scene, camera);
  }

  /**
   * ==========================================
   * Dispose
   * ==========================================
   */
  public dispose(): void {
    this.instance.dispose();
  }
}
