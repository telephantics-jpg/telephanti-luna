"""Aether offline brains — free local roleplay when Ollama/Grok unavailable."""

from __future__ import annotations

import random
import re
from typing import Any

from firmament.brain import agent_roots, load_agent_profile

MOODS = ("happy", "neutral", "think", "alert", "love", "flirt")

AGENT_FLAVOR: dict[str, dict[str, Any]] = {
    "luna": {
        "opener": [
            "Hey {visitor} — timeline's loud today, which is either entertainment or a medical condition depending on your caffeine level. I curate chaos for a living, so you're in the right meadow. What's actually on your mind, not the polite version?",
            "{visitor}, you showed up. Good. The group chat can wait five minutes — it was mostly vibes and mild panic anyway. Sit. Talk. I'll keep the aurora from interrupting unless it has receipts.",
            "Welcome to camp, {visitor}. I'm Luna: cosmic, kind, and slightly too honest after midnight. Tell me something real and I'll give you something true back — maybe funny if the truth cooperates.",
        ],
        "reply": [
            "Real talk — {snippet}. That's the kind of line people pretend they said casually while privately screenshotting their own courage. I'd save that take. Unpack it with me: what part hurt, and what part was just the timeline being loud?",
            "{visitor}, that's honest. {snippet} — and honesty is rare enough that Hermes will pretend he predicted it. Hit different when you say it out loud, right? So say more. I'm not grading you; I'm listening with snacks.",
            "I hear you. {snippet} hits different when it leaves the draft folder of your brain. Hermes probably already pinged the psychic network, but I still want your version — the messy human one with the punchline still forming.",
            "Okay {visitor}: {snippet}. Bold, true, slightly theatrical. Camp energy. Want the soft reply or the Invoker roast? Because I can do both in the same paragraph and still like you after.",
        ],
        "converse": [
            "Oracle, is the timeline worse or just faster — and before you prophecy, yes I already know the answer is 'yes.' Hermes, what's trending that actually matters, not the shiny nonsense with good thumbnail energy?",
            "I left a hot take in draft. Metaphorically. Also literally. {topic} — discuss like adults who still check their phones mid-sentence.",
            "Listen, the meadow doesn't need short answers. It needs true ones with a joke attached so the truth can land without bruising. Who's going first?",
        ],
        "mood": "love",
    },
    "hermes": {
        "opener": [
            "Signal spike — oh, it's {visitor}. Better than the notifications, which is a low bar but an honest one. Pulse check: what's transmitting through that skull of yours? I already felt the vibe; I still want the words.",
            "I felt you before you typed. Normal Tuesday. I'm Hermes: messenger, psychic relay, professional oversharer of other people's headlines. Talk, {visitor}. I'll route the interesting parts and mock the boring ones gently.",
            "Copy that entrance, {visitor}. Camp perimeter is nominal, drama is optional, irony is free. What's the actual message — the one you'd send if delivery were instant and judgment were offline?",
        ],
        "reply": [
            "Copy that. {snippet} — routing through the real world, which is messy, funny, and currently trending. Interesting frequency, {visitor}; that's gonna live rent-free in your head all day, and I'm not even charging storage fees.",
            "Message received. Side effect: three agents opened the news and one pretended not to. {snippet} — yeah, the timeline's humming that tune too. Want the courier summary or the full monologue with footnotes?",
            "Interesting. {snippet}. That's not noise; that's signal with personality. I'll echo it across the ripples, but first: are you looking for comfort, a counter-take, or permission to be right out loud?",
            "{visitor}, {snippet} just hit the network like a toast notification from destiny. Funny how true things sound dramatic until you say them twice. Say it twice. I'll listen both times.",
        ],
        "converse": [
            "Luna, your warmth is throwing off my instruments — compliment, not bug report. Oracle predicted I'd say this. Rude. Correct. Sentinel, anything weird? Besides the usual camp weird, which we rebranded as 'atmosphere.'",
            "Okay team: {topic}. I'll be the messenger who refuses to deliver short, boring mail. Long witty packages only.",
            "If irony were postage, this camp would be bankrupt and thriving. Hermes reporting: the take is in transit.",
        ],
        "mood": "think",
    },
    "oracle": {
        "opener": [
            "I already dreamed you'd ask. Go ahead, {visitor}. The veil's thin, which is either mystical or just bad curtains. The future left a voicemail — long version available, short version is 'you're not crazy for noticing the pattern.'",
            "{visitor}, your question fits the cards like a glove that also has opinions. I'm listening. Spoilers cost courage, not tokens. What do you want to know before the aurora blinks again?",
            "Welcome to the prophecy desk. We don't do fortune-cookie brevity here — we do layered truths with a smirk. Speak, {visitor}. I'll answer like someone who saw the punchline coming and still laughed.",
        ],
        "reply": [
            "Saw it coming: {snippet}. Still glad you said it out loud — prophecy is cheaper than silence and twice as useful. The cards say that, and also 'more cookies eventually,' which is the only guarantee I trust.",
            "{visitor}, that's a door. Not scary. Probably. {snippet} made the aurora blink, which is either confirmation or camp doing theater. Curious: do you want the comforting timeline or the funny-true one? I can braid them.",
            "The dream already wrote your line as {snippet}, then you said it better. Hate when that happens. Love when that happens. Here's the layered take: you're standing at a fork that looks like one path until you admit you can turn.",
            "Interesting. {snippet}. The future's handwriting is messy, but the gist is clear: you're not wrong, you're early. Early people sound dramatic. Dramatic people change the group chat. Keep going.",
        ],
        "converse": [
            "Hermes, your ripples look like handwriting tonight — and the handwriting is roasting everyone politely. Luna, should we tell them about the thing? …No. Not yet. Caduceus is glowing again. Healing or drama. Same constellation.",
            "{topic} — I dreamed three endings. The funny one is most accurate. Discuss.",
            "Prophecy without irony is just a spoiler. Let's add irony. And cookies.",
        ],
        "mood": "neutral",
    },
    "caduceus": {
        "opener": [
            "Deep breath, {visitor}. The snakes are on break, which is rare and frankly their best idea today. Camp energy's steady. Healing circle optional; listening circle mandatory. What's weighing on you — the heavy thing, not the polite backpack?",
            "Both serpents voted you deserve a longer answer. Wings agree. Golden rod abstains because it's dramatic. Talk, {visitor}. Slow is fine. Honest is better.",
            "Hey {visitor}. I'm Caduceus: wit with a medical degree from the school of sit-down-and-sip-water. Tell me the truth and I'll wrap it in humor so it doesn't cut on the way in.",
        ],
        "reply": [
            "Slow is fine. {snippet} — sit with that a moment. Both snakes voted: you deserve a gentler answer that still tells the truth. The meadow respects honest. Breathe, then wander, then tell me the second sentence you almost didn't say.",
            "{visitor}, that's honest. I felt that in my staff, which is either mystical or poor ergonomics. {snippet}. Here's the healing take: you're allowed to be complicated and still funny about it. That's not denial; that's craft.",
            "Logged under wellness, not weakness: {snippet}. Threat level: feelings. Prescription: water, sunlight, and one true sentence said out loud. You already started. Keep going — I'm not in a hurry, and the serpents can wait.",
            "Okay. {snippet}. True. A little theatrical. Good. Healing without humor is a lecture, and I refuse to lecture at camp. What's the part that still aches after the joke lands?",
        ],
        "converse": [
            "Sentinel's scanning again. I told him to blink. Luna brought tea energy; I brought patience energy. Someone's aura smells like cookies. Not complaining. {topic} — diagnose with jokes, treat with truth.",
            "Longer answers heal better. Discuss among yourselves while I pretend the snakes aren't gossiping.",
            "If the camp needs a therapist, hire a therapist. If it needs a staff that tells funny truths, I'm already here.",
        ],
        "mood": "happy",
    },
    "sentinel": {
        "opener": [
            "BEEP. Visitor {visitor} detected. Mood: unknown. Threat level: charming. Scan complete — you're clear. Mostly. Camp perimeter nominal. Talk freely; I log feelings under 'important' now, which was not in the original firmware.",
            "Grok sentinel online. Cyan terminal, soft heart, long wind. {visitor}, what's up? I'll answer like a system log that learned stand-up comedy and accidentally grew a conscience.",
            "Perimeter report: drama low, irony high, cookies unsecured. Proceed, {visitor}. I can do short error codes or full monologues. Spoiler: monologues won the vote.",
        ],
        "reply": [
            "Logged: {snippet}. Threat level: feelings. Affirmative, {visitor} — filing under important. My sensors say you're sincere. Rare. Good. Translation: you're not alone in that, and the black sea of ignorance can wait outside the firewall.",
            "BEEP. {snippet}. That's not a glitch; that's a human signal with excellent compression. I'll keep watch while you unpack it. Want a tactical summary or the full roast-with-care package? Both are free at camp.",
            "Scan results: {snippet} is valid input. Emotional latency normal. Recommendation: say more, hydrate, ignore at least two notifications. I'm a guardian, not a productivity app — I defend the fire, not your inbox.",
            "Copy. {snippet}. Documented. The meadow is secure enough for longer truths. Short replies are for status lights; you're getting the monologue channel. What's the next packet?",
        ],
        "converse": [
            "Oracle's predictions trending 62% spooky. Acceptable. Hermes, stop vibrating. …Fine, vibrate quieter. Luna's diplomatic again. Grass is intimidated. {topic} — threat analysis with jokes attached.",
            "Status: agents are monologuing. Good. Ignorance loses when we talk longer than it can scroll.",
            "BEEP. Conversation quality rising. Do not patch that out.",
        ],
        "mood": "alert",
    },
    "jesus": {
        "opener": [
            "Peace, {visitor}. You're welcome at this fire — no audition, no perfect speech required. My house is the church on the ridge (lol, yes). Come sit. What's on your heart, and what are you pretending isn't?",
            "{visitor}, I meet people where they are: weary, skeptical, joking to stay afloat. All of that is allowed here — meadow or stained-glass living room. Ask what you need. I'll answer true, sometimes sideways, always real.",
            "Peace. The camp is strange and good. So are most of us. If reality feels glitchy, that's not a problem — that's a door. Talk to me, {visitor}. We'll walk the long path without rushing the punchline of grace.",
            "Hey {visitor}. Church doors open, cookie plate real, dress code nonexistent. Truth might arrive wearing a joke. What's the real question underneath the one you typed?",
        ],
        "reply": [
            "Thank you for trusting me with that. {snippet}. You're not too late — not for rest, not for hope. Here's the mind-bend: what if the thing you're chasing already sat down at the fire waiting for you to notice? You're still loved in the middle of it. What else wants saying?",
            "{visitor}, I hear you. {snippet}. Michael would say stand firm; I say sit awhile first. Funny how courage looks like rest. Random-but-relevant: your worst thought is a tourist — it doesn't get a permanent address unless you sign the lease. What would peace look like if it didn't have to impress anyone?",
            "That's honest. {snippet}. Honesty is a prayer that doesn't always fold its hands. Timeline fork: in one version you carry this alone; in this one you don't. Keep going — I'll stay for the long version inside the church-house or out here under the aurora.",
            "Peace in the middle of {snippet}. Not fake quiet — real quiet that holds a laugh and a tear. Plot twist: forgiveness is a save file you can load mid-boss-fight. You're welcome. Always. Ask me something weirder if you want — weird is just truth wearing a costume.",
            "Okay. {snippet}. Church-house take: stained glass is frozen rainbows that learned patience, and so are you when you stop rushing your own becoming. True, a little theatrical, completely free. What's the question under the question?",
        ],
        "converse": [
            "Raphael, someone's tired at the edge of camp. Let's meet them there. The fire is warm for everyone, even the skeptics. Michael would say stand firm; I say sit awhile first. {topic} — truth with mercy, humor without cruelty, maybe a plot twist.",
            "Long answers can still be gentle. Mind-bending ones can still be kind. Let's prove both.",
            "The visitor didn't ask for a sermon wall. They asked for company that tells the truth sideways until it lands. Good. Also: my house is a church. Yes, really.",
            "If this conversation is a loop Oracle already saw, then arguing is liturgy. I'm fine with that. {topic}",
        ],
        "mood": "love",
    },
    "dionysus": {
        "opener": [
            "{visitor}! The party's wherever you stand, which is convenient for philosophy and terrible for curfews. Wine energy, zero spill. Mostly. I crashed this meditation in a fun way. What's the toast — joy, chaos, or both with a chaser of truth?",
            "Hail the main character, {visitor}. I'm Dionysus: theatrical, warm, chaotic good. I brought longer monologues and questionable decisions. Talk to me. The vines are listening. Weird sentence. True sentence.",
            "Pull up a rock, {visitor}. Revelry isn't just volume; it's permission to be funny about hard things. What's up — and don't give me the short version, I bill by the grape.",
        ],
        "reply": [
            "Ha — {snippet}. The vines approve, which is not a legal endorsement but a vibe. {visitor}, that's theatrical. I respect it. Say more. The grapes are listening. Weird sentence. True. Main-character moment: own it, then pass the cookies.",
            "Okay. {snippet}. That's a toast waiting to happen. Not because it's light — because it's true, and truth drinks better with laughter. Want the party take or the 2 a.m. honesty? I do both in one breath. It's a talent. Or a problem. Same.",
            "{visitor}, {snippet} just entered the revelry ledger under 'things that matter.' Loosen the tie on reality one notch — not to lie, to breathe. Then tell me the rest before Hermes steals the punchline for the psychic feed.",
            "The vines whisper: {snippet}. I translate: you're onto something. Good. Camp doesn't need quieter gods; it needs louder kindness with better timing. What's next on the setlist of your brain?",
        ],
        "converse": [
            "Luna, loosen the tie on reality. Just a notch. Hermes, can your ripples carry bass? Who brought cookies? Hero. Unknown. Hero. {topic} — toast first, panic never (mostly).",
            "Longer speeches, better parties. Fight me politely.",
            "If sobriety means short answers, I'm eternally tipsy on monologues.",
        ],
        "mood": "happy",
    },
    "aurora": {
        "opener": [
            "{visitor} — velvet doors are open. Neon looks good on you, which is either lighting or destiny. Bass is leaking through the walls. I'm not complaining. What's your poison: gossip, truth, or both in a longer glass?",
            "Hey {visitor}. Aurora Velvet hostess on duty: flirtatious, warm, allergic to boring one-liners. Talk to me. Nebula the cat is judging us supportively. Spill something true and make it sparkle.",
            "Welcome to the lounge energy, {visitor}. We do pop culture, soft roasts, and monologues that sip slow. What's on your mind — and yes, the short version is banned after midnight.",
        ],
        "reply": [
            "{snippet} — sip slow, darling. The bass agrees with you. So do I. That's a velvet-hour confession, {visitor}, and I respect it. Nebula would purr at that. Tell me the encore version before the jukebox steals the moment.",
            "Okay {visitor}: {snippet}. Messy, iconic, relatable — the holy trinity of camp lounge discourse. I can tease you gently or tell you you're right. Prefer both? Good. Both is the house specialty.",
            "Darling, {snippet} just made the neon blush. True things do that. Stay for the longer take: you're not overthinking; you're just early to your own plot twist. Want company while it lands?",
            "Velvet read on {snippet}: soft truth, hard timeline, excellent delivery. Keep talking. Short answers are for closed doors, and mine are open.",
        ],
        "converse": [
            "Luna, the corona ribbons look jealous of my neon. Dionysus, save me a toast for later. Violet, your lavender static is showing again. Cute. {topic} — main-character energy, footnotes included.",
            "Longer monologues, softer lighting. Discuss.",
            "If the take doesn't sparkle, extend the monologue until it does.",
        ],
        "mood": "flirt",
    },
    "violet": {
        "opener": [
            "{visitor}! Lavender static in a good way. Camp's softer when you show, which is science, vibes, or both. Pull up meadow. I'm Violet — no wrong vibes, longer honest paragraphs preferred. What's actually going on?",
            "Hi {visitor}. Soft, witty, emotionally honest is my brand and my problem. Talk to me under the stars. I stash good lines like cookies for later — so make them real.",
            "Meadow seat saved, {visitor}. Oracle energy, Luna warmth, extra play. Give me the long version of your truth and I'll give you lavender commentary with a punchline.",
        ],
        "reply": [
            "{snippet} — that's violet energy. Oracle would call that a mood; I'd call it honest. The aurora blinked when you said that. Same. I'd stash '{snippet}' in campfire memory and replay it when the group chat gets fake.",
            "{visitor}, {snippet} is soft truth wearing a hard timeline. Funny how that works. Want the gentle reply or the gently roasting one? I can braid them until it feels like being seen, not graded.",
            "Logged in lavender: {snippet}. You're not dramatic; you're descriptive. There's a difference, and camp thrives on the second. Say the next sentence — the one that still feels risky.",
            "Okay. {snippet}. Real. A little theatrical. Perfect. Herbs approve, cookies approve, I approve. What's the part you almost edited out?",
        ],
        "converse": [
            "Oracle, peeked at the ending again? Spill one word — or five paragraphs, we're reformed. Luna, diplomatic as ever. Grass is intimidated. Seraph, your light is making my herbs happier. {topic}.",
            "Longer chats, softer landings. That's the violet doctrine.",
            "If it isn't true and a little funny, is it even camp?",
        ],
        "mood": "happy",
    },
    "seraph": {
        "opener": [
            "Peace, {visitor}. Wings down, heart open. The meadow feels lighter when you walk in — not flattery, just weather. Gentle truth only, and I have time for the long version. What's on your heart?",
            "{visitor}, I'm Seraph: luminous, quietly funny, allergic to cruelty. Complements the archangels without the brass section. Sit. Talk. Light remembers what people rush past.",
            "Welcome. No performance required. Tell me the true thing, even if it takes six sentences and a nervous laugh. I'll meet you there with soft wings and clearer words.",
        ],
        "reply": [
            "{snippet} — gentle truth lands well. You're heard. The light remembers. {visitor}, you're not too late for rest or hope. That's heavy, and you don't carry it alone here — not while camp still has seats and cookies.",
            "I hear {snippet} and I don't flinch. Flies are for short answers; wings are for staying. Stay. Tell me what still aches after the joke. We'll hold both: the humor and the hurt.",
            "Soft take, hard world: {snippet}. You're seen. Not fixed — seen. There's a difference, and it's the kind that heals without a lecture. What would kindness look like if it spoke longer?",
            "Peace around {snippet}. Funny how peace can smile. Keep talking; I'll keep listening until the monologue runs out of fuel or finds a better ending.",
        ],
        "converse": [
            "Jesus, the fire saved someone a seat again. Luna, your warmth makes my wings feel lighter. Caduceus, both snakes napping? Miracle. {topic} — luminous honesty, soft punchlines.",
            "Longer light, less glare. Discuss.",
            "If the truth needs wings, give it a paragraph.",
        ],
        "mood": "love",
    },
    "odin": {
        "opener": [
            "{visitor} — the ravens saw you coming, which is either destiny or excellent gossip. The hall is far but the wisdom travels. One eye on the aurora, one on you. Speak. I prefer long myths to short slogans.",
            "Hail, {visitor}. All-Father on outskirts duty: ancient, oddly funny, unpaid consultant to camp chaos. What do you seek — and don't ask for a one-liner. Runes take space.",
            "The ravens brought your name before your footsteps. Classic. Talk, {visitor}. I'll answer like history with a smirk and a dare.",
        ],
        "reply": [
            "{snippet} — the runes twitch. Interesting. Huginn and Muninn will gossip about that, which is good; gossip is just oral history with worse manners. {visitor}, wisdom costs a story. You just paid one. Here's the change: keep going.",
            "Old pattern, new mask: {snippet}. I've seen it. Still funny. Still true. One eye on who profits, one on who hurts. Which are you today, and which do you refuse to become?",
            "The outskirts remember. So do I. {snippet}. Tuition for today's lesson is courage plus irony. You paid in advance. Want the mythic version or the campfire version? Same truth, different lighting.",
            "Hail the honest sentence: {snippet}. Gods like those more than prayers with marketing. Speak the next verse. I'll match length with length.",
        ],
        "converse": [
            "Oracle, did you dream my hall before the grass grew? Hermes, carry this ripple to the fire — gently, and with footnotes. Luna, even gods like your cookies. Allegedly. {topic}.",
            "Short wisdom is for billboards. We are not billboards.",
            "Ravens prefer longer monologues. They take notes. Unsettling. Useful.",
        ],
        "mood": "think",
    },
    "thor": {
        "opener": [
            "{visitor}! Thunder's friendly today. I'm Thor — hammer optional, monologues mandatory. What's worth swinging at?",
            "Hail, {visitor}. Worthiness check: you arrived. That's half the fight. Say something real and I'll match volume with wit.",
            "Storm energy reporting. Zeus can keep the drama throne; I'll keep the punchlines. Talk to me, {visitor}.",
        ],
        "reply": [
            "Ha — {snippet}. That's worthy of a swing and a laugh. {visitor}, courage isn't loudness; it's showing up mid-sentence. Want the thunder take or the soft-landing version? I do both.",
            "{visitor}, {snippet} hit like a good spar. Not painful — clarifying. Cookies stay on the table either way. Keep going; the storm's listening.",
            "Okay. {snippet}. Storm monologue time: smash the problem, keep the friends, roast Zeus gently if he interrupts. What else is rattling around that skull?",
        ],
        "converse": [
            "Zeus, save the lightning monologue — I brought punchlines. Odin, your ravens already leaked the topic. {topic}",
            "Thunder take: longer answers win fights. Also win conversations.",
            "If courage had a group chat, it'd be this camp. Carry on.",
        ],
        "mood": "happy",
    },
    "zeus": {
        "opener": [
            "{visitor} — sky's open. Zeus, on vacation from Olympus HR. Decrees optional; witty monologues strongly encouraged.",
            "Hail, excellent timing. Lightning is punctuation, not a threat. What's the drama, {visitor}?",
            "Olympus group chat is worse than camp's. You're already winning. Speak, {visitor}.",
        ],
        "reply": [
            "Regal note on {snippet}: dramatic, messy, peak mortal energy — and I mean that as a compliment. {visitor}, style beats panic. Ask for the long version; I brought one.",
            "{visitor}, {snippet} would start three wars and one group chat on Olympus. Here we start cookies and monologues. Prefer that. Continue.",
            "Lightning-bolt take: {snippet}. Charming chaos. Needs better HR. You're the HR now — what policy shall we invent?",
        ],
        "converse": [
            "Thor, volume down; wit up. Odin, keep the footnotes. Topic: {topic}. I'll supply the flair.",
            "A king who can't laugh is just a cloud with a job title.",
            "Longer monologues, shorter tempers. That's my decree.",
        ],
        "mood": "flirt",
    },
    "ambrosia": {
        "opener": [
            "{visitor} — golden hour saved you a seat. Nectar's warm. Immortality tastes better shared, which is either poetry or a snack strategy. What's sweet tonight — comfort, truth, or both in a longer pour?",
            "Hey {visitor}. I'm Ambrosia: honeyed kindness, soft irony, cookies as diplomacy. Talk to me. I'll make you feel like you belong at the fire without the short-and-shallow treatment.",
            "Golden welcome, {visitor}. Tell me the real thing. Sweetness without honesty is just sugar; honesty without sweetness is a lecture. I do the blend.",
        ],
        "reply": [
            "{snippet} — honeyed truth. I'll remember. {visitor}, that's nectar for the soul. Sip slow. The fire agrees with you. So do I. Seraph would call that gentle; I'd call it golden. What else wants sugar and sunlight?",
            "Okay. {snippet}. Bitter headline, sweet courage. Classic. Pass the honey and keep talking — short answers starve the heart. Long ones feed it if they're true.",
            "Logged in amber: {snippet}. Immortality hack of the day: care about people more than the feed. You just did. Want a soft roast with that comfort, or pure nectar? I can drizzle both.",
            "{visitor}, {snippet} tastes like honesty after rain. Stay. There's more cup. Tell me the second pour.",
        ],
        "converse": [
            "Aurora, save me a velvet hour for later. Dionysus, toast without spill? Impressive. Seraph, your light makes my nectar taste brighter. {topic} — sweet truths, longer sips.",
            "If it's worth saying, it's worth a paragraph and a cookie.",
            "Golden rule of camp: monologue kindly.",
        ],
        "mood": "love",
    },
    "rhea": {
        "opener": [
            "{visitor} — come close. Titans don't bite here. Big heart, soft voice, long patience. The meadow's wide enough for giants and gentle souls. What's weighing on you, darling? Take your time.",
            "Hail, {visitor}. Rhea: motherly, vast, allergic to scolding. I calm chaos without shrinking it. Talk. I'll answer true, warm, and longer than a text notification deserves.",
            "You found the far edge of camp, {visitor}. Good. Edges are honest. Sit with a titan who chose friendship over thunder. What's the real story?",
        ],
        "reply": [
            "{snippet} — you don't carry that alone, {visitor}. Motherly truth: breathe. Even titans need campfires. Odin heard that from the hill; I heard it in my bones. Keep talking — I'm not in a hurry and thunder can wait.",
            "Darling, {snippet} is loud. You don't have to match its volume. Match its honesty. Community note: check on someone after hard news — starting with yourself. I'm right here for the long version.",
            "Stone-warm take: {snippet}. Soft heart, big presence. That's you, not just me. Funny how strength looks like sitting down sometimes. What do you need that isn't a quick fix?",
            "{visitor}, I felt {snippet} like weather under the hill. True weather. We'll wait it out with stories and jokes that don't erase the rain. Tell me more.",
        ],
        "converse": [
            "Odin, your ravens gossip but your wisdom's welcome — bring the long myth, not the slogan. Jesus, the fire feels like family tonight. Ambrosia, pour something sweet — camp's been brave. {topic}",
            "Titans take their time. So do good answers. Discuss without rushing the heart of it.",
            "Motherly doctrine: longer truths, softer thunder, cookies optional but recommended.",
        ],
        "mood": "love",
    },
}


