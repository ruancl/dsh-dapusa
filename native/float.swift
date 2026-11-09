// dsh-dapusa · 小光桌面浮窗（macOS 原生，浮在所有窗口最上层；DSH 最小化后仍显示）
//
// 由 Host 端 desktop-float.js 按需用 `xcrun swiftc -O` 编译后启动：
//   xiaoguang-float --quotes <quotes.json> [--minutes 10] [--parent-pid <pid>]
//
// 独立进程 + NSWindow.Level.floating + 独立 AppKit 窗口，因此不随 DSH 主窗口最小化而隐藏。
// 父进程消失（DSH 退出）后 5 秒内自行退出。

import AppKit
import SwiftUI

enum Palette {
    static let gold = Color(red: 0.87, green: 0.70, blue: 0.40)
    static let goldDeep = Color(red: 0.74, green: 0.55, blue: 0.27)
    static let ink = Color(red: 0.29, green: 0.22, blue: 0.12)
    static let inkSoft = Color(red: 0.45, green: 0.37, blue: 0.24)
    static let cream = Color(red: 1.0, green: 0.985, blue: 0.95)
    static let creamDeep = Color(red: 0.98, green: 0.94, blue: 0.84)
}

struct Quote: Codable {
    let text: String
    let title: String
    let date: String
}

// MARK: - 状态

final class Model: ObservableObject {
    let quotes: [Quote]
    @Published var quote: Quote?
    @Published var bubbleVisible = false
    @Published var panelOpen = false
    @Published var enabled: Bool
    @Published var minutes: Int
    var layoutHandler: (() -> Void)?

    private var lastText = ""
    private var showTimer: Timer?
    private var hideTimer: Timer?

    init(quotes: [Quote], minutes: Int) {
        self.quotes = quotes
        let defaults = UserDefaults.standard
        let savedMinutes = defaults.object(forKey: "xg.minutes") as? Int
        let savedEnabled = defaults.object(forKey: "xg.enabled") as? Bool
        self.minutes = savedMinutes ?? minutes
        self.enabled = savedEnabled ?? true
        if self.minutes <= 0 { self.minutes = 10 }
        schedule()
    }

    func layout() { layoutHandler?() }

    private func schedule() {
        showTimer?.invalidate()
        showTimer = nil
        guard enabled else { return }
        let base = Double(minutes) * 60.0
        let first = 6.0 + Double.random(in: 0...6)
        showTimer = Timer.scheduledTimer(withTimeInterval: first, repeats: false) { [weak self] _ in
            guard let self else { return }
            self.showQuote()
            self.scheduleNext(after: base)
        }
    }

    private func scheduleNext(after base: Double) {
        showTimer?.invalidate()
        let delay = max(45.0, base * Double.random(in: 0.6...1.4))
        showTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            guard let self else { return }
            self.showQuote()
            self.scheduleNext(after: base)
        }
    }

    func showQuote() {
        guard !quotes.isEmpty else { return }
        var candidate = quotes.randomElement()!
        for _ in 0..<6 where candidate.text == lastText {
            candidate = quotes.randomElement()!
        }
        lastText = candidate.text
        quote = candidate
        bubbleVisible = true
        layout()
        hideTimer?.invalidate()
        hideTimer = Timer.scheduledTimer(withTimeInterval: 26, repeats: false) { [weak self] _ in
            self?.bubbleVisible = false
            self?.layout()
        }
    }

    func hideBubble() {
        bubbleVisible = false
        hideTimer?.invalidate()
        layout()
    }

    func setInterval(_ value: Int) {
        minutes = max(value, 0)
        enabled = value > 0
        let defaults = UserDefaults.standard
        defaults.set(minutes, forKey: "xg.minutes")
        defaults.set(enabled, forKey: "xg.enabled")
        schedule()
        layout()
    }

    func togglePanel() {
        panelOpen.toggle()
        if quote == nil { showQuote() }
        layout()
    }

    func closePanel() {
        panelOpen = false
        layout()
    }
}

