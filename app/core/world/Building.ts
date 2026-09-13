import * as THREE from "three";

/**
 * ==========================================
 * Residential Building Kind
 * ==========================================
 *
 * نوع ساختمان مسکونی.
 *
 * فقط ساختمان‌های مسکونی از این سیستم
 * استفاده می‌کنند.
 *
 * villa     → خانه ویلایی
 * apartment → آپارتمان
 * none      → ساختمان غیرمسکونی یا نامشخص
 */
export type ResidentialBuildingKind = "villa" | "apartment" | "none";

/**
 * ==========================================
 * Building
 * ==========================================
 *
 * مسئول نگهداری یک ساختمان سه‌بعدی مستقل است.
 *
 * نکته بسیار مهم:
 *
 * هر Building یک Group مستقل دارد.
 *
 * بنابراین بعداً می‌توانیم هر ساختمان را
 * جداگانه با Raycaster پیدا و انتخاب کنیم.
 *
 * مثال:
 *
 * CityBlock
 * ├── Building_01
 * ├── Building_02
 * ├── Building_03
 * └── Building_04
 *
 * هیچ‌کدام با دیگری Merge نمی‌شوند.
 *
 * ==========================================
 *
 * در Infinitown:
 *
 * - ساختمان هنگام ورود Scale نمی‌شود.
 * - ساختمان هنگام خروج کوچک نمی‌شود.
 * - نمایش/مخفی شدن توسط Chunkها کنترل می‌شود.
 *
 * ==========================================
 *
 * Performance:
 *
 * - هیچ Animation per-frame ندارد.
 * - Shadow برای ساختمان خاموش است.
 * - Frustum Culling فعال است.
 * - مدل اصلی از BuildingFactory Cache می‌شود.
 * - هر ساختمان Group مستقل خودش را دارد.
 */
export class Building {
  /**
   * ==========================================
   * Group اصلی ساختمان
   * ==========================================
   *
   * این Group همان چیزی است که بعداً
   * Raycaster می‌تواند به آن برسد.
   */
  public readonly group: THREE.Group;

  /**
   * ==========================================
   * Scale واقعی ساختمان
   * ==========================================
   */
  private targetScale = 1;

  /**
   * ==========================================
   * Residential Kind
   * ==========================================
   *
   * نوع ساختمان مسکونی.
   *
   * مقدار پیش‌فرض none است تا زمانی که
   * Factory نوع واقعی مدل را مشخص کند.
   */
  private residentialKind: ResidentialBuildingKind = "none";

