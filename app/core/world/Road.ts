import * as THREE from 'three'

/**
 * ==========================================
 * Road
 * ==========================================
 *
 * یک قطعه خیابان مستقیم.
 *
 * جهت پایه Road:
 * محور Z
 *
 * بنابراین:
 *
 * Width  → محور X
 * Length → محور Z
 *
 * RoadGenerator می‌تواند Road را برای
 * خیابان افقی 90 درجه بچرخاند.
 *
 * ==========================================
 *
 * امکانات:
 *
 * - Asphalt
 * - Sidewalk
 * - Center Line
 * - Stop Lines
 *
 * ==========================================
 *
 * Performance:
 *
 * Geometryهای یکسان بین Roadها به صورت Shared
 * استفاده می‌شوند تا برای هر Road دوباره
 * Geometry ساخته نشود.
 *
 * Materialها نیز Shared هستند.
 *
 * این ساختار برای تعداد زیاد Road و Chunk
 * مناسب‌تر است و فشار روی CPU و حافظه را
 * کاهش می‌دهد.
 *
 * ==========================================
 */

export class Road {
  /**
   * عرض آسفالت
   */
  public static readonly WIDTH = 8

  /**
   * طول پیش‌فرض
   */
  public static readonly LENGTH = 20

  /**
   * عرض پیاده‌رو
   */
  private static readonly SIDEWALK_WIDTH = 1.5

  /**
   * ارتفاع پیاده‌رو
   */
  private static readonly SIDEWALK_HEIGHT = 0.12

  /**
   * اندازه محدوده‌ای که برای Intersection
   * خالی نگه داشته می‌شود.
   */
  private static readonly INTERSECTION_SIZE = 8

  /**
   * Group اصلی Road
   */
  public readonly group: THREE.Group

  /**
   * مشخصات Road
   */
  private readonly roadWidth: number
  private readonly roadLength: number

  /**
   * ==========================================
   * Shared Materials
   * ==========================================
   *
   * تمام Roadها از Materialهای مشترک
   * استفاده می‌کنند.
   */

  private static roadMaterial:
    THREE.MeshStandardMaterial | null = null

  private static sidewalkMaterial:
    THREE.MeshStandardMaterial | null = null

  private static markingMaterial:
    THREE.MeshBasicMaterial | null = null

  private static stopLineMaterial:
    THREE.MeshBasicMaterial | null = null

  /**
   * ==========================================
   * Shared Geometry Cache
   * ==========================================
   *
   * Geometryهای تکراری فقط یک بار ساخته می‌شوند.
   *
   * Key:
   * width + length
   *
   * این موضوع مخصوصاً زمانی مهم است که
   * تعداد زیادی Road در Chunkهای مختلف داشته باشیم.
   */

  private static readonly roadGeometryCache =
    new Map<string, THREE.PlaneGeometry>()

  private static readonly sidewalkGeometryCache =
    new Map<string, THREE.BoxGeometry>()

  private static readonly centerLineGeometry =
    new THREE.PlaneGeometry(
      0.12,
      1.8
    )

  private static readonly stopLineGeometry =
    new THREE.PlaneGeometry(
      Road.WIDTH - 0.8,
      0.18
    )

  /**
   * ==========================================
   * Constructor
   * ==========================================
   */
  constructor(
    width: number = Road.WIDTH,
    length: number = Road.LENGTH
  ) {
    this.roadWidth = width
    this.roadLength = length

    this.group = new THREE.Group()
    this.group.name = 'Road'

    this.initializeMaterials()

    this.createRoadSurface()
    this.createSidewalks()
    this.createRoadMarkings()
    this.createStopLines()
  }

