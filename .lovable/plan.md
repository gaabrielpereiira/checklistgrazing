
## Corrigir follow-ups de “hoje” no chat compartilhado

### Problema identificado
A falha não está no permissionamento da task. O erro está na detecção de intenção de “hoje” no chat compartilhado:

- `runChatTurn` só usa a lógica correta de “tasks de hoje” quando `isTodayTasksIntent(userMessage)` retorna `true`
- hoje essa função reconhece apenas frases fechadas como:
  - `tasks de hoje`
  - `o que tenho pra hoje`
  - `agenda de hoje`
- frases de follow-up como `veja novamente pra hoje` não entram nessa lista
- com isso, a IA cai no fluxo de `search_tasks` com `due_after=today` e `due_before=today`
- esse filtro olha apenas `due_date`, então ignora tasks agendadas para hoje em `task_schedule_overrides`

Foi exatamente isso que apareceu nos logs: a mensagem virou busca por prazo do dia, em vez de consulta de agenda do dia.

### O que vou ajustar

1. **Tornar a detecção de “hoje” mais robusta em `supabase/functions/_shared/chat-core.ts`**
   - ampliar `isTodayTasksIntent` para reconhecer follow-ups e reformulações naturais, por exemplo:
     - `veja novamente pra hoje`
     - `confira de novo pra hoje`
     - `veja de novo hoje`
     - `pra hoje`
     - `e hoje?`
     - `quais tem hoje`
     - `quais eu tenho hoje`
   - trocar a lógica de lista fixa por uma heurística simples:
     - presença de `hoje`/`pra hoje`/`do dia`
     - combinada com verbos de consulta (`ver`, `veja`, `confira`, `listar`, `mostrar`, `quais`, `tenho`)
     - aceitando também follow-ups curtos

2. **Blindar o atalho de agenda do dia**
   - em `runChatTurn`, manter o atalho determinístico para “hoje”
   - além da frase exata, aceitar qualquer mensagem classificada como intenção de agenda do dia
   - quando a IA pedir `search_tasks` com `due_before=today` e `due_after=today`, devolver `buildTodayTasksSummaryResponse(...)` se a mensagem for de “hoje”, para não depender de `due_date`

3. **Sincronizar o mesmo ajuste no chat da aplicação**
   - `supabase/functions/chat/index.ts` ainda tem a versão duplicada da lógica
   - atualizar a detecção lá também para evitar divergência entre app e WhatsApp
   - assim os dois canais passam a interpretar “veja novamente pra hoje” do mesmo jeito

4. **Preservar a lógica certa de “hoje”**
   - continuar usando `buildTodayTasksSummaryResponse(...)`
   - essa função já considera:
     - task com `due_date = hoje`
     - task com `task_schedule_overrides.work_date = hoje`
   - não mexer no filtro normal de datas para consultas como `tasks de 22/04`, que devem continuar usando `search_tasks`

### Arquivos afetados
```text
supabase/functions/_shared/chat-core.ts
supabase/functions/chat/index.ts
```

### Resultado esperado
Depois da correção, mensagens como:
- `veja novamente pra hoje`
- `confira de novo pra hoje`
- `quais tem hoje`
- `e hoje?`

devem responder com as tasks realmente previstas para hoje, incluindo as que estão agendadas em `task_schedule_overrides`, mesmo quando o prazo final da task for outro dia.

### Critérios de aceite
- `veja novamente pra hoje` retorna a agenda do dia, não a busca por `due_date=today`
- tasks com agendamento hoje aparecem mesmo se o `due_date` for amanhã ou depois
- o comportamento fica igual no WhatsApp e no chat interno
- consultas por data específica, como `22/04`, continuam funcionando pelo fluxo normal de busca
