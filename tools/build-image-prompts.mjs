#!/usr/bin/env node
// assets/image-prompts.json を生成する（Codex.md のテンプレートと同じ内容）。
// 使い方: node tools/build-image-prompts.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['js/core/namespace.js', 'data/assets.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox);
const assets = sandbox.SAA.data.assets;

export const STYLE = 'Japanese anime visual-novel illustration, clean confident lineart, cel shading with soft gradients, warm soft autumn lighting, high detail, polished commercial galge quality, gentle pastel palette with coral pink and blue accents';
export const NO = 'No text, no letters, no numbers, no logos, no watermark, no signature, no brand marks (especially no AWS or Amazon logos). Do not resemble any real person.';
export const LOCK_AKARI = 'Character "Akari Nanase": an adult Japanese woman, 24 years old, about 160 cm, slim build. Milk-tea brown shoulder-length hair with soft wavy ends and side-swept bangs, a small thin braid on her left side fastened with a small coral-pink hair clip. Large warm amber-brown eyes, gentle round face, light natural makeup. Outfit: white blouse with a soft bow-tie collar, navy blue knit cardigan, beige flared knee-length skirt, black low-heel pumps. Employee ID card on a coral-pink lanyard. Often holds a notebook full of colorful sticky notes. Cheerful, earnest, slightly clumsy junior infrastructure engineer.';
export const LOCK_REN = 'Character "Ren Himuro": an adult Japanese man, 29 years old, about 182 cm, slim and tall. Neat black hair with slightly long bangs swept to one side, sharp gray-blue eyes, thin silver square-frame glasses. Outfit: white dress shirt with sleeves rolled up to the elbows, top button open, no tie, dark navy vest (waistcoat), charcoal slacks, silver wristwatch, employee ID card on a navy lanyard. Calm, handsome, mature senior cloud architect and technical instructor; kind eyes behind a cool expression.';
const SPRITE_FRAME = 'Standing character sprite for a visual novel: knee-up shot (from the top of the head to just above the knees), body facing the viewer at a slight 3/4 angle, centered on a 2:3 portrait canvas with about 5% empty space above the head, the figure cut off by the bottom edge at knee level. Same pose, same scale and same position in every expression variant. Fully transparent background (PNG with alpha), no shadow on the ground, no props except those described.';
const BG_FRAME = 'Visual novel background, no people, wide establishing shot, eye level, 3:2 landscape canvas; keep important elements inside the central 16:9 safe area (about 7% may be cropped at top and bottom).';
const CG_FRAME = 'Visual novel event CG illustration, 3:2 landscape canvas, cinematic composition; keep faces and key elements inside the central 16:9 safe area (about 7% may be cropped at top and bottom). Wholesome, professional workplace atmosphere.';

