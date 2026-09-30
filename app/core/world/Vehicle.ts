import * as THREE from "three";

/**
 * ==========================================
 * Vehicle Types
 * ==========================================
 */

/**
 * جهت حرکت خودرو در شبکه خیابان.
 *
 * IMPORTANT:
 * Mapping این جهت‌ها عمداً تغییر داده نشده است.
 */
export type VehicleDirection = "north" | "south" | "east" | "west";

/**
 * حالت فعلی حرکت خودرو.
 */
export type VehicleState = "freeFlow" | "slowing" | "stopped";

/**
 * ==========================================
 * Vehicle Model Type
 * ==========================================
 *
 * نوع مدل ظاهری خودرو.
 */
export type VehicleModelType =
  | "taxi"
  | "sedan"
  | "sedan-sports"
  | "hatchback-sports"
  | "suv"
  | "suv-luxury"
  | "van"
  | "delivery"
  | "truck"
  | "truck-flat"
  | "police"
  | "ambulance"
  | "firetruck"
  | "garbage-truck"
  | "race"
  | "race-future"
  | "tractor";

/**
 * ==========================================
 * Vehicle
 * ==========================================
 *
 * مسئول مدیریت یک خودرو:
 *
 * - مدل سه‌بعدی
 * - سرعت
 * - جهت حرکت
 * - شتاب‌گیری
 * - ترمز
 * - توقف
 * - فعال / غیرفعال شدن
 *
 * این کلاس مستقل از CarManager است و فقط
 * منطق حرکتی خود خودرو را کنترل می‌کند.
 */
export class Vehicle {
  /**
   * ==========================================
   * State
   * ==========================================
   */

  /**
   * سرعت فعلی خودرو.
   */
  private speed = 0;

  /**
   * سرعت هدف فعلی خودرو.
   *
   * Vehicle به‌صورت تدریجی به این سرعت می‌رسد.
   */
  private targetSpeed = 0;

  /**
   * سرعت مطلوب خودرو در حالت حرکت عادی.
   *
   * این مقدار توسط CarManager تعیین می‌شود.
   */
  private desiredSpeed = 0;

  /**
   * جهت حرکت خودرو.
   *
   * این mapping نباید تغییر کند.
   */
  private direction: VehicleDirection = "north";

  /**
   * وضعیت فعلی خودرو.
   */
  private state: VehicleState = "stopped";

  /**
   * آیا خودرو در حال استفاده است؟
   */
  private active = false;

  /**
   * نوع مدل خودرو.
   */
  private readonly vehicleType: VehicleModelType;

  /**
   * گروه سه‌بعدی خودرو.
   */
  public readonly group: THREE.Group;

  /**
   * ==========================================
   * Movement Constants
   * ==========================================
   */

  /**
   * حداکثر سرعت مجاز Vehicle.
   *
   * با MAX_SPEED در CarManager هماهنگ است.
   *
   * نکته:
   * قوانین ترافیکی در CarManager اعمال می‌شوند؛
   * این مقدار فقط یک safety limit برای خود Vehicle است.
   */
  private static readonly MAX_SPEED = 5.5;

  /**
   * شتاب خودرو.
   */
  private static readonly ACCELERATION = 3.5;

  /**
   * قدرت ترمز.
   */
  private static readonly BRAKING = 7;

  /**
   * حداقل سرعت قابل حرکت.
   *
   * برای جلوگیری از لرزش خودرو در سرعت‌های بسیار پایین.
   */
  private static readonly MIN_MOVING_SPEED = 0.15;

  /**
   * حداکثر deltaTime قابل استفاده در یک update.
   *
   * از پرش حرکتی در صورت افت فریم جلوگیری می‌کند.
   */
  private static readonly MAX_DELTA_TIME = 0.1;

  /**
   * ==========================================
   * Constructor
   * ==========================================
   */

  constructor(
    group: THREE.Group,
    vehicleType: VehicleModelType,
  ) {
    this.group = group;
    this.vehicleType = vehicleType;

    /**
     * نام‌گذاری گروه برای Raycaster و
     * شناسایی مستقل خودرو در آینده.
     */
    this.group.name = `Vehicle_${vehicleType}`;

    /**
     * اطلاعات خودرو داخل userData.
     */
    this.group.userData.isVehicle = true;
    this.group.userData.vehicle = this;
    this.group.userData.vehicleType = vehicleType;

    /**
     * خودرو در ابتدا غیرفعال است.
     */
    this.reset();
  }

  /**
   * ==========================================
   * Activation
   * ==========================================
   */

