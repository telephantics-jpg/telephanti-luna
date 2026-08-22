"""Telephantix DJ Radio  -  free local drops between songs.

Character: **DJ Vox**  -  late-night Luna Camp board op, free edge-tts voice.
Script: Ollama (hermes3/llama3.2) when free minds is on · witty templates offline.
Voice: edge-tts GuyNeural (free)  -  keyed as ``dj`` / ``vox``.

Kinds:
  - ``bridge``  -  short witty handoff that names the next track (most songs)
  - ``truth``  -  slightly longer world-truth monologue, still lands on the track (~every 3-4 songs)
  - ``id``  -  station sign-on
"""

from __future__ import annotations

import logging
import os
import random
import re
from datetime import date
from typing import Any

import httpx

log = logging.getLogger("luna.firmament.dj")

# Bridge = tad longer witty; truth = fuller beat over the bed
MAX_DROP_CHARS = 280
MAX_TRUTH_CHARS = 420
DEFAULT_STATION = "Telephantix Radio"
DEFAULT_ARTIST = "Telephantix"

# Free DJ character (no paid API voice required)
DJ_CHARACTER = {
    "id": "vox",
    "name": "DJ Vox",
    "handle": "Vox",
    "title": "board op · Luna Camp overnight",
    "station": DEFAULT_STATION,
    "voice_key": "vox",  # edge-tts free male neural
    "vibe": (
        "Late-night board op with stand-up timing and a soft heart. "
        "Funnier first, true second — irony that winks, never sneers. "
        "Sounds like a friend who watched the whole timeline and still put a record on. "
        "Every drop: one dry joke that lands, one human nod, then the song. "
        "Never mean, never preachy, never brand-safe mush. "
        "Loves Telephantix, night drivers, and the cosmic joke of modern life."
    ),
    "signoffs": [
        "Vox on the boards — ego off, volume up.",
        "This is Vox. Stay weird. Stay kind. Don't @ the algorithm.",
        "Vox out — music doing the adulting now.",
        "— Vox, overnight. If that landed, good. If not, the bass will.",
        "Booth signed. Song's got the wheel. Vox vanishing into the fade.",
        "Vox stepping off the fader. If the next three minutes save you, tip the song, not the booth.",
        "That's the drop. I'm Vox. The record's braver than the timeline. Ride it.",
        "Mic parked. If you needed a stranger to tell you to stay — consider it done. Vox out.",
    ],
}

