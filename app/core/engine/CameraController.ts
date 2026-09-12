import * as THREE from 'three'

/**
 * ==========================================
 * CameraController
 * ==========================================
 *
 * کنترل نرم دوربین شهر.
 *
 * Controls:
 *
 * Left Mouse + Drag
 * → Pan
 *
 * Right Mouse + Drag
 * → Rotate
 *
 * Mouse Wheel
 * → Smooth Zoom
 *
 * ------------------------------------------
 *
 * رفتار دوربین:
 *
 * ورودی Mouse مستقیماً دوربین را حرکت نمی‌دهد.
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
 * - هنگام شروع حرکت نرم است.
 * - هنگام توقف آرام می‌شود.
 * - Rotate و Pan حس طبیعی‌تری دارند.
 *
 * ------------------------------------------
 *
 * Performance:
 *
 * - هیچ Vector3 جدیدی در update ساخته نمی‌شود.
 * - از Vectorهای cache شده استفاده می‌شود.
 * - Animation سبک است.
 * - هیچ Animation جداگانه‌ای برای هر Object وجود ندارد.
 * ==========================================
 */
export class CameraController {
  private readonly camera: THREE.PerspectiveCamera

  // ==========================================
  // Mouse State
  // ==========================================

  private isLeftMouseDown = false
  private isRightMouseDown = false

  // ==========================================
  // Target Position
  // ==========================================

  /**
   * موقعیتی که دوربین باید به سمت آن حرکت کند.
   */
  private readonly target =
    new THREE.Vector3(0, 0, 0)

  // ==========================================
  // Smooth Target Position
  // ==========================================

  /**
   * موقعیت واقعی دوربین Target.
   *
   * target
   * ↓
   * smoothTarget
   * ↓
   * camera
   */
  private readonly smoothTarget =
    new THREE.Vector3(0, 0, 0)

  // ==========================================
  // Orbit
  // ==========================================

  /**
   * زاویه افقی واقعی دوربین.
   */
  private azimuth = 0

  /**
   * زاویه افقی هدف.
   *
   * Mouse مقدار این Target را تغییر می‌دهد.
   */
  private targetAzimuth = 0

  /**
   * زاویه عمودی دستی واقعی.
   */
  private manualElevation = 0

  /**
   * زاویه عمودی هدف.
   */
  private targetManualElevation = 0

  /**
   * زاویه نهایی واقعی دوربین.
   */
  private elevation = 0

  // ==========================================
  // Distance
  // ==========================================

  /**
   * فاصله فعلی دوربین.
   */
  private distance = 24

  /**
   * فاصله هدف Zoom.
   */
  private targetDistance = 24

  // ==========================================
  // سرعت Pan
  // ==========================================

  /**
   * سرعت تغییر Target هنگام Drag.
   *
   * مقدار پایین‌تر:
   * → حرکت آرام‌تر
   *
   * مقدار بالاتر:
   * → حرکت سریع‌تر
   */
  private readonly panSpeed = 0.035

  // ==========================================
  // سرعت Rotate
  // ==========================================

  private readonly rotateSpeed = 0.005

  // ==========================================
  // سرعت Zoom
  // ==========================================

  private readonly zoomSpeed = 0.0025

  // ==========================================
  // Camera Damping
  // ==========================================

  /**
   * نرمی حرکت Position.
   *
   * هرچه کمتر:
   * → حرکت نرم‌تر و سنگین‌تر
   *
   * هرچه بیشتر:
   * → پاسخ سریع‌تر
   */
  private readonly positionSmoothness = 0.10

  /**
   * نرمی چرخش افقی.
   */
  private readonly rotationSmoothness = 0.10

  /**
   * نرمی چرخش عمودی.
   */
  private readonly elevationSmoothness = 0.10

  /**
   * نرمی Zoom.
   */
  private readonly zoomSmoothness = 0.15

  // ==========================================
  // Zoom Limits
  // ==========================================

