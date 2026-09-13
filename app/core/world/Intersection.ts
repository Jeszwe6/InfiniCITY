import * as THREE from "three";

/**
 * ==========================================
 * Intersection
 * ==========================================
 *
 * تقاطع چهارراه.
 *
 * طراحی:
 * - سطح مرکزی کاملاً آسفالت
 * - بدون پیاده‌رو در وسط چهارراه
 * - بدون خطوط اصلی Road در مرکز
 * - فقط Crosswalk Lines در چهار طرف
 *
 * پیاده‌رو فقط توسط Road در کناره‌های
 * خیابان ساخته می‌شود.
 *
 * ==========================================
 *
 * Performance:
 * - یک Geometry برای سطح
 * - یک Material برای سطح
 * - یک Geometry مشترک برای Crosswalk
 * - یک InstancedMesh برای تمام خطوط
 * - StaticDrawUsage
 *
 * ==========================================
 */

export class Intersection {
  public readonly group: THREE.Group;

  /**
   * اندازه چهارراه.
   *
   * Road.WIDTH = 8
   *
   * محدوده:
   * -4 تا +4
   */
  private static readonly SIZE = 8;

  /**
   * ارتفاع سطح آسفالت چهارراه.
   */
  private static readonly SURFACE_Y = 0.032;

  /**
   * ارتفاع خطوط Crosswalk.
   */
  private static readonly MARKING_Y = 0.034;

  /**
   * ==========================================
   * Crosswalk Dimensions
   * ==========================================
   */

  /**
   * طول هر نوار.
   */
  private static readonly CROSSWALK_LENGTH = 1;

  /**
   * عرض هر نوار.
   */
  private static readonly CROSSWALK_WIDTH = 0.6;

  /**
   * فاصله بین نوارها.
   */
  private static readonly CROSSWALK_GAP = 0.22;

  /**
   * فاصله Crosswalk از مرکز چهارراه.
   */
  private static readonly CROSSWALK_OFFSET = 3.5;

  /**
   * ==========================================
   * Intersection Surface
   * ==========================================
   */

  private readonly surfaceGeometry: THREE.PlaneGeometry;
  private readonly surfaceMaterial: THREE.MeshStandardMaterial;
  private readonly surface: THREE.Mesh;

  /**
   * ==========================================
   * Crosswalk
   * ==========================================
   */

  private readonly crosswalkGeometry: THREE.PlaneGeometry;
  private readonly crosswalkMaterial: THREE.MeshBasicMaterial;
  private readonly crosswalks: THREE.InstancedMesh;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = "Intersection";

    // ============================================================
    // Intersection Asphalt Surface
    // ============================================================

    /**
     * فقط یک سطح آسفالت برای مرکز چهارراه.
     *
     * هیچ Plane یا Box مربوط به پیاده‌رو
     * در این کلاس ساخته نمی‌شود.
     */
    this.surfaceGeometry = new THREE.PlaneGeometry(
      Intersection.SIZE,
      Intersection.SIZE,
    );

    this.surfaceMaterial = new THREE.MeshStandardMaterial({
      color: 0x454545,
      roughness: 1,
      metalness: 0,
    });

    this.surface = new THREE.Mesh(this.surfaceGeometry, this.surfaceMaterial);

    /**
     * انتقال Plane از XY به XZ.
     */
    this.surface.rotation.x = -Math.PI / 2;

    this.surface.position.y = Intersection.SURFACE_Y;

    /**
     * Intersection یک سطح ثابت است.
     */
    this.surface.castShadow = false;
    this.surface.receiveShadow = false;
    this.surface.frustumCulled = true;
    this.surface.name = "IntersectionAsphalt";

    this.group.add(this.surface);

    // ============================================================
    // Crosswalk Geometry
    // ============================================================

    /**
     * Geometry مشترک تمام خطوط.
     */
    this.crosswalkGeometry = new THREE.PlaneGeometry(
      Intersection.CROSSWALK_WIDTH,
      Intersection.CROSSWALK_LENGTH,
    );

    /**
     * تبدیل Plane از XY به XZ.
     */
    this.crosswalkGeometry.rotateX(-Math.PI / 2);

    /**
     * Material مشترک.
     */
    this.crosswalkMaterial = new THREE.MeshBasicMaterial({
      color: 0xd9d9d9,
      side: THREE.DoubleSide,
    });

    /**
     * تعداد خطوط در هر طرف.
     */
    const stripesPerSide = 8;

    /**
     * چهار طرف چهارراه.
     */
    const instanceCount = stripesPerSide * 4;

