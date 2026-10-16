/** The dental tips shown on the home screen, one a day. The wording is the design's. */
export const DENTAL_TIPS: { title: string; text: string }[] = [
  {
    title: 'Avoid Abrasives',
    text: 'Skip the charcoal and baking soda scrubs. They are too "gritty" and can scratch your enamel, which actually makes your teeth look more yellow in the long run as the enamel thins.',
  },
  {
    title: 'Hydrate with Water',
    text: 'Water is the best "mouthwash." It rinses away food particles and keeps your saliva levels high (Saliva is your mouth’s natural defence against acid).',
  },
  {
    title: 'The Two-Minute Rule',
    text: 'Brush for at least two minutes, twice a day. Use a soft-bristled brush to avoid wearing down your enamel or receding your gums.',
  },
]

/** The tip for a given day: it changes at midnight and cycles through the list. */
export const tipFor = (date: Date) => DENTAL_TIPS[Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000) % DENTAL_TIPS.length]