  /**
   * ==========================================
   * Constructor
   * ==========================================
   */
  constructor(model: THREE.Object3D) {
    /**
     * ----------------------------------------
     * Group اصلی
     * ----------------------------------------
     */
    this.group = new THREE.Group();

    this.group.name = "Building";

    /**
     * ----------------------------------------
     * مدل سه‌بعدی
     * ----------------------------------------
     *
     * مدل داخل Group مستقل ساختمان قرار
     * می‌گیرد.
     */
    this.group.add(model);

    /**
     * ========================================
     * Building Identity
     * ========================================
     *
     * این اطلاعات برای سیستم انتخاب آینده
     * بسیار مهم هستند.
     *
     * Raycaster می‌تواند از طریق parentهای
     * آبجکت Mesh به این Group برسد.
     */
    this.group.userData.isBuilding = true;

    this.group.userData.building = this;

    /**
     * نوع فعلی ساختمان.
     *
     * بعداً توسط Factory مشخص می‌شود.
     */
    this.group.userData.residentialKind = this.residentialKind;

    /**
     * ========================================
     * Optimization
     * ========================================
     */
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        /**
         * ساختمان‌ها Shadow تولید نمی‌کنند.
         *
         * این تصمیم برای تعداد زیاد
         * ساختمان و دستگاه‌های ضعیف
         * مهم است.
         */
        object.castShadow = false;

        object.receiveShadow = false;

        /**
         * Three.js اشیای خارج از Frustum
         * را Render نمی‌کند.
         */
        object.frustumCulled = true;

        /**
         * اطلاعات مرجع برای Raycaster.
         *
         * اگر کاربر روی خود Mesh کلیک کند،
         * می‌توانیم Building اصلی را پیدا کنیم.
         */
        object.userData.building = this;

        object.userData.isBuilding = true;
      }
    });
  }

  /**
   * ==========================================
   * Set Residential Kind
   * ==========================================
   *
   * نوع ساختمان مسکونی را مشخص می‌کند.
   *
   * فقط دو مقدار واقعی برای سیستم فعلی
   * اهمیت دارند:
   *
   * villa
   * apartment
   *
   * برای ساختمان‌های غیرمسکونی از none
   * استفاده می‌شود.
   */
  public setResidentialKind(kind: ResidentialBuildingKind): void {
    this.residentialKind = kind;

    /**
     * ذخیره در userData برای دسترسی
     * سریع سیستم‌های دیگر.
     */
    this.group.userData.residentialKind = kind;
  }

  /**
   * ==========================================
   * Get Residential Kind
   * ==========================================
   */
  public getResidentialKind(): ResidentialBuildingKind {
    return this.residentialKind;
  }

  /**
   * ==========================================
   * Is Villa
   * ==========================================
   */
  public isVilla(): boolean {
    return this.residentialKind === "villa";
  }

  /**
   * ==========================================
   * Is Apartment
   * ==========================================
   */
  public isApartment(): boolean {
    return this.residentialKind === "apartment";
  }

  /**
   * ==========================================
   * Is Residential
   * ==========================================
   *
   * بررسی می‌کند که ساختمان یکی از
   * ساختمان‌های مسکونی قابل تعامل باشد.
   */
  public isResidential(): boolean {
    return (
      this.residentialKind === "villa" || this.residentialKind === "apartment"
    );
  }

  /**
   * ==========================================
   * Set Scale
   * ==========================================
   *
   * ساختمان بدون Animation Scale می‌شود.
   */
  public setScale(scale: number): void {
    /**
     * جلوگیری از Scale نامعتبر.
     */
    if (!Number.isFinite(scale) || scale <= 0) {
      return;
    }

    this.targetScale = scale;

    this.group.scale.setScalar(scale);
  }

  /**
   * ==========================================
   * Get Scale
   * ==========================================
   */
  public getScale(): number {
    return this.targetScale;
  }

  /**
   * ==========================================
   * Place On Ground
   * ==========================================
   *
   * کف ساختمان را روی سطح زمین قرار می‌دهد.
   */
  public placeOnGround(): void {
    const box = new THREE.Box3().setFromObject(this.group);

    this.group.position.y -= box.min.y;
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
    this.group.visible = true;
  }

  public hide(): void {
    this.group.visible = false;
  }

  public isVisible(): boolean {
    return this.group.visible;
  }

  /**
   * ==========================================
   * Selection State
   * ==========================================
   *
   * فعلاً فقط State را نگه می‌داریم.
   *
   * سیستم Highlight واقعی را بعداً اضافه
   * می‌کنیم.
   *
   * این متدها باعث می‌شوند UI و Raycaster
   * در آینده مستقیماً با Building کار کنند.
   */
  public setSelected(selected: boolean): void {
    this.group.userData.selected = selected;
  }

  public isSelected(): boolean {
    return this.group.userData.selected === true;
  }

  /**
   * ==========================================
   * Update
   * ==========================================
   *
   * عمداً خالی است.
   *
   * Building هیچ Animation per-frame
   * ندارد.
   *
   * این موضوع برای صدها ساختمان بسیار
   * مهم است؛ چون CPU برای هر Building
   * وارد Update غیرضروری نمی‌شود.
   */
  public update(_deltaTime: number): void {
    // فعلاً هیچ Animation مستقیمی
    // روی ساختمان نداریم.
  }
}
