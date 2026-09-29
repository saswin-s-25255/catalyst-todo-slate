"use client";

import dynamic from "next/dynamic";

const TodoApp = dynamic(() => import("./TodoApp"), {
  ssr: false,
  loading: () => <main style={{ padding: "3rem 1rem", textAlign: "center" }}>Loading…</main>,
});

export default function Home() {
  return <TodoApp />;
}