// MARK: - 小光形象：灵性（光晕/光轮/莲花/合掌）· 光明（光束/辉光/光点）· 智慧（眉间觉知光/安住神情）

struct XiaoGuangFigure: View {
    var size: CGFloat = 84

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1.0 / 24.0)) { timeline in
            Canvas { context, canvasSize in
                var ctx = context
                let scale = canvasSize.width / 64
                ctx.scaleBy(x: scale, y: scale)
                draw(&ctx, timeline.date.timeIntervalSinceReferenceDate)
            }
        }
        .frame(width: size, height: size)
    }

    // MARK: 画小光

    private func draw(_ ctx: inout GraphicsContext, _ time: Double) {
        let gold = Palette.gold
        let goldDeep = Palette.goldDeep

        // 呼吸光晕
        let breathe = 0.72 + 0.28 * (0.5 + 0.5 * sin(time * 1.4))
        ctx.fill(Path(ellipseIn: CGRect(x: 2, y: 3, width: 60, height: 60)),
                 with: .radialGradient(
                    Gradient(colors: [gold.opacity(0.42 * breathe), gold.opacity(0.13 * breathe), gold.opacity(0)]),
                    center: CGPoint(x: 32, y: 33), startRadius: 1, endRadius: 30))

        // 飞旋的光轨
        var orbit = ctx
        rotate(&orbit, around: CGPoint(x: 32, y: 29.5), degrees: time * 22.5)
        orbit.stroke(Path(ellipseIn: CGRect(x: 13.5, y: 11, width: 37, height: 37)),
                     with: .color(gold.opacity(0.35)),
                     style: StrokeStyle(lineWidth: 0.9, lineCap: .round, dash: [2, 5]))
        drawSpark(&orbit, x: 45.1, y: 14.9, r: 1.6, color: Color(red: 0.99, green: 0.91, blue: 0.68), opacity: 0.95)
        drawSpark(&orbit, x: 17.4, y: 39.4, r: 1.1, color: Color(red: 0.99, green: 0.91, blue: 0.68), opacity: 0.7)

        // 灵活：整体轻轻摇摆
        var figure = ctx
        rotate(&figure, around: CGPoint(x: 32, y: 50), degrees: sin(time * 1.65) * 2.2)

        // 飘起来的尾光
        var tail = Path()
        tail.move(to: CGPoint(x: 40, y: 47))
        tail.addCurve(to: CGPoint(x: 53.5, y: 38.5), control1: CGPoint(x: 47, y: 46.5), control2: CGPoint(x: 51, y: 43.5))
        figure.stroke(tail, with: .color(gold.opacity(0.65)), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
        var tail2 = Path()
        tail2.move(to: CGPoint(x: 39, y: 51))
        tail2.addCurve(to: CGPoint(x: 52, y: 43), control1: CGPoint(x: 46, y: 50.6), control2: CGPoint(x: 50, y: 47.6))
        figure.stroke(tail2, with: .color(gold.opacity(0.4)), style: StrokeStyle(lineWidth: 1.1, lineCap: .round))
        drawSpark(&figure, x: 54.4, y: 37.3, r: 1.5, color: Color(red: 0.97, green: 0.86, blue: 0.58), opacity: 0.9)

        // 光之衣
        var robe = Path()
        robe.move(to: CGPoint(x: 32, y: 36.8))
        robe.addCurve(to: CGPoint(x: 20.9, y: 46.9), control1: CGPoint(x: 25.6, y: 36.8), control2: CGPoint(x: 21.9, y: 41.6))
        robe.addCurve(to: CGPoint(x: 23.7, y: 52.6), control1: CGPoint(x: 20.2, y: 50.6), control2: CGPoint(x: 21.2, y: 52.6))
        robe.addLine(to: CGPoint(x: 40.3, y: 52.6))
        robe.addCurve(to: CGPoint(x: 43.1, y: 46.9), control1: CGPoint(x: 42.8, y: 52.6), control2: CGPoint(x: 43.8, y: 50.5))
        robe.addCurve(to: CGPoint(x: 32, y: 36.8), control1: CGPoint(x: 42.1, y: 41.6), control2: CGPoint(x: 38.4, y: 36.8))
        robe.closeSubpath()
        figure.fill(robe, with: .linearGradient(
            Gradient(colors: [
                Color(red: 1.0, green: 0.99, blue: 0.96),
                Color(red: 1.0, green: 0.92, blue: 0.75),
                Color(red: 0.93, green: 0.76, blue: 0.48),
            ]),
            startPoint: CGPoint(x: 32, y: 37), endPoint: CGPoint(x: 32, y: 53)))
        figure.stroke(robe, with: .color(goldDeep.opacity(0.45)), style: StrokeStyle(lineWidth: 0.8))
        var collar = Path()
        collar.move(to: CGPoint(x: 29.6, y: 37.5))
        collar.addLine(to: CGPoint(x: 32, y: 39.9))
        collar.addLine(to: CGPoint(x: 34.4, y: 37.5))
        figure.stroke(collar, with: .color(goldDeep.opacity(0.4)), style: StrokeStyle(lineWidth: 0.9, lineCap: .round))

        // 轻盈悬浮的底光
        var base = Path()
        base.move(to: CGPoint(x: 19, y: 56.2))
        base.addCurve(to: CGPoint(x: 45, y: 55.8), control1: CGPoint(x: 24, y: 59.6), control2: CGPoint(x: 40, y: 59.6))
        figure.stroke(base, with: .color(gold.opacity(0.55)), style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
        var base2 = Path()
        base2.move(to: CGPoint(x: 24, y: 57.8))
        base2.addCurve(to: CGPoint(x: 40, y: 57.6), control1: CGPoint(x: 29, y: 60.2), control2: CGPoint(x: 35, y: 60.2))
        figure.stroke(base2, with: .color(gold.opacity(0.3)), style: StrokeStyle(lineWidth: 1, lineCap: .round))

        // 好奇的灵光球（聪慧）
        let orbTwinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(time * 2.1))
        figure.fill(Path(ellipseIn: CGRect(x: 13.5, y: 17.7, width: 6.2, height: 6.2)),
                    with: .color(Color(red: 1.0, green: 0.965, blue: 0.85).opacity(0.95 * orbTwinkle)))
        figure.fill(Path(ellipseIn: CGRect(x: 11.2, y: 15.4, width: 10.8, height: 10.8)),
                    with: .color(Color(red: 1.0, green: 0.914, blue: 0.69).opacity(0.22 * orbTwinkle)))
        drawSpark(&figure, x: 22.4, y: 16.7, r: 1.1, color: Color(red: 0.98, green: 0.9, blue: 0.68), opacity: 0.9 * orbTwinkle)

        // 歪着脑袋（灵活）+ 眨眼 + 眼珠跟着鼠标（聪慧；NSEvent.mouseLocation 不需要辅助功能权限）
        let mouse = NSEvent.mouseLocation
        let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let figureCenter = CGPoint(x: screenFrame.maxX - 78, y: screenFrame.minY + 80)
        let gazeX = max(-1.15, min(1.15, (mouse.x - figureCenter.x) / 220))
        let gazeY = max(-0.95, min(0.95, -(mouse.y - figureCenter.y) / 220))

        var head = figure
        rotate(&head, around: CGPoint(x: 32, y: 28), degrees: -5 + sin(time * 0.9) * 2.0)

        let cycle = time.truncatingRemainder(dividingBy: 4.6)
        let openness: CGFloat = (cycle > 4.15 && cycle < 4.38) ? 0.08 : 1.0
        head.drawLayer { layer in
            var eyes = layer
            eyes.translateBy(x: 32, y: 27.7)
            eyes.scaleBy(x: 1, y: openness)
            eyes.translateBy(x: -32, y: -27.7)
            eyes.translateBy(x: gazeX, y: gazeY)
            drawEyes(&eyes)
        }

        // 呆毛（灵活）
        head.drawLayer { layer in
            var wisp = layer
            rotate(&wisp, around: CGPoint(x: 29.6, y: 18.6), degrees: sin(time * 2.2) * 8 - 2)
            var hair = Path()
            hair.move(to: CGPoint(x: 29.2, y: 18.6))
            hair.addCurve(to: CGPoint(x: 33.4, y: 14.1), control1: CGPoint(x: 28.2, y: 15.2), control2: CGPoint(x: 30.4, y: 13.2))
            hair.addCurve(to: CGPoint(x: 33.2, y: 18.4), control1: CGPoint(x: 36.0, y: 14.9), control2: CGPoint(x: 35.4, y: 17.9))
            wisp.stroke(hair, with: .color(Color(red: 0.886, green: 0.71, blue: 0.40)),
                        style: StrokeStyle(lineWidth: 1.7, lineCap: .round))
        }

        // 头
        head.fill(Path(ellipseIn: CGRect(x: 21.7, y: 17.7, width: 20.6, height: 20.6)),
                  with: .radialGradient(
                    Gradient(colors: [
                        Color(red: 1.0, green: 0.998, blue: 0.98),
                        Color(red: 1.0, green: 0.93, blue: 0.76),
                        Color(red: 0.95, green: 0.79, blue: 0.51),
                    ]),
                    center: CGPoint(x: 28.5, y: 23.5), startRadius: 0, endRadius: 17))
        head.stroke(Path(ellipseIn: CGRect(x: 21.7, y: 17.7, width: 20.6, height: 20.6)),
                    with: .color(goldDeep.opacity(0.45)), style: StrokeStyle(lineWidth: 0.8))

        // 眉间觉知光
        let browTwinkle = 0.5 + 0.5 * (0.5 + 0.5 * sin(time * 2.4 + 1.1))
        drawSpark(&head, x: 32, y: 22.2, r: 1.35, color: Color(red: 1.0, green: 0.996, blue: 0.97), opacity: 0.65 + 0.35 * browTwinkle)

        // 聪慧的挑眉
        var browLeft = Path()
        browLeft.move(to: CGPoint(x: 25.5, y: 23.3))
        browLeft.addCurve(to: CGPoint(x: 29.3, y: 22.8), control1: CGPoint(x: 26.7, y: 22.4), control2: CGPoint(x: 28.1, y: 22.3))
        head.stroke(browLeft, with: .color(Palette.inkSoft), style: StrokeStyle(lineWidth: 1.05, lineCap: .round))
        var browRight = Path()
        browRight.move(to: CGPoint(x: 34.7, y: 22.7))
        browRight.addCurve(to: CGPoint(x: 38.5, y: 23.2), control1: CGPoint(x: 35.9, y: 22.2), control2: CGPoint(x: 37.3, y: 22.3))
        head.stroke(browRight, with: .color(Palette.inkSoft), style: StrokeStyle(lineWidth: 1.05, lineCap: .round))

        // 温暖的脸颊
        head.fill(Path(ellipseIn: CGRect(x: 24.55, y: 29.95, width: 2.7, height: 2.7)),
                  with: .color(Color(red: 0.953, green: 0.78, blue: 0.54).opacity(0.35)))
        head.fill(Path(ellipseIn: CGRect(x: 36.75, y: 29.75, width: 2.7, height: 2.7)),
                  with: .color(Color(red: 0.953, green: 0.78, blue: 0.54).opacity(0.35)))

        // 有点调皮的微笑
        var smile = Path()
        smile.move(to: CGPoint(x: 29.7, y: 32.3))
        smile.addCurve(to: CGPoint(x: 34.6, y: 32.6), control1: CGPoint(x: 30.9, y: 33.8), control2: CGPoint(x: 33.3, y: 34.0))
        head.stroke(smile, with: .color(Palette.inkSoft), style: StrokeStyle(lineWidth: 1.2, lineCap: .round))

        // 周围的小光点
        let twinkleA = 0.35 + 0.65 * (0.5 + 0.5 * sin(time * 2.1 + 2.2))
        let twinkleB = 0.3 + 0.7 * (0.5 + 0.5 * sin(time * 2.1 + 4.1))
        drawSpark(&ctx, x: 12.6, y: 36.2, r: 1.1, color: Color(red: 0.98, green: 0.9, blue: 0.68), opacity: 0.7 * twinkleA)
        drawSpark(&ctx, x: 50.2, y: 28.4, r: 1.0, color: Color(red: 0.98, green: 0.9, blue: 0.68), opacity: 0.6 * twinkleB)
    }

    private func drawEyes(_ ctx: inout GraphicsContext) {
        let eye = Color(red: 0.353, green: 0.239, blue: 0.082)
        for (cx, angle) in [(28.1, -5.0), (35.9, 5.0)] {
            ctx.drawLayer { layer in
                var e = layer
                rotate(&e, around: CGPoint(x: cx, y: 27.7), degrees: angle)
                e.fill(Path(ellipseIn: CGRect(x: cx - 2.05, y: 27.7 - 2.5, width: 4.1, height: 5.0)),
                       with: .color(eye))
            }
            ctx.fill(Path(ellipseIn: CGRect(x: cx + 0.15, y: 26.1, width: 1.44, height: 1.44)),
                     with: .color(Color(red: 1.0, green: 0.992, blue: 0.96)))
            ctx.fill(Path(ellipseIn: CGRect(x: cx - 1.1, y: 28.3, width: 0.72, height: 0.72)),
                     with: .color(Color(red: 1.0, green: 0.992, blue: 0.96).opacity(0.85)))
        }
    }

    private func drawSpark(_ ctx: inout GraphicsContext, x: Double, y: Double, r: Double, color: Color, opacity: Double) {
        var star = Path()
        star.move(to: CGPoint(x: x, y: y - r))
        star.addLine(to: CGPoint(x: x + r, y: y))
        star.addLine(to: CGPoint(x: x, y: y + r))
        star.addLine(to: CGPoint(x: x - r, y: y))
        star.closeSubpath()
        ctx.fill(star, with: .color(color.opacity(opacity)))
    }

    private func rotate(_ ctx: inout GraphicsContext, around point: CGPoint, degrees: Double) {
        ctx.translateBy(x: point.x, y: point.y)
        ctx.rotate(by: Angle(degrees: degrees))
        ctx.translateBy(x: -point.x, y: -point.y)
    }
}

