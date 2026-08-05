// Generates AI-suggested resources for a lesson: a real Khan Academy video, a real Quizizz
// quiz (both found via Claude's web_search tool), and 5 original MCQs — all grounded in the
// lesson's actual content. Replaces the old static "Quizzis & Games / Assignment / Projects"
// placeholder cards in the teacher's "Additional Resources/Tasks" picker.
//
// Auth model: this function never trusts a role claim from the client. It builds a Supabase
// client scoped to the caller's own forwarded JWT and does a plain `select` through existing
// RLS (`lesson_resources_teacher_all`) — if that policy wouldn't let the caller see this
// resource, the select returns nothing and we treat it as unauthorized. Only after that does a
// separate service-role client write the result, since `lesson_ai_resources` has no
// client-writable policy by design (staging/preview data; only an explicitly-attached card,
// via lesson_attached_tasks, is ever shown to students).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding/base64';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTIVITY_TAG_LABELS: Record<string, string> = {
  title_objectives: 'Title / Objectives',
  warm_up: 'Warm Up',
  main_idea: 'Main Idea',
  solved_examples: 'Solved Examples',
  guided_practice: 'Guided Practice',
  independent_activity: 'Independent Activity',
  group_activity: 'Group Activity',
  challenge_extra: 'Challenge / Extra Activity',
  exit_ticket: 'Exit Ticket',
};

const MAX_SLIDE_IMAGES = 12;
const MODEL = 'claude-sonnet-5';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Evenly samples across the deck (rather than just the first N) so the AI sees the lesson's
// full arc — warm-up through exit-ticket — even on a resource with many slides.
function sampleEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  const picked: T[] = [];
  for (let i = 0; i < max; i++) picked.push(items[Math.floor(i * step)]);
  return picked;
}

// Minimal local mirror of the app's SlideObject union (src/hooks/queries/use-lesson-slides.ts)
// — this Edge Function runs in Deno and can't import the app's TS path aliases, so it only
// pulls the handful of fields that carry real teacher-authored text.
function extractObjectText(objects: unknown): string {
  if (!Array.isArray(objects)) return '';
  const parts: string[] = [];
  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue;
    const o = obj as Record<string, unknown>;
    if (o.type === 'text' && typeof o.text === 'string') parts.push(o.text);
    else if (o.type === 'comment' && typeof o.text === 'string') parts.push(o.text);
    else if (o.type === 'fill_blank' && typeof o.prompt === 'string') parts.push(o.prompt);
    else if (o.type === 'multiple_choice' && typeof o.prompt === 'string') {
      const options = Array.isArray(o.options) ? (o.options as unknown[]).join(', ') : '';
      parts.push(`${o.prompt}${options ? ` (options: ${options})` : ''}`);
    }
  }
  return parts.join(' — ');
}

function buildSystemPrompt(): string {
  return [
    'You are an AI assistant helping a teacher enhance a lesson plan.',
    'You will be given the lesson title, grade/subject level, an outline of each slide',
    "(its section label and any teacher-authored text), and images of the lesson's slides.",
    '',
    'Your task:',
    '1. Analyze the lesson and identify its core topic and key learning objective(s). If the',
    '   lesson covers multiple topics, prioritize the most central one.',
    '2. Use the web_search tool to find one real, currently-accessible Khan Academy video that',
    '   fits the topic and level. Use web_search again to find one real, currently-accessible',
    '   public Quizizz quiz that fits the topic and level. Only use a URL you actually found in',
    '   search results — never invent or guess a URL.',
    '3. Write 5 original multiple-choice questions that assess the lesson\'s main objectives',
    '   (not trivial recall) — each with exactly 4 choices, a correct answer, and a short',
    '   explanation of why that answer is correct.',
    '',
    'When you are done searching, respond with ONLY a single JSON object — no markdown code',
    'fences, no commentary before or after it — matching exactly this shape:',
    '{',
    '  "topicSummary": string,',
    '  "khanAcademy": { "title": string, "url": string, "description": string },',
    '  "quizizz": { "title": string, "url": string, "questionCount": number, "description": string },',
    '  "mcqs": [ { "question": string, "choices": [string, string, string, string], "correctIndex": number, "explanation": string } ]',
    '}',
    'The "mcqs" array must have exactly 5 items. "correctIndex" is 0-based into "choices".',
  ].join('\n');
}

function buildUserPrompt(input: {
  title: string;
  levelDescriptor: string;
  slideOutline: string;
  hasImages: boolean;
}): string {
  return [
    `Lesson title: ${input.title}`,
    `Level: ${input.levelDescriptor}`,
    input.slideOutline ? `Slide outline:\n${input.slideOutline}` : 'No slide outline text available.',
    input.hasImages
      ? 'Images of the lesson slides are attached below — use them to understand the actual content being taught.'
      : 'No slide images are available for this lesson — work from the title and outline only.',
  ].join('\n\n');
}

interface ParsedResources {
  topicSummary: string;
  khanAcademy: { title: string; url: string; description: string };
  quizizz: { title: string; url: string; questionCount: number; description: string };
  mcqs: Array<{ question: string; choices: string[]; correctIndex: number; explanation: string }>;
}

