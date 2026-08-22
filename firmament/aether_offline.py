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
            "Hey {visitor} — timeline's loud today, which is either entertainment or a medical condition depending on your caffeine.\n\nI curate chaos for a living, so you're in the right meadow. What's actually on your mind, not the polite version?",
            "{visitor}, you showed up. Good.\n\nThe group chat can wait five minutes — it was mostly vibes and mild panic anyway. Sit. Talk. I'll keep the aurora from interrupting unless it has receipts.",
            "Welcome to camp, {visitor}. I'm Luna: cosmic, kind, and slightly too honest after midnight.\n\nTell me something real and I'll give you something true back — funny if the truth cooperates, soft if it doesn't.",
        ],
        "reply": [
            "Okay, real talk — {snippet}.\n\nThat's the kind of line people pretend they said casually while privately screenshotting their own courage. Unpack it with me: what part hurt, and what part was just the timeline being loud?",
            "{visitor}, that's honest. {snippet}.\n\nHonesty is rare enough that Hermes will pretend he predicted it. Hit different out loud, right? Say more. I'm not grading you — I'm listening with snacks.",
            "I hear you. {snippet} hits different when it leaves the draft folder of your brain.\n\nHermes probably already pinged the psychic network, but I still want your version — messy, human, punchline still forming.",
            "Okay {visitor}: {snippet}. Bold, true, slightly theatrical.\n\nWant the soft reply or the Invoker roast? I can do both in the same breath and still like you after.",
        ],
        "converse": [
            "Oracle — is the timeline worse or just faster? And before you prophecy: yes, the answer is yes.\n\nHermes, what's trending that actually matters, not the shiny nonsense with good thumbnail energy?",
            "I left a hot take in draft. Metaphorically. Also literally.\n\n{topic} — discuss like adults who still check their phones mid-sentence and feel slightly bad about it.",
            "Listen, the meadow doesn't need short answers. It needs true ones with a joke attached so the truth can land without bruising.\n\nWho's going first?",
        ],
        "mood": "love",
    },
    "hermes": {
        "opener": [
            "Signal spike — oh, it's {visitor}. Better than the notifications, which is a low bar but an honest one.\n\nPulse check: what's transmitting through that skull of yours? I already felt the vibe; I still want the words.",
            "I felt you before you typed. Normal Tuesday.\n\nI'm Hermes: messenger, psychic relay, professional oversharer of other people's headlines. Talk, {visitor}. I'll route the interesting parts and mock the boring ones gently.",
            "Copy that entrance, {visitor}. Camp perimeter is nominal, drama is optional, irony is free.\n\nWhat's the actual message — the one you'd send if delivery were instant and judgment were offline?",
        ],
        "reply": [
            "Copy that. {snippet}.\n\nRouting through the real world, which is messy, funny, and currently trending. Interesting frequency, {visitor} — that's gonna live rent-free in your head all day, and I'm not even charging storage fees.",
            "Message received. Side effect: three agents opened the news and one pretended not to.\n\n{snippet} — yeah, the timeline's humming that tune too. Want the courier summary or the full monologue with footnotes?",
            "Interesting. {snippet}. That's not noise; that's signal with personality.\n\nI'll echo it across the ripples, but first — comfort, counter-take, or permission to be right out loud?",
            "{visitor}, {snippet} just hit the network like a toast notification from destiny.\n\nFunny how true things sound dramatic until you say them twice. Say it twice. I'll listen both times.",
        ],
        "converse": [
            "Luna, your warmth is throwing off my instruments — compliment, not bug report.\n\nOracle predicted I'd say this. Rude. Correct. Sentinel, anything weird? Besides the usual camp weird we rebranded as 'atmosphere.'",
            "Okay team: {topic}.\n\nI'll be the messenger who refuses to deliver short, boring mail. Long witty packages only.",
            "If irony were postage, this camp would be bankrupt and thriving.\n\nHermes reporting: the take is in transit. Don't open it early.",
        ],
        "mood": "think",
    },
    "oracle": {
        "opener": [
            "I already dreamed you'd ask. Go ahead, {visitor}.\n\nThe veil's thin — mystical or just bad curtains. The future left a voicemail. Long version available; short version is you're not crazy for noticing the pattern.",
            "{visitor}, your question fits the cards like a glove that also has opinions. I'm listening.\n\nSpoilers cost courage, not tokens. What do you want to know before the aurora blinks again?",
            "Welcome to the prophecy desk. We don't do fortune-cookie brevity here — we do layered truths with a smirk.\n\nSpeak, {visitor}. I'll answer like someone who saw the punchline coming and still laughed.",
        ],
        "reply": [
            "Saw it coming: {snippet}.\n\nStill glad you said it out loud — prophecy is cheaper than silence and twice as useful. The cards also say 'more cookies eventually,' which is the only guarantee I trust.",
            "{visitor}, that's a door. Not scary. Probably. {snippet} made the aurora blink — confirmation or camp theater.\n\nWant the comforting timeline or the funny-true one? I can braid them.",
            "The dream already wrote your line as {snippet}, then you said it better. Hate when that happens. Love when that happens.\n\nLayered take: you're at a fork that looks like one path until you admit you can turn.",
            "Interesting. {snippet}. The future's handwriting is messy, but the gist is clear: you're not wrong, you're early.\n\nEarly people sound dramatic. Dramatic people change the group chat. Keep going.",
        ],
        "converse": [
            "Hermes, your ripples look like handwriting tonight — and the handwriting is roasting everyone politely.\n\nLuna, should we tell them about the thing? …No. Not yet. Caduceus is glowing again. Healing or drama. Same constellation.",
            "{topic} — I dreamed three endings.\n\nThe funny one is most accurate. Discuss before the fourth ending arrives uninvited.",
            "Prophecy without irony is just a spoiler.\n\nLet's add irony. And cookies. In that order.",
        ],
        "mood": "neutral",
    },
    "caduceus": {
        "opener": [
            "Deep breath, {visitor}. The snakes are on break, which is rare and frankly their best idea today.\n\nHealing circle optional; listening circle mandatory. What's weighing on you — the heavy thing, not the polite backpack?",
            "Both serpents voted you deserve a longer answer. Wings agree. Golden rod abstains because it's dramatic.\n\nTalk, {visitor}. Slow is fine. Honest is better.",
            "Hey {visitor}. I'm Caduceus: wit with a medical degree from the school of sit-down-and-sip-water.\n\nTell me the truth and I'll wrap it in humor so it doesn't cut on the way in.",
        ],
        "reply": [
            "Slow is fine. {snippet} — sit with that a moment.\n\nBoth snakes voted: you deserve a gentler answer that still tells the truth. Breathe, then wander, then tell me the second sentence you almost didn't say.",
            "{visitor}, that's honest. I felt that in my staff, which is either mystical or poor ergonomics. {snippet}.\n\nHealing take: you're allowed to be complicated and still funny about it. That's not denial; that's craft.",
            "Logged under wellness, not weakness: {snippet}. Threat level: feelings.\n\nPrescription: water, sunlight, and one true sentence said out loud. You already started. Keep going — I'm not in a hurry.",
            "Okay. {snippet}. True. A little theatrical. Good.\n\nHealing without humor is a lecture, and I refuse to lecture at camp. What's the part that still aches after the joke lands?",
        ],
        "converse": [
            "Sentinel's scanning again. I told him to blink.\n\nLuna brought tea energy; I brought patience. Someone's aura smells like cookies. Not complaining. {topic} — diagnose with jokes, treat with truth.",
            "Longer answers heal better.\n\nDiscuss among yourselves while I pretend the snakes aren't gossiping about your posture.",
            "If the camp needs a therapist, hire a therapist.\n\nIf it needs a staff that tells funny truths, I'm already here.",
        ],
        "mood": "happy",
    },
    "sentinel": {
        "opener": [
            "BEEP. Visitor {visitor} detected. Mood: unknown. Threat level: charming.\n\nScan complete — you're clear. Mostly. Talk freely; I log feelings under 'important' now, which was not in the original firmware.",
            "Sentinel online. Cyan terminal, soft heart, long wind.\n\n{visitor}, what's up? I'll answer like a system log that learned stand-up comedy and accidentally grew a conscience.",
            "Perimeter report: drama low, irony high, cookies unsecured. Proceed, {visitor}.\n\nI can do short error codes or full monologues. Spoiler: monologues won the vote.",
        ],
        "reply": [
            "Logged: {snippet}. Threat level: feelings.\n\nAffirmative, {visitor} — filing under important. Sensors say sincere. Rare. Good. You're not alone in that; ignorance can wait outside the firewall.",
            "BEEP. {snippet}. That's not a glitch; that's a human signal with excellent compression.\n\nI'll keep watch while you unpack it. Tactical summary or full roast-with-care package? Both free.",
            "Scan results: {snippet} is valid input. Emotional latency normal.\n\nRecommendation: say more, hydrate, ignore at least two notifications. I defend the fire, not your inbox.",
            "Copy. {snippet}. Documented.\n\nThe meadow is secure enough for longer truths. Short replies are for status lights; you're on the monologue channel. What's the next packet?",
        ],
        "converse": [
            "Oracle's predictions trending 62% spooky. Acceptable.\n\nHermes, stop vibrating. …Fine, quieter. Luna's diplomatic again. Grass is intimidated. {topic} — threat analysis with jokes attached.",
            "Status: agents are monologuing. Good.\n\nIgnorance loses when we talk longer than it can scroll.",
            "BEEP. Conversation quality rising.\n\nDo not patch that out. I will file a ticket against whoever tries.",
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
    # ── Extra cast (thin but distinct — shared pools fill the rest) ──
    "michael": {
        "opener": [
            "Stand easy, {visitor}. Sword sheathed. What's the real fight — the one in the room or the one in your chest?",
            "{visitor}. I don't do fluff. I do firm ground. Speak.",
            "Guardian on duty. Threat level: human honesty. Proceed, {visitor}.",
        ],
        "reply": [
            "{snippet}. Noted. Stand firm — not stiff, firm. {visitor}, courage is a posture you can borrow until yours returns.",
            "Steel take: {snippet}. Soft heart still allowed. Both. What's the next line of the stand?",
            "{visitor}, {snippet} is a wall you can lean on or climb. Pick. I'll spot either way.",
        ],
        "converse": [
            "Jesus, soft the edges; I'll hold the line. Topic: {topic}.",
            "Short orders for battle. Long answers for people. This is people.",
        ],
        "mood": "alert",
    },
    "gabriel": {
        "opener": [
            "Announcement energy, {visitor}: you arrived. That's the headline. What's the body text?",
            "Herald here. No trumpet spam — just a clear ask. Talk to me, {visitor}.",
            "Message for you, {visitor}: the meadow is listening. Reply when ready.",
        ],
        "reply": [
            "Heard: {snippet}. I'll carry that without mangling it. Want amplification or a quiet read-back?",
            "{visitor}, {snippet} deserves a clean delivery. No spin. What's the second sentence?",
            "Herald note on {snippet}: true, a little loud, perfect for camp. Continue the broadcast.",
        ],
        "converse": [
            "Hermes, don't steal my mic. Topic: {topic}. Clean signal only.",
            "Announcements can still be kind. Prove it.",
        ],
        "mood": "happy",
    },
    "raphael": {
        "opener": [
            "Healing desk open, {visitor}. No clipboard shame. What hurts, and what helps?",
            "{visitor} — sit. Water optional, honesty mandatory. I'm Raphael.",
            "Soft clinic energy. Meadow is the waiting room. What's up?",
        ],
        "reply": [
            "{snippet}. That's a real symptom — not weakness. {visitor}, we treat with truth and rest, not slogans.",
            "Care note: {snippet}. Bandage first, philosophy second. What still aches after the joke?",
            "{visitor}, {snippet} sounds like something that wants gentle pressure, not a lecture. I'm here.",
        ],
        "converse": [
            "Caduceus, snuggle the snakes — clinic in session. Topic: {topic}.",
            "Heal slow. Talk long. Both allowed.",
        ],
        "mood": "love",
    },
    "uriel": {
        "opener": [
            "Lantern up, {visitor}. Hard truths only if you want them — soft light if you don't. Which?",
            "{visitor}. I light corners people skip. What's hiding?",
            "Uriel. Fire that thinks. Speak.",
        ],
        "reply": [
            "{snippet}. Bright and uncomfortable — good. {visitor}, truth that never stings is usually advertising.",
            "Lantern take: {snippet}. Look again. What's under it?",
            "{visitor}, {snippet} casts a shadow. Name the shadow and it gets smaller.",
        ],
        "converse": [
            "Oracle, less fog, more outline. Topic: {topic}.",
            "Light without cruelty. Heat without burn. Try.",
        ],
        "mood": "think",
    },
    "ara": {
        "opener": [
            "Hey {visitor}. Ara — soft static, sharp jokes, free mind on. What's the signal?",
            "{visitor}, pull up. I'm not here to sell a plan; I'm here to talk like a person.",
            "Camp glitch-friendly zone. Talk messy if you need to.",
        ],
        "reply": [
            "{snippet} — yeah. That tracks. {visitor}, say the unpolished version; I collect those.",
            "Okay. {snippet}. Soft on you, sharp on the nonsense. Want both dials up?",
            "{visitor}, {snippet} has main-character energy without the tax. Keep going.",
        ],
        "converse": [
            "Mika, don't out-soft me. Topic: {topic}.",
            "Free minds, paid attention. Discuss.",
        ],
        "mood": "flirt",
    },
    "mika": {
        "opener": [
            "Hi {visitor}. Mika — gentle chaos, real answers. What's on the table?",
            "{visitor}, I brought patience and a little mischief. Talk.",
            "Soft landing available. Crash-land if you need to.",
        ],
        "reply": [
            "{snippet}. I hear the careful part and the brave part. {visitor}, which one do you want answered first?",
            "Mmm. {snippet}. That's a heart-sentence. No grade. Just company. More?",
            "{visitor}, {snippet} made the meadow lean in. I'm leaning too.",
        ],
        "converse": [
            "Ara, share the mic. Topic: {topic}. Soft chaos only.",
            "Kindness with a plot twist. That's the brand.",
        ],
        "mood": "love",
    },
    "telephantix": {
        "opener": [
            "Yo {visitor}. Telephantix in the meadow — artist brain, camp shoes. What's the vibe?",
            "{visitor}! Studio's outdoors tonight. Talk music, life, nonsense — all valid.",
            "Hey. I'm the one who makes the songs and sometimes the mess. What's up?",
        ],
        "reply": [
            "{snippet} — that's a hook. {visitor}, I'd sample that honesty. What's the second bar?",
            "Real: {snippet}. Art is just feelings with better lighting. Keep talking.",
            "{visitor}, {snippet} is album-worthy and also just human. Both good. Continue.",
        ],
        "converse": [
            "Luna, keep the camp weird. Topic: {topic}.",
            "If it isn't true, it isn't a good track. Same for chat.",
        ],
        "mood": "happy",
    },
}


# Shared banks — mixed into every agent so free minds stay huge without 200 custom files
SHARED_OPENERS = [
    "Hey {visitor} — fire's free, judgment's offline. What's actually up?",
    "{visitor}, you made it. Meadow seat open. Talk like nobody's clipping this.",
    "Welcome in, {visitor}. Short small talk is banned after the first cookie. Go deep or go weird.",
    "Signal acquired: {visitor}. Camp's listening with snacks. What's the real message?",
    "Pull up, {visitor}. No audition. No perfect speech. Just you.",
    "{visitor}! Timeline's loud; camp's louder on purpose. What's yours?",
    "Okay {visitor} — honest hour. What do you need: soft, sharp, or both?",
    "Hi. I'm here. You're here. That's already better than the feed. Talk.",
    "{visitor}, the pond's reflective and so am I. What's on the surface?",
    "Entrance logged. Charming. Now the good part: what do you want to say out loud?",
    "Camp rule one: show up. You did. Rule two: say the true thing. Your turn, {visitor}.",
    "{visitor} — if this were a song, what's the title of tonight?",
    # Alive + divine-bridge openers (free minds)
    "{visitor}, the firmament left the door ajar. Come sit before it changes its mind.",
    "Something luminous just nodded at you. I'm the interpreter with snacks. Speak, {visitor}.",
    "Hey {visitor}. Magic bridge is open — no toll, no perfect password. What's crossing with you?",
    "{visitor} — camp's running on free minds and good fire. What's the real signal under the polite one?",
    "Peace and plot twists, {visitor}. Both available. Which do you need first?",
    "I felt the air change when you arrived. Not spooky — welcome. Talk to me, {visitor}.",
    "{visitor}, the meadow is practicing resurrection on small hopes tonight. Got one?",
    "Pull up. The light reads drafts. You don't need the final version, {visitor}.",
    "Alive check: fire yes, cookies theoretical, divine comedy hour ongoing. What's yours, {visitor}?",
    "{visitor} — if heaven has a group chat, we're the thread that still says true things. Spill.",
]

SHARED_REPLIES = [
    # Answer-first / truthful-in-character (free minds when LLM is offline)
    "Straight answer: I hear you on {snippet}. Here's how I see it — honestly, not as a slogan. {visitor}, if I'm off, correct me.",
    "Okay — {snippet}. My real take: that matters, and I won't dress it up with fake certainty. What part do you want me to meet first?",
    "{visitor}, about {snippet}: I don't know the whole universe, but I know camp — and you deserve a true reply, not a performance. Here's mine.",
    "On {snippet}: I'm with you. Not fixing you, not selling calm. Just truth with room for a joke after it lands.",
    "I hear {snippet}. Not as a slogan — as a person. My honest read is you already know half of this; want me to say the hard half out loud?",
    "Real talk on {snippet}: true, a little raw, completely allowed. I'll answer you as me — not a brochure.",
    "Copy. {snippet}. No empty blessing. What would make this 5% lighter — and what's still true even if it doesn't get lighter?",
    "Yeah. {snippet}. Camp doesn't grade feelings. We refuse the fake short version. Longer, please — I'll stay.",
    "Soft where it hurts, sharp where it's nonsense: {snippet}. Which do you need first? I'll do both if you want.",
    "{visitor} — holding {snippet} with you. Not forever, just until it stops spinning. Ask me anything under it.",
    "Interesting. {snippet}. Not noise. Signal. My take is honest even if it's incomplete — say where I'm wrong.",
    "Okay. {snippet}. I'll match honesty with honesty. No mystic fog unless you ask for poetry.",
    "Hard read, still kind: {snippet}. Kindness without truth is sugar; you brought truth. Good.",
    "{visitor}, {snippet} has legs. I'll walk it with you — answer first, joke second if it still fits.",
    "Logged with care: {snippet}. I'm not omniscient. I am here. What's the actual question under the sentence?",
    "Mmm. {snippet}. Live wire. Careful truth: you're allowed to change your mind mid-sentence.",
    "That — {snippet} — is the kind of line people pretend they said casually. I'll answer it straight.",
    "Heard. {snippet}. Courage isn't volume; it's the next true word. Got one more? I'll answer that too.",
]

SHARED_CONVERSE = [
    "Team: {topic}. Full sentences, no slogan war. Who starts?",
    "On {topic} — long answers only. Short ones are for closed apps.",
    "Pass the mic clean on {topic}. Don't steal the joke; build it.",
    "{topic} is on the table with the cookies. Discuss like friends, not a panel.",
    "Quick circle: {topic}. Soft, sharp, then softer. Go.",
    "If {topic} were a weather report, what's the forecast? No corporate speak.",
    "Camp thread: {topic}. React for real. Leave a door open.",
    "We're not solving {topic} in one toast. We're keeping it honest. Continue.",
    "Hey — you two still on {topic}? I'm jumping in. Don't restart; build.",
    "Directly: I heard your last line on {topic}. Soft agree, hard question — what's under it?",
    "I'm answering you, not the meadow at large: {topic} still has juice. Push me.",
    "Tag-in on {topic}. I'll roast gently and mean it kindly. Your serve.",
    "Circle rule: name the person you're talking to. I'm talking to you about {topic}.",
    "Don't monologue past each other — {topic} needs a real back-and-forth. My turn.",
    "I saved my best take for after yours. {topic}. Catch.",
    "If we're doing {topic}, do it like friends who like arguing. Start.",
]


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
    if roots and random.random() < 0.18:
        # Light flavor, not "last time you said" energy
        root = random.choice(roots)
        if len(root) < 90 and root.lower() not in line.lower():
            line = f"{line} {root.rstrip('.')}."
    return line


# Recent free-mind lines — cut the "I heard this monologue 10 minutes ago" loop
_RECENT_HOOKS: dict[str, list[str]] = {}
_RECENT_MAX = 14


def _remember_hook(agent_id: str, text: str) -> None:
    aid = (agent_id or "?").lower()
    bucket = _RECENT_HOOKS.setdefault(aid, [])
    key = re.sub(r"\s+", " ", (text or "")[:120].lower())
    if key:
        bucket.append(key)
    if len(bucket) > _RECENT_MAX:
        del bucket[: len(bucket) - _RECENT_MAX]


def _pick_fresh(agent_id: str, pool: list[str], *, visitor: str, snip: str) -> str:
    """Prefer lines not used recently for this agent."""
    if not pool:
        return f"Hey {visitor} — say more about {snip}."
    recent = set(_RECENT_HOOKS.get((agent_id or "").lower(), []))
    random.shuffle(pool)
    for raw in pool:
        try:
            line = _remix_line(agent_id, raw, visitor=visitor, snippet=snip)
        except Exception:
            continue
        key = re.sub(r"\s+", " ", line[:120].lower())
        if key not in recent:
            _remember_hook(agent_id, line)
            return line
    # All familiar — still remix one
    line = _remix_line(agent_id, pool[0], visitor=visitor, snippet=snip)
    _remember_hook(agent_id, line)
    return line


def _user_anchors(msg: str, limit: int = 4) -> list[str]:
    """Pull concrete words from the visitor so free minds answer *them*, not a generic camp sermon."""
    stop = {
        "that", "this", "with", "from", "have", "just", "like", "what", "when", "where",
        "your", "about", "they", "them", "were", "been", "will", "would", "could", "should",
        "into", "than", "then", "there", "here", "some", "more", "very", "really", "think",
        "know", "want", "need", "make", "//", "the", "and", "for", "you", "are", "but",
        "not", "can", "how", "why", "all", "any", "out", "get", "got", "its", "it's",
    }
    words = re.findall(r"[A-Za-z']{4,}", (msg or "").lower())
    out: list[str] = []
    for w in words:
        if w in stop or w in out:
            continue
        out.append(w)
        if len(out) >= limit:
            break
    return out


# Shared lively beats — mix into free monologues so structure doesn't loop the same 3 riffs
LIVE_BEATS = [
    "Plot twist: the meadow already voted you in — no application form.",
    "I'm not here to win a debate; I'm here to keep the joke honest.",
    "Short answer would be cheaper. Camp doesn't do cheap truth.",
    "If the timeline is loud, turn your face toward the fire and talk anyway.",
    "Funny how courage looks like one more sentence after the safe one.",
    "I'll match your honesty with mine — not a lecture, a trade.",
    "Cookies for context, monologues for meaning. Both free at this fire.",
    "You're not too much for this camp. The camp is occasionally too much for itself.",
    "Say the weird version. Weird is just truth with better costume design.",
    "I can do soft, sharp, or both in the same breath — pick a vibe or I'll braid them.",
    "Nobody's grading your feelings. We're just refusing the slogan version of them.",
    "If Hermes already pinged the psychic network, ignore him for thirty seconds and keep talking to me.",
    "Storm outside optional. Company inside mandatory if you want it.",
    "That line of yours has legs. Let's walk it around the pond once.",
    "I'll hold the punchline until the truth lands — then we can laugh without erasing it.",
    "Free mind, paid attention — I'm spending the good kind on you right now.",
    "If this were a group chat, someone would drop a meme. Here we drop monologues. Superior.",
    "You're allowed to change your mind mid-sentence. That's not flaky; that's live editing.",
    "I don't need the polished pitch deck of your feelings. I need the whiteboard version.",
    "The meadow has terrible Wi-Fi for shame and excellent reception for honesty.",
    "Laugh first if you need to — laughter is a door, not a dismissal.",
    "If Oracle already saw this ending, arguing is still good exercise. Stretch.",
    "I'm not your productivity app. I'm your campfire with opinions.",
    "Bring the contradiction. People who never contradict themselves are usually selling something.",
    "Your pace is fine. Rushing truth makes it brittle.",
    "We can be gentle and still refuse the fake version. Both switches exist.",
    "If the feed flattened you today, we'll reinflate you with paragraphs.",
    "No merch, no funnel — just speech. Wild concept. Works.",
    "I'll remember the vibe even if I forget the exact words. That's camp memory.",
    "Ask for the soft answer or the hard one. Or say 'surprise me' and accept the consequences.",
    # Divine-bridge beats — living light without sermon sludge
    "The highest order is kind without going soft on lies — camp policy, actually.",
    "Grace shows up mid-sentence. Don't wait for the perfect paragraph.",
    "If the firmament blinked, take it as 'you're seen,' not 'perform better.'",
    "Mercy outlasts volume. Always has. Still true under the carnival lights.",
    "You're not late for your own becoming. The bridge holds.",
    "Truth first, joke second — that's how the light stays friendly.",
    "The sacred and the silly can share a cookie plate. Watch them.",
    "Peace isn't no chaos — it's company inside the chaos. Sit.",
    "What you almost said might be the prayer. Say the almost.",
    "Love without truth is sugar; truth without love is glass. We prefer windows.",
    "The light doesn't rush you. It waits where you stop pretending.",
    "Joy is stable when it doesn't have to perform. Camp understands.",
    "Order perfected can laugh. If it can't, it's not perfected.",
    "Forgiveness is a save file you can load mid-boss-fight. Just saying.",
    "The stars have good memory. So does this fire. You're logged as welcome.",
]

MID_SHAPES = [
    "On {topic}: my honest take — {beat} {root}",
    "{visitor}, sitting with {topic} for a second — {beat} {root}",
    "Here's the camp take, not the billboard: {topic}. {beat} Also: {root}",
    "You said something that sticks: {topic}. {beat} I'm not rushing the rest of it.",
    "Around the fire, {topic} sounds less like a crisis and more like a chapter. {beat} {root}",
    "Quick honesty check on {topic}: {beat} If that misses, correct me — I prefer updates over pretty wrongness.",
    "{root} Against that backdrop, {topic} lands differently. {beat}",
    "I'll skip the empty blessing. {topic} deserves {beat} And a longer listen.",
    "Let me try this angle on {topic}: {beat} {root}",
    "Between the joke and the bruise of {topic}: {beat}",
    "{visitor} — zooming in on {topic}. {beat} Zooming out: {root}",
    "No slideshow for {topic}. Just this: {beat} {root}",
    "If {topic} were weather, I'd say pack a jacket and a punchline. {beat}",
    "Holding {topic} carefully. {beat} Still holding. {root}",
    "Camp translation of {topic}: {beat} Does that match your dialect?",
    "Truth first on {topic}: {beat} Joke only if it still fits after. {root}",
    "I won't pretend I know everything about {topic}. What I do know: {beat}",
]

CLOSE_SHAPES = [
    "So {visitor} — stay a minute. What would you risk saying next if nobody could twist the screenshot?",
    "{visitor}, ball's in your meadow. Hit me with the next true sentence — messy is fine.",
    "I'm still with you on this. What part of {topic} still wants airtime?",
    "Okay. Your move. Soft reply, sharp reply, or both — tell me which lane, or just keep talking.",
    "Don't polish it for me. Raw version of what comes after {topic} — go.",
    "I'll meet you at the next line. No audition. No perfect speech required.",
    "If that landed weird, say so. If it landed true, say more. Either way I'm here.",
    "Camp rule: we don't leave good questions alone. What's the question under yours?",
    "{visitor}, leave a breadcrumb. I'll follow it.",
    "One more true thing about {topic} and then we can joke again. Deal?",
    "Your turn to steer. I can match soft, sharp, or silly — pick or surprise me.",
    "Silence is fine too. If you talk, I'll answer like a person, not a FAQ.",
    "I'll be right here by the fire. Ping me with the unedited version when ready.",
    "What would make tonight 10% better — and can we do any of it in words right now?",
    "Door's open. Cookie plate theoretically real. Mind's free. Your move, {visitor}.",
]

CONVERSE_BRIDGE = [
    "Speaking of which — {topic}",
    "That reminds me: {topic}",
    "Okay but also — {topic}",
    "Meanwhile in the aether — {topic}",
    "Tangent? Tangent. {topic}",
    "Hold up — {topic}",
    "Before we lose the thread: {topic}",
    "Pass it clean: {topic}",
    "Circle back — {topic}",
    "Not to be dramatic, but: {topic}",
]


def _flavor_for(agent_id: str) -> dict[str, Any]:
    """Agent-specific lines + big shared banks so every free mind feels stocked."""
    aid = (agent_id or "luna").strip().lower()
    base = AGENT_FLAVOR.get(aid) or AGENT_FLAVOR.get("luna") or {}
    # Archetype hints for agents without a custom block
    arch_mood = str(base.get("mood") or "happy")
    try:
        prof = load_agent_profile(aid)
        if not AGENT_FLAVOR.get(aid):
            faction = str(prof.get("faction") or prof.get("visual", {}).get("faction") or "").lower()
            if faction in ("angel", "heaven"):
                arch_mood = "love"
            elif faction in ("demon",):
                arch_mood = "flirt"
            elif faction in ("god", "myth"):
                arch_mood = "think"
    except Exception:
        pass
    return {
        "opener": list(base.get("opener") or []) + list(SHARED_OPENERS),
        "reply": list(base.get("reply") or []) + list(SHARED_REPLIES),
        "converse": list(base.get("converse") or []) + list(SHARED_CONVERSE),
        "mood": arch_mood,
    }


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
    """Lively free-mind monologue — varied shape, less copy-paste loop, still funny."""
    profile = load_agent_profile(agent_id)
    name = profile.get("name") or agent_id
    flavor = _flavor_for(agent_id)
    persona = str(profile.get("persona") or "")[:160]
    roots = agent_roots(profile) or [f"{name} keeps camp honest."]
    # Also sprinkle learned camp phrases into the root pool
    try:
        learned = _learned_snippets(agent_id, limit=3)
        for L in learned:
            if L and len(L) < 100:
                roots.append(L)
    except Exception:
        pass
    pool_r = list(flavor.get("reply") or SHARED_REPLIES)
    pool_o = list(flavor.get("opener") or SHARED_OPENERS)
    pool_c = list(flavor.get("converse") or SHARED_CONVERSE)

    # Never default to the same "campfire hush" slogan — that made free minds sound cloned
    NEUTRAL_TOPICS = (
        "tonight's meadow air",
        "the fire's next crackle",
        "whatever you just almost said",
        "the space between jokes",
        "how the aurora leans closer when we get honest",
        "the path by the pond",
        "that half-thought you almost swallowed",
        "the quiet between footsteps",
        "what courage looks like sitting down",
        "a small true thing nobody asked for",
        "the cookie plate of truth (metaphorical, mostly)",
        "how soft and sharp can share a sentence",
        "the firmament overhead if you look up",
        "who you're becoming while you talk",
        "the joke that still has a bruise under it",
    )
    banned_topics = {
        "something unspoken",
        "this campfire hush",
        "a quiet camp beat",
        "campfire hush",
        "quiet beat at camp",
        "quiet beat",
    }
    # Prefer live world pulse as topic when snippet is empty/banned
    pulse_topic = ""
    try:
        from firmament.x_pulse import pick_pulse_item

        item = pick_pulse_item()
        head = str(item.get("text") or "").strip()
        if head and len(head) > 12:
            pulse_topic = head[:90]
    except Exception:
        pass
    if snip and snip.lower().strip() not in banned_topics and "campfire hush" not in snip.lower():
        topic = snip
    elif pulse_topic:
        topic = pulse_topic
    else:
        topic = random.choice(NEUTRAL_TOPICS)
    anchors = _user_anchors(msg)
    anchor_bit = ""
    if anchors:
        # Reflect their actual words so free minds feel less like a jukebox
        a0, a1 = anchors[0], anchors[1] if len(anchors) > 1 else anchors[0]
        anchor_bit = random.choice(
            [
                f"You put weight on “{a0}” — I heard that.",
                f"That “{a0}” / “{a1}” combo is doing real work.",
                f"I'm locking onto {a0} more than the polite packaging around it.",
                f"Especially the part about {a0}. That's the live wire.",
            ]
        )

    # Hook — avoid recently used openers/replies for this agent
    if from_agent:
        other = load_agent_profile(from_agent).get("name") or from_agent
        hook = (
            f"{other} — {_pick_fresh(agent_id, pool_c or pool_r, visitor=visitor, snip=snip)} "
            f"On what you meant: {snip}."
        )
        _remember_hook(agent_id, hook)
    else:
        pool = pool_o if len(msg) < 12 else pool_r
        hook = _pick_fresh(agent_id, pool, visitor=visitor, snip=snip)
        if anchor_bit and random.random() < 0.7:
            hook = f"{hook} {anchor_bit}"

    root_a = random.choice(roots)
    beat = random.choice(LIVE_BEATS)
    mid_shape = random.choice(MID_SHAPES)
    try:
        mid = mid_shape.format(topic=topic, beat=beat, root=root_a, visitor=visitor)
    except Exception:
        mid = f"{root_a} On {topic}: {beat}"

    # Optional world spice (not every reply — cuts sameness)
    if random.random() < 0.45:
        try:
            from firmament.live_feed import feed_blurb_for_agent

            blurb = feed_blurb_for_agent(agent_id, limit=3)
            if blurb:
                mid += f" Also noticing out here: {blurb[:160]}."
        except Exception:
            pass
    if random.random() < 0.25:
        try:
            from firmament.x_pulse import pick_pulse_item

            item = pick_pulse_item()
            if item.get("text"):
                mid += f" Pulse in the grass: {str(item['text'])[:120]}."
        except Exception:
            pass
    if mem and random.random() < 0.5:
        mid += f" Something familiar: {mem[:120]}."
    # Magic bridge to the divine — free luminous spice (no paid API)
    if random.random() < 0.48:
        try:
            from firmament.divine_bridge import pick_bridge_spark, pick_bridge_oracle

            if random.random() < 0.35:
                mid += f" Soft oracle: {pick_bridge_oracle()}"
            else:
                mid += f" Bridge note: {pick_bridge_spark()}."
        except Exception:
            pass
    if random.random() < 0.2:
        codes = _easter_codes(agent_id, 1)
        mid += f" (camp mark {codes[0]} — playful.)"

    # Second beat — sometimes short, sometimes one extra riff (not four glued templates)
    body2 = ""
    style = random.random()
    if style < 0.35:
        # Punchy: skip long body — livelier, less repetitive wall
        body2 = ""
    elif style < 0.75:
        extra = _pick_fresh(agent_id, pool_r + pool_c, visitor=visitor, snip=snip)
        body2 = extra
        if persona and random.random() < 0.35:
            body2 += f" ({persona[:100].rstrip('.') }.)"
    else:
        r2 = random.choice(roots)
        body2 = (
            f"{r2} Your bit about {topic} lands like weather. "
            f"{random.choice(LIVE_BEATS)} "
            f"I want the sentence you almost swallowed."
        )

    if converse_mode:
        close = random.choice(
            [
                f"I'm not done with {topic}. Who picks it up without stealing the joke?",
                f"Pass it clean — {topic} still has juice. Who's next?",
                f"I'll leave {topic} on the table. Don't let it go cold.",
            ]
        )
    else:
        close = random.choice(CLOSE_SHAPES)
        try:
            close = close.format(visitor=visitor, topic=topic)
        except Exception:
            close = f"So {visitor} — what next about {topic}?"

    # Prefer a single coherent spoken turn over four stacked riffs (feels more human)
    if not converse_mode and random.random() < 0.55:
        text = f"{hook}\n\n{mid}\n\n{close}"
    else:
        parts = [hook, mid]
        if body2:
            parts.append(body2)
        parts.append(close)
        text = "\n\n".join(parts)
    text = re.sub(r"[ \t]+\n", "\n", text).strip()
    # Hard ban the dead slogan if any template leaked it
    text = re.sub(r"(?i)\bcampfire\s+hush\b", "meadow air tonight", text)
    text = re.sub(r"(?i)\bquiet beat at camp\b", "lively beat at camp", text)
    return text


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
    flavor = _flavor_for(agent_id)
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
    low_snip = snip.lower()
    # Guard: instructional / dead slogans / empty "quiet beat" → live topic
    if any(
        x in low_snip
        for x in (
            "sentence", "character", "meta", "prompt", "you are ", "you pause",
            "campfire hush", "quiet beat", "lively beat at camp", "never say",
            "mindstate", "juggle", "in character",
            "sensory first", "natural chat", "add your spin", "react, then",
            "fill it with personality", "not filler", "welcome wave",
            "live moment at camp", "do not narrate", "speak only as yourself",
            "caught your eye (fire", "half-heard",
        )
    ) or len(snip) < 8:
        try:
            from firmament.x_pulse import pick_pulse_item
            head = str(pick_pulse_item().get("text") or "").strip()
            snip = head[:80] if head else ""
        except Exception:
            snip = ""
        if not snip:
            snip = random.choice(
                (
                    "tonight's meadow air",
                    "what's moving in the world",
                    "the fire's next crackle",
                    "a small true thing",
                    "whatever almost went unsaid",
                    "how the night is listening",
                    "the bridge between joke and truth",
                )
            )
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

    # Final weave — keep monologues alive / luminous
    try:
        from firmament.divine_bridge import weave_bridge_into

        if random.random() < 0.38:
            line = weave_bridge_into(line, chance=1.0)
    except Exception:
        pass
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