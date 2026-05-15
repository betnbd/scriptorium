import "./styles.css";

export default function App() {
  return (
    <main className="app-shell">
      <aside className="file-pane">Open a folder</aside>
      <section className="editor-pane">No file open</section>
      <aside className="assistant-pane">Assistant</aside>
    </main>
  );
}
