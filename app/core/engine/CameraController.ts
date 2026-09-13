import * as THREE from "three";

/**
 * ==========================================
 * CameraController
 * ==========================================
 *
 * کنترل نرم دوربین شهر.
 *
 * Controls:
 *
 * Middle Mouse + Drag
 * → Rotate
 *
 * Left Mouse + Drag
 * → Move / Pan
 *
 * Right Mouse + Drag
 * → Move Horizontally
 *
 * Mouse Wheel
 * → Smooth Zoom
 *
 * ------------------------------------------
 *
 * ساختار حرکت:
 *
 * Mouse
 * ↓
 * Target Camera State
 * ↓
 * Damping / Inertia
 * ↓
 * Camera
 *
 * بنابراین دوربین:
 *
 * - ناگهانی حرکت نمی‌کند.
 * - حرکت نرم دارد.
 * - هنگام توقف آرام می‌شود.
 * - چرخش ۳۶۰ درجه دارد.
 *
 * ------------------------------------------
 *
 * Performance:
 *
 * - هیچ Vector3 جدیدی داخل update ساخته نمی‌شود.
 * - Vectorهای موردنیاز cache شده‌اند.
 * - Animation سبک است.
 * - برای هر فریم آبجکت جدید ساخته نمی‌شود.
 * ==========================================
 */

export class CameraController {
  private readonly camera: THREE.PerspectiveCamera;

  // ==========================================
  // Mouse State
  // ==========================================

  private isLeftMouseDown = false;
  private isMiddleMouseDown = false;
  private isRightMouseDown = false;

  // ==========================================
  // Target Position
  // ==========================================

  /**
   * نقطه‌ای که دوربین باید به سمت آن حرکت کند.
   */
  private readonly target = new THREE.Vector3(0, 0, 0);

  /**
   * نسخه Smooth شده Target.
   */
  private readonly smoothTarget = new THREE.Vector3(0, 0, 0);

  // ==========================================
  // Orbit
  // ==========================================

  /**
   * زاویه افقی فعلی دوربین.
   *
   * این مقدار محدود نمی‌شود و بنابراین
   * چرخش افقی می‌تواند به صورت 360 درجه
   * و حتی چند دور ادامه پیدا کند.
   */
  private azimuth = 0;

  /**
   * زاویه افقی هدف.
   */
  private targetAzimuth = 0;

  /**
   * زاویه عمودی فعلی.
   */
  private manualElevation = 0;

  /**
   * زاویه عمودی هدف.
   */
  private targetManualElevation = 0;

  /**
   * زاویه نهایی عمودی دوربین.
   */
  private elevation = 0;

  // ==========================================
  // Distance
  // ==========================================

  /**
   * فاصله فعلی دوربین از Target.
   */
  private distance = 24;

  /**
   * فاصله هدف Zoom.
   */
  private targetDistance = 24;

  // ==========================================
  // Movement Speed
  // ==========================================

  /**
   * سرعت حرکت دوربین هنگام Pan.
   */
  private readonly panSpeed = 0.035;

  /**
   * سرعت چرخش دوربین.
   */
  private readonly rotateSpeed = 0.005;

  /**
   * سرعت Zoom.
   */
  private readonly zoomSpeed = 0.0025;

  // ==========================================
  // Camera Damping
  // ==========================================

  /**
   * نرمی حرکت Target.
   */
  private readonly positionSmoothness = 0.1;

  /**
   * نرمی چرخش افقی.
   */
  private readonly rotationSmoothness = 0.1;

  /**
   * نرمی چرخش عمودی.
   */
  private readonly elevationSmoothness = 0.1;

  /**
   * نرمی Zoom.
   */
  private readonly zoomSmoothness = 0.15;

  // ==========================================
  // Zoom Limits
  // ==========================================

  private readonly minDistance = 8;
  private readonly maxDistance = 30;

  // ==========================================
  // Elevation Limits
  // ==========================================

  private readonly minElevation = THREE.MathUtils.degToRad(14);
  private readonly maxElevation = THREE.MathUtils.degToRad(58);

