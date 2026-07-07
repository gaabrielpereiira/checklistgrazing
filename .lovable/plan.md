## Problema

O email `allan.abrunhosa@grazingtable.com.br` já existe em auth.users (por isso o cadastro retorna "User already registered"), mas o login falha com "Invalid login credentials" — ou seja, a senha não confere. Além disso, o formulário atual tem um link "Esqueceu a senha?" que não faz nada (`href="#"`), então a recuperação também não funciona.

## Solução

**1. Resetar a senha do Allan diretamente (acesso imediato)**
- Definir uma senha temporária para `allan.abrunhosa@grazingtable.com.br` via update em `auth.users` (usando função admin no backend).
- Informar a senha temporária para o Allan usar no próximo login e trocar depois.

**2. Implementar fluxo de "Esqueceu a senha?" funcional**
- Tornar o link clicável no `AnimatedAuthForm`: abrir um pequeno prompt/modal pedindo o email e chamar `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`.
- Criar página pública `/reset-password` que:
  - Detecta o token de recovery na URL,
  - Mostra formulário de nova senha,
  - Chama `supabase.auth.updateUser({ password })`,
  - Redireciona para `/auth` após sucesso.
- Adicionar rota em `src/App.tsx`.

## Observação sobre emails de recuperação

O envio do email de recuperação depende do sistema de emails do projeto estar configurado. Se o Allan não receber o email mesmo com o fluxo implementado, será necessário verificar a configuração de emails (domínio, DNS) — mas isso é um passo separado. O reset direto da senha (passo 1) garante acesso imediato independente do email.

## Pergunta antes de implementar

Qual senha temporária você quer que eu defina para o Allan? (Ex: `Grazing@2026` — ele troca depois no primeiro acesso.)
