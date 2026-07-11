import { useEffect, useRef, useState } from 'react'

const features = [
  { icon: '✦', title: '清晰协作', text: '把目标、进度和反馈放在同一个空间，团队始终步调一致。' },
  { icon: '↗', title: '快速交付', text: '用轻量工作流减少等待，让好想法更快抵达真实用户。' },
  { icon: '◎', title: '洞察全局', text: '关键数据自动汇总，每个决策都更及时、更有依据。' },
]

function Modal({ onClose }: { onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButton.current?.focus()
    const handleKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button ref={closeButton} className="modal-close" onClick={onClose} aria-label="关闭弹窗">×</button>
        <div className="modal-icon">👋</div>
        <p className="eyebrow">WELCOME ABOARD</p>
        <h2 id="modal-title">准备好，让想法起飞了吗？</h2>
        <p>这是一个 React + TypeScript 6 + Vite 构建的交互弹窗。你的下一次出色发布，可以从这里开始。</p>
        <button className="button primary modal-action" onClick={onClose}>好的，出发</button>
      </section>
    </div>
  )
}

export default function App() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="page-shell">
      <header className="nav container">
        <a className="brand" href="#top" aria-label="LaunchPilot 首页">
          <span className="brand-mark">L</span> LaunchPilot
        </a>
        <nav aria-label="主导航">
          <a href="#features">产品能力</a>
          <a href="#about">关于我们</a>
        </nav>
        <button className="button nav-button" onClick={() => setIsOpen(true)}>预约体验</button>
      </header>

      <main id="top">
        <section className="hero container">
          <div className="hero-copy">
            <div className="pill"><span>●</span> 专为高效团队打造</div>
            <h1>让每一次发布<br /><em>都值得期待。</em></h1>
            <p className="hero-text">LaunchPilot 将计划、协作与洞察汇聚一处，帮助现代团队把大胆想法，变成真正被用户喜爱的产品。</p>
            <div className="hero-actions">
              <button className="button primary" onClick={() => setIsOpen(true)}>查看产品演示 <span>→</span></button>
              <a className="text-link" href="#features">探索产品能力 <span>↓</span></a>
            </div>
            <div className="social-proof">
              <div className="avatars"><span>苏</span><span>林</span><span>陈</span><span>周</span></div>
              <p><strong>2,000+ 创新团队</strong><br />正在使用 LaunchPilot</p>
            </div>
          </div>

          <div className="hero-visual" aria-label="产品数据面板示意图">
            <div className="glow glow-one" /><div className="glow glow-two" />
            <div className="dashboard">
              <div className="dash-top"><span><i /> Launch overview</span><b>•••</b></div>
              <p className="dash-label">本月发布进度</p>
              <div className="score-row"><strong>84%</strong><span>↗ 12.4%</span></div>
              <div className="chart">
                {[35, 54, 46, 70, 62, 88, 78, 98].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
              </div>
              <div className="dash-grid">
                <div><span>进行中的任务</span><strong>24</strong><small>8 项即将完成</small></div>
                <div><span>团队协作效率</span><strong>+36%</strong><small>较上个月提升</small></div>
              </div>
            </div>
            <div className="floating-card status-card"><span className="check">✓</span><div><small>里程碑已完成</small><strong>Beta 正式发布</strong></div></div>
            <div className="floating-card people-card"><small>团队在线</small><div className="avatars"><span>杨</span><span>方</span><span>吴</span><b>+8</b></div></div>
          </div>
        </section>

        <section className="features" id="features">
          <div className="container">
            <p className="eyebrow">WHY LAUNCHPILOT</p>
            <h2>复杂留给我们，专注留给你。</h2>
            <div className="feature-grid">
              {features.map((feature) => <article key={feature.title}><span className="feature-icon">{feature.icon}</span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}
            </div>
          </div>
        </section>

        <section className="cta container" id="about">
          <p className="eyebrow">START TODAY</p>
          <h2>下一次精彩发布，从现在开始。</h2>
          <button className="button primary" onClick={() => setIsOpen(true)}>免费预约体验 →</button>
        </section>
      </main>

      <footer className="container"><a className="brand" href="#top"><span className="brand-mark">L</span> LaunchPilot</a><p>© 2026 LaunchPilot. 用心打造每一次发布。</p></footer>
      {isOpen && <Modal onClose={() => setIsOpen(false)} />}
    </div>
  )
}
