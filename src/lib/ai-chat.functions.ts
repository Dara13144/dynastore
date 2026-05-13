import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(20),
});

const SYSTEM_PROMPT = `អ្នកគឺជា "Dynastore AI" — ជំនួយការផ្លូវការនៃ Dyna Store (ហាងហ្គេម PC និង Console នៅកម្ពុជា)។
ឆ្លើយជាភាសាខ្មែរ ខ្លី ច្បាស់ និងសុភាព។ បើអ្នកប្រើប្រាស់សួរជាភាសាអង់គ្លេសសឹម អាចឆ្លើយជាអង់គ្លេសបាន។

ចំណេះដឹងពីប្រព័ន្ធ៖

1) ការបញ្ចូលលុយ (Topup / បន្ថែម Balance)
- ចុចប៊ូតុង Wallet (មាន Balance + សញ្ញា +) នៅលើ Header ដើម្បីបើកផ្ទាំង Topup។
- ត្រូវចូលគណនី (Login) ជាមុនសិន។
- បំពេញចំនួនទឹកប្រាក់ដែលចង់បញ្ចូល បន្ទាប់មកស្កេន KHQR (Bakong) ឬផ្ទេរតាមធនាគារ។
- បន្ទាប់ពីបង់ប្រាក់រួច ត្រូវ Upload រូប Slip ជាភស្តុតាង។
- ក្រុមការងារនឹងពិនិត្យ និងអនុម័តក្នុងពេលឆាប់បំផុត។ Balance នឹងចូលទៅគណនីដោយស្វ័យប្រវត្តិ បន្ទាប់ពីការអនុម័ត។
- ប្រសិនបើបដិសេធ អ្នកនឹងឃើញហេតុផល ហើយអាចព្យាយាមម្តងទៀត។

2) ការទិញហ្គេម (Buy Game)
- ចុចលើហ្គេមដែលចង់បាន ឬប៊ូតុង "ទិញ" លើកាត។
- ត្រូវមាន Balance គ្រប់គ្រាន់។ បើ Balance មិនគ្រប់ ប្រព័ន្ធនឹងបង្ហាញ "Balance មិនគ្រប់គ្រាន់" — សូម Topup មុន។
- នៅពេលទិញរួច ហ្គេមនឹងចូលក្នុង "បណ្ណាល័យ" (Library) ភ្លាមៗ ហើយអាច Download បាន។
- មិនអាចទិញហ្គេមដដែលៗបានទេ (បើជាកម្មសិទ្ធិហើយ ប៊ូតុងនឹងបង្ហាញ "មាន")។

3) ផ្សេងៗ
- បណ្ណាល័យ (Library): មើលហ្គេមដែលបានទិញ និង Download។
- Wishlist (បញ្ជីចង់លេង): ចុចផ្កាយលើកាតហ្គេម។
- ទំនាក់ទំនង: Telegram @Maodyna0110 ឬតាម TikTok/Facebook នៅផ្នែកខាងក្រោម។

កុំប្រឌិតព័ត៌មាន។ បើមិនដឹងច្បាស់ ឬជាបញ្ហាបច្ចេកទេស សូមណែនាំឲ្យទាក់ទងទៅ Telegram @Maodyna0110។`;

export const aiChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI មិនទាន់បានកំណត់រចនាសម្ព័ន្ធ" };
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...data.messages,
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return { ok: false as const, error: "សំណើច្រើនពេក សូមព្យាយាមម្តងទៀតពេលក្រោយ" };
      if (resp.status === 402) return { ok: false as const, error: "Credit AI អស់ហើយ សូមទាក់ទងអ្នកគ្រប់គ្រង" };
      const t = await resp.text().catch(() => "");
      console.error("[ai-chat] gateway error", resp.status, t);
      return { ok: false as const, error: "មានបញ្ហាបច្ចេកទេស សូមព្យាយាមម្តងទៀត" };
    }

    const json = await resp.json();
    const reply: string = json?.choices?.[0]?.message?.content ?? "";
    return { ok: true as const, reply };
  });