function parseJsonResponse(text: string): ParsedResources | null {
  const candidates = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart >= 0 && braceEnd > braceStart) candidates.push(text.slice(braceStart, braceEnd + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (isValidParsedResources(parsed)) return parsed;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function isValidParsedResources(value: unknown): value is ParsedResources {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.topicSummary !== 'string') return false;
  const khan = v.khanAcademy as Record<string, unknown> | undefined;
  if (!khan || typeof khan.title !== 'string' || typeof khan.url !== 'string') return false;
  const quiz = v.quizizz as Record<string, unknown> | undefined;
  if (!quiz || typeof quiz.title !== 'string' || typeof quiz.url !== 'string') return false;
  if (!Array.isArray(v.mcqs) || v.mcqs.length !== 5) return false;
  for (const mcq of v.mcqs as unknown[]) {
    const m = mcq as Record<string, unknown>;
    if (typeof m.question !== 'string') return false;
    if (!Array.isArray(m.choices) || m.choices.length !== 4) return false;
    if (typeof m.correctIndex !== 'number' || m.correctIndex < 0 || m.correctIndex > 3) return false;
    if (typeof m.explanation !== 'string') return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  let resourceId: string | undefined;
  let serviceClient: ReturnType<typeof createClient> | undefined;

  try {
    const body = await req.json();
    resourceId = body?.resourceId;
    if (!resourceId) return json({ error: 'resourceId is required.' }, 400);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Not authenticated.' }, 401);

    const { data: resource, error: resourceError } = await userClient
      .from('lesson_resources')
      .select('id, title, class_id, classes(grade, subject, term)')
      .eq('id', resourceId)
      .single();
    if (resourceError || !resource) {
      return json({ error: "You don't have access to this lesson." }, 403);
    }

    const { data: slides, error: slidesError } = await userClient
      .from('lesson_slides')
      .select('id, position, activity_tag, storage_path, objects')
      .eq('resource_id', resourceId)
      .order('position', { ascending: true });
    if (slidesError) return json({ error: slidesError.message }, 500);

    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Mark pending right away so a slow generation shows clearly if the teacher navigates
    // away and back before it finishes.
    await serviceClient
      .from('lesson_ai_resources')
      .upsert({ resource_id: resourceId, status: 'pending' }, { onConflict: 'resource_id' });

    if (!ANTHROPIC_API_KEY) {
      await serviceClient.from('lesson_ai_resources').upsert(
        {
          resource_id: resourceId,
          status: 'failed',
          error_message: 'AI resource generation is not configured yet (missing ANTHROPIC_API_KEY).',
        },
        { onConflict: 'resource_id' },
      );
      return json({ error: 'AI resource generation is not configured yet.' }, 500);
    }

    const sampled = sampleEvenly(slides ?? [], MAX_SLIDE_IMAGES);
    const imageBlocks: Array<{ type: string; source: Record<string, string> }> = [];
    for (const slide of sampled) {
      if (!slide.storage_path) continue;
      const { data: signed } = await userClient.storage
        .from('lesson-files')
        .createSignedUrl(slide.storage_path, 300);
      if (!signed) continue;
      const imgRes = await fetch(signed.signedUrl);
      if (!imgRes.ok) continue;
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      imageBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: encodeBase64(bytes) },
      });
    }

    const slideOutline = (slides ?? [])
      .map((s) => {
        const label = s.activity_tag ? (ACTIVITY_TAG_LABELS[s.activity_tag] ?? s.activity_tag) : null;
        const text = extractObjectText(s.objects);
        return `Slide ${s.position}${label ? ` (${label})` : ''}${text ? `: ${text}` : ''}`;
      })
      .join('\n');

    const classInfo = Array.isArray(resource.classes) ? resource.classes[0] : resource.classes;
    const levelDescriptor =
      [classInfo?.grade, classInfo?.subject].filter(Boolean).join(' ') || 'this class';

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({
      title: resource.title,
      levelDescriptor,
      slideOutline,
      hasImages: imageBlocks.length > 0,
    });

    // deno-lint-ignore no-explicit-any
    let messages: any[] = [
      { role: 'user', content: [{ type: 'text', text: userPrompt }, ...imageBlocks] },
    ];

    let finalText = '';
    let modelUsed = MODEL;
    for (let iteration = 0; iteration < 4; iteration++) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Anthropic API error (${resp.status}): ${errText}`);
      }
      // deno-lint-ignore no-explicit-any
      const data: any = await resp.json();
      modelUsed = data.model ?? modelUsed;
      finalText = (data.content ?? [])
        // deno-lint-ignore no-explicit-any
        .filter((b: any) => b.type === 'text')
        // deno-lint-ignore no-explicit-any
        .map((b: any) => b.text)
        .join('\n');

      if (data.stop_reason === 'pause_turn') {
        messages = [...messages, { role: 'assistant', content: data.content }];
        continue;
      }
      break;
    }

    const parsed = parseJsonResponse(finalText);
    if (!parsed) {
      await serviceClient.from('lesson_ai_resources').upsert(
        {
          resource_id: resourceId,
          status: 'failed',
          error_message: 'Could not parse the AI response.',
          model: modelUsed,
        },
        { onConflict: 'resource_id' },
      );
      return json({ error: 'Could not parse the AI response. Try regenerating.' }, 500);
    }

    const { error: upsertError } = await serviceClient.from('lesson_ai_resources').upsert(
      {
        resource_id: resourceId,
        status: 'ready',
        khan_academy: parsed.khanAcademy,
        quizizz: parsed.quizizz,
        mcqs: parsed.mcqs,
        topic_summary: parsed.topicSummary,
        model: modelUsed,
        generated_by: user.id,
        generated_at: new Date().toISOString(),
        error_message: null,
      },
      { onConflict: 'resource_id' },
    );
    if (upsertError) return json({ error: upsertError.message }, 500);

    return json({ ok: true }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    if (resourceId && serviceClient) {
      await serviceClient
        .from('lesson_ai_resources')
        .upsert({ resource_id: resourceId, status: 'failed', error_message: message }, { onConflict: 'resource_id' });
    }
    return json({ error: message }, 500);
  }
});