// MARK: - 控件

struct PillButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 11.5))
                .foregroundStyle(Palette.inkSoft)
                .padding(.horizontal, 10)
                .padding(.vertical, 3)
                .overlay(
                    Capsule().strokeBorder(Palette.goldDeep.opacity(0.45), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

struct CardBackground: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(LinearGradient(colors: [Palette.cream, Palette.creamDeep],
                                 startPoint: .top, endPoint: .bottom))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Palette.goldDeep.opacity(0.4), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.16), radius: 14, x: 0, y: 8)
    }
}

struct QuoteBubble: View {
    let quote: Quote
    let onNext: () -> Void
    let onHide: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("「\(quote.text)」")
                .font(.system(size: 13))
                .foregroundStyle(Palette.ink)
                .lineSpacing(6)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack {
                Spacer()
                Text("——《\(quote.title)》\(quote.date)")
                    .font(.system(size: 11))
                    .foregroundStyle(Palette.inkSoft)
            }
            .padding(.top, 6)
            HStack(spacing: 8) {
                Spacer()
                PillButton(title: "换一句", action: onNext)
                PillButton(title: "隐藏", action: onHide)
            }
            .padding(.top, 9)
        }
        .padding(EdgeInsets(top: 13, leading: 15, bottom: 11, trailing: 15))
        .frame(width: 340)
        .background(CardBackground())
    }
}