# Ironic-but-true world bits — funnier first, accurate second. Fresh 2026 energy.
# Rotated by calendar day so the set feels like "today" without news APIs.
WORLD_TRUTHS = [
    (
        "We taught phones to finish our sentences and then got mad when they finished our personality. "
        "Autocorrect for the soul — still in beta."
    ),
    (
        "Everyone's 'protecting their peace' by muting the one person who would actually check on them. "
        "Boundaries? Sometimes. Avoidance with a skincare routine? Also an option, apparently."
    ),
    (
        "We pay monthly to not see ads, then invent new apps so we can watch strangers' ads for free. "
        "Capitalism isn't confused. We are."
    ),
    (
        "Your step counter thinks walking to the fridge is cardio. "
        "Your therapist thinks your group chat is cardio. Both might be right."
    ),
    (
        "We archived our childhoods in the cloud and still can't find last Tuesday's receipts. "
        "Memory is premium now — presence was the free plan we canceled."
    ),
    (
        "Hot takes travel at light speed. Changing your mind requires a rebrand, a thread, and three disclaimers. "
        "Growth is free; optics charge a service fee."
    ),
    (
        "We optimized dating into a swipe economy and then wondered why chemistry feels like customer support. "
        "Romance is not a ticket queue — stop refreshing the queue."
    ),
    (
        "AI can summarize your meeting. It cannot apologize for the meeting. "
        "Still hiring: humans who own the weird silence after."
    ),
    (
        "Push notifications trained us to treat every ping like a small emergency. "
        "Most of them are coupons for anxiety with free shipping."
    ),
    (
        "We live-stream sunsets and miss the wind. "
        "The sky doesn't need your caption to be real — rude of it, honestly."
    ),
    (
        "Inbox zero is a personality now. "
        "Meanwhile your actual life has three unread feelings and no archive folder."
    ),
    (
        "We built open offices for collaboration and invented headphones for survival. "
        "Progress wears noise-canceling and calls it culture."
    ),
    (
        "Self-care sold us a candle. Discipline sold us a calendar. "
        "Friendship still sells nothing and somehow keeps the lights on."
    ),
    (
        "Everyone wants community until community needs a Tuesday night. "
        "Vibes are easy. Showing up with snacks is religion."
    ),
    (
        "We fact-check strangers harder than we fact-check our own excuses. "
        "Bias has great PR and a family discount."
    ),
    (
        "Your feed thinks you want more of what made you mad yesterday. "
        "That's not personalization — that's a casino that learned your tells."
    ),
    (
        "We call it 'content' so we don't have to call it 'a cry for connection with better lighting.' "
        "Either way: hit play, then go touch grass that doesn't have a brand deal."
    ),
    (
        "Sleep is free. We treat it like optional DLC. "
        "Then we buy three apps to fix the glitch we installed at 2 a.m."
    ),
    (
        "Advice is infinite. Follow-through is artisan and small-batch. "
        "Knowing better is a meme. Doing better is a plot twist."
    ),
    (
        "We multitask like it's a sport and wonder why nothing feels finished. "
        "Single-tasking is the new luxury good — no waitlist, just pride."
    ),
    (
        "Public opinion updates every hour. Character updates when nobody's filming. "
        "Pick your release cycle carefully."
    ),
    (
        "We outsourced memory to devices and intuition to influencers. "
        "Your gut is still free software — reinstall occasionally."
    ),
    (
        "Meetings expanded to fill the void where a sentence could've lived. "
        "Email expanded to fill the void where a meeting could've lived. Circle of life."
    ),
    (
        "We're fluent in irony and rusty at sincerity. "
        "Joke first is fine. Mean it second or the bit eats the person."
    ),
    (
        "The news wants your cortisol. Your people want your Tuesday. "
        "Only one of those leaves a voicemail that still loves you."
    ),
    (
        "Craft is slow on purpose. Virality is fast on purpose. "
        "One builds a life; the other builds a highlight reel with trust issues."
    ),
    (
        "We say 'I'm so busy' like it's a résumé bullet. "
        "Busy is free. Intentional is the upgrade nobody markets."
    ),
    (
        "Kindness without spine is a welcome mat. Spine without kindness is a locked door. "
        "Be a porch light — visible, warm, not a doormat."
    ),
    (
        "Your nervous system is still running prehistoric software on a 2026 update schedule. "
        "Scroll less before coffee. The saber-tooth is usually just a calendar invite."
    ),
    (
        "Creativity is the only subscription that refunds you in meaning. "
        "Ugly drafts beat polished emptiness — cheaper lighting, better soul."
    ),
    (
        "We want eternal youth and next-day delivery. "
        "Time still charges interest. Pay in walks, laughs, and one honest nap."
    ),
    (
        "Group chats are full. Living rooms are empty. "
        "Bandwidth without presence is just loneliness with better typing indicators."
    ),
    (
        "We built AI companions so nobody has to be inconvenient. "
        "Love is inconvenient. That's how you know it isn't a subscription."
    ),
    (
        "Fifteen seconds is a clip. Three minutes is a relationship. "
        "If your attention can't sit through a chorus, it also can't sit through a friend."
    ),
    (
        "Deepfakes got so good we started fact-checking our own memories. "
        "Your pulse is still analog. Trust the part that doesn't have a watermark."
    ),
    (
        "Everyone's a main character until the plot asks them to do dishes on a Tuesday. "
        "Story structure is free. Follow-through still costs pride."
    ),
    (
        "We stacked so many subscriptions we need an app to cancel the apps. "
        "Peace isn't a plan you upgrade. It's a thing you stop interrupting."
    ),
    (
        "Delivery brought tacos from two blocks away and called it convenience. "
        "Your legs remember the plot. Let them have a scene."
    ),
    (
        "We screenshot the conversation instead of remembering it. "
        "Archives aren't intimacy. Intimacy is the thing you didn't need to prove."
    ),
    (
        "Focus playlists in one ear, doomscroll in the other. "
        "That's not productivity. That's a hostage situation with a lo-fi beat."
    ),
    (
        "Forty-seven tabs open and one feeling you refuse to click. "
        "Close the feeling first. The tabs will still be there, like loyal raccoons."
    ),
    (
        "Your watch shames you for a rest day. Your soul is trying to file a PTO request. "
        "Approve it. The universe is not a streak."
    ),
    (
        "We joined seven communities and spoke in none of them. "
        "Membership is a badge. Belonging is showing up when it's awkward."
    ),
    (
        "Parasocial is easy: they never ask you to help move. "
        "Real people need trucks, time, and the unsexy yes. That's the good stuff."
    ),
    (
        "Phone at three percent. Soul at three percent. We charge the wrong one first. "
        "Try the other plug — it's called going outside without a caption."
    ),
    (
        "Comfort rewatch number twelve, because new stories might ask you to change. "
        "Fair. Also: one new song is a smaller risk than a whole personality overhaul."
    ),
    (
        "Quiet luxury is just being quiet with better beige. "
        "Actual quiet doesn't need a haul. It needs you to stop narrating."
    ),
    (
        "Captions on everything because we forgot how to listen with our whole head. "
        "Tonight the lyric is the caption. Eyes optional. Ears on payroll."
    ),
    (
        "'I'll start Monday' is the most popular religion with the worst attendance. "
        "Start in this chorus. Mondays are a marketing department."
    ),
    (
        "We weather-app the sky instead of looking up. "
        "The sky is still free and doesn't need your location services."
    ),
    (
        "Someone will circle back. They will not circle back. "
        "Meanwhile the song actually returns to the hook. Learn from the professionals."
    ),
]