  /**
   * ==========================================
   * Materials
   * ==========================================
   */
  private initializeMaterials(): void {
    /**
     * Asphalt
     */
    if (Road.roadMaterial === null) {
      Road.roadMaterial =
        new THREE.MeshStandardMaterial({
          color: 0x454545,
          roughness: 0.95,
          metalness: 0,
        })
    }

    /**
     * Sidewalk
     */
    if (Road.sidewalkMaterial === null) {
      Road.sidewalkMaterial =
        new THREE.MeshStandardMaterial({
          color: 0x8d8d8d,
          roughness: 1,
          metalness: 0,
        })
    }

    /**
     * Center / lane markings
     */
    if (Road.markingMaterial === null) {
      Road.markingMaterial =
        new THREE.MeshBasicMaterial({
          color: 0xd9d9d9,
        })
    }

    /**
     * Stop line
     */
    if (Road.stopLineMaterial === null) {
      Road.stopLineMaterial =
        new THREE.MeshBasicMaterial({
          color: 0xf5f5f5,
        })
    }
  }

  /**
   * ==========================================
   * Road Geometry
   * ==========================================
   *
   * Geometry آسفالت را از Cache می‌گیریم.
   *
   * اگر Road دیگری با همان Width و Length
   * وجود داشته باشد، Geometry جدید ساخته نمی‌شود.
   */
  private getRoadGeometry(): THREE.PlaneGeometry {
    const key =
      `${this.roadWidth}_${this.roadLength}`

    const cached =
      Road.roadGeometryCache.get(key)

    if (cached) {
      return cached
    }

    const geometry =
      new THREE.PlaneGeometry(
        this.roadWidth,
        this.roadLength
      )

    Road.roadGeometryCache.set(
      key,
      geometry
    )

    return geometry
  }

  /**
   * ==========================================
   * Asphalt
   * ==========================================
   */
  private createRoadSurface(): void {
    if (Road.roadMaterial === null) {
      return
    }

    const road =
      new THREE.Mesh(
        this.getRoadGeometry(),
        Road.roadMaterial
      )

    /**
     * تبدیل Plane به سطح افقی
     */
    road.rotation.x =
      -Math.PI / 2

    /**
     * کمی بالاتر از Ground
     * تا Z-Fighting ایجاد نشود.
     */
    road.position.y =
      0.025

    road.name =
      'RoadSurface'

    this.group.add(road)
  }

  /**
   * ==========================================
   * Sidewalk Geometry
   * ==========================================
   *
   * پیاده‌روهای سمت راست و چپ دقیقاً
   * Geometry یکسان دارند.
   *
   * بنابراین فقط یک Geometry ساخته
   * و بین هر دو Mesh استفاده می‌شود.
   */
  private getSidewalkGeometry(): THREE.BoxGeometry {
    const key =
      `${Road.SIDEWALK_WIDTH}_${Road.SIDEWALK_HEIGHT}_${this.roadLength}`

    const cached =
      Road.sidewalkGeometryCache.get(key)

    if (cached) {
      return cached
    }

    const geometry =
      new THREE.BoxGeometry(
        Road.SIDEWALK_WIDTH,
        Road.SIDEWALK_HEIGHT,
        this.roadLength
      )

    Road.sidewalkGeometryCache.set(
      key,
      geometry
    )

    return geometry
  }

  /**
   * ==========================================
   * Sidewalk
   * ==========================================
   */
  private createSidewalks(): void {
    if (Road.sidewalkMaterial === null) {
      return
    }

    /**
     * Geometry مشترک بین دو پیاده‌رو
     */
    const geometry =
      this.getSidewalkGeometry()

    /**
     * --------------------------------------
     * Right Sidewalk
     * --------------------------------------
     */
    const right =
      new THREE.Mesh(
        geometry,
        Road.sidewalkMaterial
      )

    right.position.set(
      this.roadWidth / 2 +
        Road.SIDEWALK_WIDTH / 2,

      Road.SIDEWALK_HEIGHT / 2,

      0
    )

    right.name =
      'RightSidewalk'

    this.group.add(right)

    /**
     * --------------------------------------
     * Left Sidewalk
     * --------------------------------------
     */
    const left =
      new THREE.Mesh(
        geometry,
        Road.sidewalkMaterial
      )

    left.position.set(
      -(
        this.roadWidth / 2 +
        Road.SIDEWALK_WIDTH / 2
      ),

      Road.SIDEWALK_HEIGHT / 2,

      0
    )

    left.name =
      'LeftSidewalk'

    this.group.add(left)
  }

