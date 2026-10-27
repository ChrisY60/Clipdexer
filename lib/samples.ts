import { Clip } from "./types";
// Authored demonstration fixtures. They do not describe real streamer footage.
export const samples: Clip[] = [
  {
    id: "sample-purple",
    title: "Wait… we’re going to Bulgaria?",
    streamer: "Demo creator",
    category: "Just Chatting",
    duration: 30,
    thumbnail: "purple",
    segments: [
      {
        start: 6,
        end: 12,
        kind: "speech",
        text: "Chat, where should we travel next?",
      },
      {
        start: 12,
        end: 18,
        kind: "visual",
        text: "A person wearing a purple shirt sits at a desk with a microphone and purple room lighting.",
      },
      {
        start: 18,
        end: 24,
        kind: "speech",
        text: "Bulgaria! I want to visit Bulgaria. That would be an incredible trip.",
      },
    ],
  },
  {
    id: "sample-clutch",
    title: "One health. One very loud celebration.",
    streamer: "Demo player",
    category: "Gaming",
    duration: 30,
    thumbnail: "game",
    segments: [
      {
        start: 8,
        end: 14,
        kind: "visual",
        text: "A first-person game shows a final opponent and a player with one health point.",
      },
      {
        start: 18,
        end: 24,
        kind: "speech",
        text: "No way! We won the final round with one health! That was the best clutch.",
      },
      {
        start: 20,
        end: 26,
        kind: "visual",
        text: "A player in a green hoodie jumps up and celebrates a gaming victory.",
      },
    ],
  },
  {
    id: "sample-cat",
    title: "The real main character just arrived",
    streamer: "Demo creator",
    category: "Just Chatting",
    duration: 30,
    thumbnail: "cat",
    segments: [
      {
        start: 10,
        end: 16,
        kind: "visual",
        text: "An orange cat walks across a keyboard next to a coffee mug on a desk.",
      },
      {
        start: 16,
        end: 23,
        kind: "speech",
        text: "My cat just deleted everything. Please get off the keyboard!",
      },
      {
        start: 20,
        end: 27,
        kind: "visual",
        text: "A person laughs as an orange cat sits on the keyboard.",
      },
    ],
  },
].map(
  (c) =>
    ({
      ...c,
      source: "sample",
      status: "ready",
      createdAt: "2026-01-01T00:00:00.000Z",
    }) as Clip,
);
