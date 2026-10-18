export function ResourceArtwork({ kind }: { kind: string }) {
  return (
    <div
      className={`resource-art art-${kind === "gallery" ? "gallery-cover" : kind}`}
      aria-hidden
    >
      {kind === "portfolio" ? (
        <>
          <div className="art-site-nav">
            <b>STILL / 光影</b>
            <span>作品　 关于　 预约 ↗</span>
          </div>
          <div className="portfolio-copy">
            <small>IN THE MOMENT</small>
            <strong>
              定格片刻。
              <br />
              让故事发生。
            </strong>
            <span>用光影，记录真实的你。</span>
            <i>探索作品 ↗</i>
          </div>
          <div className="art-landscape">
            <i />
            <b />
            <span />
          </div>
        </>
      ) : null}
      {kind === "calendar" ? (
        <>
          <div className="art-side">
            ◈<br />
            <br />▦<br />
            <br />▤<br />
            <br />◷
          </div>
          <div className="art-board">
            <div className="art-site-nav">
              <b>内容工作台</b>
              <span>＋ 新建内容</span>
            </div>
            <h3>把灵感，变成计划。</h3>
            <div className="art-kanban">
              {["灵感 · 3", "创作中 · 2", "已发布 · 2"].map((s, i) => (
                <div key={s}>
                  <small>{s}</small>
                  <p>
                    <i />
                    {["记录一个好故事", "本周产品灵感", "关于春天的提案"][i]}
                    <em>设计　·　内容</em>
                  </p>
                  <p>
                    <i />
                    {["新品发布计划", "一点创作日常", "品牌视觉记录"][i]}
                    <em>12 OCT　↗</em>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
      {kind === "analytics" ? (
        <>
          <div className="art-site-nav">
            <b>◒ INSIGHT</b>
            <span>概览　订单　客户</span>
          </div>
          <div className="art-metrics">
            <div>
              <small>本月销售额</small>
              <strong>¥ 128,430</strong>
              <em>↗ 18.6%</em>
            </div>
            <div>
              <small>新增订单</small>
              <strong>286</strong>
              <em>↗ 12.4%</em>
            </div>
          </div>
          <div className="art-chart">
            <span>销售趋势</span>
            <svg viewBox="0 0 400 100">
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#8468f8" stopOpacity=".4" />
                  <stop offset="1" stopColor="#8468f8" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 80 Q25 90 50 64 T100 68 T150 40 T200 56 T250 32 T300 38 T350 14 T400 5 V100 H0Z"
                fill="url(#chart-fill)"
              />
              <path
                d="M0 80 Q25 90 50 64 T100 68 T150 40 T200 56 T250 32 T300 38 T350 14 T400 5"
                fill="none"
                stroke="#a791ff"
                strokeWidth="3"
              />
            </svg>
            <small>周一　　 周二　　 周三　　 周四　　 周五</small>
          </div>
        </>
      ) : null}
      {kind === "habits" ? (
        <>
          <div className="art-site-nav">
            <b>日积</b>
            <span>今天，又进步一点。</span>
          </div>
          <div className="habit-banner">
            <strong>
              小小的坚持，
              <br />
              大大的改变。
            </strong>
            <span>
              75<small>%</small>
            </span>
          </div>
          <div className="habit-rows">
            {["晨间阅读", "喝足 8 杯水", "出门走一走"].map((s, i) => (
              <p key={s}>
                <span>{s}</span>
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                  <i key={n} className={n < 5 - i ? "checked" : ""}>
                    {n < 5 - i ? "✓" : ""}
                  </i>
                ))}
              </p>
            ))}
          </div>
        </>
      ) : null}
      {kind === "gallery" ? (
        <>
          <div className="art-site-nav">
            <b>✳ 拾光</b>
            <span>我的画廊　 12 件作品</span>
          </div>
          <div className="art-gallery">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`art-painting painting-${i}`}>
                <i />
                <b />
                <span />
              </div>
            ))}
          </div>
        </>
      ) : null}
      {kind === "focus" ? (
        <>
          <div className="art-site-nav">
            <b>◷ 此刻</b>
            <span>专注于眼前的美好</span>
          </div>
          <div className="art-timer">
            <small>是时候，专心做一件事</small>
            <strong>25:00</strong>
            <span>开始专注 ↗</span>
          </div>
          <div className="art-tasks">
            <span>○　整理今天的灵感</span>
            <span>✓　给自己一段安静的时间</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