  private readonly minDistance = 8

  private readonly maxDistance = 30

  // ==========================================
  // Elevation Limits
  // ==========================================

  private readonly minElevation =
    THREE.MathUtils.degToRad(14)

  private readonly maxElevation =
    THREE.MathUtils.degToRad(58)

  private readonly manualElevationLimit =
    THREE.MathUtils.degToRad(22)

  // ==========================================
  // Cached Vectors
  // ==========================================

  private readonly offset =
    new THREE.Vector3()

  private readonly right =
    new THREE.Vector3()

  private readonly forward =
    new THREE.Vector3()

  private readonly up =
    new THREE.Vector3(0, 1, 0)

  // ==========================================
  // Constructor
  // ==========================================

  constructor(
    camera: THREE.PerspectiveCamera
  ) {
    this.camera = camera

    // ----------------------------------------
    // Initial Distance
    // ----------------------------------------

    this.distance =
      camera.position.distanceTo(
        this.target
      )

    this.distance =
      THREE.MathUtils.clamp(
        this.distance,
        this.minDistance,
        this.maxDistance
      )

    this.targetDistance =
      this.distance

    // ----------------------------------------
    // Initial Angles
    // ----------------------------------------

    const dx =
      camera.position.x -
      this.target.x

    const dy =
      camera.position.y -
      this.target.y

    const dz =
      camera.position.z -
      this.target.z

    // Horizontal angle
    this.azimuth =
      Math.atan2(
        dx,
        dz
      )

    this.targetAzimuth =
      this.azimuth

    // Vertical angle
    const initialElevation =
      Math.atan2(
        dy,
        Math.sqrt(
          dx * dx +
          dz * dz
        )
      )

    this.manualElevation =
      THREE.MathUtils.clamp(
        initialElevation -
          this.getZoomElevation(),
        -this.manualElevationLimit,
        this.manualElevationLimit
      )

    this.targetManualElevation =
      this.manualElevation

    this.elevation =
      this.getZoomElevation() +
      this.manualElevation

    this.elevation =
      THREE.MathUtils.clamp(
        this.elevation,
        THREE.MathUtils.degToRad(8),
        THREE.MathUtils.degToRad(75)
      )

    // ----------------------------------------
    // Initial Target
    // ----------------------------------------

    this.smoothTarget.copy(
      this.target
    )

    // ----------------------------------------
    // Mouse Events
    // ----------------------------------------

    window.addEventListener(
      'mousedown',
      this.handleMouseDown
    )

    window.addEventListener(
      'mousemove',
      this.handleMouseMove
    )

    window.addEventListener(
      'mouseup',
      this.handleMouseUp
    )

    window.addEventListener(
      'wheel',
      this.handleWheel,
      {
        passive: false,
      }
    )

    window.addEventListener(
      'contextmenu',
      this.handleContextMenu
    )

    // ----------------------------------------
    // Initial Camera
    // ----------------------------------------

    this.updateCamera()
  }

  // ==========================================
  // Zoom → Elevation
  // ==========================================

  /**
   * زاویه پایه را بر اساس Zoom محاسبه می‌کند.
   */
  private getZoomElevation(): number {
    const zoomRatio =
      THREE.MathUtils.clamp(
        (
          this.distance -
          this.minDistance
        ) /
        (
          this.maxDistance -
          this.minDistance
        ),
        0,
        1
      )

    return THREE.MathUtils.lerp(
      this.minElevation,
      this.maxElevation,
      zoomRatio
    )
  }

  // ==========================================
  // Mouse Down
  // ==========================================

  private handleMouseDown = (
    event: MouseEvent
  ): void => {
    // ----------------------------------------
    // Left Mouse
    // ----------------------------------------

    if (event.button === 0) {
      this.isLeftMouseDown = true
    }

    // ----------------------------------------
    // Right Mouse
    // ----------------------------------------

    if (event.button === 2) {
      this.isRightMouseDown = true

      event.preventDefault()
    }
  }

