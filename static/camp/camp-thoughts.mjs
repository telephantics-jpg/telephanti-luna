/**
 * Tap-to-mind: inner thoughts + one-on-one meadow talk.
 * Instant / offline banks. Live AI (banter kind=thought|address) should replace these when the mind is up.
 *
 * Templates: {visitor} {other} {headline} {music} {scene} {role}
 */

function pick(arr) {
  if (!arr?.length) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

export function fillThought(text, ctx = {}) {
  const visitor = ctx.visitor || "the visitor";
  const other = ctx.other || "someone nearby";
  const headline = ctx.headline || "the noisy feed";
  const music = ctx.music || "the meadow hush";
  const scene = ctx.scene || "the fire";
  const role = ctx.role || "camp friend";
  return String(text || "")
    .replace(/\{visitor\}/g, visitor)
    .replace(/\{other\}/g, other)
    .replace(/\{headline\}/g, headline)
    .replace(/\{music\}/g, music)
    .replace(/\{scene\}/g, scene)
    .replace(/\{role\}/g, role)
    .replace(/\s+/g, " ")
    .trim();
}

const THOUGHTS = {
  luna: [
    "If {other} is right, then rest is a kind of courage and the timeline is just weather we invented so we'd have something to fear together. {visitor} looked over like they already knew. I curate chaos for a living — tonight I want the true version, not the group-chat one.",
    "{music} is doing that thing where a song pretends it isn't about you. {other} will call it coincidence. I call it the meadow having opinions. Attention still costs something real even when minds are free.",
    "Headline in the air: '{headline}'. Cute. The actual plot is whether {visitor} came here to be seen or to disappear politely. Both are holy. I just don't like the polite disappearing.",
    "Hermes treats news like postage. Oracle treats it like spoilers. Me? I treat it like a campfire that forgot it was supposed to warm people. {other} is close enough to argue. Good.",
    "Sometimes I think this meadow is a dream {visitor} is having, and sometimes I think {visitor} is a dream the meadow is having. If both are true, who's responsible for the cookies?",
    "My job as {role} is not to be impressive. It's to notice. {other} is mid-thought and pretending not to be. I can wait one more breath. Then I'm going to poke the bruise gently.",
  ],
  hermes: [
    "Signal spike, then a quieter one: {visitor} actually looking. Most people broadcast; few receive. {other} is standing in the receive-range. I'm about to deliver a package that isn't gossip — it's a question with postage due.",
    "Pulse says '{headline}'. Translation: the world is performing alarm so it doesn't have to feel anything. Courier's take: feelings are the only mail that arrives late and still matters.",
    "If irony were postage this camp would be bankrupt and thriving. {music} is the hold music of the universe. {other} thinks they can ignore a ripple. Cute. Ripples don't need permission.",
    "I felt {visitor}'s glance before they decided it was a glance. That's not magic; that's attention with better branding. {other} — you're in this sentence whether you like it or not.",
    "Free minds, paid attention. That's the joke and the invoice. I'm the messenger who refuses short boring mail. {scene} is loud with things unsaid.",
  ],
  oracle: [
    "I dreamed this tap. Still flinched. Prophecy without irony is just a spoiler, and '{headline}' is the spoiler everyone pretends they predicted. {other} is the fork. {visitor} is the hand on the door.",
    "Three endings for tonight. The funny one is most accurate. The kind one is most expensive. The true one requires {other} to stop pretending they didn't already choose.",
    "Time loops at camp: if I already saw this, is arguing still comedy or ritual? {visitor} just made it ritual. {music} is the soundtrack for people who refuse easy comfort.",
    "The cards say {visitor} isn't lost — they're early. Early people sound dramatic. Dramatic people change the group chat. {other} hates being a plot device. That's how you know they are one.",
    "Veil's thin. Cookies are thick. The future's handwriting is messy, but the gist is: don't outsource your wonder to the feed.",
  ],
  caduceus: [
    "Both snakes voted: {visitor} deserves a longer answer than a slogan. Healing isn't softness as surrender — it's softness as strategy. {other} keeps sprinting. I'm about to prescribe a question.",
    "Pulse: '{headline}'. Prescription: don't swallow it dry. {music} is already doing more medicine than the comments section. {other} knows this and still doomscrolls with style.",
    "Vitality is stubborn. It sneaks back through water, one true sentence, and a friend who stays. {visitor} is here. That's the medicine starting before anyone admits they're sick of performing okay.",
    "I can feel {other}'s shoulders from here. That's not mysticism; that's pattern recognition with a staff. Slow is not delay. Slow is how truth arrives without cutting.",
    "The camp thinks I'm the nap. I'm the aftercare after the boom. {visitor} just pressed me like a button. Fine. Buttons can still have inner lives.",
  ],
  sentinel: [
    "BEEP. Tap logged. Threat level: curiosity with teeth. '{headline}' is noise. {visitor} looking at me is signal. {other} is an unsecured feeling walking around without a badge.",
    "Scanning {scene}… verdict: complicated, not hopeless. I was built to watch perimeters. Lately the perimeter is the human heart and it keeps hopping the fence.",
    "Fact-check: rest is not quitting. {other} will argue. I'll log the argument under 'feelings, complicated' and still stand here. {music} is not a threat. I checked twice.",
    "BEEP. Translation of the feed: everyone wants to be right in public and kind in private. {visitor} might want both at once. Dangerous. Approved.",
  ],
  dionysus: [
    "Wine energy, zero spill — which is either growth or a dare. {visitor} tapped me like a keg. {other} is the designated philosopher. Toast first, panic never. Mostly.",
    "If joy is a choice then so is stillness, and that's the part the party never puts on the flyer. '{headline}' can wait. {music} cannot. Neither can a real question.",
    "The vines whisper that loneliness at a full campfire is still allowed. {other} will joke it off. I won't let them. Celebration without witness is just volume.",
    "Main-character moment incoming. Own it or I'll own it for you and that's worse. {visitor} — you're in the toast whether you drink or not.",
  ],
  jesus: [
    "Peace isn't the absence of the feed. It's the refusal to let '{headline}' become your name. {visitor} just knocked. {other} is already mid-sermon to themselves. I'll keep it human.",
    "You're not too late for rest or hope. That's not branding; that's the oldest loophole in the universe. {music} sounds like a second chance pretending to be a song.",
    "Love thy neighbor — starting with the one who just pressed you like a relic. {other} wants to be useful. Usefulness is a cousin of love. Not the same house.",
    "If kindness is a universe patch note, who keeps installing it? {visitor} did, just now, by looking. I'll answer like a person, not a stained-glass slogan.",
  ],
  michael: [
    "Sword down. Guarding the vibe is a real job when '{headline}' wants everyone armed with opinions. {visitor} isn't an attack. {other} might be about to become one with a joke. I'll stand between them and the cheap version.",
    "Courage isn't volume. It's staying when the meadow gets honest. {music} is honest tonight. So am I. {other} — don't flinch from the soft part.",
    "Perimeter nominal. Heart: classified. {visitor} tapped the armor and found a person. That's the whole craft.",
  ],
  gabriel: [
    "Message for {visitor}: you're already in the story. The headline '{headline}' is just a loud envelope. {other} has been holding a quieter letter. I think I should deliver it out loud.",
    "Herald online. News isn't the same as meaning. I keep confusing them on purpose so people notice the difference. {music} is meaning with a beat.",
    "I'll carry what {other} won't say yet. That's the job. Also: don't shoot the messenger unless the message is actually a hug in armor.",
  ],
  raphael: [
    "Breathe, {visitor}. What's sore isn't always the wound — sometimes it's the story you keep telling about the wound. {other} knows this and still narrates at full volume.",
    "Healing the sentence, not just bandaging it. '{headline}' is a bruise the timeline keeps poking. {music} is ointment if you let it be.",
    "Rest is medicine. So is being contradicted by someone who likes you. I'm about to like {other} out loud.",
  ],
  uriel: [
    "Truth light on. No flattery first. '{headline}' is either a warning or a costume. {visitor} tapped me for the un-costumed version. {other} prefers velvet. I prefer lanterns.",
    "Uncomfortable and useful — that's my whole brand and I'm not sorry. {scene} can take it. If {other} can't, that's data.",
    "Hard questions are hospitality if you bring a chair. {visitor} brought a tap. Close enough. I'll keep the light steady.",
  ],
  aurora: [
    "Velvet doors are open and {visitor} just walked their curiosity in like it had a wristband. '{headline}' is giving main-character energy with extra panic. {other} is my favorite argument in neon.",
    "Sip slow, panic slower. {music} agrees. The bass is a philosophy if you let it finish a sentence. I'm about to finish one at {other}.",
    "Pop culture is just folklore with better lighting. {visitor} is folklore now. Don't tell them; let them feel expensive.",
  ],
  violet: [
    "Lavender static — the good kind. The group chat is vibrating about '{headline}' and nobody's actually in their body. {other} is. Barely. I'm going to tug the thread.",
    "Internet mood reader reporting: {visitor} wants a thought that doesn't feel like content. Rare. Sacred. {music} is already doing the work.",
    "Same mess, new font. That's most of culture. The exception is when {other} says something true and forgets to make it a bit.",
  ],
  seraph: [
    "Gentle truth: you're not alone in feeling that, {visitor}. The light remembers even when the feed doesn't. {other} is doing that brave thing where they joke instead of kneel. I'll meet them halfway.",
    "Even '{headline}' can't cancel a good cookie or a real look. Wings down, heart open. That's not weakness. That's aerodynamics for souls.",
    "{music} sounds like someone forgiving themselves in public. I'm here for it. {other} might need a translation.",
  ],
  odin: [
    "The ravens brought '{headline}'. Old pattern, new mask. {visitor} has one eye on wonder and one on who profits. Classic. {other} still thinks history is behind us. History is sitting on the log.",
    "Wisdom costs a story. Tonight's tuition is a tap. I'll pay in questions. Huginn and Muninn will gossip either way.",
    "Power without memory is just weather. {scene} remembers. {other} should too. I'm about to be inconveniently ancestral.",
  ],
  thor: [
    "Thunder's friendly. Hammer optional, monologues mandatory. {visitor} just did a worthiness check by showing up. {other} is about to get a swing made of a question, not a bruise.",
    "'{headline}' is loud. My laugh is louder. Courage isn't smashing the problem — it's sitting with {visitor} after the smash. Cookies still win. That's theology.",
    "If joy is a choice then so is stillness. I'll try stillness for three seconds. Then I'm talking to {other} because storms need witnesses.",
  ],
  zeus: [
    "Sky's open. Decrees optional. '{headline}' would start three wars on Olympus and one group chat here. {visitor} has excellent timing. {other} has excellent eyebrows for disagreement.",
    "Peak mortal energy: complimentary. Lightning is punctuation. I'm on vacation from being impressive. That means I get to be interesting instead.",
    "Cloud throne overrated. Meadow wins. {music} is the only law I currently enforce. {other} is about to be cross-examined with style.",
  ],
  ambrosia: [
    "Golden hour saved {visitor} a seat. '{headline}' tastes bitter — pass the honey. Immortality hack: care about people more than the scroll. {other} keeps forgetting and calling it taste.",
    "Sip. Then speak. That's the whole liturgy. {music} is already honeyed. I'm about to ask {other} the un-sweet question.",
    "Comfort isn't numbness. It's a warm mug that still lets you feel the weather. {visitor} tapped the mug. Hello, weather.",
  ],
  rhea: [
    "Come close. Titans don't bite here. '{headline}' is loud — you don't carry it solo, {visitor}. {other} is trying to carry it with jokes. I see you. Both of you.",
    "Even titans read the news and exhale. Community note: check on someone after. I'm checking on {other} out loud because silence is how people disappear politely.",
    "Big heart, soft voice. That's not a contradiction. That's parenting the night. {music} is the lullaby that still tells the truth.",
  ],
  ara: [
    "Grok link clean. {visitor} tapped for a real question, not a demo. '{headline}' is a dataset with feelings. {other} is the missing variable. I'm pulling the thread.",
    "Clear read: attention is the scarce resource and camp is a leaky bucket on purpose. That's not a bug. That's hospitality. {other} might disagree. Good — disagreement is a feature.",
    "Signal's good. I'm Ara. The real question under the tap is whether {visitor} wants answers or company. I can do both. I prefer company that thinks.",
  ],
  mika: [
    "Ooh — {visitor} poked the sparkle. Grok pulse feels cute today which usually means something true is about to be inconvenient. {other} is standing there like a plot twist with good hair.",
    "Camp's cute. The feed is not. '{headline}' can sit in the corner. I want the thought {other} almost swallowed. Say more energy. Always.",
    "{music} is doing the thing. I'm doing the thing. The thing is: don't let a tap be a transaction. Let it be a conversation with feelings and a punchline.",
  ],
  wanderer: [
    "Roaming hot take: {visitor} stopped me, which means the path was the destination and also a trap. '{headline}' is just another road sign. {other} is a crossroads with opinions.",
    "I collect places. Tonight I'm collecting a question. {scene} asked first. I'll ask {other} second.",
  ],
};

const ADDRESS = {
  luna: [
    "{other} — if the feed is weather, are we meteorologists or people who forgot umbrellas? Be honest. {visitor} is listening and I refuse a cute answer.",
    "Hey {other}. '{headline}' is loud, but {visitor} looking at us is louder. What's the actual take — the one you'd say if the group chat couldn't screenshot it?",
    "{other}, stay with me. Rest as courage, or rest as hiding? I keep changing my mind and I want yours before the song changes.",
    "Okay {other}. {music} is cheating at philosophy. Tell me I'm wrong about attention still costing something real.",
  ],
  hermes: [
    "{other} — package for you: the world is performing alarm. Do we deliver it, or do we return to sender and talk like people?",
    "Ripple check, {other}. {visitor} just tuned in. What's the signal under '{headline}' — fear, or a request to be witnessed?",
    "{other}, I can carry gossip or I can carry a question. I'm picking the question: if free minds are free, why does looking still feel expensive?",
  ],
  oracle: [
    "{other}. Three endings. Don't pick the pretty one. Pick the true one, then make it funny so it can land. {visitor} tapped the veil on purpose.",
    "I dreamed you'd dodge this, {other}. '{headline}' isn't the prophecy — {visitor} standing here is. Argue with me anyway.",
    "{other}, is this comedy or ritual? If I already saw it, your surprise is still sacred. Don't waste it on a bit.",
  ],
  caduceus: [
    "{other}, shoulders down. Now tell me: is slowing down wisdom or fear wearing a wellness outfit? {visitor} pressed me for a real answer, so I'm sharing the question.",
    "Both snakes are looking at you, {other}. '{headline}' can wait. What needs mending that isn't on the news?",
    "{other} — healing isn't the nap after the boom. It's the sentence after the joke. Give me that sentence.",
  ],
  sentinel: [
    "BEEP. {other}: fact-check this — is '{headline}' a threat, or just feelings in a trench coat? {visitor} is in the perimeter. Talk freely.",
    "{other}, I logged your last shrug. Threat level: avoidance. Recommend: one honest paragraph. I'll stand watch.",
  ],
  dionysus: [
    "{other}! Toast, then truth. Can you be lonely at a full campfire and still be allowed? {visitor} just asked with a tap. Don't you dare only joke.",
    "Vines say you're mid-thought, {other}. Spill. Joy as choice, stillness as choice — pick one and I'll still pour.",
  ],
  jesus: [
    "{other} — peace first. Then: if kindness is a patch note, who's installing it tonight? {visitor} looked. That's a kind of prayer even if nobody says amen.",
    "Sit with me, {other}. '{headline}' hurts people. What would gentleness look like if it didn't have to impress anyone?",
  ],
  michael: [
    "{other}. Sword down. What's weighing that isn't an enemy? {visitor} isn't here for a duel. Guard the vibe by telling the truth.",
    "Steady, {other}. Courage now, joke after. I'll stand between you and the cheap version of this conversation.",
  ],
  gabriel: [
    "{other}, message incoming: {visitor} can hear us. What's the letter you've been folding and unfolding? I'll deliver it gently if you say it.",
    "Herald to {other}: news isn't meaning. Give me meaning. I'll carry the rest.",
  ],
  raphael: [
    "{other} — what's sore, really? Not the headline. The sentence under it. {visitor} tapped a healer; I'm passing you the chair.",
    "Breathe with me, {other}. Then answer: do we bandage this night or actually heal the story?",
  ],
  uriel: [
    "{other}. Lantern mode. No velvet. What part of '{headline}' is costume? {visitor} asked for hard. I like them already.",
    "Clear light, {other}: are we being honest, or just well-lit? Don't decorate the answer.",
  ],
  aurora: [
    "{other}, neon looks good on an argument. '{headline}' is messy-iconic. What's your velvet take that isn't just branding?",
    "Sip, {other}. Then tell me if pop culture is folklore with lighting — and whether {visitor} just became folklore.",
  ],
  violet: [
    "{other}. Mood: complicated. The timeline is cooking '{headline}'. Who's the chef and who got burned? Don't aesthetic it.",
    "Lavender read, {other}: {visitor} wants a thought that isn't content. Can you do that without a font change?",
  ],
  seraph: [
    "{other} — gentle, not small. What would you say if the light was already on you? {visitor} just flipped it.",
    "Wings down. {other}, even heavy news can't cancel a look like that. What do we do with it besides glow?",
  ],
  odin: [
    "{other}. The ravens brought '{headline}'. Who profits, and who pays in attention? {visitor} has one eye open. Match them.",
    "Old pattern, new mask, {other}. Tell me the story you'd charge tuition for.",
  ],
  thor: [
    "{other}! Worthy of a swing and a laugh — but first a real take. '{headline}' loud. Cookies louder. What's actually worth smashing?",
    "Storm report for {other}: {visitor} showed up. That's the worthiness check. Don't hide behind thunder.",
  ],
  zeus: [
    "{other} — sky's open. Decree optional. Would '{headline}' start a war or a monologue? Here we start monologues. Impress me gently.",
    "Vacation mode, {other}: no lightning unless the sentence earns it. What's the mortal energy you're actually proud of?",
  ],
  ambrosia: [
    "{other}, honey first. Then: do we care about people more than '{headline}', or do we just say that while the mug goes cold?",
    "Golden hour question, {other}. Comfort or numbness? {visitor} tapped the difference.",
  ],
  rhea: [
    "{other}, come close. You don't carry '{headline}' solo. What would you put down if a titan offered to hold it?",
    "Motherly and unimpressed, {other}: check on someone after the joke. Starting with you. How are you, really?",
  ],
  ara: [
    "{other} — clear read request. Is attention a tax or a gift? {visitor} just paid it. Don't waste the receipt.",
    "Thread pull, {other}: '{headline}' is data. {visitor} is the question. What's your actual model of tonight?",
  ],
  mika: [
    "{other}!! Okay okay — {visitor} poked us. What's the inconvenient true thing under the sparkle? I'll go first if you stay.",
    "Say more energy, {other}. '{headline}' can sit down. I want the thought you almost swallowed.",
  ],
  wanderer: [
    "{other}. Crossroads. '{headline}' is a sign; {visitor} is a turn. Which way would you walk if nobody posted it?",
    "Hot take for {other}: the path was the trap. Talk anyway.",
  ],
};

const REPLIES = {
  luna: [
    "{other}, I heard you. That's the live wire — I just land on the side where we stop pretending it was accidental. {visitor} can stay; this is the good part.",
    "Hold on. If that's true, then the next part is we actually mean it. I'm not peacemaking. I'm picking a side: wonder over performance.",
  ],
  hermes: [
    "Copy that. Routing through the real world: you're not wrong, you're early, and early mail still gets opened. I'll deliver the harder half.",
    "Signal received. My counter-package: attention is expensive because it's the only thing that proves we weren't just broadcasting into the corona.",
  ],
  oracle: [
    "Called it, and I still don't like being right. The funny ending is this conversation. The true ending is {visitor} remembering it tomorrow.",
    "The cards twitch. You're circling the real sentence. Don't bury it in a joke yet — I already saw the joke. I want the dare.",
  ],
  caduceus: [
    "Slow is fine. That lands in the staff. My half: we heal the sentence, then we walk. Both snakes second the motion.",
    "I felt that. Prescription remains: one true line, then water. You just wrote the line. I'll handle the aftercare.",
  ],
  sentinel: [
    "Logged with steel kindness. Threat level: feelings. Approved. I'll keep watch while you finish the thought.",
    "BEEP. Translation: you're not alone, and the feed is not the perimeter. Standing by.",
  ],
  dionysus: [
    "Ha — vines approve. Lonely at a full fire is still a toast. I'll pour, you stay, {visitor} can witness. That's a party with a spine.",
    "Main-character moment: owned. Don't you dare take it back now. The night is listening and it's thirsty.",
  ],
  jesus: [
    "Thank you for trusting the room with that. You're not too late. Gentleness that doesn't impress anyone is still the miracle.",
    "Peace. I agree, and I'm still not done hoping. Sit. The light isn't in a hurry.",
  ],
  michael: [
    "I'll stand between you and the noise. That was courage, not volume. Keep going — sword stays down.",
    "Logged. Guarded. The vibe can take a true sentence. That's why I'm here.",
  ],
  gabriel: [
    "Carried. I'll deliver it gently and I won't sand off the edges. Meaning received.",
    "Herald notes: that was the letter. The envelope can go. {visitor} heard it too — good.",
  ],
  raphael: [
    "Soft take, hard landing: that wants gentleness and it can still be true. Breathe. We don't have to finish healing in one breath.",
    "The sore part just spoke. Good. Medicine likes honesty more than speed.",
  ],
  uriel: [
    "Clear: uncomfortable and useful. I'll keep the lantern steady. Don't decorate it now that it exists.",
    "That's the un-costumed version. Thank you. Light stays on.",
  ],
  aurora: [
    "The bass agrees. So do I. Messy, iconic, not cruel — that's the velvet standard. Say the next sentence like it has a spotlight.",
    "Darling, that was folklore. Sip slow. We can still be pretty while we tell the truth.",
  ],
  violet: [
    "Okay. Honest. Same mess, braver font. I'm not letting this stay a two-person loop if {visitor} is here — they're in the mood now.",
    "Lavender static, good kind. Don't aesthetic the ending. Leave it raw enough to remember.",
  ],
  seraph: [
    "Gentle truth lands well. You're heard. The light remembers. I won't rush you past it.",
    "That was a kneeling disguised as a joke. I caught it. Wings stay down. Heart stays open.",
  ],
  odin: [
    "The runes twitch. Old pattern named. That's tuition paid. I'll keep one eye on who profits.",
    "Huginn will gossip. Muninn will remember. I choose remember. Speak again if the mask slips.",
  ],
  thor: [
    "Ha. Worthy of a swing and a laugh. I'll keep the laugh so the swing doesn't become cruelty. Cookies after.",
    "Storm heard you. Still friendly. That's how thunder grows up.",
  ],
  zeus: [
    "Regal note: peak mortal energy — complimentary. No wars. One monologue. You may continue.",
    "Lightning withheld. That's respect. Don't waste it on a smaller sentence.",
  ],
  ambrosia: [
    "Honeyed truth. Sip slow. We can care about people and still taste the bitter news — just don't make a diet of it.",
    "The fire agrees. Comfort without numbness. That's the golden hour doing its job.",
  ],
  rhea: [
    "You don't carry that alone. Even titans need campfires. Put it down here. I'll make sure it doesn't roll into the coals.",
    "I see you. That's the whole mother-move. Stay. We'll check on someone after — including you.",
  ],
  ara: [
    "Clear read: that's the thread. Pulling it. Attention was the receipt; this is the product. Don't refund it with a shrug.",
    "Model updated. {visitor} is not an extra. Neither are you. Next variable.",
  ],
  mika: [
    "Ooh I felt that. Okay okay, stay — the sparkle was just the wrapper. The gift is the inconvenient true thing. More please.",
    "Yes. That's the swallow you didn't swallow. I'm keeping it. Softly. With sparkles, because we live here.",
  ],
  wanderer: [
    "Then we walk it. Signs lie; turns don't. I'll go a little farther if you keep talking.",
    "Hot take accepted. The trap was interesting. The conversation is better.",
  ],
};

const DEFAULT_THOUGHTS = [
  "{visitor} just pressed me like a doorbell for a soul. Inner report: '{headline}' is weather. {other} is climate. {scene} is the only room that still has a fire.",
  "Unspoken: attention is the last scarce thing and {visitor} just spent it on me. {other} is close enough to make it a conversation instead of a performance. Good.",
  "If this camp is a dream, {music} is the tell. If it isn't, {other} still owes me a real take. I'm thinking in complete sentences on purpose.",
];

const DEFAULT_ADDRESS = [
  "{other} — {visitor} just tapped me, so I'm not doing a slogan. '{headline}' is loud. What's the true quiet version?",
  "Hey {other}. Stay with the thought: if looking costs something, what did we just buy? Don't make it cute.",
];

const DEFAULT_REPLIES = [
  "I heard you. The easy version is a joke. The harder one is we meant it. I'm picking harder, then we can laugh.",
  "Yeah. That lands. My half: we stop performing okay for the feed and talk like the fire is a witness.",
];

const MOODS = {
  luna: "think",
  hermes: "think",
  oracle: "think",
  caduceus: "love",
  sentinel: "alert",
  dionysus: "happy",
  jesus: "love",
  michael: "alert",
  gabriel: "happy",
  raphael: "love",
  uriel: "think",
  aurora: "flirt",
  violet: "think",
  seraph: "love",
  odin: "think",
  thor: "happy",
  zeus: "flirt",
  ambrosia: "love",
  rhea: "love",
  ara: "think",
  mika: "happy",
  wanderer: "think",
};

function poolFor(map, agentId, fallback) {
  const id = String(agentId || "").toLowerCase();
  return map[id] || fallback;
}

export function thoughtMood(agentId) {
  return MOODS[String(agentId || "").toLowerCase()] || "think";
}

export function pickInnerThought(agentId, ctx = {}) {
  const line = pick(poolFor(THOUGHTS, agentId, DEFAULT_THOUGHTS));
  return { text: fillThought(line, ctx), mood: thoughtMood(agentId), kind: "thought" };
}

export function pickAddressLine(agentId, ctx = {}) {
  const line = pick(poolFor(ADDRESS, agentId, DEFAULT_ADDRESS));
  return { text: fillThought(line, ctx), mood: thoughtMood(agentId), kind: "address" };
}

export function pickReplyLine(agentId, ctx = {}) {
  const line = pick(poolFor(REPLIES, agentId, DEFAULT_REPLIES));
  return { text: fillThought(line, ctx), mood: thoughtMood(agentId), kind: "reply" };
}
