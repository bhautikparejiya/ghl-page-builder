"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

// GrapesJS needs the browser, so the editor is client-only.
const PageEditor = dynamic(() => import("@/components/editor/Editor"), {
  ssr: false,
  loading: () => <div className="center-screen">Loading editor…</div>,
});

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  return <PageEditor key={id} mode={{ kind: "page", id }} />;
}
