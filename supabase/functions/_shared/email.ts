import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

  if (!gmailUser || !gmailPassword) {
    throw new Error("GMAIL_USER ou GMAIL_APP_PASSWORD não configurado nos secrets do Supabase");
  }

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: gmailUser,
        password: gmailPassword,
      },
    },
  });

  await client.send({
    from: `Grazing Tasks <${gmailUser}>`,
    to,
    subject,
    content: "auto",
    html,
  });

  await client.close();
}

// ---------- Templates ----------

export function emailDailyDigest({
  name,
  overdue,
  today,
  tomorrow,
  appUrl = "https://checklistgrazing.lovable.app",
}: {
  name: string;
  overdue: { title: string; collection: string; due_date: string }[];
  today: { title: string; collection: string }[];
  tomorrow: { title: string; collection: string }[];
  appUrl?: string;
}): string {
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const section = (
    emoji: string,
    title: string,
    color: string,
    tasks: { title: string; collection: string; due_date?: string }[]
  ) => {
    if (tasks.length === 0) return "";
    const rows = tasks
      .map(
        (t) => `
        <tr>
          <td style="padding:10px 24px;border-bottom:1px solid #f0f0f0;">
            <span style="font-size:14px;color:#333;">${t.title}</span>
            <span style="font-size:12px;color:#999;margin-left:8px;">${t.collection}</span>
            ${t.due_date ? `<span style="font-size:11px;color:${color};margin-left:6px;">(${t.due_date})</span>` : ""}
          </td>
        </tr>`
      )
      .join("");

    return `
      <tr>
        <td style="padding:20px 24px 8px;background:#fafafa;">
          <span style="font-size:13px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:.06em;">
            ${emoji} ${title} (${tasks.length})
          </span>
        </td>
      </tr>
      ${rows}`;
  };

  const hasAnything = overdue.length > 0 || today.length > 0 || tomorrow.length > 0;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#111827;padding:28px 24px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">📋 Grazing Tasks</p>
            <p style="margin:6px 0 0;font-size:13px;color:#9ca3af;">${dateStr}</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:20px 24px 4px;">
            <p style="margin:0;font-size:15px;color:#333;">Olá, <strong>${name}</strong>! Aqui está seu resumo de tarefas:</p>
          </td>
        </tr>

        ${hasAnything ? `
          ${section("🚨", "Atrasadas", "#dc2626", overdue)}
          ${section("📅", "Para hoje", "#ea580c", today)}
          ${section("⏰", "Amanhã", "#2563eb", tomorrow)}
        ` : `
        <tr>
          <td style="padding:32px 24px;text-align:center;color:#6b7280;font-size:14px;">
            ✅ Nenhuma tarefa pendente. Bom trabalho!
          </td>
        </tr>`}

        <!-- Footer -->
        <tr>
          <td style="padding:24px;text-align:center;border-top:1px solid #f0f0f0;">
            <a href="${appUrl}"
              style="display:inline-block;padding:10px 24px;background:#111827;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
              Abrir sistema →
            </a>
            <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">
              Grazing Tasks · Notificação automática diária
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailNewTask({
  assigneeName,
  taskTitle,
  taskDescription,
  collectionName,
  dueDate,
  assignerName,
  appUrl = "https://checklistgrazing.lovable.app",
}: {
  assigneeName: string;
  taskTitle: string;
  taskDescription?: string;
  collectionName: string;
  dueDate?: string;
  assignerName?: string;
  appUrl?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#111827;padding:28px 24px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">📋 Grazing Tasks</p>
            <p style="margin:6px 0 0;font-size:13px;color:#9ca3af;">Nova tarefa atribuída</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 24px;">
            <p style="margin:0 0 16px;font-size:15px;color:#333;">
              Olá, <strong>${assigneeName}</strong>!
              ${assignerName ? `<strong>${assignerName}</strong> atribuiu uma nova tarefa para você:` : "Uma nova tarefa foi atribuída para você:"}
            </p>

            <div style="background:#f9fafb;border-left:4px solid #111827;border-radius:4px;padding:16px 20px;margin:0 0 16px;">
              <p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#111;">${taskTitle}</p>
              ${taskDescription ? `<p style="margin:0 0 10px;font-size:14px;color:#555;">${taskDescription}</p>` : ""}
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                📁 ${collectionName}
                ${dueDate ? ` · 📅 Prazo: <strong style="color:#ea580c;">${dueDate}</strong>` : ""}
              </p>
            </div>

            <a href="${appUrl}"
              style="display:inline-block;padding:12px 28px;background:#111827;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
              Ver tarefa →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 24px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              Grazing Tasks · Você recebeu esta notificação porque uma tarefa foi atribuída a você
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