  /**
   * فعال کردن خودرو در موقعیت و جهت مشخص.
   *
   * سرعت اولیه sanitize و محدود می‌شود تا
   * مقدار نامعتبر وارد سیستم حرکتی نشود.
   */
  public activate(
    position: THREE.Vector3,
    direction: VehicleDirection,
    speed: number,
  ): void {
    this.active = true;
    this.group.visible = true;

    this.group.position.copy(position);

    /**
     * جهت خودرو را بدون تغییر در mapping
     * تنظیم می‌کنیم.
     */
    this.setDirection(direction);

    /**
     * سرعت اولیه را امن می‌کنیم.
     */
    const safeSpeed = this.sanitizeSpeed(speed);

    this.speed = safeSpeed;
    this.targetSpeed = safeSpeed;
    this.desiredSpeed = safeSpeed;

    this.state = "freeFlow";
  }

  /**
   * غیرفعال کردن خودرو.
   */
  public deactivate(): void {
    this.active = false;

    this.speed = 0;
    this.targetSpeed = 0;
    this.desiredSpeed = 0;

    this.state = "stopped";
    this.group.visible = false;
  }

  /**
   * ==========================================
   * State Control
   * ==========================================
   */

  /**
   * توقف خودرو.
   *
   * توقف به‌صورت ترمز انجام می‌شود و
   * Vehicle.update() سرعت را به صفر می‌رساند.
   */
  public stop(): void {
    this.state = "stopped";
    this.targetSpeed = 0;
  }

  /**
   * ادامه حرکت خودرو.
   *
   * بعد از آزاد شدن مسیر، خودرو به سرعت مطلوب
   * خودش برمی‌گردد.
   */
  public resume(): void {
    this.state = "freeFlow";

    /**
     * desiredSpeed از قبل توسط CarManager تعیین شده.
     * بنابراین اینجا سرعت تصادفی تولید نمی‌کنیم.
     */
    this.targetSpeed = this.sanitizeSpeed(this.desiredSpeed);
  }

  /**
   * کاهش سرعت خودرو.
   *
   * سرعت هدف را به سرعت فعلی محدود می‌کنیم
   * تا خودرو هنگام slowdown شتاب مثبت نگیرد.
   */
  public slowDown(): void {
    this.state = "slowing";

    this.targetSpeed = Math.min(
      this.sanitizeSpeed(this.desiredSpeed),
      this.speed,
    );
  }

  /**
   * ==========================================
   * Direction
   * ==========================================
   */

  /**
   * تعیین جهت حرکت خودرو.
   *
   * IMPORTANT:
   * این mapping دقیقاً همان mapping قبلی است
   * و نباید تغییر کند.
   *
   * north -> -Z
   * south -> +Z
   * east  -> +X
   * west  -> -X
   */
  public setDirection(direction: VehicleDirection): void {
    this.direction = direction;

    /**
     * مدل‌های خودرو در فایل GLB جهت Forward
     * مخالف محور حرکت داخلی سیستم دارند؛
     * بنابراین برای نمایش صحیح خودرو،
     * چرخش مدل اصلاح شده است.
     */
    switch (direction) {
      case "north":
        this.group.rotation.y = Math.PI;
        break;

      case "south":
        this.group.rotation.y = 0;
        break;

      case "east":
        this.group.rotation.y = Math.PI / 2;
        break;

      case "west":
        this.group.rotation.y = -Math.PI / 2;
        break;
    }
  }

  /**
   * دریافت جهت فعلی.
   */
  public getDirection(): VehicleDirection {
    return this.direction;
  }

  /**
   * ==========================================
   * Speed
   * ==========================================
   */

  /**
   * تعیین سرعت هدف.
   *
   * این متد عمداً سرعت را ناگهانی روی speed
   * قرار نمی‌دهد؛ فقط target را تغییر می‌دهد.
   *
   * Vehicle.update() وظیفه تغییر تدریجی speed را دارد.
   */
  public setTargetSpeed(speed: number): void {
    const safeSpeed = this.sanitizeSpeed(speed);

    this.desiredSpeed = safeSpeed;

    /**
     * اگر خودرو متوقف نباشد، targetSpeed نیز
     * به سرعت مطلوب جدید منتقل می‌شود.
     */
    if (this.state !== "stopped") {
      this.targetSpeed = safeSpeed;
    }
  }

  /**
   * دریافت سرعت فعلی.
   */
  public getSpeed(): number {
    return this.speed;
  }

  /**
   * ==========================================
   * Update
   * ==========================================
   */

  /**
   * حرکت خودرو بر اساس deltaTime.
   *
   * این متد:
   *
   * 1. سرعت را به‌صورت تدریجی تغییر می‌دهد.
   * 2. از جهش سرعت جلوگیری می‌کند.
   * 3. deltaTime غیرمعتبر را کنترل می‌کند.
   * 4. خودرو را روی محور صحیح حرکت می‌دهد.
   */
  public update(deltaTime: number): void {
    /**
     * خودروهای غیرفعال نباید پردازش شوند.
     */
    if (!this.active) {
      return;
    }

    /**
     * deltaTime را امن می‌کنیم.
     *
     * اگر مقدار NaN یا Infinity باشد،
     * این فریم را بدون حرکت پردازش می‌کنیم.
     */
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }

