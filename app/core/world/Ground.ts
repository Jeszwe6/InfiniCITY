import * as THREE from "three";

/**
 * ==========================================
 * Ground
 * ==========================================
 *
 * سطح پایه شهر.
 *
 * Ground فقط یک سطح پایه است و مسئول
 * مدیریت Chunkها یا ساختمان‌ها نیست.
 *
 * مدیریت شهر و Chunkها بر عهده World و
 * ChunkManager باقی می‌ماند.
 *
 * ------------------------------------------
 * Performance
 * ------------------------------------------
 *
 * - فقط یک Plane برای کل Ground داریم.
 * - Geometry بسیار ساده است.
 * - Shadow کاملاً خاموش است.
 * - Frustum Culling فعال است.
 * - Ground به صورت جداگانه Dispose می‌شود.
 *
 * اندازه Ground با محدوده فعلی ChunkManager
 * هماهنگ شده تا هنگام حرکت دوربین، لبه
 * زمین زودتر از محدوده شهر دیده نشود.
 * ==========================================
 */

export class Ground {
  /**
   * Mesh اصلی زمین.
   */
  public readonly mesh: THREE.Mesh;

  /**
   * Geometry زمین.
   */
  private readonly geometry: THREE.PlaneGeometry;

  /**
   * Material زمین.
   */
  private readonly material: THREE.MeshStandardMaterial;

  /**
   * اندازه Ground.
   *
   * Chunk فعلی:
   * 32 × 32
   *
   * View Distance:
   * 2
   *
   * بنابراین چندین Chunk اطراف دوربین
   * می‌توانند همزمان فعال باشند.
   *
   * Ground را بزرگ‌تر از محدوده فعال
   * Chunkها نگه می‌داریم.
   */
  private static readonly SIZE = 512;

  constructor() {
    // ==========================================
    // Geometry
    // ==========================================

    /**
     * فقط یک Plane ساده ساخته می‌شود.
     *
     * تعداد subdivisionها صفر است و برای
     * سطح پایه شهر کاملاً کافی است.
     */
    this.geometry = new THREE.PlaneGeometry(Ground.SIZE, Ground.SIZE);

    // ==========================================
    // Material
    // ==========================================

    /**
     * رنگ پایه زمین.
     *
     * جزئیات واقعی شهر توسط Plot و Road
     * روی این سطح قرار می‌گیرند.
     */
    this.material = new THREE.MeshStandardMaterial({
      color: 0x88c273,
      roughness: 1,
      metalness: 0,
    });

    // ==========================================
    // Mesh
    // ==========================================

    this.mesh = new THREE.Mesh(this.geometry, this.material);

    // ==========================================
    // Rotation
    // ==========================================

    /**
     * Plane به صورت پیش‌فرض عمودی است.
     *
     * با چرخش 90 درجه روی X،
     * آن را به سطح افقی تبدیل می‌کنیم.
     */
    this.mesh.rotation.x = -Math.PI / 2;

    // ==========================================
    // Position
    // ==========================================

    /**
     * سطح Ground از مرکز World عبور می‌کند.
     *
     * بنابراین مختصات Chunkها بدون هیچ
     * تبدیل اضافی روی آن قرار می‌گیرند.
     */
    this.mesh.position.set(0, 0, 0);

    // ==========================================
    // Performance
    // ==========================================

    /**
     * Ground نباید Shadow تولید کند.
     */
    this.mesh.castShadow = false;

    /**
     * در حال حاضر Shadow سیستم ما خاموش است،
     * بنابراین دریافت Shadow نیز لازم نیست.
     */
    this.mesh.receiveShadow = false;

    /**
     * Frustum Culling برای Mesh فعال است.
     */
    this.mesh.frustumCulled = true;

    // ==========================================
    // Debug Name
    // ==========================================

    this.mesh.name = "Ground";
  }

  /**
   * ==========================================
   * Dispose
   * ==========================================
   *
   * آزاد کردن منابع GPU مربوط به Ground.
   *
   * این متد توسط World.dispose() فراخوانی می‌شود.
   */
  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