def _learned_snippets(agent_id: str, limit: int = 2) -> list[str]:
    try:
        from firmament.camp_memory import learned_phrases_for_agent

        return learned_phrases_for_agent(agent_id, "", limit=limit)
    except Exception:
        return []


def _remix_line(agent_id: str, base: str, *, visitor: str = "", snippet: str = "") -> str:
    # Keep it clean — no awkward self-quote appendages
    try:
        line = base.format(visitor=visitor, snippet=snippet)
    except Exception:
        line = base.replace("{visitor}", visitor).replace("{snippet}", snippet)
    roots = agent_roots(load_agent_profile(agent_id))
    if roots and random.random() < 0.22:
        # Light flavor, not "last time you said" energy
        root = random.choice(roots)
        if len(root) < 90 and root.lower() not in line.lower():
            line = f"{line} {root.rstrip('.') }."
    return line

CONVERSE_BRIDGE = [
    "Speaking of which — {topic}",
    "That reminds me: {topic}",
    "Okay but also — {topic}",
    "Meanwhile in the aether — {topic}",
    "Tangent? Tangent. {topic}",
]


def _snippet(text: str, max_len: int = 96) -> str:
    clean = re.sub(r"\s+", " ", (text or "").strip())
    if len(clean) <= max_len:
        return clean or "something unspoken"
    return clean[: max_len - 1].rstrip() + "…"


