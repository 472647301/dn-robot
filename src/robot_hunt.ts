import fs from 'fs'
import dm from 'dm.dll'
import path from 'path'
import moment from "moment";
import { OptionsT, KeyStr } from './typings/props'
import { app } from 'electron'

const { execFile } = require('child_process')

export class RobotHunt {
  public logFileName = ''
  public red = '255,52,0'
  public blue = '255,255,255'
  public portrait = '255,255,255'
  public options: Partial<OptionsT> = {};
  public success = 0 // 蓝方次数
  public failure = 0 // 红方次数
  public unknown = 0 // 未知方
  public successTimer: NodeJS.Timeout | null = null
  public failureTimer: NodeJS.Timeout | null = null
  public startTimer: NodeJS.Timeout | null = null
  public send?: (channel: string, ...args: any[]) => void;
  public runState = false;

  /**
   * 开始
   */
  public start(options?: OptionsT) {
    if (options) {
      this.options = options
    }
    if (this.send) {
      this.send("hunt-start");
    }
    this.runState = true
    this.debug(`狩猎大战机器人开始工作`);
    if (!this.isHuntTime()) {
      this.debug('当前不是黑暗城堡大战期间')
      this.stop()
      return
    }
    const hWnd = dm.findWindow('DRAGONNEST', '龙之谷')
    if (!hWnd) {
      this.debug(`窗口获取失败,请确认是否已启动龙之谷？`);
      return
    }
    dm.bindWindow(hWnd, 'dx', 'windows', 'windows', 0)
    this.fetchLogFile()
    this.extractionColor().then(color => {
      if (color) {
        this.portrait = color
      }
      this.startTimerEvent(true)
    })
  }

  /**
   * 结束
   */
  public stop() {
    if (this.successTimer) {
      clearInterval(this.successTimer)
      this.successTimer = null
    }
    if (this.failureTimer) {
      clearInterval(this.failureTimer)
      this.failureTimer = null
    }
    if (this.startTimer) {
      clearInterval(this.startTimer)
      this.startTimer = null
    }
    if (this.send) {
      this.send("hunt-stop");
    }
    this.runState = false
    this.debug(`狩猎大战机器人已停止工作`);
    this.debug(`共${this.success}次蓝方,${this.failure}次红方,${this.unknown}次未知`)
  }

  public fetchLogFile() {
    const { DN_INSTALL_DIR } = this.options
    if (!DN_INSTALL_DIR) {
      this.debug('缺少龙之谷安装目录参数')
      this.stop()
      return
    }
    this.debug('开始获取日志文件')
    if (!fs.existsSync(DN_INSTALL_DIR)) {
      this.debug(`打开客户端目录[${DN_INSTALL_DIR}]失败`);
      this.stop()
      return
    }
    const keys: KeyStr = {}
    const logDir = `${DN_INSTALL_DIR}/DragonNest/Log`
    const logName = 'DragonNestOutLog_'
    const files = fs.readdirSync(logDir)
    for (let file of files) {
      const logs = path.join(`${logDir}`, file)
      const stat = fs.statSync(logs)
      if (stat.isDirectory()) {
        continue
      }
      let name = file.split('.')[0]
      if (name.indexOf(logName) === -1) {
        continue
      }
      name = name.replace(logName, '')
      name = name.replace(`-`, '')
      name = name.replace(`_`, '')
      keys[name] = file
    }
    const list = Object.keys(keys)
    list.sort((a, b) => Number(a) - Number(b))
    const index = list[list.length - 1]
    if (!keys[index]) {
      this.debug('获取日志文件失败')
      this.stop()
      return
    }
    this.logFileName = `${logDir}/${keys[index]}`
    this.debug(`成功获取日志[${keys[index]}]文件`)
    fs.open(this.logFileName, 'a+', (err, fd) => {
      if (err) {
        this.debug(`读取日志文件失败[${err.message}]`)
        this.stop()
        return
      }
      this.watchLogFile(err, fd)
    });
  }

