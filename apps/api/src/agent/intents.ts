export type IntentName =
  | "help"
  | "book_service"
  | "query_status"
  | "reschedule"
  | "cancel"
  | "accept_job"
  | "decline_job"
  | "check_in"
  | "check_out"
  | "complete_service"
  | "list_services"
  | "unknown";

export type ParsedIntent = {
  intent: IntentName;
  slots: Record<string, string>;
  confidence: number;
};

const SERVICE_ALIASES: Record<string, string> = {
  家居清潔: "cleaning",
  清潔: "cleaning",
  洗澡: "bathing",
  沐浴: "bathing",
  護送: "escort",
  覆診: "escort",
  陪診: "escort",
  復康: "rehab",
  物理治療: "rehab",
  買餸: "errand",
  購物: "errand",
  送飯: "meal",
  膳食: "meal",
  看護: "companionship",
  陪伴: "companionship",
};

export function parseRuleIntent(text: string, role: string | null): ParsedIntent {
  const t = text.trim().toLowerCase();
  const raw = text.trim();
  const slots: Record<string, string> = {};

  for (const [alias, code] of Object.entries(SERVICE_ALIASES)) {
    if (raw.includes(alias)) {
      slots.service = code;
      break;
    }
  }

  const dateMatch = raw.match(/(今天|今日|明天|聽日|後日|週[一二三四五六日天]|星期[一二三四五六日天]|\d{1,2}[\/月]\d{1,2})/);
  if (dateMatch) slots.dateHint = dateMatch[1];

  const timeMatch = raw.match(/(\d{1,2})([:：點時])(\d{0,2})?\s*(am|pm|上午|下午|早上|晚上)?/i);
  if (timeMatch) slots.timeHint = timeMatch[0];

  if (/幫助|求助|點用|怎麼用|菜单|選單|help/i.test(raw)) {
    return { intent: "help", slots, confidence: 0.95 };
  }
  if (/服務項目|有咩服務|有什麼服務|價目/i.test(raw)) {
    return { intent: "list_services", slots, confidence: 0.9 };
  }

  if (role === "caregiver") {
    if (/接單|接受|我可以|ok接|肯做/.test(raw)) {
      return { intent: "accept_job", slots, confidence: 0.92 };
    }
    if (/不接|拒單|没空|做唔到|拒絕/.test(raw)) {
      return { intent: "decline_job", slots, confidence: 0.92 };
    }
    if (/到達|到咗|check.?in|已到/.test(raw)) {
      return { intent: "check_in", slots, confidence: 0.9 };
    }
    if (/離開|check.?out|走咗/.test(raw)) {
      return { intent: "check_out", slots, confidence: 0.9 };
    }
    if (/完成|搞掂|做完|已完成/.test(raw)) {
      return { intent: "complete_service", slots, confidence: 0.9 };
    }
  }

  if (/取消|唔要|不要了/.test(raw)) {
    return { intent: "cancel", slots, confidence: 0.88 };
  }
  if (/改期|改時間|推遲|延後|改去/.test(raw)) {
    return { intent: "reschedule", slots, confidence: 0.88 };
  }
  if (/查詢|進度|狀態|我的預約|我嘅預約|點樣/.test(raw) && !/預約|幫我約|想約/.test(raw)) {
    return { intent: "query_status", slots, confidence: 0.85 };
  }
  if (/預約|幫我約|想約|Booking|安排.*上門|需要.*服務/.test(raw) || slots.service) {
    return { intent: "book_service", slots, confidence: slots.service ? 0.9 : 0.75 };
  }
  if (/查詢|進度|狀態/.test(raw)) {
    return { intent: "query_status", slots, confidence: 0.7 };
  }

  void t;
  return { intent: "unknown", slots, confidence: 0.2 };
}

export async function parseWithLlm(
  text: string,
  role: string | null,
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<ParsedIntent | null> {
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `你是香港居家養老調度助理的意圖解析器。回傳 JSON：{"intent":"...","slots":{},"confidence":0-1}
intent 只能是: help, book_service, query_status, reschedule, cancel, accept_job, decline_job, check_in, check_out, complete_service, list_services, unknown
slots 可含 service(cleaning|bathing|escort|rehab|errand|meal|companionship), dateHint, timeHint
使用者角色: ${role ?? "family"}`,
          },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as ParsedIntent;
    if (!parsed.intent) return null;
    return parsed;
  } catch {
    return null;
  }
}
