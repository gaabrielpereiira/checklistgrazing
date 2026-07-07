# Fase 2 — Enriquecimento ClickUp-like

Amplia a base já entregue com os recursos que ficaram pendentes na Fase 1. Sem mudanças destrutivas no schema.

## 1. Subtarefas

- No modal de tarefa (`TaskModal`), quando a tarefa já existe, mostrar seção "Subtarefas":
  - Lista das subtarefas (query em `tasks` com `parent_task_id = task.id`)
  - Input inline para criar nova subtarefa (herda `list_id` da pai)
  - Toggle de conclusão, título editável, exclusão
- No `ListView`, indicador visual `▸ 3` quando a tarefa tem subtarefas; clicar expande inline mostrando as subtarefas indentadas
- Subtarefas concluídas contam para um progresso `x/y` mostrado na coluna Título

## 2. Editor rich-text de Documentos (TipTap)

- Instalar `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`
- Reescrever `DocPage`:
  - Editor TipTap salvo em `docs.content` (JSON do TipTap)
  - Bubble menu com bold/italic/underline/strike/code/link
  - Toolbar fixa: H1–H3, listas, checklist, citação, código, separador
  - Autosave debounced (800ms)
  - Título permanece em `<input>` grande no topo
- Migração leve dos docs existentes: se `content.text` existir, converter em nó parágrafo TipTap ao carregar

## 3. Campos personalizados por Lista (UI)

- Botão "Campos" na toolbar da Lista abre painel lateral (`Sheet`):
  - Lista os campos (`custom_fields`) com nome, tipo, visibilidade, ordem
  - Botão "+ Campo" com escolha de tipo: texto, número, data, checkbox, select (com edição de opções), usuário, URL, e-mail
  - Reordenar (drag), renomear, ocultar/mostrar, excluir
- `ListView` renderiza colunas visíveis dinamicamente após as fixas
- Célula editável inline por tipo:
  - texto/número/url/email → input
  - data → date picker
  - checkbox → switch
  - select → dropdown
  - user → combobox de responsáveis
- Persistência via `task_field_values` (upsert por `task_id + field_id`)
- `TaskModal` também renderiza os campos personalizados na parte inferior

## 4. Filtros AND/OR salvos por view

- Substituir os selects atuais por um `Popover` "Filtros" com construtor:
  - Adicionar condição: campo (fixo ou custom) + operador (`é`/`não é`/`contém`/`vazio`/`entre datas` etc, dependente do tipo) + valor
  - Alternar entre AND e OR
- Botão "Salvar view" cria/atualiza registro em `list_views` com `type` da tab atual + `config` (colunas visíveis, ordem, filtros, agrupamento, sort)
- Barra de tabs de views salvas ao lado das 4 tabs padrão, com menu para renomear/excluir/tornar padrão
- Nova view = criar `list_views` do tipo escolhido; view "própria" tem `is_shared=false`

## 5. Drag-and-drop na sidebar

- Usar `@dnd-kit/core` (já no projeto)
- Cada nó (Space, Folder, List, Doc) é `useDraggable` + `useDroppable`
- Regras:
  - Space reordena entre Spaces
  - Folder reordena dentro do Space; pode mover para outro Space
  - List/Doc reordena dentro do container (Folder ou Space) e pode mover entre Folders/Spaces
- Atualiza `position` (recalcula sequência) e `folder_id`/`space_id` conforme drop
- Indicador visual: linha entre irmãos (reorder) vs. destaque no container (mover para dentro)

## 6. Melhorias de UX

- Reordenar tarefas dentro da Lista via drag no ListView (atualiza `position`)
- Reordenar cards dentro da coluna no Kanban
- Clicar num status na tabela abre um mini-popover para trocar rapidamente
- Botão "..." na barra topo da Lista → renomear, mudar cor, excluir, gerenciar status
- Painel "Status" (Sheet): CRUD dos `statuses` da Lista com cor e tipo (todo/active/done)

## Detalhes técnicos

- Hooks novos:
  - `useCustomFields`, `useUpsertFieldValue`
  - `useSubtasks(parentId)`
  - `useListViews(listId)`, `useSaveView`
  - `useReorderTree` (atualização em massa de `position`)
- Bibliotecas a instalar:
  - `@tiptap/react @tiptap/starter-kit @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-link @tiptap/extension-placeholder`
- Sem migration destrutiva. Possíveis ajustes:
  - Adicionar índice `tasks_position_idx` em `(list_id, position)`
  - Adicionar `custom_fields.width` (INTEGER) para colunas com largura persistida

## Fica fora desta fase

- Realtime multi-usuário nos Docs
- Menções (`@user`) no editor
- Formulários e Whiteboards
- Automations (regras de troca de status, notificações WhatsApp/Slack adaptadas ao novo schema — as edge functions estão desativadas)
- Chat IA reescrito para o novo schema

Ao aprovar, começo pelas subtarefas + status manager (mudanças menores), depois campos personalizados, filtros salvos, editor TipTap e por fim o DnD na sidebar.
