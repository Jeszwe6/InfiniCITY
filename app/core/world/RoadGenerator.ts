import { Road } from "./Road";

/**
 * ==========================================
 * Road Direction
 * ==========================================
 *
 * جهت قرارگیری Road در World.
 *
 * vertical:
 *   امتداد اصلی روی محور Z
 *
 * horizontal:
 *   امتداد اصلی روی محور X
 */
export type RoadDirection = "horizontal" | "vertical";

/**
 * ==========================================
 * RoadGenerator
 * ==========================================
 *
 * مسئول ساخت Road های استاندارد شهر است.
 *
 * خروجی متدهای این کلاس خود Road است،
 * نه THREE.Group.
 *
 * برای اضافه کردن Road به Scene باید از:
 *
 *     road.group
 *
 * استفاده شود.
 */
export class RoadGenerator {
  /**
   * ==========================================
   * Create Road
   * ==========================================
   *
   * یک Road جدید با طول مشخص ایجاد می‌کند.
   *
   * Road در حالت پایه روی محور Z ساخته می‌شود.
   */
  public createRoad(
    direction: RoadDirection = "vertical",
    length: number = Road.LENGTH,
  ): Road {
    /**
     * ساخت خود Road.
     */
    const road = new Road(Road.WIDTH, length);

    /**
     * ------------------------------------------
     * Horizontal Rotation
     * ------------------------------------------
     *
     * Road پایه در امتداد +Z است.
     *
     * با چرخش 90 درجه حول محور Y:
     *
     * +Z → +X
     *
     * تبدیل به Road افقی می‌شود.
     */
    if (direction === "horizontal") {
      road.group.rotation.y = Math.PI / 2;
    }

    /**
     * ------------------------------------------
     * Road Metadata
     * ------------------------------------------
     *
     * این Metadata برای سیستم‌هایی مثل:
     *
     * - World
     * - CarManager
     * - Raycaster
     * - Debugging
     *
     * قابل استفاده است.
     *
     * Road خودش نیز isRoad و road را در
     * constructor ثبت می‌کند، بنابراین اینجا
     * فقط مقدار direction را اضافه می‌کنیم.
     */
    road.group.userData.isRoad = true;
    road.group.userData.road = road;
    road.group.userData.direction = direction;

    /**
     * ------------------------------------------
     * Debug Name
     * ------------------------------------------
     */
    road.group.name =
      direction === "horizontal" ? "Road_Horizontal" : "Road_Vertical";

    return road;
  }

  /**
   * ==========================================
   * Create Horizontal Road
   * ==========================================
   *
   * یک Road افقی ایجاد می‌کند.
   */
  public createHorizontalRoad(length: number = Road.LENGTH): Road {
    return this.createRoad("horizontal", length);
  }

  /**
   * ==========================================
   * Create Vertical Road
   * ==========================================
   *
   * یک Road عمودی ایجاد می‌کند.
   */
  public createVerticalRoad(length: number = Road.LENGTH): Road {
    return this.createRoad("vertical", length);
  }
}
