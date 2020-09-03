type LocationT = { x: number; y: number };

export type OptionsT = {
  /**
   * 龙之谷安装目录
   */
  DN_INSTALL_DIR: string;
  /**
   * 竞技场图标坐标
   */
  JJC_ICON_LOCATION: LocationT;
  /**
   * 狩猎大战匹配坐标
   */
  HUNT_MATCH_LOCATION: LocationT;
  /**
   * 狩猎大战开始坐标
   */
  HUNT_START_LOCATION: LocationT;
  /**
   * 狩猎大战投降坐标
   */
  HUNT_SURRENDDER_LOCATION: LocationT;
  /**
   * 狩猎大战结束坐标
   */
  HUNT_STOP_LOCATION: LocationT;
  /**
   * 按Esc之后显示的投降坐标
   */
  ESC_SURRENDDER_LOCATION?: LocationT;
  /**
   * 角色头像中心坐标
   */
  CHARACTER_HEAD_COORDINATE: LocationT;
  /**
   * 掉线通知QQ
   */
  DROP_NOTICE_QQ?: string;
  /**
   * 其它
   */
  OTHER?: string;
};

export type ItemT = keyof Omit<OptionsT, "DROP_NOTICE_QQ" | "OTHER" | "ESC_SURRENDDER_LOCATION">;

export type KeyStr = { [key: string]: string }