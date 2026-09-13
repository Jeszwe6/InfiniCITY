import * as THREE from "three";

/**
 * ==========================================
 * Sidewalk
 * ==========================================
 *
 * پیاده‌روی اطراف Plot.
 *
 * برای Performance:
 * - Geometryها Shared هستند.
 * - Material به صورت Shared است.
 * - Shadow غیرفعال است.
 * - Frustum Culling فعال است.
 *
 * نکته:
 * طول قطعات پیاده‌رو طوری محاسبه می‌شود که
 * در گوشه‌ها هندسه‌ها روی یکدیگر قرار نگیرند.
 * ==========================================
 */

export class Sidewalk {
  /**
   * اندازه Plot
   */
  public static readonly PLOT_SIZE = 12;

  /**
   * عرض پیاده‌رو
   */
  public static readonly WIDTH = 1.2;

  /**
   * ضخامت پیاده‌رو
   */
  public static readonly HEIGHT = 0.14;

  /**
   * ارتفاع پیاده‌رو از سطح زمین
   */
  public static readonly Y = 0.14;

  /**
   * طول واقعی هر قطعه مستقیم پیاده‌رو.
   *
   * با کم کردن دو عرض پیاده‌رو از اندازه Plot،
   * از هم‌پوشانی غیرضروری گوشه‌ها جلوگیری می‌کنیم.
   */
  private static readonly STRAIGHT_LENGTH =
    Sidewalk.PLOT_SIZE - Sidewalk.WIDTH * 2;

  // -----------------------------------------
  // Shared Geometry
  // -----------------------------------------

  /**
   * Geometry افقی
   */
  private static readonly horizontalGeometry = new THREE.BoxGeometry(
    Sidewalk.STRAIGHT_LENGTH,
    Sidewalk.HEIGHT,
    Sidewalk.WIDTH,
  );

  /**
   * Geometry عمودی
   */
  private static readonly verticalGeometry = new THREE.BoxGeometry(
    Sidewalk.WIDTH,
    Sidewalk.HEIGHT,
    Sidewalk.STRAIGHT_LENGTH,
  );

  // -----------------------------------------
  // Shared Material
  // -----------------------------------------

  /**
   * Material مشترک تمام پیاده‌روها
   */
  private static readonly material = new THREE.MeshStandardMaterial({
    color: 0xc8c8c8,
    roughness: 0.9,
    metalness: 0,
  });

  // -----------------------------------------
  // Group
  // -----------------------------------------

  /**
   * گروه اصلی پیاده‌رو
   */
  public readonly group: THREE.Group;

  // -----------------------------------------
  // Constructor
  // -----------------------------------------

  constructor() {
    this.group = new THREE.Group();
    this.group.name = "Sidewalk";

    this.create();
  }

  // ==========================================
  // Create
  // ==========================================

  /**
   * ساخت چهار ضلع پیاده‌رو
   */
  private create(): void {
    const half = Sidewalk.PLOT_SIZE / 2;

    /**
     * مرکز نوار پیاده‌رو.
     *
     * پیاده‌رو کمی داخل محدوده Plot قرار می‌گیرد.
     */
    const offset = half - Sidewalk.WIDTH / 2;

    // ---------------------------------------
    // ضلع بالا
    // ---------------------------------------

    const top = new THREE.Mesh(Sidewalk.horizontalGeometry, Sidewalk.material);

    top.position.set(0, Sidewalk.Y, -offset);

    // ---------------------------------------
    // ضلع پایین
    // ---------------------------------------

    const bottom = new THREE.Mesh(
      Sidewalk.horizontalGeometry,
      Sidewalk.material,
    );

    bottom.position.set(0, Sidewalk.Y, offset);

    // ---------------------------------------
    // ضلع چپ
    // ---------------------------------------

    const left = new THREE.Mesh(Sidewalk.verticalGeometry, Sidewalk.material);

    left.position.set(-offset, Sidewalk.Y, 0);

    // ---------------------------------------
    // ضلع راست
    // ---------------------------------------

    const right = new THREE.Mesh(Sidewalk.verticalGeometry, Sidewalk.material);

    right.position.set(offset, Sidewalk.Y, 0);

    // ---------------------------------------
    // اضافه کردن به Group
    // ---------------------------------------

    this.group.add(top, bottom, left, right);

    // ---------------------------------------
    // Performance
    // ---------------------------------------

    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      /**
       * فقط زمانی Render شود که داخل Frustum دوربین باشد.
       */
      object.frustumCulled = true;

      /**
       * پیاده‌رو Shadow تولید نمی‌کند.
       */
      object.castShadow = false;

      /**
       * پیاده‌رو Shadow دریافت نمی‌کند.
       */
      object.receiveShadow = false;

      /**
       * پیاده‌رو بعد از سطح زمین رسم شود.
       */
      object.renderOrder = 2;
    });
  }
}