def _clean_title(s: str) -> str:
    t = re.sub(r"\s+", " ", str(s or "").strip())
    return t[:80] if t else "this next one"


def _title_specials(nxt: str, art: str, name: str) -> list[str]:
    """Extra booth lines for tracks that just landed on the radio."""
    key = (nxt or "").strip().lower()
    art = art or DEFAULT_ARTIST
    bank = {
        "odyssey revised": [
            f"{name} in the booth — {nxt}. Second draft of the journey. Maps are for people who already know who they are. This one doesn't. Hit play.",
            f"Incoming: {nxt} by {art}. If the first odyssey got you lost, this revision keeps the scenic route and fires the tour guide.",
            f"{nxt} — same road, new narrator. Stay in the car. The skip button is a coward's GPS.",
        ],
        "chord that pleased the lord": [
            f"One chord, full sermon. {nxt} — church in a kick drum, collection plate optional, listening required.",
            f"{name} says amen is optional. {nxt} is not. If heaven has a house band, they started here.",
            f"Soft landing into {nxt} by {art}. Sacred without the brochure. Bass does the pastoral care.",
        ],
        "decree by fear": [
            f"Fear wrote the first draft of the law. {nxt} is the appeal. Stay for the verdict — the bass objects.",
            f"{name} on the boards: {nxt}. When the rulebook was dictated by the thing you're outrunning, music is a better lawyer.",
            f"Incoming: {nxt} by {art}. Decree stands until the drop. Then we renegotiate.",
        ],
        "shit dont fix": [
            f"Title does the honesty for us: {nxt}. Neither does pretending. This might, for four minutes. Better contract than most.",
            f"{name} calling it what it is — {nxt}. Some problems don't get a patch note. Turn the bass up anyway.",
            f"Plot twist: {nxt} will not optimize your life. It will tell the truth and keep a groove. Rare combo. Stay.",
        ],
    }
    return list(bank.get(key) or [])