  // ==========================================
  // Mouse Move
  // ==========================================

  /**
   * مهم:
   *
   * اینجا دیگر Camera مستقیماً حرکت نمی‌کند.
   *
   * فقط Target تغییر می‌کند.
   *
   * update()
   * بعداً دوربین را نرم به سمت Target می‌برد.
   */
  private handleMouseMove = (
    event: MouseEvent
  ): void => {
    const movementX =
      event.movementX

    const movementY =
      event.movementY

    // ========================================
    // Right Drag → Rotate
    // ========================================

    if (this.isRightMouseDown) {
      this.targetAzimuth -=
        movementX *
        this.rotateSpeed

      this.targetManualElevation -=
        movementY *
        this.rotateSpeed

      this.targetManualElevation =
        THREE.MathUtils.clamp(
          this.targetManualElevation,
          -this.manualElevationLimit,
          this.manualElevationLimit
        )

      return
    }

    // ========================================
    // Left Drag → Pan
    // ========================================

    if (this.isLeftMouseDown) {
      this.pan(
        movementX,
        movementY
      )
    }
  }

  // ==========================================
  // Pan
  // ==========================================

  /**
   * Target را تغییر می‌دهد.
   *
   * خود Camera اینجا حرکت نمی‌کند.
   */
  private pan(
    movementX: number,
    movementY: number
  ): void {
    // ----------------------------------------
    // Forward
    // ----------------------------------------

    this.camera.getWorldDirection(
      this.forward
    )

    // فقط جهت افقی
    this.forward.y = 0

    if (
      this.forward.lengthSq() > 0
    ) {
      this.forward.normalize()
    }

    // ----------------------------------------
    // Right
    // ----------------------------------------

    this.right.crossVectors(
      this.forward,
      this.up
    )

    if (
      this.right.lengthSq() > 0
    ) {
      this.right.normalize()
    }

    // ----------------------------------------
    // Horizontal Movement
    // ----------------------------------------

    this.target.addScaledVector(
      this.right,
      -movementX *
        this.panSpeed
    )

    // ----------------------------------------
    // Forward / Backward Movement
    // ----------------------------------------

    this.target.addScaledVector(
      this.forward,
      movementY *
        this.panSpeed
    )
  }

  // ==========================================
  // Mouse Up
  // ==========================================

  private handleMouseUp = (
    event: MouseEvent
  ): void => {
    if (event.button === 0) {
      this.isLeftMouseDown = false
    }

    if (event.button === 2) {
      this.isRightMouseDown = false
    }
  }

  // ==========================================
  // Wheel
  // ==========================================

  /**
   * Wheel فقط Target Distance را تغییر می‌دهد.
   */
  private handleWheel = (
    event: WheelEvent
  ): void => {
    event.preventDefault()

    const zoomAmount =
      event.deltaY *
      this.zoomSpeed

    this.targetDistance +=
      zoomAmount *
      this.targetDistance

    this.targetDistance =
      THREE.MathUtils.clamp(
        this.targetDistance,
        this.minDistance,
        this.maxDistance
      )
  }

  // ==========================================
  // Update Elevation
  // ==========================================

  private updateElevation(): void {
    // ----------------------------------------
    // Smooth Manual Elevation
    // ----------------------------------------

    const manualDifference =
      this.targetManualElevation -
      this.manualElevation

    this.manualElevation +=
      manualDifference *
      this.elevationSmoothness

    // ----------------------------------------
    // Zoom Elevation
    // ----------------------------------------

    const zoomElevation =
      this.getZoomElevation()

    const desiredElevation =
      zoomElevation +
      this.manualElevation

    const minAllowed =
      THREE.MathUtils.degToRad(8)

    const maxAllowed =
      THREE.MathUtils.degToRad(75)

    const clampedElevation =
      THREE.MathUtils.clamp(
        desiredElevation,
        minAllowed,
        maxAllowed
      )

    // ----------------------------------------
    // Smooth Final Elevation
    // ----------------------------------------

    const elevationDifference =
      clampedElevation -
      this.elevation

    this.elevation +=
      elevationDifference *
      this.elevationSmoothness
  }

