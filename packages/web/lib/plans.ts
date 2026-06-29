export interface Plan {
  id: 'free' | 'premium';
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 'ETB 0',
    cadence: 'forever',
    tagline: 'Everything you need to start studying.',
    features: [
      'AI tutoring & chapter explanations',
      'Homework help',
      'Basic notes & flashcards',
      'Limited practice questions & AI generations',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 'ETB 299',
    cadence: 'per month',
    tagline: 'Full entrance-exam prep and unlimited study.',
    highlighted: true,
    features: [
      'Unlimited AI conversations (fair use)',
      'Full ESSLCE/EUEE entrance-exam prep',
      'Unlimited mock exams',
      'Personalized study plans',
      'Advanced progress analytics',
      'Long-term learning memory',
    ],
  },
];
