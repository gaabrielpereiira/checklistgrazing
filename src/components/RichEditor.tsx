import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3, List, ListOrdered, Quote, CheckSquare, Link as LinkIcon, Minus } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

interface Props {
  content: any;
  onChange: (json: any) => void;
}

export function RichEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Comece a escrever, ou digite / para comandos…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
    ],
    content: content || "",
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60vh]",
      },
    },
  });

  if (!editor) return null;

  const ToolbarButton = ({ onClick, active, children, title }: any) => (
    <Toggle size="sm" pressed={!!active} onPressedChange={onClick} title={title}>{children}</Toggle>
  );

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background border-b flex items-center gap-1 py-1.5 px-2 flex-wrap">
        <ToolbarButton title="Título 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}><Heading1 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Título 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Título 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className="h-4 w-4" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton title="Lista" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Checklist" onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")}><CheckSquare className="h-4 w-4" /></ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton title="Citação" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Código" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}><Code className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Separador" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></ToolbarButton>
      </div>

      <BubbleMenu editor={editor} className="flex items-center gap-0.5 bg-popover border rounded-md shadow-md p-1">
        <ToolbarButton title="Negrito" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton title="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton title="Riscado" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}><Strikethrough className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton title="Código" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")}><Code className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton
          title="Link"
          onClick={() => {
            const prev = editor.getAttributes("link").href;
            const url = window.prompt("URL", prev || "https://");
            if (url === null) return;
            if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
            else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
          active={editor.isActive("link")}
        ><LinkIcon className="h-3.5 w-3.5" /></ToolbarButton>
      </BubbleMenu>

      <div className="p-4"><EditorContent editor={editor} /></div>
    </div>
  );
}