  /**
   * ==========================================
   * Lane Markings
   * ==========================================
   *
   * خط وسط خیابان به صورت Dash ساخته می‌شود.
   *
   * خط‌ها قبل از Intersection متوقف می‌شوند.
   */
  private createRoadMarkings(): void {
    if (Road.markingMaterial === null) {
      return
    }

    const lineLength = 1.8
    const gap = 2.0

    /**
     * فاصله‌ای که برای Intersection
     * آزاد می‌کنیم.
     */
    const halfIntersection =
      Road.INTERSECTION_SIZE / 2

    /**
     * فضای قابل استفاده در هر طرف Road
     */
    const usableLength =
      this.roadLength / 2 -
      halfIntersection

    /**
     * تعداد خط‌های قابل قرارگیری
     */
    const count =
      Math.floor(
        usableLength /
        (lineLength + gap)
      )

    /**
     * --------------------------------------
     * Positive Z
     * --------------------------------------
     */
    for (
      let i = 0;
      i < count;
      i++
    ) {
      this.createCenterLine(
        i,
        lineLength,
        gap,
        false
      )
    }

    /**
     * --------------------------------------
     * Negative Z
     * --------------------------------------
     */
    for (
      let i = 0;
      i < count;
      i++
    ) {
      this.createCenterLine(
        i,
        lineLength,
        gap,
        true
      )
    }
  }

  /**
   * ==========================================
   * Center Line
   * ==========================================
   *
   * Geometry خط‌ها Shared است.
   *
   * بنابراین اگر یک Road صدها خط داشته باشد،
   * برای هر خط Geometry جدید ساخته نمی‌شود.
   */
  private createCenterLine(
    index: number,
    lineLength: number,
    gap: number,
    negativeSide: boolean
  ): void {
    if (Road.markingMaterial === null) {
      return
    }

    const line =
      new THREE.Mesh(
        Road.centerLineGeometry,
        Road.markingMaterial
      )

    line.rotation.x =
      -Math.PI / 2

    /**
     * فاصله از مرکز Intersection
     */
    const distance =
      Road.INTERSECTION_SIZE / 2 +
      lineLength / 2 +
      index *
        (lineLength + gap)

    line.position.set(
      0,
      0.035,
      negativeSide
        ? -distance
        : distance
    )

    line.name =
      negativeSide
        ? `CenterLine_N_${index}`
        : `CenterLine_S_${index}`

    this.group.add(line)
  }

  /**
   * ==========================================
   * Stop Lines
   * ==========================================
   *
   * خط توقف قبل از Intersection.
   *
   * Geometry این خط نیز Shared است.
   */
  private createStopLines(): void {
    if (Road.stopLineMaterial === null) {
      return
    }

    /**
     * فاصله از مرکز Intersection
     */
    const offset =
      Road.INTERSECTION_SIZE / 2 +
      0.8

    /**
     * --------------------------------------
     * Positive Z
     * --------------------------------------
     */
    const positive =
      new THREE.Mesh(
        Road.stopLineGeometry,
        Road.stopLineMaterial
      )

    positive.rotation.x =
      -Math.PI / 2

    positive.position.set(
      0,
      0.038,
      offset
    )

    positive.name =
      'StopLine_Positive'

    this.group.add(
      positive
    )

    /**
     * --------------------------------------
     * Negative Z
     * --------------------------------------
     */
    const negative =
      new THREE.Mesh(
        Road.stopLineGeometry,
        Road.stopLineMaterial
      )

    negative.rotation.x =
      -Math.PI / 2

    negative.position.set(
      0,
      0.038,
      -offset
    )

    negative.name =
      'StopLine_Negative'

    this.group.add(
      negative
    )
  }
}