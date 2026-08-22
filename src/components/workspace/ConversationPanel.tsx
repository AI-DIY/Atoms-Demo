"use client";

import { ArrowUp, MoreHorizontal, ShieldCheck, Sparkles } from "lucide-react";

const events = [
  {
    name: "团队负责人",
    time: "刚刚",
    color: "#a6e07a",
    text: "已根据目标安排产品、架构与工程三个阶段，并在工程实现前保留审批点。",
  },
  {
    name: "产品经理",
    time: "等待中",
    color: "#ffb095",
    text: "批准后将整理核心用户、预约流程与可验证的交互验收条件。",
  },
  {
    name: "架构师",
    time: "等待中",
    color: "#c6adff",
    text: "批准后将限定单文件实现边界，确保预览可安全运行。",
  },
  {
    name: "工程师",
    time: "等待中",
    color: "#77d9d0",
    text: "将基于确认后的需求生成无需外部依赖的网页应用。",
  },
];

export function ConversationPanel() {
  return (
    <div className="conversation">
      <header className="conversation-header">
        <div>
          <p className="eyebrow">当前工作区</p>
          <h2 className="conversation-title">从目标到可运行应用</h2>
        </div>
        <button className="small-button" title="更多项目操作" type="button">
          <MoreHorizontal aria-hidden />
        </button>
      </header>

      <div className="goal-card">
        <div className="goal-card-top">
          <span>项目目标</span>
          <span className="goal-tag">计划中</span>
        </div>
        <h1>为摄影师创建预约与报价工具</h1>
        <p>统一收集客户信息、安排预约时间，并提供清晰的报价跟进流程。</p>
      </div>

      <div className="feed">
        <p className="feed-heading">团队运行记录</p>
        {events.map((event, index) => (
          <article className="agent-event" key={event.name}>
            <span
              className="agent-avatar"
              style={{ "--event-color": event.color } as React.CSSProperties}
            >
              {index === 0 ? <Sparkles size={15} aria-hidden /> : <ShieldCheck size={15} aria-hidden />}
            </span>
            <div>
              <div className="event-heading">
                <strong>{event.name}</strong>
                <time>{event.time}</time>
              </div>
              <p className="event-copy">{event.text}</p>
            </div>
          </article>
        ))}
      </div>

      <form className="composer" onSubmit={(event) => event.preventDefault()}>
        <div className="composer-box">
          <textarea
            aria-label="描述你要构建的产品"
            placeholder="描述你要构建的产品，或输入 @架构师 ..."
            rows={2}
          />
          <button className="send-button" title="制定团队计划" type="submit">
            <ArrowUp aria-hidden />
          </button>
        </div>
        <p className="composer-help">@ 专家直接咨询；按目标发起团队协作</p>
      </form>
    </div>
  );
}

