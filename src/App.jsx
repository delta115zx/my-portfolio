import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

// 학원 패턴 그대로: 컴포넌트 밖에서 소켓 인스턴스 생성
// 서버 미배포 시 연결 실패해도 UI는 정상 동작 (badge만 숨겨짐)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";
const socket = SOCKET_URL ? io(SOCKET_URL, { reconnectionAttempts: 3, timeout: 4000 }) : null;

const NAV_ITEMS = ["about", "skills", "project", "troubleshooting", "draw", "contact"];
const NAV_LABELS = { about: "소개", skills: "기술", project: "프로젝트", troubleshooting: "문제해결", draw: "드로잉", contact: "연락처" };

const SKILLS = [
  { cat: "AI / Azure", items: ["Azure OpenAI", "Azure AI Search", "Semantic Kernel", "MCP", "AgentGroupChat", "Azure ML", "MS AI-900"] },
  { cat: "Backend", items: ["Python 3.12", "FastAPI", "Flask", "Node.js", "REST API", "JWT"] },
  { cat: "Frontend", items: ["React 19", "Vite", "Tailwind CSS", "Redux", "JavaScript", "Socket.IO"] },
  { cat: "Database", items: ["Azure PostgreSQL", "Azure Cosmos DB", "OracleDB", "MongoDB", "ChromaDB"] },
  { cat: "Infra / Tools", items: ["Azure Container Apps", "Azure Storage", "Linux", "Docker"] },
  { cat: "Data / ML", items: ["NumPy", "Pandas", "Matplotlib", "Seaborn", "scikit-learn", "PyTorch", "KoNLPy", "OpenLayers", "Chart.js"] },
];

const TROUBLES = [
  {
    id: "01",
    title: "멀티에이전트 데이터 파이프라인 재설계",
    problem: "Copilot Studio 기반 에이전트 시스템에서 에이전트 간 원본 데이터가 전달되지 않는 구조적 문제 발생",
    solution: "Semantic Kernel로 전환하여 에이전트 파이프라인을 직접 제어하고 데이터 흐름을 명시적으로 보장. 추가 플러그인 개발과 미세 조정이 원활해짐",
    result: "멀티에이전트 안정성 확보 및 확장 가능한 파이프라인 구조 완성",
    stack: ["Semantic Kernel", "Python", "FastAPI"],
  },
  {
    id: "02",
    title: "RAG 에이전트 응답 속도 75% 개선",
    problem: "AI 에이전트 응답 시간이 40초로 실사용이 어려운 수준. 추론 모델 사용과 순차 처리가 주된 병목",
    solution: "DB 조회·백엔드 병렬 처리 도입, 추론 모델 → 일반 모델 교체, 시스템 프롬프트 최적화 적용",
    result: "응답 시간 40초 → 10초대로 단축 (75% 개선), 응답 품질 유지",
    stack: ["Azure OpenAI", "FastAPI", "Async"],
  },
  {
    id: "03",
    title: "법령 벡터 검색 정확도 개선",
    problem: "법령 질문에 대한 일반 LLM 응답의 부정확성 문제. 할루시네이션으로 잘못된 법령 안내 위험",
    solution: "Azure AI Search로 식품위생법·근로기준법 등 10개 법령 ~1,288개 조항을 인덱싱. HNSW + cosine 유사도 기반 하이브리드 검색 구현 (벡터 + BM25 + 시맨틱 리랭킹)",
    result: "법령 관련 질의 정확도 향상, 실제 조항 인용 응답 제공",
    stack: ["Azure AI Search", "text-embedding-3-large", "RAG"],
  },
];

// 학원 패턴 적용: useEffect에서 socket.on 등록, cleanup에서 socket.off
function LiveVisitorBadge() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!socket) return;

    socket.on("visitor_count", (n) => setCount(n));
    socket.on("connect_error", () => setCount(null));

    return () => {
      socket.off("visitor_count");
      socket.off("connect_error");
    };
  }, []);

  if (count === null) return null;
  return <span style={styles.badge}>● 지금 {count}명 방문 중</span>;
}

