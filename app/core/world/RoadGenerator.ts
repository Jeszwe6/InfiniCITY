import * as THREE from 'three'

import { Road } from './Road'

/**
 * ==========================================
 * RoadGenerator
 * ==========================================
 *
 * مسئول ساخت خیابان‌های شهر است.
 *
 * جهت‌ها:
 *
 * horizontal
 * → خیابان در امتداد محور X
 *
 * vertical
 * → خیابان در امتداد محور Z
 *
 * نکته:
 * Road به صورت پیش‌فرض در امتداد Z ساخته می‌شود،
 * بنابراین برای horizontal آن را 90 درجه می‌چرخانیم.
 * ==========================================
 */

export type RoadDirection =
  | 'horizontal'
  | 'vertical'

export class RoadGenerator {
  /**
   * ساخت خیابان
   *
   * @param direction جهت خیابان
   * @param length طول خیابان
   */
  public createRoad(
    direction: RoadDirection = 'vertical',
    length: number = Road.LENGTH
  ): THREE.Group {
    const road = new Road(
      Road.WIDTH,
      length
    )

    /**
     * Road به صورت پیش‌فرض روی محور Z است.
     *
     * برای تبدیل آن به خیابان افقی،
     * حول محور Y به اندازه 90 درجه می‌چرخانیم.
     */
    if (direction === 'horizontal') {
      road.group.rotation.y = Math.PI / 2
    }

    return road.group
  }

  /**
   * ساخت خیابان افقی
   */
  public createHorizontalRoad(
    length: number
  ): THREE.Group {
    return this.createRoad(
      'horizontal',
      length
    )
  }

  /**
   * ساخت خیابان عمودی
   */
  public createVerticalRoad(
    length: number
  ): THREE.Group {
    return this.createRoad(
      'vertical',
      length
    )
  }
}