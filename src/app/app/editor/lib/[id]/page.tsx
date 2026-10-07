"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const PageEditor = dynamic(() => import("@/components/editor/Editor"), {
  ssr: false,
  loading: () => <div className="center-screen">Loading editor…</div>,
});

/** Editing a library item (global section) in the full editor. */
export default function LibraryItemEditorPage() {
  const { id } = useParams<{ id: string }>();
  return <PageEditor key={id} mode={{ kind: "library", id }} />;
}