  // ==========================================
  // Smooth Target Position
  // ==========================================

  private updateTargetPosition(): void {
    const xDifference =
      this.target.x -
      this.smoothTarget.x

    const yDifference =
      this.target.y -
      this.smoothTarget.y

    const zDifference =
      this.target.z -
      this.smoothTarget.z

    this.smoothTarget.x +=
      xDifference *
      this.positionSmoothness

    this.smoothTarget.y +=
      yDifference *
      this.positionSmoothness

    this.smoothTarget.z +=
      zDifference *
      this.positionSmoothness
  }

  // ==========================================
  // Smooth Rotation
  // ==========================================

  private updateRotation(): void {
    /**
     * برای جلوگیری از مشکل عبور
     * زاویه از 180- به 180+
     * اختلاف زاویه را normalize می‌کنیم.
     */

    let difference =
      this.targetAzimuth -
      this.azimuth

    difference =
      THREE.MathUtils.euclideanModulo(
        difference + Math.PI,
        Math.PI * 2
      ) - Math.PI

    this.azimuth +=
      difference *
      this.rotationSmoothness
  }

  // ==========================================
  // Smooth Distance
  // ==========================================

  private updateDistance(): void {
    const difference =
      this.targetDistance -
      this.distance

    if (
      Math.abs(difference) < 0.001
    ) {
      this.distance =
        this.targetDistance

      return
    }

    this.distance +=
      difference *
      this.zoomSmoothness

    this.distance =
      THREE.MathUtils.clamp(
        this.distance,
        this.minDistance,
        this.maxDistance
      )
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
    const cosElevation =
      Math.cos(
        this.elevation
      )

    const sinElevation =
      Math.sin(
        this.elevation
      )

    const sinAzimuth =
      Math.sin(
        this.azimuth
      )

    const cosAzimuth =
      Math.cos(
        this.azimuth
      )

    // ----------------------------------------
    // Camera Offset
    // ----------------------------------------

    this.offset.set(
      this.distance *
        cosElevation *
        sinAzimuth,

      this.distance *
        sinElevation,

      this.distance *
        cosElevation *
        cosAzimuth
    )

    // ----------------------------------------
    // Camera Position
    // ----------------------------------------

    this.camera.position.copy(
      this.smoothTarget
    )

    this.camera.position.add(
      this.offset
    )

    // ----------------------------------------
    // Look At
    // ----------------------------------------

    this.camera.lookAt(
      this.smoothTarget
    )
  }

  // ==========================================
  // Context Menu
  // ==========================================

  private handleContextMenu = (
    event: MouseEvent
  ): void => {
    event.preventDefault()
  }

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

    this.updateTargetPosition()

    // ----------------------------------------
    // Smooth Rotation
    // ----------------------------------------

    this.updateRotation()

    // ----------------------------------------
    // Smooth Zoom
    // ----------------------------------------

    this.updateDistance()

    // ----------------------------------------
    // Smooth Elevation
    // ----------------------------------------

    this.updateElevation()

    // ----------------------------------------
    // Apply Camera State
    // ----------------------------------------

    this.updateCamera()
  }

  // ==========================================
  // Dispose
  // ==========================================

  public dispose(): void {
    window.removeEventListener(
      'mousedown',
      this.handleMouseDown
    )

    window.removeEventListener(
      'mousemove',
      this.handleMouseMove
    )

    window.removeEventListener(
      'mouseup',
      this.handleMouseUp
    )

    window.removeEventListener(
      'wheel',
      this.handleWheel
    )

    window.removeEventListener(
      'contextmenu',
      this.handleContextMenu
    )

    this.isLeftMouseDown = false
    this.isRightMouseDown = false
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
    return this.distance
  }
}