const AKARI_FACE = {
  normal: 'Expression: calm natural smile, relaxed. Pose: holding her notebook with both hands in front of her chest.',
  smile: 'Expression: bright happy smile with slightly closed eyes. Pose: same base pose holding the notebook.',
  happy: 'Expression: beaming big smile, cheeks slightly flushed. Pose: one small fist raised in a cheerful mini fist-pump, the other hand still holding the notebook to her chest.',
  surprised: 'Expression: eyes wide open, mouth slightly open in surprise. Pose: same base pose, shoulders a little raised.',
  troubled: 'Expression: troubled wry smile, eyebrows lowered, a small comic sweat drop near the temple. Pose: same base pose.',
  thinking: 'Expression: thoughtful, eyes looking up and to the side. Pose: holding a pen to her chin with one hand, notebook in the other hand.',
  sad: 'Expression: downcast, eyes moist with tears that have not fallen, slight frown. Pose: same base pose, head slightly lowered.',
  blush: 'Expression: shy embarrassed smile, clearly blushing cheeks, eyes glancing away to the side. Pose: notebook held up near her mouth.',
  determined: 'Expression: determined, confident eyebrows, firm small smile. Pose: one hand clenched into a light fist at chest height, notebook tucked under the other arm.'
};
const REN_FACE = {
  normal: 'Expression: cool, composed, almost neutral. Pose: one hand in his slacks pocket, standing straight.',
  smile: 'Expression: gentle subtle smile with only the corners of the mouth. Pose: same base pose.',
  explain: 'Expression: focused, explaining. Pose: holding a whiteboard marker in one hand, index finger of the other hand raised as if making a point.',
  serious: 'Expression: serious, eyes slightly narrowed. Pose: same base pose.',
  smirk: 'Expression: playful teasing smirk, one corner of the mouth raised. Pose: same base pose, head tilted slightly.',
  surprised: 'Expression: mildly surprised, eyes slightly widened, restrained. Pose: same base pose.',
  impressed: 'Expression: impressed, small approving nod with a soft smile. Pose: arms crossed.',
  thinking: 'Expression: thinking. Pose: fingertips touching the bridge of his glasses, other hand in pocket.'
};
const SCENES = {
  face_akari: 'Square avatar icon, bust-up portrait of Akari smiling warmly at the viewer, plain soft pastel pink background, centered face.',
  face_ren: 'Square avatar icon, bust-up portrait of Ren with a gentle subtle smile looking at the viewer, plain soft pastel blue background, centered face.',
  bg_office_day: 'A bright modern Japanese IT company office floor in the daytime: rows of desks with dual monitors, ergonomic chairs, green plants, large windows with warm autumn sunlight and a city view.',
  bg_office_night: 'The same modern office at night: mostly dark, only one desk lit by a warm desk lamp and the glow of a monitor, city lights and a night skyline through large windows, quiet atmosphere.',
  bg_meeting_room: 'A small glass-walled meeting room: a large whiteboard covered with hand-drawn cloud architecture diagrams made of boxes and arrows (no readable text), a large wall monitor, a long table with chairs and a coffee cup.',
  bg_lab: 'A company cloud verification lab room: several monitors showing dashboards, graphs and terminal-like screens (no readable text), cool teal and blue indirect lighting, cables neatly arranged, a keyboard on the desk.',
  bg_cafe: 'A cozy in-office cafe lounge: wooden tables, an espresso machine at the counter, pendant lights, plants, a window counter seat, soft afternoon light.',
  bg_rooftop_evening: 'The rooftop of an office building at sunset: a safety fence, a bench, a skyline of city buildings, sky with a gradient from orange to purple, a few birds.',
  bg_home_night: 'A cute but tidy one-room apartment of a young woman at night: a desk with a laptop, reference books and colorful sticky notes, a desk lamp, cushions and a small plant, night sky through the window.',
  bg_station_morning: 'A Japanese train station rotary in the morning: clear autumn blue sky, ginkgo trees just starting to turn yellow, a few clouds, clean and hopeful atmosphere.',
  bg_test_center: 'The entrance of an office building that hosts a certification test center: glass doors, a calm lobby with chairs, neat and quiet, morning light; no signs with readable text.',
  bg_park_autumn: 'A park avenue in late afternoon: golden ginkgo and red maple trees, a path covered with fallen leaves, soft backlight, warm and romantic but calm atmosphere.',
  cg_title: 'Title key visual: in a meeting room by a large window at golden hour, Ren stands by a whiteboard holding a marker and looks back over his shoulder with a gentle smile, while Akari, holding her notebook to her chest, turns toward him with a bright determined smile. Behind them, an abstract glowing network of cloud-like nodes and lines floats in the air (no logos). Leave the right third of the image relatively calm for the title text overlay.',
  cg_prologue_result: 'Night office: Akari sits alone at her desk, shoulders slumped, staring at her laptop screen (the screen faces away or shows nothing readable), the screen light illuminating her face, eyes moist with unshed tears. Lonely but not tragic mood.',
  cg_whiteboard_lecture: 'Meeting room: Ren draws a cloud architecture diagram (only boxes and arrows) on a whiteboard and turns around to explain with a marker, while Akari sits at the table in the foreground taking notes eagerly with sparkling eyes.',
  cg_late_night_study: 'Night office under a warm desk lamp: Akari and Ren sit side by side in front of laptops; Akari points at a practice question in her book, and Ren leans slightly toward her screen to look, keeping a respectful distance. Two steaming coffee cups on the desk.',
  cg_rooftop_talk: 'Rooftop at sunset: Akari and Ren lean against the fence talking; Ren holds a can of coffee and smiles gently, Akari laughs a little shyly. Warm backlight, a heartfelt mood.',
  cg_handson_lab: 'Verification lab: Akari types on a keyboard while Ren stands behind and slightly to the side, pointing at a monitor that shows diagrams and graphs (nothing readable), giving advice. Teal light from the monitors.',
  cg_exam_morning: 'Exam morning at the station plaza: Akari takes a deep breath and looks ahead with a determined expression, holding her smartphone (screen not visible) and her notebook full of sticky notes; clear blue sky and early autumn leaves.',
  cg_pass_celebration: 'Office celebration: Akari holds up her smartphone with both hands, beaming with joy (the screen is not readable), while Ren stands next to her smiling and clapping lightly. Soft confetti-like sparkles of light.',
  cg_ending: 'True ending: late afternoon on an avenue of golden ginkgo and red maple trees; Akari and Ren walk side by side, seen from slightly behind; Akari looks up at Ren and laughs, Ren looks down at her with a gentle smile; falling leaves drift in warm backlight.',
  cg_retry_end: 'Night, in her room: Akari sits at her desk in front of a reference book full of sticky notes, tying a headband like a "hachimaki" with a bright, motivated, positive expression; a memo note from Ren lies at the corner of the desk.'
};