  public watchLogFile(err: NodeJS.ErrnoException | null, fd: number) {
    this.debug(`开始监听日志文件`)
    fs.watchFile(this.logFileName, {
      persistent: true,
      interval: 1000
    }, (curr, prev) => {
      if (curr.mtime > prev.mtime) {
        const buffer = Buffer.alloc(curr.size - prev.size);
        this.readLogFile(fd, buffer, (curr.size - prev.size), prev.size);
      }
    });
  }

  public readLogFile(fd: number, buffer: Buffer, length: number, position: number) {
    this.debug(`开始解析新增日志内容`)
    fs.read(fd, buffer, 0, length, position, (err, bytesRead, buffer) => {
      if (err) {
        this.debug(`解析新增日志内容失败[${err.message}]`)
        this.stop()
        return
      }
      this.analyzeLogs(buffer.toString())
    });
  }

  public analyzeLogs(text: string) {
    // 角色准备返回村庄
    if (text.indexOf('GameToVillage') !== -1) {
      if (this.successTimer) {
        clearInterval(this.successTimer)
        this.successTimer = null
      }
      if (this.failureTimer) {
        clearInterval(this.failureTimer)
        this.failureTimer = null
      }
    }
    // 角色进入村庄 但ui界面暂未显示
    if (text.indexOf('Village Loading End') !== -1) {
      this.readyStartHunt()
    }
    if (text.indexOf('VillageToGame') !== -1) {
      if (this.startTimer) {
        clearInterval(this.startTimer)
        this.startTimer = null
      }
    }
    // 狩猎大战匹配成功 但未进入狩猎地图
    if (text.indexOf('PvP_HuntingMode InitializeStage End') !== -1) {
      if (this.startTimer) {
        clearInterval(this.startTimer)
        this.startTimer = null
      }
    }
    // 狩猎大战加载结束 但ui界面暂未显示
    if (text.indexOf('Game Loading End') !== -1) {
      this.huntingProgress()
    }
  }

  public isHuntTime() {
    const now = Number(moment().format('HHmm'))
    return now >= 1400 && now < 1601 || now >= 2100 && now < 2301
  }

  public async readyStartHunt() {
    if (!this.isHuntTime()) {
      this.debug('当前不是黑暗城堡大战期间')
      this.stop()
      return
    }
    await this.delay(3000)
    await this.extractionForEact()
    await this.delay(3000)
    this.startTimer = setInterval(() => {
      this.startTimerEvent()
    }, 3000)
  }

  public async startTimerEvent(bool = false) {
    if (!this.startTimer && !bool) {
      return
    }
    // 按下enter按键
    dm.keyPress(13)
    await this.delay(300)
    const { JJC_ICON_LOCATION, HUNT_MATCH_LOCATION, HUNT_START_LOCATION } = this.options
    if (!JJC_ICON_LOCATION || !HUNT_MATCH_LOCATION || !HUNT_START_LOCATION) {
      dm.keyPress(13)
      return
    }
    // 鼠标移动到竞技场图标坐标
    dm.moveTo(JJC_ICON_LOCATION.x, JJC_ICON_LOCATION.y)
    dm.leftClick()
    await this.delay(300)
    // 鼠标移动到狩猎大战匹配坐标
    dm.moveTo(HUNT_MATCH_LOCATION.x, HUNT_MATCH_LOCATION.y)
    dm.leftClick()
    await this.delay(300)
    // 鼠标移动到狩猎大战开始坐标
    dm.moveTo(HUNT_START_LOCATION.x, HUNT_START_LOCATION.y)
    dm.leftClick()
    dm.keyPress(13)
  }

  public async huntingProgress() {
    if (!this.isHuntTime()) {
      this.debug('当前不是黑暗城堡大战期间')
      this.stop()
      return
    }
    await this.delay(10000)
    let color = await this.extractionForEact()
    if (color === this.blue) {
      this.success++
    } else if (color === this.red) {
      this.failure++
    } else {
      this.unknown++
    }
    const num = this.success + this.failure + this.unknown
    const result = color === this.blue ? '蓝' : color === this.red ? '红' : '未知'
    this.debug(`第${num}次大战模式进行中,匹配到${result}队`)
    if (color === this.blue) {
      this.successTimer = setInterval(() => {
        this.successEvent()
      }, 5000)
    } else {
      this.failureTimer = setInterval(() => {
        this.failureEvent()
      }, 5000)
    }
  }