// web/Dec08_5 드로잉 패턴 + web/Dec08_4 채팅 패턴 적용
// Canvas 마우스좌표를 socket.emit("xy") → 서버 브로드캐스트 → 다른 방문자 캔버스에 반영
function DrawingBoard() {
  const canvasRef = useRef(null);
  const drawMode = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!socket) return;

    const canvas = canvasRef.current;
    const pen = canvas.getContext("2d");
    pen.strokeStyle = "#7ee8c8";
    pen.lineWidth = 2;
    pen.lineCap = "round";

    // 학원 Dec08_5 패턴: socket.on("xy2") 로 상대방 드로잉 수신
    socket.on("xy2", ({ a, b, c, d }) => {
      pen.beginPath();
      pen.moveTo(c, d);
      pen.lineTo(a, b);
      pen.closePath();
      pen.stroke();
    });

    socket.on("draw_clear", () => {
      pen.clearRect(0, 0, canvas.width, canvas.height);
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("visitor_count", (n) => setOnlineCount(n));

    return () => {
      socket.off("xy2");
      socket.off("draw_clear");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("visitor_count");
    };
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const startDraw = (e) => {
    drawMode.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  };

  const draw = (e) => {
    if (!drawMode.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const pen = canvas.getContext("2d");
    const { x: a, y: b } = getPos(e, canvas);
    const { x: c, y: d } = lastPos.current;

    pen.beginPath();
    pen.moveTo(c, d);
    pen.lineTo(a, b);
    pen.closePath();
    pen.stroke();

    // 학원 Dec08_5 패턴: socket.emit("xy") 로 좌표 전송
    if (socket) socket.emit("xy", { a, b, c, d });

    lastPos.current = { x: a, y: b };
  };

  const stopDraw = () => { drawMode.current = false; };

  const clearCanvas = () => {
    const pen = canvasRef.current.getContext("2d");
    pen.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (socket) socket.emit("draw_clear");
  };

  return (
    <div style={styles.drawWrap}>
      <div style={styles.drawHeader}>
        <span style={styles.drawStatus}>
          {socket ? (connected ? <><span style={styles.onlineDot} />실시간 연결됨 · {onlineCount}명 접속 중</> : "연결 중...") : "소켓 서버 미연결 (로컬 드로잉만 가능)"}
        </span>
        <button style={styles.clearBtn} onClick={clearCanvas}>전체 지우기</button>
      </div>
      <canvas
        ref={canvasRef}
        width={700}
        height={320}
        style={styles.canvas}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      <p style={styles.drawHint}>← 캔버스에 자유롭게 그려보세요. 연결된 다른 방문자에게 실시간으로 공유됩니다.</p>
    </div>
  );
}

export default function Portfolio() {
  const [active, setActive] = useState("about");
  const [scrolled, setScrolled] = useState(false);
  const [hoveredSkill, setHoveredSkill] = useState(null);
  const [openTrouble, setOpenTrouble] = useState(null);
  const sectionRefs = useRef({});

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      for (const key of NAV_ITEMS) {
        const el = sectionRefs.current[key];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120 && rect.bottom > 120) setActive(key);
        }
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={styles.root}>
      <style>{css}</style>

      {/* NAV */}
      <nav style={{ ...styles.nav, background: scrolled ? "rgba(10,10,14,0.92)" : "transparent", borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
        <span style={styles.navLogo}>최진영</span>
        <div style={styles.navLinks}>
          {NAV_ITEMS.map((id) => (
            <button key={id} onClick={() => scrollTo(id)} style={{ ...styles.navBtn, color: active === id ? "#7ee8c8" : "rgba(255,255,255,0.55)" }}>
              {NAV_LABELS[id]}
              {active === id && <span style={styles.navUnderline} />}
            </button>
          ))}
        </div>
      </nav>

      {/* HERO */}
      <section ref={(el) => (sectionRefs.current.about = el)} style={styles.hero}>
        <div style={styles.heroBg} />
        <div style={styles.heroContent}>
          <p style={styles.heroEyebrow} className="fadeUp d1">AI / Backend Engineer</p>
          <h1 style={styles.heroName} className="fadeUp d2">최진영</h1>
          <p style={styles.heroSub} className="fadeUp d3">
            F&B 현장 경험에서 출발해 Azure AI 스택으로<br />
            실사용자 검증 서비스를 설계·운영합니다.
          </p>
          <div style={styles.heroBadges} className="fadeUp d4">
            {["SOHOBI Live", "~80명 실사용자", "MS AI-900"].map((b) => (
              <span key={b} style={styles.badge}>{b}</span>
            ))}
            <LiveVisitorBadge />
          </div>
          <a href="mailto:delta115zx@naver.com" style={styles.heroBtn} className="fadeUp d5">연락하기</a>
        </div>
        <div style={styles.heroDecor}>
          <div style={styles.ring1} className="spin" />
          <div style={styles.ring2} className="spinR" />
          <div style={styles.ring3} />
        </div>
      </section>

      {/* SKILLS */}
      <section ref={(el) => (sectionRefs.current.skills = el)} style={styles.section}>
        <SectionTitle num="01" title="기술 스택" sub="Skills" />
        <div style={styles.skillGrid}>
          {SKILLS.map((s) => (
            <div key={s.cat} style={styles.skillCard} className="card">
              <p style={styles.skillCat}>{s.cat}</p>
              <div style={styles.skillTags}>
                {s.items.map((item) => (
                  <span
                    key={item}
                    style={{ ...styles.tag, background: hoveredSkill === item ? "rgba(126,232,200,0.18)" : "rgba(255,255,255,0.05)", borderColor: hoveredSkill === item ? "#7ee8c8" : "rgba(255,255,255,0.1)", color: hoveredSkill === item ? "#7ee8c8" : "rgba(255,255,255,0.75)" }}
                    onMouseEnter={() => setHoveredSkill(item)}
                    onMouseLeave={() => setHoveredSkill(null)}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PROJECT */}
      <section ref={(el) => (sectionRefs.current.project = el)} style={styles.section}>
        <SectionTitle num="02" title="핵심 프로젝트" sub="Project" />
        <div style={styles.projCard} className="card">
          <div style={styles.projHeader}>
            <div>
              <div style={styles.projLive}><span style={styles.liveDot} />LIVE SERVICE</div>
              <h2 style={styles.projTitle}>SOHOBI</h2>
              <p style={styles.projTagline}>멀티에이전트 기반 F&B 창업 도우미</p>
            </div>
            <a href="https://sohobi.net" target="_blank" rel="noreferrer" style={styles.projLink}>sohobi.net →</a>
          </div>
          <p style={styles.projDesc}>
            F&B 업종 창업자를 위한 AI 도우미 서비스. 행정 절차 안내, 법령 조회, 재무 시뮬레이션,
            상권 분석을 멀티에이전트 구조로 통합하여 창업에 필요한 모든 정보를 한 곳에서 제공합니다.
          </p>
          <div style={styles.projStats}>
            {[["기간", "2026.02 → 04"], ["팀 유형", "팀 프로젝트"], ["실사용자", "~80명"], ["담당", "AI/RAG · 상권분석"]].map(([k, v]) => (
              <div key={k} style={styles.stat}>
                <span style={styles.statKey}>{k}</span>
                <span style={styles.statVal}>{v}</span>
              </div>
            ))}
          </div>
          <div style={styles.projArch}>
            <p style={styles.archLabel}>Architecture</p>
            <div style={styles.archFlow}>
              {["React 19", "→", "FastAPI", "→", "Semantic Kernel", "→", "Azure OpenAI", "→", "Azure AI Search"].map((n, i) => (
                <span key={i} style={n === "→" ? styles.arrow : styles.archNode}>{n}</span>
              ))}
            </div>
            <div style={styles.archFlow} className="mt8">
              {["OpenLayers", "→", "상권 에이전트", "→", "Azure PostgreSQL"].map((n, i) => (
                <span key={i} style={n === "→" ? styles.arrow : styles.archNode}>{n}</span>
              ))}
            </div>
          </div>
          <div style={styles.projRoles}>
            <p style={styles.archLabel}>담당 기여</p>
            <ul style={styles.roleList}>
              {["행정 RAG: 창업 절차 문서 Azure AI Search 인덱싱 및 파이프라인 설계",
                "상권 분석 에이전트: PostgreSQL 상권 데이터 쿼리 및 업종별 분석 로직",
                "지도 연동: OpenLayers + 상권 분석 에이전트 결과 시각화",
                "에이전트 프레임워크 전환: Copilot Studio → Semantic Kernel (AgentGroupChat)",
                "성능 최적화: 응답 시간 40초 → 10초대 단축"].map((r) => (
                  <li key={r} style={styles.roleItem}><span style={styles.roleBullet}>▸</span>{r}</li>
                ))}
            </ul>
          </div>
        </div>
      </section>

      {/* TROUBLESHOOTING */}
      <section ref={(el) => (sectionRefs.current.troubleshooting = el)} style={styles.section}>
        <SectionTitle num="03" title="문제 해결" sub="Troubleshooting" />
        <div style={styles.troubleList}>
          {TROUBLES.map((t) => (
            <div key={t.id} style={{ ...styles.troubleCard, borderColor: openTrouble === t.id ? "#7ee8c8" : "rgba(255,255,255,0.08)" }} className="card">
              <button style={styles.troubleHeader} onClick={() => setOpenTrouble(openTrouble === t.id ? null : t.id)}>
                <span style={styles.troubleNum}>{t.id}</span>
                <span style={styles.troubleTitle}>{t.title}</span>
                <span style={{ ...styles.troubleChev, transform: openTrouble === t.id ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
              </button>
              {openTrouble === t.id && (
                <div style={styles.troubleBody}>
                  <div style={styles.troubleRow}>
                    <span style={styles.troubleLabel}>문제</span>
                    <p style={styles.troubleText}>{t.problem}</p>
                  </div>
                  <div style={styles.troubleRow}>
                    <span style={{ ...styles.troubleLabel, color: "#7ee8c8" }}>해결</span>
                    <p style={styles.troubleText}>{t.solution}</p>
                  </div>
                  <div style={styles.troubleRow}>
                    <span style={{ ...styles.troubleLabel, color: "#f9c74f" }}>성과</span>
                    <p style={{ ...styles.troubleText, color: "#f9c74f" }}>{t.result}</p>
                  </div>
                  <div style={styles.tagRow}>
                    {t.stack.map((s) => <span key={s} style={styles.tag}>{s}</span>)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* DRAWING BOARD */}
      <section ref={(el) => (sectionRefs.current.draw = el)} style={styles.section}>
        <SectionTitle num="04" title="실시간 드로잉" sub="Live Drawing" />
        <DrawingBoard />
      </section>

      {/* CONTACT */}
      <section ref={(el) => (sectionRefs.current.contact = el)} style={{ ...styles.section, ...styles.contactSection }}>
        <SectionTitle num="05" title="연락처" sub="Contact" />
        <div style={styles.contactGrid}>
          {[
            { label: "Email", value: "delta115zx@naver.com", href: "mailto:delta115zx@naver.com" },
            { label: "Phone", value: "010-5834-4789", href: "tel:01058344789" },
            { label: "Service", value: "sohobi.net", href: "https://sohobi.net" },
          ].map(({ label, value, href }) => (
            <div key={label} style={styles.contactCard} className="card">
              <p style={styles.contactLabel}>{label}</p>
              {href ? <a href={href} target="_blank" rel="noreferrer" style={styles.contactValue}>{value}</a> : <p style={styles.contactValue}>{value}</p>}
            </div>
          ))}
        </div>
      </section>

      <footer style={styles.footer}>
        <p style={styles.footerText}>© 2026 최진영 · Built with React</p>
      </footer>
    </div>
  );
}

function SectionTitle({ num, title, sub }) {
  return (
    <div style={styles.sectionTitle}>
      <span style={styles.sectionNum}>{num}</span>
      <div>
        <p style={styles.sectionSub}>{sub}</p>
        <h2 style={styles.sectionH2}>{title}</h2>
      </div>
    </div>
  );
}

const styles = {
  root: { fontFamily: "'Noto Sans KR', 'DM Sans', sans-serif", background: "#0a0a0e", color: "#fff", minHeight: "100vh", overflowX: "hidden" },
  nav: { position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5%", height: 64, backdropFilter: "blur(12px)", transition: "all .3s" },
  navLogo: { fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: -1 },
  navLinks: { display: "flex", gap: 4 },
  navBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, padding: "6px 12px", borderRadius: 6, position: "relative", transition: "color .2s", letterSpacing: 0.3 },
  navUnderline: { position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "#7ee8c8" },
  hero: { minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", padding: "0 8%", overflow: "hidden" },
  heroBg: { position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 60% at 70% 50%, rgba(126,232,200,0.07) 0%, transparent 70%)" },
  heroContent: { position: "relative", zIndex: 2, maxWidth: 600 },
  heroEyebrow: { fontSize: 12, letterSpacing: 4, color: "#7ee8c8", textTransform: "uppercase", marginBottom: 16, fontWeight: 600 },
  heroName: { fontFamily: "'DM Serif Display', serif", fontSize: "clamp(64px, 10vw, 112px)", lineHeight: 1, fontWeight: 400, margin: "0 0 24px", letterSpacing: -3, color: "#fff" },
  heroSub: { fontSize: 17, lineHeight: 1.7, color: "rgba(255,255,255,0.6)", marginBottom: 32 },
  heroBadges: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 36 },
  badge: { fontSize: 11, padding: "5px 12px", borderRadius: 20, background: "rgba(126,232,200,0.1)", border: "1px solid rgba(126,232,200,0.3)", color: "#7ee8c8", letterSpacing: 0.5, fontWeight: 600 },
  heroBtn: { display: "inline-block", padding: "14px 32px", background: "#7ee8c8", color: "#0a0a0e", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none", letterSpacing: 0.5, transition: "opacity .2s" },
  heroDecor: { position: "absolute", right: "8%", top: "50%", transform: "translateY(-50%)", width: 360, height: 360 },
  ring1: { position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(126,232,200,0.15)" },
  ring2: { position: "absolute", inset: 40, borderRadius: "50%", border: "1px dashed rgba(126,232,200,0.1)" },
  ring3: { position: "absolute", inset: 80, borderRadius: "50%", background: "radial-gradient(circle, rgba(126,232,200,0.08) 0%, transparent 70%)" },
  section: { padding: "100px 8%", maxWidth: 1200, margin: "0 auto" },
  sectionTitle: { display: "flex", alignItems: "flex-end", gap: 20, marginBottom: 52 },
  sectionNum: { fontFamily: "'DM Serif Display', serif", fontSize: 72, color: "rgba(255,255,255,0.04)", lineHeight: 1, fontWeight: 400, marginBottom: -8 },
  sectionSub: { fontSize: 11, letterSpacing: 4, color: "#7ee8c8", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 },
  sectionH2: { fontFamily: "'DM Serif Display', serif", fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: -1 },
  skillGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 },
  skillCard: { padding: "24px 28px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", transition: "border-color .2s" },
  skillCat: { fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 14, fontWeight: 600 },
  skillTags: { display: "flex", flexWrap: "wrap", gap: 6 },
  tag: { fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid", cursor: "default", transition: "all .15s", fontWeight: 500 },
  projCard: { padding: "40px 44px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" },
  projHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  projLive: { display: "flex", alignItems: "center", gap: 6, fontSize: 10, letterSpacing: 2, color: "#7ee8c8", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 },
  liveDot: { width: 6, height: 6, borderRadius: "50%", background: "#7ee8c8", display: "inline-block", animation: "pulse 2s infinite" },
  projTitle: { fontFamily: "'DM Serif Display', serif", fontSize: 42, fontWeight: 400, margin: "0 0 6px", letterSpacing: -2 },
  projTagline: { color: "rgba(255,255,255,0.5)", fontSize: 15 },
  projLink: { color: "#7ee8c8", textDecoration: "none", fontSize: 13, fontWeight: 600, border: "1px solid rgba(126,232,200,0.3)", padding: "8px 16px", borderRadius: 8 },
  projDesc: { color: "rgba(255,255,255,0.6)", lineHeight: 1.8, fontSize: 15, marginBottom: 28, maxWidth: 680 },
  projStats: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, marginBottom: 32, background: "rgba(255,255,255,0.03)", borderRadius: 12, overflow: "hidden" },
  stat: { padding: "18px 20px", borderRight: "1px solid rgba(255,255,255,0.05)" },
  statKey: { display: "block", fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
  statVal: { fontSize: 14, fontWeight: 600, color: "#fff" },
  projArch: { marginBottom: 28, padding: "20px 24px", background: "rgba(0,0,0,0.3)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" },
  archLabel: { fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 12, fontWeight: 600 },
  archFlow: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  archNode: { fontSize: 12, padding: "4px 10px", background: "rgba(126,232,200,0.08)", border: "1px solid rgba(126,232,200,0.2)", borderRadius: 6, color: "#7ee8c8", fontWeight: 500 },
  arrow: { color: "rgba(255,255,255,0.25)", fontSize: 16, fontWeight: 300 },
  projRoles: { padding: "20px 24px", background: "rgba(0,0,0,0.2)", borderRadius: 12 },
  roleList: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 },
  roleItem: { display: "flex", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 },
  roleBullet: { color: "#7ee8c8", flexShrink: 0, marginTop: 2 },
  troubleList: { display: "flex", flexDirection: "column", gap: 12 },
  troubleCard: { borderRadius: 16, border: "1px solid", background: "rgba(255,255,255,0.02)", overflow: "hidden", transition: "border-color .2s" },
  troubleHeader: { width: "100%", display: "flex", alignItems: "center", gap: 20, padding: "22px 28px", background: "none", border: "none", color: "#fff", cursor: "pointer", textAlign: "left" },
  troubleNum: { fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "rgba(255,255,255,0.15)", lineHeight: 1, minWidth: 36 },
  troubleTitle: { flex: 1, fontSize: 16, fontWeight: 600 },
  troubleChev: { fontSize: 24, color: "#7ee8c8", transition: "transform .2s", lineHeight: 1 },
  troubleBody: { padding: "0 28px 24px", borderTop: "1px solid rgba(255,255,255,0.05)" },
  troubleRow: { display: "flex", gap: 16, padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" },
  troubleLabel: { fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", fontWeight: 700, minWidth: 36, paddingTop: 2 },
  troubleText: { fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, margin: 0, flex: 1 },
  tagRow: { display: "flex", gap: 6, paddingTop: 16, flexWrap: "wrap" },
  contactSection: { paddingBottom: 60 },
  contactGrid: { display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" },
  contactCard: { padding: "28px 24px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", transition: "border-color .2s", width: 220 },
  contactLabel: { fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 },
  contactValue: { fontSize: 14, color: "#7ee8c8", textDecoration: "none", fontWeight: 600, wordBreak: "break-all" },
  footer: { borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px 8%", textAlign: "center" },
  footerText: { fontSize: 12, color: "rgba(255,255,255,0.25)" },
  drawWrap: { borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" },
  drawHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  drawStatus: { fontSize: 12, color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 6 },
  onlineDot: { width: 7, height: 7, borderRadius: "50%", background: "#7ee8c8", display: "inline-block", animation: "pulse 2s infinite" },
  clearBtn: { fontSize: 11, padding: "5px 14px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", cursor: "pointer" },
  canvas: { display: "block", width: "100%", height: 320, cursor: "crosshair", background: "rgba(0,0,0,0.25)", touchAction: "none" },
  drawHint: { fontSize: 12, color: "rgba(255,255,255,0.25)", padding: "10px 20px" },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #0a0a0e; }
  .fadeUp { animation: fadeUp 0.7s both; }
  .d1 { animation-delay: 0.1s; }
  .d2 { animation-delay: 0.2s; }
  .d3 { animation-delay: 0.3s; }
  .d4 { animation-delay: 0.4s; }
  .d5 { animation-delay: 0.5s; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
  .spin { animation: spin 18s linear infinite; }
  .spinR { animation: spin 12s linear infinite reverse; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .card:hover { border-color: rgba(126,232,200,0.25) !important; }
  .mt8 { margin-top: 8px; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0a0a0e; } ::-webkit-scrollbar-thumb { background: rgba(126,232,200,0.3); border-radius: 4px; }
`;