  /**
   * مقدار چرخش عمودی دستی که Mouse اجازه می‌دهد.
   */
  private readonly manualElevationLimit = THREE.MathUtils.degToRad(22);

  // ==========================================
  // Cached Vectors
  // ==========================================

  private readonly offset = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  // ==========================================
  // Constructor
  // ==========================================

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;

    // ----------------------------------------
    // Initial Distance
    // ----------------------------------------

    this.distance = camera.position.distanceTo(this.target);

    this.distance = THREE.MathUtils.clamp(
      this.distance,
      this.minDistance,
      this.maxDistance,
    );

    this.targetDistance = this.distance;

    // ----------------------------------------
    // Initial Angles
    // ----------------------------------------

    const dx = camera.position.x - this.target.x;
    const dy = camera.position.y - this.target.y;
    const dz = camera.position.z - this.target.z;

    // زاویه افقی اولیه
    this.azimuth = Math.atan2(dx, dz);
    this.targetAzimuth = this.azimuth;

    // زاویه عمودی اولیه
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);

    const initialElevation = Math.atan2(dy, horizontalDistance);

    this.manualElevation = THREE.MathUtils.clamp(
      initialElevation - this.getZoomElevation(),
      -this.manualElevationLimit,
      this.manualElevationLimit,
    );

    this.targetManualElevation = this.manualElevation;

    this.elevation = this.getZoomElevation() + this.manualElevation;

    this.elevation = THREE.MathUtils.clamp(
      this.elevation,
      THREE.MathUtils.degToRad(8),
      THREE.MathUtils.degToRad(75),
    );

    // ----------------------------------------
    // Initial Target
    // ----------------------------------------

    this.smoothTarget.copy(this.target);

    // ----------------------------------------
    // Mouse Events
    // ----------------------------------------

    window.addEventListener("mousedown", this.handleMouseDown);

    window.addEventListener("mousemove", this.handleMouseMove);

    window.addEventListener("mouseup", this.handleMouseUp);

    window.addEventListener("wheel", this.handleWheel, {
      passive: false,
    });

    window.addEventListener("contextmenu", this.handleContextMenu);

    // ----------------------------------------
    // Initial Camera
    // ----------------------------------------

    this.updateCamera();
  }

  // ==========================================
  // Zoom → Elevation
  // ==========================================

  /**
   * زاویه پایه دوربین را بر اساس فاصله Zoom
   * محاسبه می‌کند.
   */
  private getZoomElevation(): number {
    const zoomRange = this.maxDistance - this.minDistance;

    const zoomRatio = THREE.MathUtils.clamp(
      (this.distance - this.minDistance) / zoomRange,
      0,
      1,
    );

    return THREE.MathUtils.lerp(
      this.minElevation,
      this.maxElevation,
      zoomRatio,
    );
  }

  // ==========================================
  // Mouse Down
  // ==========================================

  private handleMouseDown = (event: MouseEvent): void => {
    // ----------------------------------------
    // Left Mouse
    // ----------------------------------------

    if (event.button === 0) {
      this.isLeftMouseDown = true;
    }

    // ----------------------------------------
    // Middle Mouse
    // ----------------------------------------

    if (event.button === 1) {
      this.isMiddleMouseDown = true;

      event.preventDefault();
    }

    // ----------------------------------------
    // Right Mouse
    // ----------------------------------------

    if (event.button === 2) {
      this.isRightMouseDown = true;

      event.preventDefault();
    }
  };

  // ==========================================
  // Mouse Move
  // ==========================================

  private handleMouseMove = (event: MouseEvent): void => {
    const movementX = event.movementX;
    const movementY = event.movementY;

    // ========================================
    // Middle Drag → Rotate
    // ========================================

    if (this.isMiddleMouseDown) {
      this.targetAzimuth -= movementX * this.rotateSpeed;

      this.targetManualElevation -= movementY * this.rotateSpeed;

      this.targetManualElevation = THREE.MathUtils.clamp(
        this.targetManualElevation,
        -this.manualElevationLimit,
        this.manualElevationLimit,
      );

      return;
    }

    // ========================================
    // Left Drag → Pan
    // ========================================

    if (this.isLeftMouseDown) {
      this.pan(movementX, movementY, 1);

      return;
    }

    // ========================================
    // Right Drag → Horizontal Movement
    // ========================================

    if (this.isRightMouseDown) {
      this.pan(movementX, 0, -1);
    }
  };

  // ==========================================
  // Pan
  // ==========================================

  /**
   * Target دوربین را جابه‌جا می‌کند.
   *
   * direction:
   *
   *  1  → حرکت عادی
   * -1  → حرکت افقی معکوس
   *
   * برای Right Mouse فقط حرکت افقی انجام می‌شود.
   */
  private pan(movementX: number, movementY: number, direction: number): void {
    // ----------------------------------------
    // Forward
    // ----------------------------------------

    this.camera.getWorldDirection(this.forward);

    // حرکت روی زمین؛ ارتفاع تغییر نمی‌کند.
    this.forward.y = 0;

    if (this.forward.lengthSq() > 0) {
      this.forward.normalize();
    }

    // ----------------------------------------
    // Right
    // ----------------------------------------

    this.right.crossVectors(this.forward, this.up);

    if (this.right.lengthSq() > 0) {
      this.right.normalize();
    }

    // ----------------------------------------
    // Horizontal Movement
    // ----------------------------------------

    this.target.addScaledVector(
      this.right,
      -movementX * this.panSpeed * direction,
    );

    // ----------------------------------------
    // Forward / Backward Movement
    // ----------------------------------------

    if (movementY !== 0) {
      this.target.addScaledVector(
        this.forward,
        movementY * this.panSpeed * direction,
      );
    }
  }

  // ==========================================
  // Mouse Up
  // ==========================================

  private handleMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.isLeftMouseDown = false;
    }

    if (event.button === 1) {
      this.isMiddleMouseDown = false;
    }

    if (event.button === 2) {
      this.isRightMouseDown = false;
    }
  };

  // ==========================================
  // Wheel
  // ==========================================

  /**
   * Wheel فقط فاصله هدف را تغییر می‌دهد.
   */
  private handleWheel = (event: WheelEvent): void => {
    event.preventDefault();

    const zoomAmount = event.deltaY * this.zoomSpeed;

    this.targetDistance += zoomAmount * this.targetDistance;

    this.targetDistance = THREE.MathUtils.clamp(
      this.targetDistance,
      this.minDistance,
      this.maxDistance,
    );
  };

  // ==========================================
  // Update Elevation
  // ==========================================

  private updateElevation(): void {
    // ----------------------------------------
    // Smooth Manual Elevation
    // ----------------------------------------

    const manualDifference = this.targetManualElevation - this.manualElevation;

    this.manualElevation += manualDifference * this.elevationSmoothness;

    // ----------------------------------------
    // Zoom Elevation
    // ----------------------------------------

    const zoomElevation = this.getZoomElevation();

    const desiredElevation = zoomElevation + this.manualElevation;

    const minAllowed = THREE.MathUtils.degToRad(8);

    const maxAllowed = THREE.MathUtils.degToRad(75);

    const clampedElevation = THREE.MathUtils.clamp(
      desiredElevation,
      minAllowed,
      maxAllowed,
    );

    // ----------------------------------------
    // Smooth Final Elevation
    // ----------------------------------------

    const elevationDifference = clampedElevation - this.elevation;

    this.elevation += elevationDifference * this.elevationSmoothness;
  }

  // ==========================================
  // Smooth Target Position
  // ==========================================

  private updateTargetPosition(): void {
    const xDifference = this.target.x - this.smoothTarget.x;

    const yDifference = this.target.y - this.smoothTarget.y;

    const zDifference = this.target.z - this.smoothTarget.z;

    this.smoothTarget.x += xDifference * this.positionSmoothness;

    this.smoothTarget.y += yDifference * this.positionSmoothness;

    this.smoothTarget.z += zDifference * this.positionSmoothness;
  }

  // ==========================================
  // Smooth Rotation
  // ==========================================

  private updateRotation(): void {
    /**
     * اختلاف زاویه را در بازه
     * -PI تا +PI نگه می‌داریم.
     *
     * خود targetAzimuth محدود نمی‌شود؛
     * بنابراین چرخش دوربین می‌تواند 360 درجه
     * و حتی چند دور ادامه پیدا کند.
     */
    let difference = this.targetAzimuth - this.azimuth;

    difference =
      THREE.MathUtils.euclideanModulo(difference + Math.PI, Math.PI * 2) -
      Math.PI;

    this.azimuth += difference * this.rotationSmoothness;
  }

  // ==========================================
  // Smooth Distance
  // ==========================================

  private updateDistance(): void {
    const difference = this.targetDistance - this.distance;

    if (Math.abs(difference) < 0.001) {
      this.distance = this.targetDistance;

      return;
    }

    this.distance += difference * this.zoomSmoothness;

    this.distance = THREE.MathUtils.clamp(
      this.distance,
      this.minDistance,
      this.maxDistance,
    );
  }

  // ==========================================
  // Update Camera
  // ==========================================

  /**
   * Camera را از State فعلی محاسبه می‌کند.
   *
   * هیچ Object جدیدی ساخته نمی‌شود.
   */
  private updateCamera(): void {
    const cosElevation = Math.cos(this.elevation);

    const sinElevation = Math.sin(this.elevation);

    const sinAzimuth = Math.sin(this.azimuth);

    const cosAzimuth = Math.cos(this.azimuth);

    // ----------------------------------------
    // Camera Offset
    // ----------------------------------------

    this.offset.set(
      this.distance * cosElevation * sinAzimuth,

      this.distance * sinElevation,

      this.distance * cosElevation * cosAzimuth,
    );

    // ----------------------------------------
    // Camera Position
    // ----------------------------------------

    this.camera.position.copy(this.smoothTarget);

    this.camera.position.add(this.offset);

    // ----------------------------------------
    // Look At
    // ----------------------------------------

    this.camera.lookAt(this.smoothTarget);
  }

  // ==========================================
  // Context Menu
  // ==========================================

  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  // ==========================================
  // Main Update Loop
  // ==========================================

  /**
   * این متد در Animation Loop اجرا می‌شود.
   *
   * ترتیب:
   *
   * 1. Position نرم
   * 2. Rotation نرم
   * 3. Zoom نرم
   * 4. Elevation نرم
   * 5. محاسبه Camera
   */
  public update(): void {
    // ----------------------------------------
    // Smooth Position
    // ----------------------------------------

    this.updateTargetPosition();

    // ----------------------------------------
    // Smooth Rotation
    // ----------------------------------------

    this.updateRotation();

    // ----------------------------------------
    // Smooth Zoom
    // ----------------------------------------

    this.updateDistance();

    // ----------------------------------------
    // Smooth Elevation
    // ----------------------------------------

    this.updateElevation();

    // ----------------------------------------
    // Apply Camera State
    // ----------------------------------------

    this.updateCamera();
  }

  // ==========================================
  // Dispose
  // ==========================================

  public dispose(): void {
    window.removeEventListener("mousedown", this.handleMouseDown);

    window.removeEventListener("mousemove", this.handleMouseMove);

    window.removeEventListener("mouseup", this.handleMouseUp);

    window.removeEventListener("wheel", this.handleWheel);

    window.removeEventListener("contextmenu", this.handleContextMenu);

    this.isLeftMouseDown = false;
    this.isMiddleMouseDown = false;
    this.isRightMouseDown = false;
  }

  // ==========================================
  // Get Distance
  // ==========================================

  /**
   * فاصله فعلی دوربین.
   *
   * ChunkManager از این مقدار استفاده می‌کند.
   */
  public getDistance(): number {
    return this.distance;
  }
}