  public async successEvent() {
    const { HUNT_STOP_LOCATION } = this.options
    if (!HUNT_STOP_LOCATION) {
      return
    }
    if (!this.successTimer) {
      return
    }
    await this.delay(500)
    // 按下enter按键
    dm.keyPress(13)
    await this.delay(500)
    // 点击狩猎大战结束坐标
    dm.moveTo(HUNT_STOP_LOCATION.x, HUNT_STOP_LOCATION.y)
    dm.leftClick()
    dm.keyPress(13)
  }

  public async failureEvent() {
    const { HUNT_STOP_LOCATION, HUNT_SURRENDDER_LOCATION } = this.options
    if (!HUNT_STOP_LOCATION) {
      return
    }
    if (!HUNT_SURRENDDER_LOCATION) {
      return
    }
    if (!this.failureTimer) {
      return
    }
    await this.delay(200)
    // 按下enter按键
    dm.keyPress(13)
    await this.delay(300)
    // 按下esc按键
    // dm.keyPress(27)
    // 点击狩猎大战投降坐标
    dm.moveTo(HUNT_SURRENDDER_LOCATION.x, HUNT_SURRENDDER_LOCATION.y)
    dm.leftClick()
    await this.delay(500)
    // 点击狩猎大战结束坐标
    dm.moveTo(HUNT_STOP_LOCATION.x, HUNT_STOP_LOCATION.y)
    dm.leftClick()
    dm.keyPress(13)
  }

  public async extractionForEact(n: number = 10): Promise<string> {
    let color = await this.extractionColor()
    for (let i = 1; i < n; i++) {
      if ([this.blue, this.red, this.portrait].includes(color)) {
        break
      }
      color = await this.extractionColor()
    }
    return color
  }

  /**
   * 通过提取屏幕固定位置颜色判断是否到达村庄
   * 通过提取屏幕固定位置颜色判断本次大战是蓝方还是红方
   */
  public async extractionColor(): Promise<string> {
    const { CHARACTER_HEAD_COORDINATE } = this.options
    if (!CHARACTER_HEAD_COORDINATE || !CHARACTER_HEAD_COORDINATE.x || !CHARACTER_HEAD_COORDINATE.y) {
      this.debug(`提取屏幕固定位置颜色失败[缺少坐标参数]`);
      return ''
    }
    await this.delay(3000)
    return new Promise(resolve => {
      const now = Date.now();
      const dir = app.getPath('home')
      const image = path.join(dir, `screenshots/${now}.png`)
      const args = [now, CHARACTER_HEAD_COORDINATE.x, CHARACTER_HEAD_COORDINATE.y]
      const exePath = app.getPath('exe').replace('Hunts.exe', '')
      execFile(path.join(exePath, 'resources/byron.exe'), args, (error: Error, stdout: string) => {
        if (error) {
          this.debug(path.join(app.getPath('exe'), './byron.exe'))
          this.debug(`提取屏幕固定位置颜色失败[${error.message}]`);
          resolve('')
          return
        }
        fs.unlinkSync(image)
        this.debug(`提取屏幕固定位置颜色成功[${stdout.trim()}]`);
        resolve(stdout.trim())
      })
    })
  }

  public debug(logs: string) {
    const m = moment();
    const now = m.format("YYYY-MM-DD HH:mm:ss");
    const text = `${now} >> ${logs}`;
    if (this.send) {
      this.send("hunt-logs", text);
    }
  }

  public delay(n: number) {
    // this.debug(`延迟等待${n}ms`)
    return new Promise(resolve => {
      setTimeout(resolve, n)
    })
  }

  public fetchLocation() {
    return dm.getCursorPos()
  }
}

// const n = dm.dll.GetMousePointWindow()
// dm.bindWindow(n, 'dx', 'windows', 'windows', 0)
// console.log(dm.getCursorPos())
// className DRAGONNEST
// title 龙之谷