    /**
     * جلوگیری از deltaTime بسیار بزرگ.
     *
     * این بخش برای جلوگیری از پرش خودرو در صورت
     * افت شدید FPS بسیار مهم است.
     */
    const dt = Math.min(
      deltaTime,
      Vehicle.MAX_DELTA_TIME,
    );

    /**
     * ==========================================
     * Speed Update
     * ==========================================
     */

    if (this.state === "stopped") {
      /**
       * ترمز تدریجی تا توقف کامل.
       */
      this.speed = Math.max(
        0,
        this.speed - Vehicle.BRAKING * dt,
      );
    } else {
      /**
       * targetSpeed را همیشه امن نگه می‌داریم.
       */
      const safeTargetSpeed = this.sanitizeSpeed(
        this.targetSpeed,
      );

      const difference =
        safeTargetSpeed - this.speed;

      if (difference > 0) {
        /**
         * شتاب‌گیری نرم.
         */
        this.speed = Math.min(
          safeTargetSpeed,
          this.speed + Vehicle.ACCELERATION * dt,
        );
      } else if (difference < 0) {
        /**
         * کاهش سرعت نرم.
         */
        this.speed = Math.max(
          safeTargetSpeed,
          this.speed - Vehicle.BRAKING * dt,
        );
      }
    }

    /**
     * Safety Clamp
     *
     * حتی اگر مقدار نامعتبری از بیرون وارد شده باشد،
     * سرعت Vehicle هرگز از محدوده مجاز خارج نمی‌شود.
     */
    this.speed = this.sanitizeSpeed(this.speed);

    /**
     * اگر سرعت بسیار کم است و خودرو باید متوقف باشد،
     * مقدار را دقیقاً صفر می‌کنیم تا لرزش ایجاد نشود.
     */
    if (
      this.speed < Vehicle.MIN_MOVING_SPEED &&
      (this.state === "stopped" || this.targetSpeed <= 0)
    ) {
      this.speed = 0;
    }

    /**
     * ==========================================
     * Position Update
     * ==========================================
     */

    /**
     * مقدار جابه‌جایی این فریم.
     *
     * movement فقط از speed * dt ساخته می‌شود؛
     * بنابراین Vehicle خودش نمی‌تواند teleport کند.
     */
    const movement = this.speed * dt;

    /**
     * جهت حرکت واقعی خودرو.
     *
     * IMPORTANT:
     * این mapping عمداً دست‌نخورده باقی مانده است.
     */
    switch (this.direction) {
      case "north":
        this.group.position.z -= movement;
        break;

      case "south":
        this.group.position.z += movement;
        break;

      case "east":
        this.group.position.x += movement;
        break;

      case "west":
        this.group.position.x -= movement;
        break;
    }
  }

  /**
   * ==========================================
   * Reset
   * ==========================================
   */

  /**
   * آماده‌سازی خودرو برای قرار گرفتن مجدد
   * در Pool.
   */
  public reset(): void {
    this.active = false;

    this.speed = 0;
    this.targetSpeed = 0;
    this.desiredSpeed = 0;

    this.state = "stopped";

    /**
     * خودرو را خارج از محدوده دید قرار می‌دهیم.
     */
    this.group.position.set(0, -100, 0);
    this.group.visible = false;
  }

  /**
   * ==========================================
   * Getters
   * ==========================================
   */

  /**
   * دریافت نوع خودرو.
   */
  public getVehicleType(): VehicleModelType {
    return this.vehicleType;
  }

  /**
   * بررسی فعال بودن خودرو.
   */
  public isActive(): boolean {
    return this.active;
  }

  /**
   * دریافت وضعیت حرکتی خودرو.
   */
  public getState(): VehicleState {
    return this.state;
  }

  /**
   * ==========================================
   * Internal Safety
   * ==========================================
   */

  /**
   * پاک‌سازی و محدود کردن مقدار سرعت.
   *
   * این متد جلوی ورود موارد زیر را می‌گیرد:
   *
   * - NaN
   * - Infinity
   * - -Infinity
   * - سرعت منفی
   * - سرعت بیشتر از MAX_SPEED
   */
  private sanitizeSpeed(speed: number): number {
    if (!Number.isFinite(speed)) {
      return 0;
    }

    return Math.min(
      Math.max(speed, 0),
      Vehicle.MAX_SPEED,
    );
  }

  /**
   * ==========================================
   * Dispose
   * ==========================================
   */

  /**
   * آزادسازی منابع سه‌بعدی خودرو.
   */
  public dispose(): void {
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;

      if (mesh.geometry) {
        mesh.geometry.dispose();
      }

      if (mesh.material) {
        const material = mesh.material;

        if (Array.isArray(material)) {
          for (const item of material) {
            item.dispose();
          }
        } else {
          material.dispose();
        }
      }
    });

    this.group.clear();
  }
}