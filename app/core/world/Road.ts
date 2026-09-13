import * as THREE from "three";

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
 *
 * ==========================================
 *
 * نکته مهم:
 *
 * محدوده مرکزی Intersection در Road
 * نباید پیاده‌رو داشته باشد.
 *
 * بنابراین Sidewalk در دو طرف Intersection
 * به صورت Segment جداگانه ساخته می‌شود.
 *
 * ==========================================
 *
 * Performance:
 *
 * - Shared Materials
 * - Geometry Cache
 * - InstancedMesh برای Center Lines
 *
 * ==========================================
 */

export class Road {
  /**
   * عرض آسفالت.
   */
  public static readonly WIDTH = 8;

  /**
   * طول Road.
   *
   * CityBlock = 32×32
   */
  public static readonly LENGTH = 32;

  /**
   * عرض پیاده‌رو.
   */
  private static readonly SIDEWALK_WIDTH = 1.5;

  /**
   * ارتفاع پیاده‌رو.
   */
  private static readonly SIDEWALK_HEIGHT = 0.12;

  /**
   * اندازه Intersection.
   *
   * Intersection:
   * -4 تا +4
   */
  private static readonly INTERSECTION_SIZE = 8;

  /**
   * فاصله خط وسط از Intersection.
   */
  private static readonly INTERSECTION_LINE_PADDING = 1;

  /**
   * ارتفاع سطح جاده.
   */
  private static readonly ROAD_SURFACE_Y = 0.025;

  /**
   * ضخامت خط وسط.
   */
  private static readonly CENTER_LINE_THICKNESS = 0.006;

  /**
   * ارتفاع خط وسط.
   */
  private static readonly CENTER_LINE_Y =
    Road.ROAD_SURFACE_Y + Road.CENTER_LINE_THICKNESS / 2 + 0.0005;

  /**
   * Group اصلی Road.
   */
  public readonly group: THREE.Group;

  /**
   * مشخصات Road.
   */
  private readonly roadWidth: number;
  private readonly roadLength: number;

  /**
   * ==========================================
   * Shared Materials
   * ==========================================
   */

  private static roadMaterial: THREE.MeshStandardMaterial | null = null;

  private static sidewalkMaterial: THREE.MeshStandardMaterial | null = null;

  private static markingMaterial: THREE.MeshBasicMaterial | null = null;

  /**
   * ==========================================
   * Geometry Cache
   * ==========================================
   */

  private static readonly roadGeometryCache = new Map<
    string,
    THREE.PlaneGeometry
  >();

  /**
   * Geometry مربوط به Segmentهای پیاده‌رو.
   *
   * کل پیاده‌رو دیگر یک Geometry با طول 32 نیست.
   *
   * هر طرف Road شامل دو Segment است:
   *
   * - قبل از چهارراه
   * - بعد از چهارراه
   */
  private static readonly sidewalkGeometryCache = new Map<
    string,
    THREE.BoxGeometry
  >();

  /**
   * ==========================================
   * Center Line Geometry
   * ==========================================
   */

  /**
   * Geometry مشترک Dashهای خط وسط.
   *
   * X = عرض خط
   * Y = ضخامت
   * Z = طول Dash
   */
  private static readonly centerLineGeometry = new THREE.BoxGeometry(
    0.12,
    Road.CENTER_LINE_THICKNESS,
    1.8,
  );

  /**
   * ==========================================
   * Constructor
   * ==========================================
   */

  constructor(width: number = Road.WIDTH, length: number = Road.LENGTH) {
    this.roadWidth = width;
    this.roadLength = length;

    this.group = new THREE.Group();
    this.group.name = "Road";

    this.initializeMaterials();

    /**
     * آسفالت کل مسیر را پوشش می‌دهد.
     */
    this.createRoadSurface();

    /**
     * پیاده‌رو فقط خارج از Intersection.
     */
    this.createSidewalks();

    /**
     * خط وسط نیز خارج از Intersection.
     */
    this.createRoadMarkings();
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
      Road.roadMaterial = new THREE.MeshStandardMaterial({
        color: 0x4f5153,
        roughness: 0.95,
        metalness: 0,
      });
    }

    /**
     * Sidewalk
     */
    if (Road.sidewalkMaterial === null) {
      Road.sidewalkMaterial = new THREE.MeshStandardMaterial({
        color: 0xa5a7ab,
        roughness: 1,
        metalness: 0,
      });
    }

