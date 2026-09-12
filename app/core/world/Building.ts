import * as THREE from 'three'

/**
 * ==========================================
 * Building
 * ==========================================
 *
 * مسئول نگهداری یک ساختمان سه‌بعدی است.
 *
 * نکته مهم:
 * ساختمان دیگر Animation ورود/خروج ندارد.
 *
 * در Infinitown:
 * - ساختمان نباید هنگام ورود به صحنه Scale شود.
 * - ساختمان نباید هنگام خروج کوچک شود.
 * - مدیریت نمایش و پنهان شدن بر عهده Chunkها است.
 *
 * این کار هم طبیعی‌تر است و هم برای Performance
 * بهتر از داشتن Animation جداگانه برای هر ساختمان است.
 * ==========================================
 */
export class Building {
  public readonly group: THREE.Group

  /**
   * Scale واقعی ساختمان.
   *
   * مقدار اصلی پروژه ما 5 است.
   */
  private targetScale = 1

  constructor(model: THREE.Object3D) {
    // -----------------------------
    // Group اصلی ساختمان
    // -----------------------------

    this.group = new THREE.Group()

    this.group.name = 'Building'

    this.group.add(model)

    // -----------------------------
    // Optimization
    // -----------------------------

    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        // ساختمان‌ها Shadow تولید نمی‌کنند.
        // این کار برای موبایل و GPUهای ضعیف مهم است.
        object.castShadow = false
        object.receiveShadow = false

        // اجازه می‌دهیم Three.js اشیای خارج از Frustum
        // را خودش حذف کند.
        object.frustumCulled = true
      }
    })

    // مرجع داخلی برای سیستم‌های دیگر
    this.group.userData.building = this
  }

  /**
   * تعیین Scale ساختمان
   */
  public setScale(scale: number): void {
    this.targetScale = scale

    this.group.scale.setScalar(scale)
  }

  /**
   * دریافت Scale فعلی
   */
  public getScale(): number {
    return this.targetScale
  }

  /**
   * قرار دادن کف ساختمان روی زمین
   */
  public placeOnGround(): void {
    const box = new THREE.Box3().setFromObject(
      this.group
    )

    this.group.position.y -= box.min.y
  }

  /**
   * ==========================================
   * Visibility
   * ==========================================
   *
   * ساختمان فقط نمایش داده یا پنهان می‌شود.
   *
   * هیچ Scale Animation نداریم.
   */

  public show(): void {
    this.group.visible = true
  }

  public hide(): void {
    this.group.visible = false
  }

  public isVisible(): boolean {
    return this.group.visible
  }

  /**
   * ==========================================
   * Update
   * ==========================================
   *
   * عمداً خالی است.
   *
   * Building دیگر Animation per-frame ندارد.
   *
   * این باعث می‌شود برای صدها ساختمان، CPU
   * درگیر Update بی‌دلیل نشود.
   */
  public update(_deltaTime: number): void {
    // فعلاً هیچ Animation مستقیمی روی ساختمان نداریم.
  }
}