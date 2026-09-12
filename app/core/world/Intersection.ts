import * as THREE from 'three'

/**
 * ==========================================
 * Intersection
 * ==========================================
 *
 * مرکز تقاطع دو خیابان را مدیریت می‌کند.
 *
 * این قسمت عمداً از Road جداست تا:
 *
 * - خیابان افقی روی Intersection قرار نگیرد
 * - خیابان عمودی روی Intersection قرار نگیرد
 * - بعداً Crosswalk اضافه کنیم
 * - بعداً چراغ راهنمایی اضافه کنیم
 * - بعداً جزئیات تقاطع را اضافه کنیم
 *
 * برای Performance، هندسه بسیار ساده است.
 * ==========================================
 */

export class Intersection {
  public readonly group: THREE.Group

  /**
   * اندازه‌ی تقاطع
   */
  public static readonly SIZE = 8

  constructor(
    size: number = Intersection.SIZE
  ) {
    this.group = new THREE.Group()
    this.group.name = 'Intersection'

    this.createSurface(size)
    this.createCrosswalks(size)
  }

  /**
   * ==========================================
   * سطح تقاطع
   * ==========================================
   */
  private createSurface(
    size: number
  ): void {
    const geometry =
      new THREE.PlaneGeometry(
        size,
        size
      )

    const material =
      new THREE.MeshStandardMaterial({
        color: 0x454545,
        roughness: 0.95,
        metalness: 0,
      })

    const surface =
      new THREE.Mesh(
        geometry,
        material
      )

    // قرار دادن Plane روی زمین
    surface.rotation.x =
      -Math.PI / 2

    surface.position.y =
      0.027

    surface.name =
      'IntersectionSurface'

    this.group.add(surface)
  }

  /**
   * ==========================================
   * Crosswalk
   * ==========================================
   *
   * فعلاً چهار مجموعه خط ساده می‌سازیم.
   *
   * بعداً می‌توانیم ظاهر آن را به تصویر
   * مرجع نزدیک‌تر کنیم.
   */
  private createCrosswalks(
    size: number
  ): void {
    const stripeWidth = 0.35
    const stripeLength = 5
    const gap = 0.35

    const material =
      new THREE.MeshBasicMaterial({
        color: 0xf2f2f2,
      })

    /**
     * تعداد خطوط
     */
    const count = 9

    /**
     * -----------------------------
     * Crosswalk شمال
     * -----------------------------
     */
    for (
      let i = 0;
      i < count;
      i++
    ) {
      const geometry =
        new THREE.PlaneGeometry(
          stripeWidth,
          stripeLength
        )

      const stripe =
        new THREE.Mesh(
          geometry,
          material
        )

      stripe.rotation.x =
        -Math.PI / 2

      stripe.position.set(
        -(
          (count - 1) *
          (stripeWidth + gap)
        ) /
          2 +
          i *
            (stripeWidth + gap),

        0.04,

        -size / 2 +
          stripeLength / 2
      )

      stripe.name =
        `Crosswalk_North_${i}`

      this.group.add(stripe)
    }

    /**
     * -----------------------------
     * Crosswalk جنوب
     * -----------------------------
     */
    for (
      let i = 0;
      i < count;
      i++
    ) {
      const geometry =
        new THREE.PlaneGeometry(
          stripeWidth,
          stripeLength
        )

      const stripe =
        new THREE.Mesh(
          geometry,
          material
        )

      stripe.rotation.x =
        -Math.PI / 2

      stripe.position.set(
        -(
          (count - 1) *
          (stripeWidth + gap)
        ) /
          2 +
          i *
            (stripeWidth + gap),

        0.04,

        size / 2 -
          stripeLength / 2
      )

      stripe.name =
        `Crosswalk_South_${i}`

      this.group.add(stripe)
    }

    /**
     * -----------------------------
     * Crosswalk شرق
     * -----------------------------
     */
    for (
      let i = 0;
      i < count;
      i++
    ) {
      const geometry =
        new THREE.PlaneGeometry(
          stripeLength,
          stripeWidth
        )

      const stripe =
        new THREE.Mesh(
          geometry,
          material
        )

      stripe.rotation.x =
        -Math.PI / 2

      stripe.position.set(
        size / 2 -
          stripeLength / 2,

        0.041,

        -(
          (count - 1) *
          (stripeWidth + gap)
        ) /
          2 +
          i *
            (stripeWidth + gap)
      )

      stripe.name =
        `Crosswalk_East_${i}`

      this.group.add(stripe)
    }

    /**
     * -----------------------------
     * Crosswalk غرب
     * -----------------------------
     */
    for (
      let i = 0;
      i < count;
      i++
    ) {
      const geometry =
        new THREE.PlaneGeometry(
          stripeLength,
          stripeWidth
        )

      const stripe =
        new THREE.Mesh(
          geometry,
          material
        )

      stripe.rotation.x =
        -Math.PI / 2

      stripe.position.set(
        -size / 2 +
          stripeLength / 2,

        0.041,

        -(
          (count - 1) *
          (stripeWidth + gap)
        ) /
          2 +
          i *
            (stripeWidth + gap)
      )

      stripe.name =
        `Crosswalk_West_${i}`

      this.group.add(stripe)
    }
  }
}