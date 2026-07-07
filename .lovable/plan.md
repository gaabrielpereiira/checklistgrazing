# Reestruturação ClickUp-like — Fase 1

Recomeço do zero com nova hierarquia, quatro visualizações e campos personalizados por Lista. Dados antigos de coleções/colunas/projetos serão descartados.

## Nova hierarquia

```text
Workspace
└── Space (Setor)
    └── Folder (Pasta)
        ├── List (Lista de tarefas)
        │   └── Task
        │       └── Subtask
        └── Doc (Documento — editor rico)
```

Tarefas podem ser criadas em qualquer nível (Space/Folder/List). Internamente ficam sempre vinculadas a uma Lista "default" auto-criada no nível pai, para manter consistência de views e filtros.

## Novo schema (migration única, descarta o antigo)

Tabelas a criar (todas com RLS + GRANTs):

- `spaces` — nome, cor, ícone, ordem, workspace_id
- `folders` — nome, cor, space_id, ordem
- `lists` — nome, cor, folder_id (nullable, permite lista solta no Space), ordem, is_default
- `docs` — título, conteúdo (JSONB — TipTap), folder_id/space_id, ordem
- `tasks` — reescrita: list_id, parent_task_id (subtask), title, description, start_date, due_date, due_time, assignee_id, priority, status_id, position, created_by
- `statuses` — por Lista: nome, cor, ordem, tipo (todo/active/done). Default: "Pessoal", "Grazing", "Outro"
- `custom_fields` — por Lista: nome, tipo (text/number/select/date/checkbox/user), options JSONB, ordem, is_visible
- `task_field_values` — task_id, field_id, value JSONB
- `list_views` — visualizações salvas por Lista: tipo (list/kanban/calendar/gantt), config JSONB (colunas visíveis, ordem, filtros, agrupamento), owner_id, is_shared

Tabelas antigas a **remover**: `collections`, `collection_users`, `collection_teams`, `columns`, `column_automations`, `column_connections`, `projects`, `subtasks` (substituída por `tasks` com `parent_task_id`), `task_kanban_history`, `task_schedule_overrides`.

Preservado: `profiles`, `user_roles`, `teams`, `team_members`, `sectors`, `user_sectors`, `workspaces`, `workspace_holidays`, `notifications`, `requests`, `impediments`, `chat_*`, `slack_*`, `whatsapp_*`.

RLS: acesso via workspace_id (herdado por join até Space → Folder → List). Funções `user_has_space_access`, `user_has_list_access` (security definer) para evitar recursão.

## Sidebar (navegação em árvore)

Substitui o seletor de Coleção atual. Árvore expansível:

```text
▾ 🏢 Marketing (Space)
  ▾ 📁 Campanhas Q1 (Folder)
    · ✅ Redes sociais (List)
    · 📄 Briefing (Doc)
  · ✅ Backlog (List solta)
▸ 🏢 Comercial
```

Cada nó tem menu de contexto: Renomear, Cor, Adicionar Lista/Doc/Folder abaixo, Excluir. Drag-and-drop para reordenar/mover.

## Quatro visualizações (por Lista)

Cada Lista abre num layout com tabs de views. Views são configuráveis e salvas em `list_views`.

1. **Lista** — tabela virtualizada. Colunas: fixas (título, status, responsável, prazo, prioridade) + custom fields. Reordenar por drag, mostrar/ocultar, agrupar por qualquer coluna, ordenar clicando no header.
2. **Kanban** — colunas = statuses da Lista. Drag entre statuses. Card mostra campos escolhidos na config da view.
3. **Calendário** — mensal/semanal, tarefas posicionadas por `start_date`/`due_date`. Drag para mover.
4. **Gantt** — timeline com `start_date` → `due_date`, dependências (fase 2), zoom dia/semana/mês.

Toolbar comum a todas as views: **+ Task**, **Filtros**, **Ordenar**, **Agrupar**, **Colunas**, **Salvar view**.

## Modal de Task

- Campos: título, descrição (rich text), data de início (default: hoje), data de término (com toggle de horário), responsável, prioridade, status
- Breadcrumb no topo com Space > Folder > List (clicável)
- Sub-tarefas (mesma tabela, `parent_task_id`)
- Custom fields da Lista renderizados dinamicamente
- Comentários (fase 2)
- Botão "+ Task" disponível em qualquer nível da árvore; se clicado num Space/Folder, cria numa Lista default auto-gerada

## Filtros modulares

Painel de filtros construído dinamicamente a partir das colunas da Lista (fixas + custom). Operadores por tipo (é/não é/contém/vazio/entre datas). Múltiplas condições AND/OR. Filtros salvos junto com a view.

## Documentos

Página `/docs/:id` com editor TipTap (extensões: heading, lista, checkbox, código, tabela, imagem, link, mention). Autosave. Aparece na sidebar como filho de Folder ou Space.

## Roteamento

- `/` → redireciona para primeira Lista acessível
- `/s/:spaceId` → visão geral do Space (todas as tasks)
- `/l/:listId` → Lista com views
- `/d/:docId` → Documento
- `/t/:taskId` → abre task em painel lateral sobre a rota atual

Rotas antigas (`/`, `/gantt`, `/panoramica`, etc.) reaproveitadas ou removidas: Kanban/Gantt viram tabs dentro de `/l/:listId`. Mantidos: `/meu-dia`, `/chat`, `/solicitacoes`, `/equipe`, `/equipes`, `/configuracoes`.

## O que sai nesta Fase 1

- Nova hierarquia completa (Space/Folder/List/Doc)
- Migration destrutiva substituindo o schema antigo
- Sidebar em árvore com CRUD e drag-and-drop
- CRUD de Task e Subtask com breadcrumb
- 4 views funcionais por Lista, com salvamento de configuração
- Custom fields por Lista (text, number, select, date, checkbox, user)
- Filtros/ordenação/agrupamento por qualquer coluna
- Editor de Documentos (TipTap básico)
- Statuses customizáveis por Lista (defaults: Pessoal / Grazing / Outro)

## Fica para fases futuras

- Formulários e Whiteboards
- Dependências no Gantt, cargas de trabalho, sprints
- Custom fields globais no workspace
- Automations avançadas (as antigas serão descartadas)
- Templates de Lista
- Permissões finas por Space/Folder/List (nesta fase, herda do workspace + role)

## Detalhes técnicos

- **Editor de docs**: `@tiptap/react` + extensões starter-kit, task-list, table, link, image
- **Tabela virtualizada**: `@tanstack/react-table` + `@tanstack/react-virtual`
- **Gantt**: componente customizado sobre `date-fns` (evita libs pesadas)
- **DnD**: `@dnd-kit/core` (já usado no projeto)
- **Estado**: React Query para servidor; Zustand leve para UI da view (filtros temporários)
- **Realtime**: Supabase realtime nas tabelas `tasks`, `lists`, `custom_fields` para colaboração
- **Migration**: DROP CASCADE nas tabelas antigas e CREATE do novo schema em uma única transação, com GRANTs e políticas RLS baseadas em `has_role` e funções `user_has_*_access`
- **Seed pós-migration**: cria 1 Space "Geral", 1 Folder "Padrão", 1 List "Minhas Tarefas" com statuses default para cada workspace existente

Confirme para eu prosseguir com a migration destrutiva e a implementação — assim que aprovar, começo pelo schema + sidebar em árvore e depois as views.
