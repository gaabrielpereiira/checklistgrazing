import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const [body, setBody] = useState("");

  useEffect(() => {
    if (doc) {
      setTitle(doc.title || "");
      setBody(typeof doc.content === "object" ? doc.content?.text || "" : "");
    }
  }, [doc]);

  useEffect(() => {
    if (!docId || !doc) return;
    const t = setTimeout(async () => {
      await supabase.from("docs").update({ title, content: { text: body } }).eq("id", docId);
      qc.invalidateQueries({ queryKey: ["workspace-tree"] });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-8">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título do documento"
          className="text-3xl font-bold border-0 shadow-none focus-visible:ring-0 px-0 h-auto py-2"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Comece a escrever…"
          className="mt-4 min-h-[60vh] border-0 shadow-none focus-visible:ring-0 px-0 resize-none text-base leading-relaxed"
        />
      </div>
    </AppLayout>
  );
}
