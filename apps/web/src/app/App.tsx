export function App() {
  return (
    <main
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        minHeight: "100vh",
        margin: 0,
        padding: "48px 24px",
        background:
          "radial-gradient(circle at top, rgba(29, 78, 216, 0.18), transparent 35%), #0f172a",
        color: "#e2e8f0"
      }}
    >
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        <p style={{ letterSpacing: "0.24em", textTransform: "uppercase", color: "#38bdf8" }}>
          Fog Maze Race
        </p>
        <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", margin: "0 0 16px" }}>
          Server-authoritative multiplayer maze race
        </h1>
        <p style={{ maxWidth: "700px", lineHeight: 1.7, color: "#cbd5e1" }}>
          Workspace scaffolding is ready. Next steps wire nickname flow, room lifecycle,
          PixiJS maze rendering, and Socket.IO synchronization into this shell.
        </p>
      </div>
    </main>
  );
}