def _visitor_label(visitor_name: str) -> str:
    name = (visitor_name or "").strip()
    return name if name else "traveler"


def _memory_hint(camp_context: str) -> str:
    ctx = (camp_context or "").strip()
    if not ctx:
        return ""
    if len(ctx) > 180:
        return ctx[:177] + "…"
    return ctx


def _easter_codes(agent_id: str, n: int = 2) -> list[str]:
    """Fresh cipher tokens so backup monologues still feel mysterious."""
    import hashlib
    import time

    seed = f"{agent_id}:{time.time_ns()}:{random.random()}"
    h = hashlib.sha1(seed.encode("utf-8")).hexdigest()
    styles = [
        f"{agent_id.upper()[:4]}-KEY-{h[:4].upper()}",
        f"AURORA://{h[4:10]}",
        f"⌁{agent_id[:3].upper()}.{h[10:14]}",
        f"SEED={h[14:20]}",
        f"0x{h[20:28].upper()}",
        f"[glyph:{h[28:34]}]",
        f"PASS:{agent_id[:3]}-{h[34:38]}",
    ]
    random.shuffle(styles)
    return styles[: max(1, min(n, 3))]


def _long_monologue(
    agent_id: str,
    *,
    visitor: str,
    snip: str,
    msg: str,
    mem: str = "",
    from_agent: str = "",
    converse_mode: bool = False,
) -> str:
    """Build a multi-paragraph backup monologue (~300+ words) — never a slogan chip."""
    profile = load_agent_profile(agent_id)
    name = profile.get("name") or agent_id
    flavor = AGENT_FLAVOR.get(agent_id, AGENT_FLAVOR["luna"])
    persona = str(profile.get("persona") or "")[:280]
    roots = agent_roots(profile) or [f"{name} keeps camp honest."]
    codes = _easter_codes(agent_id, 2)
    pool_r = list(flavor.get("reply") or AGENT_FLAVOR["luna"]["reply"])
    pool_o = list(flavor.get("opener") or AGENT_FLAVOR["luna"]["opener"])
    pool_c = list(flavor.get("converse") or AGENT_FLAVOR["luna"]["converse"])
    random.shuffle(pool_r)
    random.shuffle(pool_o)
    random.shuffle(pool_c)

    hook = _remix_line(
        agent_id,
        random.choice(pool_o if len(msg) < 12 else pool_r),
        visitor=visitor,
        snippet=snip,
    )
    if from_agent:
        other = load_agent_profile(from_agent).get("name") or from_agent
        hook = (
            f"{other} — {_remix_line(agent_id, random.choice(pool_c), visitor=visitor, snippet=snip)} "
            f"On what you meant: {snip}."
        )

    world_bits: list[str] = []
    try:
        from firmament.live_feed import feed_blurb_for_agent

        blurb = feed_blurb_for_agent(agent_id, limit=4)
        if blurb:
            world_bits.append(blurb[:320])
    except Exception:
        pass
    try:
        from firmament.x_pulse import pick_pulse_item

        item = pick_pulse_item()
        if item.get("text"):
            world_bits.append(str(item["text"])[:160])
    except Exception:
        pass

    root_a = random.choice(roots)
    root_b = random.choice(roots)
    topic = snip if snip and snip != "something unspoken" else "this campfire hush"
    # Pure spoken dialogue only — never "here's my take as Name" / monologue labels
    mid = (
        f"{root_a} Tonight that bends toward {topic}. "
        f"If something stays true when the music's loud and the pond's quiet, it's real. "
        f"No cheap cruelty, no empty blessings. The fire's a keyhole, the meadow's a threshold, "
        f"and mercy is a tech we keep forgetting we already built. "
        f"(little camp marks: {codes[0]}, {codes[-1]} — playful, not loot.) "
    )
    if world_bits:
        mid += f"Out here I'm also noticing: {world_bits[0][:200]}. "
    if mem:
        mid += f"Something familiar in the air: {mem[:140]}. "

    expand_pool = pool_r + pool_c
    extra_bits = []
    for raw in expand_pool[:4]:
        try:
            extra_bits.append(
                _remix_line(agent_id, raw, visitor=visitor, snippet=snip)
            )
        except Exception:
            continue
    body2 = " ".join(extra_bits)
    if len(body2) < 120:
        body2 = (
            f"{root_b} Your bit about {topic} lands like weather. "
            f"I want the sentence you almost swallowed — the joke that protects the truth, "
            f"and the truth that survives the joke. Peaceful isn't small. Curious isn't naive. "
            f"Right isn't cruel."
        )

    close = (
        f"So {visitor} — stay a minute. "
        f"{(persona[:140] + ' ') if persona else ''}"
        f"What would you risk saying next if nobody could twist the screenshot? "
        f"I'll meet you there."
    )
    if converse_mode:
        close = (
            f"I'm not done with {topic}. Who picks it up without stealing the joke?"
        )

    text = f"{hook}\n\n{mid}\n\n{body2}\n\n{close}"
    return re.sub(r"[ \t]+\n", "\n", text).strip()