    /**
     * Road Markings
     */
    if (Road.markingMaterial === null) {
      Road.markingMaterial = new THREE.MeshBasicMaterial({
        color: 0xd9d9d9,
        side: THREE.DoubleSide,
      });
    }
  }

  /**
   * ==========================================
   * Road Geometry
   * ==========================================
   */

  private getRoadGeometry(): THREE.PlaneGeometry {
    const key = `${this.roadWidth}_${this.roadLength}`;

    const cached = Road.roadGeometryCache.get(key);

    if (cached) {
      return cached;
    }

    /**
     * PlaneGeometry ابتدا روی XY ساخته می‌شود.
     *
     * سپس روی XZ قرار می‌گیرد.
     */
    const geometry = new THREE.PlaneGeometry(this.roadWidth, this.roadLength);

    geometry.rotateX(-Math.PI / 2);

    Road.roadGeometryCache.set(key, geometry);

    return geometry;
  }

  /**
   * ==========================================
   * Asphalt
   * ==========================================
   */

  private createRoadSurface(): void {
    if (Road.roadMaterial === null) {
      return;
    }

    /**
     * آسفالت کل Road ساخته می‌شود.
     *
     * این سطح شامل محدوده Intersection
     * نیز هست و با سطح Intersection
     * هم‌تراز می‌ماند.
     */
    const road = new THREE.Mesh(this.getRoadGeometry(), Road.roadMaterial);

    road.position.y = Road.ROAD_SURFACE_Y;

    road.name = "RoadSurface";

    road.castShadow = false;
    road.receiveShadow = false;
    road.frustumCulled = true;

    this.group.add(road);
  }

  /**
   * ==========================================
   * Sidewalk Geometry
   * ==========================================
   *
   * Geometry مشترک برای Segment پیاده‌رو.
   */

  private getSidewalkGeometry(segmentLength: number): THREE.BoxGeometry {
    const key =
      `${Road.SIDEWALK_WIDTH}_` +
      `${Road.SIDEWALK_HEIGHT}_` +
      `${segmentLength}`;

    const cached = Road.sidewalkGeometryCache.get(key);

    if (cached) {
      return cached;
    }

    const geometry = new THREE.BoxGeometry(
      Road.SIDEWALK_WIDTH,
      Road.SIDEWALK_HEIGHT,
      segmentLength,
    );

    Road.sidewalkGeometryCache.set(key, geometry);

    return geometry;
  }

  /**
   * ==========================================
   * Sidewalk
   * ==========================================
   *
   * پیاده‌رو در محدوده Intersection
   * ساخته نمی‌شود.
   *
   * برای Road طول 32 و Intersection
   * به اندازه 8:
   *
   * Road:
   *
   * -16 ---------------- +16
   *
   * Intersection:
   *
   *       -4 ---- +4
   *
   * Sidewalk:
   *
   * -16 ---- -4    +4 ---- +16
   *
   * بنابراین مرکز چهارراه کاملاً
   * بدون پیاده‌رو باقی می‌ماند.
   */

  private createSidewalks(): void {
    if (Road.sidewalkMaterial === null) {
      return;
    }

    /**
     * نصف طول Road.
     */
    const halfRoadLength = this.roadLength / 2;

    /**
     * نصف Intersection.
     */
    const halfIntersection = Road.INTERSECTION_SIZE / 2;

    /**
     * طول Segment پیاده‌رو قبل و بعد
     * از Intersection.
     */
    const sidewalkSegmentLength = halfRoadLength - halfIntersection;

    /**
     * اگر Road کوتاه‌تر از Intersection
     * باشد، پیاده‌رو ساخته نمی‌شود.
     */
    if (sidewalkSegmentLength <= 0) {
      return;
    }

    const geometry = this.getSidewalkGeometry(sidewalkSegmentLength);

    /**
     * موقعیت X پیاده‌روها.
     */
    const sidewalkX = this.roadWidth / 2 + Road.SIDEWALK_WIDTH / 2;

    /**
     * موقعیت Z دو Segment.
     *
     * Segment مثبت:
     *
     * +4 تا +16
     *
     * Segment منفی:
     *
     * -16 تا -4
     */
    const segmentOffset = halfIntersection + sidewalkSegmentLength / 2;

    /**
     * ==========================================================
     * Right Sidewalk - Positive Z
     * ==========================================================
     */

    const rightPositive = new THREE.Mesh(geometry, Road.sidewalkMaterial);

    rightPositive.position.set(
      sidewalkX,
      Road.SIDEWALK_HEIGHT / 2,
      segmentOffset,
    );

    rightPositive.name = "RightSidewalkPositive";

    rightPositive.castShadow = false;
    rightPositive.receiveShadow = false;
    rightPositive.frustumCulled = true;

    this.group.add(rightPositive);

    /**
     * ==========================================================
     * Right Sidewalk - Negative Z
     * ==========================================================
     */

    const rightNegative = new THREE.Mesh(geometry, Road.sidewalkMaterial);

    rightNegative.position.set(
      sidewalkX,
      Road.SIDEWALK_HEIGHT / 2,
      -segmentOffset,
    );

    rightNegative.name = "RightSidewalkNegative";

    rightNegative.castShadow = false;
    rightNegative.receiveShadow = false;
    rightNegative.frustumCulled = true;

    this.group.add(rightNegative);

    /**
     * ==========================================================
     * Left Sidewalk - Positive Z
     * ==========================================================
     */

    const leftPositive = new THREE.Mesh(geometry, Road.sidewalkMaterial);

    leftPositive.position.set(
      -sidewalkX,
      Road.SIDEWALK_HEIGHT / 2,
      segmentOffset,
    );

    leftPositive.name = "LeftSidewalkPositive";

    leftPositive.castShadow = false;
    leftPositive.receiveShadow = false;
    leftPositive.frustumCulled = true;

    this.group.add(leftPositive);

    /**
     * ==========================================================
     * Left Sidewalk - Negative Z
     * ==========================================================
     */

    const leftNegative = new THREE.Mesh(geometry, Road.sidewalkMaterial);

    leftNegative.position.set(
      -sidewalkX,
      Road.SIDEWALK_HEIGHT / 2,
      -segmentOffset,
    );

    leftNegative.name = "LeftSidewalkNegative";

    leftNegative.castShadow = false;
    leftNegative.receiveShadow = false;
    leftNegative.frustumCulled = true;

    this.group.add(leftNegative);
  }

  /**
   * ==========================================
   * Center Line
   * ==========================================
   *
   * خط وسط خیابان.
   *
   * خط‌ها فقط خارج از Intersection
   * ساخته می‌شوند.
   */

  private createRoadMarkings(): void {
    if (Road.markingMaterial === null) {
      return;
    }

    /**
     * طول هر Dash.
     */
    const lineLength = 1.8;

    /**
     * فاصله بین Dashها.
     */
    const gap = 2.0;

    /**
     * نصف Intersection.
     */
    const halfIntersection = Road.INTERSECTION_SIZE / 2;

    /**
     * فاصله ایمنی از Intersection.
     */
    const padding = Road.INTERSECTION_LINE_PADDING;

    /**
     * طول قابل استفاده در هر طرف.
     */
    const usableLength = this.roadLength / 2 - halfIntersection - padding;

    /**
     * تعداد Dashها.
     */
    const count = Math.floor((usableLength + gap) / (lineLength + gap));

    if (count <= 0) {
      return;
    }

    /**
     * دو طرف Intersection.
     */
    const totalInstances = count * 2;

    /**
     * InstancedMesh.
     */
    const lines = new THREE.InstancedMesh(
      Road.centerLineGeometry,
      Road.markingMaterial,
      totalInstances,
    );

    lines.name = "CenterLines";

    lines.castShadow = false;
    lines.receiveShadow = false;
    lines.frustumCulled = true;

    /**
     * Matrix مشترک.
     */
    const matrix = new THREE.Matrix4();

    /**
     * Quaternion خنثی.
     */
    const quaternion = new THREE.Quaternion();

    /**
     * Scale واقعی Geometry.
     */
    const scale = new THREE.Vector3(1, 1, 1);

    let instanceIndex = 0;

    /**
     * ==========================================================
     * Positive Z
     * ==========================================================
     */

    for (let i = 0; i < count; i++) {
      const distance =
        halfIntersection + padding + lineLength / 2 + i * (lineLength + gap);

      const position = new THREE.Vector3(0, Road.CENTER_LINE_Y, distance);

      matrix.compose(position, quaternion, scale);

      lines.setMatrixAt(instanceIndex, matrix);

      instanceIndex++;
    }

    /**
     * ==========================================================
     * Negative Z
     * ==========================================================
     */

    for (let i = 0; i < count; i++) {
      const distance =
        halfIntersection + padding + lineLength / 2 + i * (lineLength + gap);

      const position = new THREE.Vector3(0, Road.CENTER_LINE_Y, -distance);

      matrix.compose(position, quaternion, scale);

      lines.setMatrixAt(instanceIndex, matrix);

      instanceIndex++;
    }

    /**
     * اعلام تغییر Matrixها.
     */
    lines.instanceMatrix.needsUpdate = true;

    /**
     * اضافه کردن خط وسط.
     */
    this.group.add(lines);
  }
}