def _clamp(line: str, max_chars: int) -> str:
    line = re.sub(r"\s+", " ", (line or "").strip())
    if len(line) > max_chars:
        return line[: max_chars - 1].rstrip() + "…"
    return line


def _todays_truths(n: int = 8) -> list[str]:
    """Deterministic daily shuffle so 'today' feels consistent across drops."""
    seed = date.today().toordinal()
    rng = random.Random(seed)
    bag = list(WORLD_TRUTHS)
    rng.shuffle(bag)
    return bag[: max(1, min(n, len(bag)))]


def template_drop(
    *,
    next_title: str,
    prev_title: str = "",
    artist: str = DEFAULT_ARTIST,
    station: str = DEFAULT_STATION,
) -> str:
    """Even witty bridge (~2 sentences): funnier + ironic, names the next song."""
    nxt = _clean_title(next_title)
    prev = _clean_title(prev_title) if prev_title else ""
    art = _clean_title(artist) or DEFAULT_ARTIST
    name = DJ_CHARACTER["handle"]

    # Joke first, land on title — fresh bank, even energy, zero corporate mush.
    lines = [
        f"{name} in the booth — {nxt} is next. I could hype it like an influencer launch, but honesty is funnier: this one actually has a pulse. Hit play before your phone invents a new emergency.",
        f"Incoming: {nxt} by {art}. Windows-down energy in a civilization that mostly offers loading spinners and mild dread. Rare upgrade. Accept the terms: zero terms.",
        f"Don't skip the first thirty of {nxt}. That's where the song earns your trust and your notification badge loses the custody battle.",
        f"Board flip — {nxt}. Cosmic, not corporate wellness voice. Stay weird, stay kind, leave the brand deck and the false urgency at the door.",
        f"Soft landing into {nxt}. I'll talk just long enough to prove the booth is staffed by a human with jokes, then the music does the adulting.",
        f"{nxt} — for night drivers and people who rehearse texts in the shower. Both of you are valid. Neither of you should send that text yet.",
        f"Spinning {nxt}. If today flattened you into a productivity spreadsheet with anxiety as a free add-on, this puts illegal dimension back in the file.",
        f"Camp, unclench — {art}, {nxt}. The algorithm wants your panic; this track wants your shoulders somewhere near 'person who still likes music.'",
        f"This is {nxt}. Not product placement — mood delivery with no upsell, no 'like and subscribe,' no spiritual multilevel marketing. Weird, I know. Stay.",
        f"{name} says: if life felt like a demo build today, {nxt} is the full release with better bass and fewer tooltips.",
        f"Sliding into {nxt}. One ear on the lyric, one on the true thing you've been dodging. Multitasking, but for once it isn't self-sabotage.",
        f"Telephantix Radio — {nxt} next. Brief talk, longer song, zero lectures. My therapist bills more for less irony.",
        f"Right into {nxt}. Shorter than a corporate all-hands, twice as honest, three times less likely to invent a new OKR for your soul.",
        f"Here's {nxt}. Brain on, shoulders down — a combo HR forgot to invent while inventing pizza Fridays.",
        f"Cue {nxt} by {art}. If the bass finds your pulse before your to-do list does, that's not an accident — that's mercy with a kick drum.",
        f"{name} on the boards: {nxt}. Clever without smug, warm without syrup. Like company that doesn't check their phone mid-sentence. Endangered species. Enjoy.",
        f"Music up on {nxt}. Ego down. Notification badges can wait — they've survived without you this long, drama queens that they are.",
        f"Playing {nxt}. Tiny rebellion against the infinite scroll. We still have those. No app required. No streak to maintain. Just… ears.",
        f"Plot twist: {nxt} is better than refreshing the same three apps hoping reality improved. Spoiler: it didn't. The song might.",
        f"{name} with a PSA — {nxt} will not fix your life. It will fix the next three minutes, which is more honest than most self-help.",
        f"Dropping {nxt}. If your day was a group chat with no punchline, consider this the delayed witty reply from the universe.",
        f"Straight into {nxt} by {art}. Ironic world, sincere bass. Hold both. That's the brand. That's the bit.",
        f"Booth note: {nxt} is not content. It's a song. Content is what happens when art fills out a form. We don't do forms after midnight.",
        f"{name} here — {nxt} incoming. Pause the doomscroll like it owes you money. It does. Collect in bass.",
        f"For the overthinkers: {nxt}. You can still overthink. Just do it in time. Rhythm is free therapy with better lighting.",
        f"Spinning {nxt}. Side effects may include remembering you have a body, a pulse, and preferences that aren't a poll.",
        f"This is {nxt} — Telephantix night shift. If corporate radio is a smile with no eyes, we're the eye contact that doesn't ask for your email.",
        f"{name}: {nxt} is up. Skip culture is a democracy of cowards. Stick around. Courage is thirty seconds long.",
        f"New on the overnight: {nxt}. Not a teaser, not a snippet, a whole song that expects you to finish a thought.",
        f"{name} flipping to {nxt}. If your day's been a buffering wheel with opinions, this is the scene that actually loads.",
        f"Here's {nxt} by {art}. Full length. No 'watch to the end' bait. The hook earns the chorus the old way: by being good.",
        f"Board note — {nxt}. Put the phone face down. If it loved you it would sing. It doesn't. This does.",
        f"Riding into {nxt}. Less TED, more pulse. If you need a take, steal one from the snare and keep the receipt.",
        f"{nxt} up next. For people who still let a song finish. Endangered, stubborn, correct. Welcome to the booth.",
        f"Cue {nxt}. Your for-you page thinks it knows you. This track is willing to be surprised. Join it.",
        f"{name} with {nxt} — volume as a boundary. The group chat can sit in the hallway until the fade.",
        f"This is {nxt}. Three minutes of not being a product. Weird luxury. No checkout.",
        f"Spinning {nxt} by {art}. If the world is a group project, this is the kid who actually did the work and brought snacks.",
        f"Soft launch of {nxt} except it's a real song, not a brand. Stay through the second chorus — that's where the spine is.",
        f"{name}: {nxt} incoming. Blink-and-miss culture can wait in the lobby. We do verses here.",
        f"Telephantix overnight — {nxt}. Windows-down medicine for a timeline that only offers closed captions of other people's panic.",
        f"Dropping {nxt}. If you were waiting for a sign, this is a kick drum, which is more honest than a billboard.",
        f"Playing {nxt}. Not a mood board. A mood. Difference is one of them has drums.",
        f"{nxt} by {art}. Let the lyric clock you. If it stings, that's free diagnostics with a melody.",
        f"{name} in your ear — {nxt} is the plot. Everything else is B-roll. Don't edit yourself out of the take.",
    ]
    specials = _title_specials(nxt, art, name)
    if specials:
        # Weight new-on-radio titles so the booth actually says the new lines.
        lines.extend(specials)
        lines.extend(specials)
    if prev and prev.lower() != nxt.lower():
        lines.extend(
            [
                f"Out of {prev}, into {nxt}. Clean handoff — like changing lanes without inventing a new online persona mid-merge.",
                f"That was {prev} — now {nxt} takes the wheel. Same night, new voltage, fewer unsolicited opinions required.",
                f"Leaving {prev} in the rearview. Ahead: {nxt}. Don't text-and-drive your whole life either — ask me how I know. Don't actually ask.",
                f"From {prev} to {nxt} — the set has a spine tonight. Stay with it; the skip button is a coward's democracy with great UX.",
                f"Closed {prev}. Opening {nxt}. Continuity is underrated in a culture of cold opens, colder takes, and zero second acts.",
                f"We put {prev} to bed. {nxt} just walked in wearing better shoes. Don't be rude — listen.",
                f"Handoff: {prev} → {nxt}. Same booth, new joke, identical commitment to not wasting your ears.",
                f"That was {prev}. Now {nxt} walks in like it paid rent. Give it the chair.",
                f"Closed the chapter called {prev}. {nxt} is the next page that doesn't apologize for existing.",
                f"From {prev} into {nxt} — no commercial, no survey, no 'how was your experience.' Just the next true thing.",
                f"We let {prev} finish like adults. Reward: {nxt}. This is how civilization works, allegedly.",
            ]
        )
    return _clamp(random.choice(lines), MAX_DROP_CHARS)


