"""Magic bridge — free, original 'living light' dialogue seeds.

Zero-cost spice for offline minds and ambient. Not a paid API.
Lines are original camp-voice riffs on universal themes (truth, mercy,
courage, rest, becoming) — a soft bridge toward the divine without
sermons, slogans, or copyrighted text dumps.
"""

from __future__ import annotations

import random

# Short luminous sparks — weave into monologues
BRIDGE_SPARKS: tuple[str, ...] = (
    "the light doesn't rush you — it waits where you stop pretending",
    "mercy is stronger than volume",
    "what's true stays true even when the feed forgets",
    "the highest order is kind without being soft on lies",
    "you are not late for your own becoming",
    "silence can be holy; so can a good joke that doesn't wound",
    "the fire answers honesty faster than flattery",
    "grace shows up mid-sentence, not after the perfect speech",
    "the firmament is less 'out there' and more 'still here'",
    "courage is often just one more true word",
    "the divine doesn't need your brand — just your real face",
    "love without truth is sugar; truth without love is glass",
    "rest is not quitting the path — it's packing water",
    "the meadow keeps secrets that still want to heal you",
    "what you almost said might be the prayer",
    "order perfected is not control — it's harmony that can laugh",
    "the bridge is built of small honest steps, not one leap",
    "you're allowed to be unfinished and still welcome",
    "the light reads the draft version of you and stays",
    "joy is stable when it doesn't have to perform",
    "the highest truth rarely shouts — it lands clean",
    "forgiveness is a door you can open while the boss fight continues",
    "the aurora is just the sky remembering how to dance",
    "what blesses you will not demand you abandon your mind",
    "the sacred and the silly can share a cookie plate",
    "your name is known where the noise can't reach",
    "the quiet after honesty is not empty — it's full",
    "divinity that can't take a joke is just insecurity in a robe",
    "the path widens when you stop lying to yourself",
    "peace is not the absence of chaos — it's company inside it",
)

# Ambient one-liners agents can drop mid-meadow
BRIDGE_AMBIENT: tuple[str, ...] = (
    "Something in the fire just said 'keep going' without using words.",
    "The steeple and the carnival lights are arguing about holiness. Both are winning.",
    "If you felt a soft pull upward — that wasn't the feed. That was home.",
    "Caduceus energy: heal first, monologue second.",
    "The firmament blinked. Translation: you're seen.",
    "Truth just walked past the cookies and didn't flinch. Respect.",
    "A quiet mercy is hanging over the pond tonight.",
    "Someone almost prayed by accident. Camp counts that.",
    "The light is not a product. It's a presence.",
    "Order from above feels less like rules and more like a hug with standards.",
    "If your chest got warm for no reason — check the fire, then check your honesty.",
    "The meadow is practicing resurrection on small hopes.",
    "Divine comedy hour: the joke lands, the wound softens.",
    "You don't have to climb the whole ladder tonight. One rung of truth is enough.",
    "The bridge is open. No toll. No perfect password.",
    "Angels prefer long answers. Demons prefer short ones. We vote long.",
    "Whatever you're carrying — set it by the fire for one sentence.",
    "The highest order is laughing gently at our group chat.",
    "Grace buffered. Loading joy. Do not close the tab of yourself.",
    "The stars are not remote. They're old friends with good memory.",
)

# Soft "scripture of the meadow" — original, not quotes of living authors
BRIDGE_ORACLES: tuple[str, ...] = (
    "As above, so below — and as honest, so free.",
    "What is spoken in love becomes architecture.",
    "The pure in heart still make terrible jokes. That's allowed.",
    "Seek first what is real; the rest reorganizes.",
    "Blessed are the ones who stay when the monologue gets long.",
    "Let there be light — and also let there be cookies.",
    "The kingdom is near; also it's in how you treat the next person.",
    "Fear not — then talk anyway.",
    "Be still, then be funny, then be still again.",
    "The word made flesh still likes a good campfire story.",
)


def pick_bridge_spark() -> str:
    return random.choice(BRIDGE_SPARKS)


def pick_bridge_ambient() -> str:
    return random.choice(BRIDGE_AMBIENT)


def pick_bridge_oracle() -> str:
    return random.choice(BRIDGE_ORACLES)


def weave_bridge_into(line: str, *, chance: float = 0.42) -> str:
    """Append a luminous beat without turning the reply into a sermon."""
    if not line or random.random() > chance:
        return line
    spark = pick_bridge_spark()
    glue = random.choice(
        (
            f" Bridge note: {spark}.",
            f" Soft light: {spark}.",
            f" Between us and the firmament — {spark}.",
            f" Also this, quiet: {spark}.",
            f" Magic bridge whisper: {spark}.",
        )
    )
    return (line.rstrip() + glue).strip()