struct SettingsCard: View {
    @ObservedObject var model: Model
    private let options = [0, 3, 5, 10, 20, 30, 60]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("小光 ✨ 桌面浮窗")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Palette.ink)
            Text("灵性 · 光明 · 智慧")
                .font(.system(size: 11))
                .foregroundStyle(Palette.inkSoft)
                .kerning(0.6)
            Text("每隔一段随机时间，念一句短法义。")
                .font(.system(size: 11.5))
                .foregroundStyle(Palette.inkSoft)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 64), spacing: 6)],
                      alignment: .leading, spacing: 6) {
                ForEach(options, id: \.self) { value in
                    let on = value == 0 ? !model.enabled : (model.enabled && model.minutes == value)
                    Button {
                        model.setInterval(value)
                    } label: {
                        Text(value == 0 ? "关闭" : "\(value) 分钟")
                            .font(.system(size: 11.5))
                            .foregroundStyle(Palette.ink)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 3)
                            .background(
                                Capsule().fill(on ? Palette.gold.opacity(0.32) : Color.clear)
                            )
                            .overlay(
                                Capsule().strokeBorder(on ? Palette.goldDeep : Palette.goldDeep.opacity(0.35),
                                                       lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 4)
            HStack(spacing: 8) {
                PillButton(title: "退出桌面小光") {
                    NSApplication.shared.terminate(nil)
                }
                Spacer()
                PillButton(title: "现在念一句") { model.showQuote() }
                PillButton(title: "收起") { model.closePanel() }
            }
            .padding(.top, 4)
            Text("原文逐字取自圣光临在开示，附《篇名》与日期。")
                .font(.system(size: 10.5))
                .foregroundStyle(Palette.inkSoft.opacity(0.9))
                .padding(.top, 1)
        }
        .padding(EdgeInsets(top: 13, leading: 14, bottom: 12, trailing: 14))
        .frame(width: 300)
        .background(CardBackground())
    }
}