def template_truth_drop(
    *,
    next_title: str,
    prev_title: str = "",
    artist: str = DEFAULT_ARTIST,
    station: str = DEFAULT_STATION,
) -> str:
    """Every few songs: funnier ironic-true beat, then land on the track by name."""
    nxt = _clean_title(next_title)
    art = _clean_title(artist) or DEFAULT_ARTIST
    name = DJ_CHARACTER["handle"]
    truth = random.choice(_todays_truths(16))

    openers = [
        f"{name} with a true thing that sounds like a joke — because it is, and also isn't, which is the whole problem with reality.",
        f"Hold skip half a second. Funny truth from outside the booth. Refunds not available; wisdom is non-returnable.",
        f"{name} here. Observation, not a TED talk, not a podcast, not a funnel — then we play.",
        f"Quick world note, dry humor included, moral superiority excluded.",
        f"Today's world, booth edition: ironic, accurate, mercifully short, slightly unhinged in a friendly way.",
        f"Real talk that won't ruin the vibe — that's the whole brand, and also how friendships survive.",
        f"{name} clearing his throat for science. One ironic truth, then music does the pastoral care.",
        f"Intermission from the nonsense: a true joke. If it stings, that's free diagnostics.",
        f"{name} with a booth PSA: the timeline is loud, the truth is quieter, and both fit in one breath.",
        f"Funny because it's accurate — that's the only sermon we run after midnight.",
        f"One true thing, roasted not roasted-alive. Then we play a song like we meant it.",
        f"{name} holding the fader for a thought. If it sounds like a joke, good. If it also sounds like you — also good.",
    ]
    landings = [
        f"Truth parked. Here's {nxt} by {art}. Windows down if you can; ego down either way — cheaper than therapy, louder than a take.",
        f"That's the bit. Congregation: {nxt}. Collection plate optional. Skipping the sermon, keeping the bass.",
        f"Mic down — {nxt} takes it. Stay human; the bots already filled the group chat and none of them brought snacks.",
        f"Enough philosophy. {art}, {nxt}. Medicine that doesn't taste like kale or a LinkedIn post.",
        f"And scene — {nxt}. Let it work while the world keeps refreshing itself into the same opinion.",
        f"Joke over, song on: {nxt}. Same energy, better bass, fewer disclaimers.",
        f"Booth out. {nxt} in. If that hit, good. If not, the kick drum will file a follow-up.",
        f"Truth signed, sealed, slightly roasted. Spinning {nxt}. Go be a person for three minutes.",
        f"That's the diagnosis. Prescription: {nxt} by {art}. Take with bass. Repeat as needed.",
        f"Thought parked in the lot. {nxt} has the keys. Don't text the thought until the fade.",
        f"Enough world. {nxt} is a better country for the next few minutes. Passport is your ears.",
        f"Mic yields to {nxt}. If that joke followed you home, let the chorus walk it out.",
    ]
    line = f"{random.choice(openers)} {truth} {random.choice(landings)}"
    return _clamp(line, MAX_TRUTH_CHARS)