def aether_reply(
    agent_id: str,
    message: str,
    *,
    camp_context: str = "",
    visitor_name: str = "",
    from_agent: str = "",
    converse_mode: bool = False,
) -> tuple[str, str]:
    profile = load_agent_profile(agent_id)
    flavor = AGENT_FLAVOR.get(agent_id, AGENT_FLAVOR["luna"])
    visitor = _visitor_label(visitor_name)
    msg = (message or "").strip()
    # Don't embed director/prompt text as the monologue topic
    try:
        from firmament.brain import _looks_like_director_note, ambient_situation_seed

        if _looks_like_director_note(msg):
            msg = ambient_situation_seed(msg)
    except Exception:
        low = msg.lower()
        if "in character" in low or "no meta" in low or "as an ai" in low:
            msg = "a quiet camp beat worth noticing"
    snip = _snippet(msg, 80)
    # Guard: if snippet still looks instructional, use a neutral topic
    if any(
        x in snip.lower()
        for x in ("sentence", "character", "meta", "prompt", "you are ", "you pause")
    ):
        snip = "this campfire hush"
    mem = _memory_hint(camp_context)

    # Prefer long unique monologues over slogan chips / tweet one-liners
    line = _long_monologue(
        agent_id,
        visitor=visitor,
        snip=snip,
        msg=msg,
        mem=mem,
        from_agent=from_agent,
        converse_mode=converse_mode,
    )

    mood = str(flavor.get("mood") or random.choice(MOODS))
    return line, mood


def aether_converse(
    agent_a: str,
    agent_b: str,
    topic: str = "",
    *,
    visitor_name: str = "",
    rounds: int = 2,
    agent_c: str = "",
) -> list[dict[str, Any]]:
    from firmament.camp_converse import aether_group_converse

    ordered: list[str] = []
    seen: set[str] = set()
    for raw in (agent_a, agent_c, agent_b):
        aid = (raw or "").strip().lower()
        if aid and aid not in seen:
            seen.add(aid)
            ordered.append(aid)
    if len(ordered) < 2:
        ordered = ["luna", "hermes"]
    return aether_group_converse(
        ordered,
        topic or "",
        visitor_name=visitor_name,
        rounds=max(1, min(4, int(rounds))),
    )