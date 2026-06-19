/**
 * Built-in template library. Users can override or extend by writing
 * to /users/{uid}/templates/{id}. These ten cover the journal types the
 * marketing page advertises.
 */
import type { Template } from './types'

export const BUILTIN_TEMPLATES: Omit<Template, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'tpl-daily',
    name: 'Daily',
    description: 'A flexible daily entry. Three sections: how you feel, what happened, what is next.',
    structure: `# How am I today?

_(write a sentence about your mood and energy)_

## What happened today
-

## What is next
- `,
    defaultJournalType: 'daily',
    defaultMoodRequired: true,
    isBuiltIn: true,
  },
  {
    id: 'tpl-gratitude',
    name: 'Gratitude',
    description: 'Three things you are grateful for, plus one thing you appreciated about yourself.',
    structure: `# Gratitude

## Three things I am grateful for
1.
2.
3.

## One thing I appreciated about myself today
`,
    defaultJournalType: 'gratitude',
    defaultMoodRequired: true,
    isBuiltIn: true,
  },
  {
    id: 'tpl-learning',
    name: 'Learning',
    description: 'Capture something you learned today. Concept, source, application.',
    structure: `# Learning log

**Concept:**

**Source:**

**Why it matters:**

**How I will apply it:**
`,
    defaultJournalType: 'learning',
    defaultMoodRequired: false,
    isBuiltIn: true,
  },
  {
    id: 'tpl-reading',
    name: 'Reading',
    description: 'Notes on a book or article — title, author, key takeaways, quotes.',
    structure: `# Reading notes

**Title:**

**Author:**

## Key takeaways
-

## Quotes
>
`,
    defaultJournalType: 'reading',
    defaultMoodRequired: false,
    isBuiltIn: true,
  },
  {
    id: 'tpl-travel',
    name: 'Travel',
    description: 'Where you went, who you were with, what you saw, what you ate.',
    structure: `# Travel —

**Place:**

**With:**

## Highlights
-

## Food
-

## Photos
_(drag-drop images into the editor)_
`,
    defaultJournalType: 'travel',
    defaultMoodRequired: true,
    isBuiltIn: true,
  },
  {
    id: 'tpl-work',
    name: 'Work',
    description: 'Wins, blockers, decisions, follow-ups.',
    structure: `# Work log

## Wins
-

## Blockers
-

## Decisions
-

## Follow-ups
- [ ]
`,
    defaultJournalType: 'work',
    defaultMoodRequired: false,
    isBuiltIn: true,
  },
  {
    id: 'tpl-fitness',
    name: 'Fitness',
    description: 'Movement log — what you did, how it felt, recovery notes.',
    structure: `# Fitness

**Activity:**

**Duration / distance / sets:**

**How it felt (1–10):**

## Notes
`,
    defaultJournalType: 'fitness',
    defaultMoodRequired: true,
    isBuiltIn: true,
  },
  {
    id: 'tpl-dream',
    name: 'Dream',
    description: 'A quick capture of last night’s dream while it is still fresh.',
    structure: `# Dream

**Setting:**

**People:**

## What happened


## What it felt like

`,
    defaultJournalType: 'dream',
    defaultMoodRequired: false,
    isBuiltIn: true,
  },
  {
    id: 'tpl-research',
    name: 'Research',
    description: 'A research log — question, sources, observations, next experiments.',
    structure: `# Research log

**Question:**

**Sources:**
-

## Observations
-

## Next experiments
-
`,
    defaultJournalType: 'research',
    defaultMoodRequired: false,
    isBuiltIn: true,
  },
  {
    id: 'tpl-reflection',
    name: 'Reflection',
    description: 'A deeper end-of-week or end-of-month reflection prompt.',
    structure: `# Reflection

## What went well

## What I struggled with

## What I learned about myself

## What I want to change next
`,
    defaultJournalType: 'reflection',
    defaultMoodRequired: true,
    isBuiltIn: true,
  },
]