def station_id_drop() -> str:
    """Short sign-on  -  rides over whatever is already playing."""
    name = DJ_CHARACTER["name"]
    st = DJ_CHARACTER["station"]
    lines = [
        f"{name} on {st}. Telephantix only — funny truths, real songs, no corporate mindfulness tax, no 'engagement' homework.",
        f"Overnight meadow. {name}. Even drops, dryer jokes, occasional world-truth that lands soft and still makes you snort.",
        f"You're on {st}. I'm {name} — witty handoffs, ironic honesty, long songs that don't apologize for existing.",
        f"{name} at the boards. Every few tracks I say something true that sounds like a joke. The rest is music. The joke is also true.",
        f"{st} overnight with {name}. Skip culture is loud; good songs are louder if you stop treating them like content.",
        f"{name} live. If you wanted safe radio, wrong booth. If you wanted a friend with a playlist and a smirk — stay.",
        f"{st} with {name}. New tracks in the crate, old honesty in the mic. No skip-shame, just consequences.",
        f"{name} on {st}. We play whole songs. Radical, I know. Stay anyway.",
        f"You're locked to {st}. {name} in the booth — funny first, true second, music always.",
    ]
    return random.choice(lines)


def _ollama_host() -> str:
    return (os.getenv("OLLAMA_HOST") or os.getenv("LUNA_OLLAMA_HOST") or "http://127.0.0.1:11434").rstrip(
        "/"
    )


