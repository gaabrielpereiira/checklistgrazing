import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RichEditor } from "@/components/RichEditor";

function isTiptapDoc(v: any) {
  return v && typeof v === "object" && v.type === "doc" && Array.isArray(v.content);
}
function textToDoc(text: string): any {
  const paras = (text || "").split(/\n\n+/).map((p) => ({
    type: "paragraph",
    content: p ? [{ type: "text", text: p }] : [],
  }));
  return { type: "doc", content: paras.length ? paras : [{ type: "paragraph" }] };
}

export default function DocPage() {
  const { docId } = useParams<{ docId: string }>();
  const qc = useQueryClient();

  const { data: doc } = useQuery({
    queryKey: ["doc", docId],
    enabled: !!docId,
    queryFn: async () => {
      const { data, error } = await supabase.from("docs").select("*").eq("id", docId!).single();
      if (error) throw error;
      return data as any;
    },
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState<any>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (doc && !initialized.current) {
      setTitle(doc.title || "");
      const content = doc.content;
      if (isTiptapDoc(content)) setBody(content);
      else if (content && typeof content === "object" && typeof content.text === "string") setBody(textToDoc(content.text));
      else setBody({ type: "doc", content: [{ type: "paragraph" }] });
      initialized.current = true;
    }
  }, [doc]);

  useEffect(() => {
    if (!docId || !initialized.current) return;
    const t = setTimeout(async () => {
      await supabase.from("docs").update({ title, content: body }).eq("id", docId);
      qc.invalidateQueries({ queryKey: ["workspace-tree"] });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="pt-8 px-8">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do documento"
            className="text-3xl font-bold border-0 shadow-none focus-visible:ring-0 px-0 h-auto py-2"
          />
        </div>
        {body && <RichEditor content={body} onChange={setBody} />}
      </div>
    </AppLayout>
  );
}