    /**
     * تمام Crosswalkها در یک InstancedMesh.
     */
    this.crosswalks = new THREE.InstancedMesh(
      this.crosswalkGeometry,
      this.crosswalkMaterial,
      instanceCount,
    );

    /**
     * خطوط ثابت هستند.
     */
    this.crosswalks.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    this.crosswalks.castShadow = false;
    this.crosswalks.receiveShadow = false;
    this.crosswalks.frustumCulled = true;
    this.crosswalks.name = "CrosswalkLines";

    this.createCrosswalks(stripesPerSide);

    this.group.add(this.crosswalks);
  }

  /**
   * ==========================================
   * Crosswalk Generation
   * ==========================================
   *
   * ساخت چهار Crosswalk.
   *
   * نکته:
   * هیچ پیاده‌رویی در مرکز تقاطع ساخته
   * نمی‌شود.
   *
   * فقط خطوط سفید Crosswalk روی آسفالت
   * قرار می‌گیرند.
   */
  private createCrosswalks(stripesPerSide: number): void {
    const matrix = new THREE.Matrix4();

    let index = 0;

    /**
     * عرض جاده.
     *
     * Road.WIDTH = 8
     *
     * بنابراین:
     * -4 تا +4
     */
    const roadWidth = 8;

    const stripeWidth = Intersection.CROSSWALK_WIDTH;

    const stripeGap = Intersection.CROSSWALK_GAP;

    /**
     * محاسبه عرض کل Crosswalk.
     */
    const totalCrosswalkWidth =
      stripesPerSide * stripeWidth + (stripesPerSide - 1) * stripeGap;

    /**
     * شروع خطوط از لبه داخلی جاده.
     */
    const edgeStart = -roadWidth / 2 + stripeWidth / 2;

    /**
     * شروع مرکزی در صورتی که مجموعه
     * خطوط کوچک‌تر از عرض جاده باشد.
     */
    const centeredStart = -totalCrosswalkWidth / 2 + stripeWidth / 2;

    /**
     * اگر عرض Crosswalk تقریباً برابر
     * عرض جاده باشد، از لبه شروع می‌کنیم.
     *
     * در غیر این صورت وسط جاده قرار می‌گیرد.
     */
    const crosswalkStart =
      Math.abs(totalCrosswalkWidth - roadWidth) < 0.001
        ? edgeStart
        : centeredStart;

    // ============================================================
    // North
    // ============================================================

    for (let i = 0; i < stripesPerSide; i++) {
      const x = crosswalkStart + i * (stripeWidth + stripeGap);

      matrix.identity();

      matrix.setPosition(
        x,
        Intersection.MARKING_Y,
        Intersection.CROSSWALK_OFFSET,
      );

      this.crosswalks.setMatrixAt(index++, matrix);
    }

    // ============================================================
    // South
    // ============================================================

    for (let i = 0; i < stripesPerSide; i++) {
      const x = crosswalkStart + i * (stripeWidth + stripeGap);

      matrix.identity();

      matrix.setPosition(
        x,
        Intersection.MARKING_Y,
        -Intersection.CROSSWALK_OFFSET,
      );

      this.crosswalks.setMatrixAt(index++, matrix);
    }

    // ============================================================
    // East
    // ============================================================

    for (let i = 0; i < stripesPerSide; i++) {
      const z = crosswalkStart + i * (stripeWidth + stripeGap);

      matrix.makeRotationY(Math.PI / 2);

      matrix.setPosition(
        Intersection.CROSSWALK_OFFSET,
        Intersection.MARKING_Y,
        z,
      );

      this.crosswalks.setMatrixAt(index++, matrix);
    }

    // ============================================================
    // West
    // ============================================================

    for (let i = 0; i < stripesPerSide; i++) {
      const z = crosswalkStart + i * (stripeWidth + stripeGap);

      matrix.makeRotationY(Math.PI / 2);

      matrix.setPosition(
        -Intersection.CROSSWALK_OFFSET,
        Intersection.MARKING_Y,
        z,
      );

      this.crosswalks.setMatrixAt(index++, matrix);
    }

    /**
     * اعلام تغییر Matrixهای Instance.
     */
    this.crosswalks.instanceMatrix.needsUpdate = true;
  }

  /**
   * ==========================================
   * Dispose
   * ==========================================
   */
  public dispose(): void {
    this.surfaceGeometry.dispose();
    this.surfaceMaterial.dispose();

    this.crosswalkGeometry.dispose();
    this.crosswalkMaterial.dispose();

    this.group.clear();
  }
}