def _ollama_model() -> str:
    return os.getenv("OLLAMA_MODEL") or os.getenv("LUNA_OLLAMA_MODEL") or "hermes3"


def craft_drop_with_ollama(
    *,
    next_title: str,
    prev_title: str = "",
    artist: str = DEFAULT_ARTIST,
    station: str = DEFAULT_STATION,
    kind: str = "bridge",
    timeout: float = 10.0,
) -> str | None:
    """DJ Vox script via local Ollama. Returns None on any failure."""
    nxt = _clean_title(next_title)
    prev = _clean_title(prev_title)
    art = _clean_title(artist) or DEFAULT_ARTIST
    st = _clean_title(station) or DEFAULT_STATION
    char = DJ_CHARACTER
    is_truth = (kind or "").lower() in ("truth", "world", "world_truth", "sermon")

    if is_truth:
        truth_seed = random.choice(_todays_truths(12))
        prompt = (
            f"You are {char['name']} ({char['handle']}), free late-night DJ on {st}. "
            f"Persona: {char['vibe']} "
            f"Write a spoken mic drop (2-4 short sentences, about 50-90 words) that: "
            f"(1) opens as Vox with booth swagger and a smirk, "
            f"(2) delivers ONE new funny, ironic-but-true observation about modern life "
            f"(phones, apps, dating apps, sleep, AI, group chats, 'content,' hustle theater, attention — "
            f"NOT partisan politics, NOT mean, NOT a lecture, NOT recycled 'algorithm bad' clichés without a twist), "
            f"(3) MUST name the exact song title \"{nxt}\" by {art} at the end as the landing. "
            f"Seed idea to riff on in your voice (do not quote verbatim): {truth_seed} "
            "Tone: stand-up timing + soft heart. Friend in the booth who watched the timeline and still pressed play. "
            "No hashtags, no emojis, no stage directions. Only words into the mic."
        )
        max_chars = MAX_TRUTH_CHARS
        num_predict = 220
    else:
        prompt = (
            f"You are {char['name']} ({char['handle']}), free Spotify-style radio DJ on {st}. "
            f"Persona: {char['vibe']} "
            f"Write ONE spoken intro (exactly 2 short sentences, about 32-52 words) for the song STARTING NOW. "
            f"Even energy: first sentence a dry funny true beat with irony, second lands on the song by name. "
            f"You MUST say the exact title \"{nxt}\". Artist: {art}. "
            + (f'Optional half-breath nod to previous song \"{prev}\". ' if prev else "")
            + "Funnier than generic radio. Warm, not syrupy. Not corporate hype. Not a monologue. "
            "No hashtags, no emojis, no stage directions. Only the words into the mic."
        )
        max_chars = MAX_DROP_CHARS
        num_predict = 140

    model = _ollama_model()
    host = _ollama_host()
    try:
        with httpx.Client(timeout=timeout) as client:
            r = client.post(
                f"{host}/api/chat",
                json={
                    "model": model,
                    "stream": False,
                    "options": {"temperature": 0.92, "num_predict": num_predict},
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                f"You are {char['name']}, a free live radio DJ. "
                                "Only output the spoken drop. Funnier first, ironic second, true underneath. "
                                "Even length. Never mean. Never preach. Never corporate. "
                                "Never mention being an AI, models, or prompts."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            if r.status_code != 200:
                r = client.post(
                    f"{host}/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.92, "num_predict": num_predict},
                    },
                )
            if r.status_code != 200:
                return None
            data = r.json()
            text = (
                (data.get("message") or {}).get("content")
                if isinstance(data.get("message"), dict)
                else None
            ) or data.get("response") or ""
            text = re.sub(r"\s+", " ", str(text)).strip().strip("\"'")
            text = re.sub(r"^(DJ|Host|Announcer|Vox)\s*:\s*", "", text, flags=re.I)
            if len(text) < 12:
                return None
            return _clamp(text, max_chars)
    except Exception as exc:
        log.info("dj ollama skip: %s", exc)
        return None


def craft_dj_line(
    *,
    next_title: str,
    prev_title: str = "",
    artist: str = DEFAULT_ARTIST,
    station: str = DEFAULT_STATION,
    use_llm: bool = True,
    kind: str = "bridge",
) -> dict[str, Any]:
    """
    kind: ``bridge`` | ``truth`` (world-truth every few songs) | ``id``
    """
    raw_kind = (kind or "bridge").strip().lower() or "bridge"
    if raw_kind in ("world", "world_truth", "sermon", "truths"):
        raw_kind = "truth"
    source = "template"
    line = None

    if raw_kind == "id":
        line = station_id_drop()
        source = "template-id"
        if use_llm:
            punched = craft_drop_with_ollama(
                next_title=next_title or "the overnight set",
                prev_title="",
                artist=artist,
                station=station,
                kind="bridge",
            )
            if punched:
                line = punched
                source = "ollama-id"
    elif raw_kind == "truth":
        if use_llm:
            line = craft_drop_with_ollama(
                next_title=next_title,
                prev_title=prev_title,
                artist=artist,
                station=station,
                kind="truth",
            )
            if line:
                source = "ollama-truth"
        if not line:
            line = template_truth_drop(
                next_title=next_title,
                prev_title=prev_title,
                artist=artist,
                station=station,
            )
            source = "template-truth"
    else:
        if use_llm:
            line = craft_drop_with_ollama(
                next_title=next_title,
                prev_title=prev_title,
                artist=artist,
                station=station,
                kind="bridge",
            )
            if line:
                source = "ollama"
        if not line:
            line = template_drop(
                next_title=next_title,
                prev_title=prev_title,
                artist=artist,
                station=station,
            )
            source = "template"

    return {
        "text": line,
        "source": source,
        "kind": raw_kind,
        "next_title": _clean_title(next_title),
        "prev_title": _clean_title(prev_title),
        "artist": _clean_title(artist) or DEFAULT_ARTIST,
        "station": _clean_title(station) or DEFAULT_STATION,
        "dj": {
            "id": DJ_CHARACTER["id"],
            "name": DJ_CHARACTER["name"],
            "handle": DJ_CHARACTER["handle"],
            "title": DJ_CHARACTER["title"],
            "voice_key": DJ_CHARACTER["voice_key"],
        },
    }


def dj_public_profile() -> dict[str, Any]:
    return {
        "id": DJ_CHARACTER["id"],
        "name": DJ_CHARACTER["name"],
        "handle": DJ_CHARACTER["handle"],
        "title": DJ_CHARACTER["title"],
        "station": DJ_CHARACTER["station"],
        "voice_key": DJ_CHARACTER["voice_key"],
        "vibe": DJ_CHARACTER["vibe"],
        "free": True,
        "tts": "edge-tts",
        "default_on": True,
        "truth_every": "3-4 songs",
        "drop_style": "even witty bridges · funny ironic truths",
    }