const out = [];
out.push({ key: 'akari_ref', path: 'assets/images/_reference/akari_ref.png', size: '1536x1024', background: 'opaque', reference: null,
  prompt: [STYLE, LOCK_AKARI, 'Character reference sheet on a plain light background: full-body front view, 3/4 view and back view of the same character, plus four small head shots showing smile, surprise, embarrassment and determination. Consistent design across all views.', NO].join(' ') });
out.push({ key: 'ren_ref', path: 'assets/images/_reference/ren_ref.png', size: '1536x1024', background: 'opaque', reference: null,
  prompt: [STYLE, LOCK_REN, 'Character reference sheet on a plain light background: full-body front view, 3/4 view and back view of the same character, plus four small head shots showing gentle smile, serious, teasing smirk and impressed. Consistent design across all views.', NO].join(' ') });

for (const [key, a] of Object.entries(assets)) {
  let prompt; let size; let background = 'opaque'; let reference = null;
  if (a.kind === 'sprite') {
    const lock = a.char === 'akari' ? LOCK_AKARI : LOCK_REN;
    const face = (a.char === 'akari' ? AKARI_FACE : REN_FACE)[a.face];
    prompt = [STYLE, lock, SPRITE_FRAME, face, NO].join(' ');
    size = '1024x1536'; background = 'transparent'; reference = a.char + '_ref';
  } else if (a.kind === 'face') {
    prompt = [STYLE, a.char === 'akari' ? LOCK_AKARI : LOCK_REN, SCENES[key], NO].join(' ');
    size = '1024x1024'; reference = a.char + '_ref';
  } else if (a.kind === 'bg') {
    prompt = [STYLE, BG_FRAME, SCENES[key], NO].join(' ');
    size = '1536x1024';
  } else {
    const who = /akari|Akari/.test(SCENES[key]) && /Ren/.test(SCENES[key]) ? LOCK_AKARI + ' ' + LOCK_REN : (/Ren/.test(SCENES[key]) ? LOCK_REN : LOCK_AKARI);
    prompt = [STYLE, CG_FRAME, who, SCENES[key], NO].join(' ');
    size = '1536x1024';
    reference = /Ren/.test(SCENES[key]) && /Akari/.test(SCENES[key]) ? 'akari_ref,ren_ref' : (/Ren/.test(SCENES[key]) ? 'ren_ref' : 'akari_ref');
  }
  if (!prompt || prompt.includes('undefined')) throw new Error('missing prompt for ' + key);
  out.push({ key, path: a.path, size, background, reference, prompt });
}
fs.writeFileSync(path.join(ROOT, 'assets/image-prompts.json'), JSON.stringify(out, null, 2) + '\n');
console.log('wrote assets/image-prompts.json with ' + out.length + ' entries');