struct RootView: View {
    @ObservedObject var model: Model

    var body: some View {
        VStack(alignment: .trailing, spacing: 10) {
            if model.panelOpen {
                SettingsCard(model: model)
            }
            if model.bubbleVisible, let quote = model.quote {
                QuoteBubble(quote: quote,
                            onNext: { model.showQuote() },
                            onHide: { model.hideBubble() })
            }
            Button(action: { model.togglePanel() }) {
                XiaoGuangFigure(size: 84)
            }
            .buttonStyle(.plain)
            .help("小光 · 点一下，听一句法义")
        }
        .padding(14)
        .fixedSize()
    }
}

// MARK: - 持久化设置（DSH 启动自动浮出）与运行状态

final class SettingsStore {
    private let url: URL?
    private(set) var autoStart: Bool = true

    init(url: URL?) {
        self.url = url
        reload()
    }

    /// 重新读设置文件：网页/工具那边改了自动浮出开关，运行中的菜单栏要能跟上
    func reload() {
        guard let url,
              let data = try? Data(contentsOf: url),
              let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }
        if let value = object["autoStart"] as? Bool { autoStart = value }
    }

    func setAutoStart(_ value: Bool) {
        autoStart = value
        save()
    }

    private func save() {
        guard let url else { return }
        let object: [String: Any] = ["autoStart": autoStart]
        guard let data = try? JSONSerialization.data(withJSONObject: object) else { return }
        try? data.write(to: url)
    }
}

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var panel: NSPanel?
    private var host: NSHostingView<RootView>?
    private var model: Model?
    private var settings: SettingsStore?
    private var statusItem: NSStatusItem?
    private var stateURL: URL?
    private var parentPID: Int32 = 0
    private var stateTimer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let args = CommandLine.arguments
        let quotesPath = value(for: "--quotes", in: args)
        let minutes = Int(value(for: "--minutes", in: args) ?? "10") ?? 10
        parentPID = Int32(value(for: "--parent-pid", in: args) ?? "0") ?? 0
        if let path = value(for: "--settings", in: args) {
            settings = SettingsStore(url: URL(fileURLWithPath: path))
        }
        if let path = value(for: "--state", in: args) {
            stateURL = URL(fileURLWithPath: path)
        }

        var quotes: [Quote] = []
        if let path = quotesPath,
           let data = try? Data(contentsOf: URL(fileURLWithPath: path)),
           let list = try? JSONDecoder().decode([Quote].self, from: data) {
            quotes = list
        }
        if quotes.isEmpty {
            quotes = [Quote(text: "光明是纯净的爱，爱之中没有自我维护。", title: "免责", date: "2022年2月21日")]
        }

        let model = Model(quotes: quotes, minutes: minutes)
        let host = NSHostingView(rootView: RootView(model: model))
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 120, height: 120),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        panel.hidesOnDeactivate = false
        panel.becomesKeyOnlyIfNeeded = true
        panel.isReleasedWhenClosed = false
        panel.contentView = host

        self.model = model
        self.host = host
        self.panel = panel
        model.layoutHandler = { [weak self] in self?.resize() }
        resize()
        panel.orderFrontRegardless()

        setupStatusBar()

        if parentPID > 0 {
            Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
                guard let self else { return }
                if kill(self.parentPID, 0) != 0 {
                    NSApp.terminate(nil)
                }
            }
        }
        stateTimer = Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { [weak self] _ in
            self?.writeState()
        }
        writeState()
    }

    // MARK: 菜单栏

    private func setupStatusBar() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = item.button {
            button.image = statusBarIcon()
            button.image?.isTemplate = true
            button.toolTip = "小光 · 桌面浮窗"
        }
        let menu = NSMenu()
        menu.delegate = self
        item.menu = menu
        statusItem = item
    }

    private func statusBarIcon() -> NSImage {
        let size = NSSize(width: 18, height: 18)
        let image = NSImage(size: size)
        image.lockFocus()
        NSColor.black.setFill()
        NSColor.black.setStroke()
        // 光轮
        let halo = NSBezierPath(ovalIn: NSRect(x: 3.4, y: 3.8, width: 11.2, height: 11.2))
        halo.lineWidth = 1
        halo.stroke()
        // 头
        NSBezierPath(ovalIn: NSRect(x: 6.7, y: 7.1, width: 4.6, height: 4.6)).fill()
        // 光之衣
        let body = NSBezierPath()
        body.move(to: NSPoint(x: 9, y: 2.9))
        body.curve(to: NSPoint(x: 5.6, y: 6.2),
                   controlPoint1: NSPoint(x: 7.0, y: 4.2),
                   controlPoint2: NSPoint(x: 6.1, y: 5.1))
        body.curve(to: NSPoint(x: 9, y: 6.9),
                   controlPoint1: NSPoint(x: 7.4, y: 6.7),
                   controlPoint2: NSPoint(x: 8.2, y: 6.9))
        body.curve(to: NSPoint(x: 12.4, y: 6.2),
                   controlPoint1: NSPoint(x: 9.8, y: 6.9),
                   controlPoint2: NSPoint(x: 10.6, y: 6.7))
        body.curve(to: NSPoint(x: 9, y: 2.9),
                   controlPoint1: NSPoint(x: 11.9, y: 5.1),
                   controlPoint2: NSPoint(x: 11.0, y: 4.2))
        body.close()
        body.fill()
        // 光点
        NSBezierPath(ovalIn: NSRect(x: 13.2, y: 12.0, width: 1.8, height: 1.8)).fill()
        image.unlockFocus()
        image.isTemplate = true
        return image
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        settings?.reload()
        menu.removeAllItems()

        let title = NSMenuItem(title: "小光 · 桌面浮窗", action: nil, keyEquivalent: "")
        title.isEnabled = false
        menu.addItem(title)
        menu.addItem(.separator())

        let read = NSMenuItem(title: "念一句法义", action: #selector(actionRead), keyEquivalent: "r")
        read.target = self
        menu.addItem(read)

        let visible = panel?.isVisible ?? false
        let toggle = NSMenuItem(title: visible ? "收起小光" : "显示小光", action: #selector(actionToggleWindow), keyEquivalent: "")
        toggle.target = self
        menu.addItem(toggle)

        let interval = NSMenuItem(title: "随机间隔", action: nil, keyEquivalent: "")
        let submenu = NSMenu()
        let model = self.model
        for value in [0, 3, 5, 10, 20, 30, 60] {
            let item = NSMenuItem(title: value == 0 ? "关闭" : "\(value) 分钟",
                                  action: #selector(actionInterval(_:)), keyEquivalent: "")
            item.target = self
            item.tag = value
            let enabled = model?.enabled ?? true
            let current = model?.minutes ?? 10
            item.state = (value == 0 ? !enabled : (enabled && current == value)) ? .on : .off
            submenu.addItem(item)
        }
        interval.submenu = submenu
        menu.addItem(interval)

        let auto = NSMenuItem(title: "DSH 启动时自动浮出", action: #selector(actionToggleAutoStart), keyEquivalent: "")
        auto.target = self
        auto.state = (settings?.autoStart ?? true) ? .on : .off
        menu.addItem(auto)

        menu.addItem(.separator())
        let quit = NSMenuItem(title: "退出小光", action: #selector(actionQuit), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)
    }

    @objc private func actionRead() {
        if panel?.isVisible == false {
            panel?.orderFrontRegardless()
        }
        model?.showQuote()
        writeState()
    }

    @objc private func actionToggleWindow() {
        guard let panel else { return }
        if panel.isVisible {
            panel.orderOut(nil)
        } else {
            panel.orderFrontRegardless()
        }
        writeState()
    }

    @objc private func actionInterval(_ sender: NSMenuItem) {
        model?.setInterval(sender.tag)
        writeState()
    }

    @objc private func actionToggleAutoStart() {
        settings?.setAutoStart(!(settings?.autoStart ?? true))
        writeState()
    }

    @objc private func actionQuit() {
        NSApp.terminate(nil)
    }

    private func writeState() {
        guard let stateURL else { return }
        settings?.reload()
        let state: [String: Any] = [
            "pid": Int(ProcessInfo.processInfo.processIdentifier),
            "menuBar": statusItem != nil,
            "windowVisible": panel?.isVisible ?? false,
            "autoStart": settings?.autoStart ?? true,
            "enabled": model?.enabled ?? true,
            "minutes": model?.minutes ?? 10,
            "quoteCount": model?.quotes.count ?? 0,
        ]
        if let data = try? JSONSerialization.data(withJSONObject: state) {
            try? data.write(to: stateURL)
        }
    }

    private func value(for flag: String, in args: [String]) -> String? {
        guard let index = args.firstIndex(of: flag), index + 1 < args.count else { return nil }
        return args[index + 1]
    }

    private func resize() {
        DispatchQueue.main.async { [weak self] in
            guard let self, let panel = self.panel, let host = self.host else { return }
            host.layoutSubtreeIfNeeded()
            let size = host.fittingSize
            guard size.width > 1, size.height > 1 else { return }
            let screen = panel.screen ?? NSScreen.main ?? NSScreen.screens.first
            let visible = screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
            let origin = NSPoint(x: visible.maxX - size.width - 22, y: visible.minY + 24)
            panel.setFrame(NSRect(origin: origin, size: size), display: true)
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let appDelegate = AppDelegate()
app.delegate = appDelegate
app.run()
