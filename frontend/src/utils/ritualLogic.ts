import { Product } from '../types';

export type SkinType = 'Oily' | 'Dry' | 'Combination' | 'Sensitive' | 'Normal' | '';
export type FocusArea = 'Face' | 'Body' | 'Hair' | 'Everything' | '';

export type Concern = 
  | 'Acne' | 'Dark spots' | 'Pigmentation' | 'Dullness' | 'Dryness' | 'Aging / fine lines' | 'Uneven skin tone'
  | 'Body acne' | 'Stretch marks' | 'Rough texture' | 'Uneven body tone'
  | 'Dandruff' | 'Hair fall' | 'Frizzy hair' | 'Split ends';

export type Goal = 
  | 'Hydration' | 'Brightening' | 'Oil control' | 'Repair & nourishment' | 'Anti-aging'
  | 'Smooth skin' | 'Firming' | 'Soothing'
  | 'Scalp health' | 'Growth' | 'Shine' | '';

export interface QuizState {
    focusArea: FocusArea;
    skinType: SkinType;
    concerns: Concern[];
    goal: Goal;
    routineTime: RoutineTime;
}

export type RoutineTime = 'Morning routine' | 'Night routine' | 'Full skincare routine' | '';

export interface PresetRoutineStep {
    pid: string;
    stepLabel: string;
    reason: string;
    icon: string;
}

export interface PresetRoutine {
    condition: (answers: QuizState) => boolean;
    morning: PresetRoutineStep[];
    night: PresetRoutineStep[];
    weekly?: PresetRoutineStep[]; // for AHA BHA peel
}

export const PRESET_ROUTINES: PresetRoutine[] = [
    {
        // 1. Anti-aging
        condition: (a) => a.goal === 'Anti-aging' || a.concerns.includes('Aging / fine lines'),
        morning: [
            { pid: 'BD-CLE-ROSE', stepLabel: 'Cleanse', reason: 'Gentle cleansing that sets a hydrated base.', icon: '🫧' },
            { pid: 'BD-SER-COQ10', stepLabel: 'Treat', reason: 'Boosts cellular energy and repairs daily damage.', icon: '💧' },
            { pid: 'BD-SUN-PHYS-SPF50', stepLabel: 'Protect', reason: 'Essential defense against photo-aging.', icon: '☀️' }
        ],
        night: [
            { pid: 'BD-CLE-KOJIC-GLY', stepLabel: 'Cleanse', reason: 'Evening wash to remove impurities and gently exfoliate.', icon: '🫧' },
            { pid: 'BD-SER-RET', stepLabel: 'Treat', reason: 'Accelerates cell turnover and reduces fine lines.', icon: '💧' },
            { pid: 'BD-MOIST-PEP', stepLabel: 'Moisturize', reason: 'Deep repair and firming while you sleep.', icon: '🧴' }
        ]
    },
    {
        // 2. Acne prone skin
        condition: (a) => a.concerns.includes('Acne'),
        morning: [
            { pid: 'BD-CLE-ACNE', stepLabel: 'Cleanse', reason: 'Clears pores and prevents new breakouts.', icon: '🫧' },
            { pid: 'BD-SER-AZE', stepLabel: 'Treat', reason: 'Targets acne bacteria and reduces inflammation.', icon: '💧' },
            { pid: 'BD-SER-NIA-SPF30', stepLabel: 'Nourish', reason: 'Controls oil and strengthens the barrier.', icon: '✨' },
            { pid: 'BD-SUN-LIQ', stepLabel: 'Protect', reason: 'Lightweight sun protection without clogging pores.', icon: '☀️' }
        ],
        night: [
            { pid: 'BD-CLE-KOJIC-GLY', stepLabel: 'Cleanse', reason: 'Deep clean to remove daily buildup.', icon: '🫧' },
            { pid: 'BD-SER-SAL', stepLabel: 'Treat', reason: 'Exfoliates inside the pore to clear congestion.', icon: '💧' }
        ]
    },
    {
        // 3. Oily skin type
        condition: (a) => a.skinType === 'Oily',
        morning: [
            { pid: 'BD-SOAP-GOAT', stepLabel: 'Cleanse', reason: 'Gentle effectively cleanses excess sebum.', icon: '🧼' },
            { pid: 'BD-SER-NIA-SPF30', stepLabel: 'Treat', reason: 'Regulates oil production throughout the day.', icon: '💧' },
            { pid: 'BD-MOIST-SILICA-OATS', stepLabel: 'Moisturize', reason: 'Provides matte hydration without heaviness.', icon: '🧴' },
            { pid: 'BD-SUN-LIQ', stepLabel: 'Protect', reason: 'Fluid sun shield perfect for oily skin.', icon: '☀️' }
        ],
        night: [
            { pid: 'BD-CLE-KOJIC-GLY', stepLabel: 'Cleanse', reason: 'Purifying evening wash.', icon: '🫧' },
            { pid: 'BD-SER-RET', stepLabel: 'Treat', reason: 'Improves skin texture (use alternate days).', icon: '💧' }
        ]
    },
    {
        // 4. Sensitive skin
        condition: (a) => a.skinType === 'Sensitive',
        morning: [
            { pid: 'BD-CLE-ROSE', stepLabel: 'Cleanse', reason: 'Ultra-gentle soothing wash.', icon: '🫧' },
            { pid: 'BD-MOIST-PEP', stepLabel: 'Nourish', reason: 'Rebuilds a compromised skin barrier.', icon: '🧴' },
            { pid: 'BD-SUN-PHYS-SPF50', stepLabel: 'Protect', reason: 'Mineral protection that will not irritate.', icon: '☀️' }
        ],
        night: [
            { pid: 'BD-CLE-STRAW', stepLabel: 'Cleanse', reason: 'Gentle clean without stripping natural oils.', icon: '🫧' },
            { pid: 'BD-SER-RET', stepLabel: 'Treat', reason: 'Mild renewal (use once a week).', icon: '💧' }
        ]
    },
    {
        // 5. Normal skin
        condition: (a) => a.skinType === 'Normal',
        morning: [
            { pid: 'BD-SER-NIA-SPF30', stepLabel: 'Treat', reason: 'Maintains healthy balanced skin.', icon: '💧' },
            { pid: 'BD-MOIST-SILICA-OATS', stepLabel: 'Moisturize', reason: 'Ideal daily hydration.', icon: '🧴' },
            { pid: 'BD-SUN-LIQ', stepLabel: 'Protect', reason: 'Weightless daily defense.', icon: '☀️' }
        ],
        night: [
            { pid: 'BD-SER-RET', stepLabel: 'Treat', reason: 'Keeps skin smooth and youthful.', icon: '💧' },
            { pid: 'BD-MOIST-SILICA-OATS', stepLabel: 'Moisturize', reason: 'Locks in active ingredients overnight.', icon: '🧴' }
        ]
    },
    {
        // 6. Dry skin
        condition: (a) => a.skinType === 'Dry',
        morning: [
            { pid: 'BD-CLE-ROSE', stepLabel: 'Cleanse', reason: 'Hydrating wash that prevents tightness.', icon: '🫧' },
            { pid: 'BD-SER-NIA-SPF30', stepLabel: 'Treat', reason: 'Boosts barrier function to retain moisture.', icon: '💧' },
            { pid: 'BD-SUN-PHYS-SPF50', stepLabel: 'Protect', reason: 'Nourishing sun protection.', icon: '☀️' }
        ],
        night: [
            { pid: 'BD-SER-RET', stepLabel: 'Treat', reason: 'Renewal treatment (use sandwich method).', icon: '💧' },
            { pid: 'BD-MOIST-OATS', stepLabel: 'Moisturize', reason: 'Deep intensive overnight moisture.', icon: '🧴' }
        ]
    },
    {
        // 7. Tan removal
        condition: (a) => a.concerns.includes('Pigmentation') || a.concerns.includes('Dark spots') || a.concerns.includes('Dullness') || a.goal === 'Brightening',
        morning: [
            { pid: 'BD-CLE-ROSE', stepLabel: 'Cleanse', reason: 'Fresh start for glowing skin.', icon: '🫧' },
            { pid: 'BD-SER-NIA-SPF30', stepLabel: 'Treat', reason: 'Fades dark spots and brightens tone.', icon: '💧' },
            { pid: 'BD-SUN-LIQ', stepLabel: 'Protect', reason: 'Prevents further tanning (reapply every 3 hours).', icon: '☀️' }
        ],
        night: [
            { pid: 'BD-CLE-KOJIC-GLY', stepLabel: 'Cleanse', reason: 'Evening exfoliation to remove tan.', icon: '🫧' },
            { pid: 'BD-SER-VITC', stepLabel: 'Treat', reason: 'Potent antioxidant for bright, even skin.', icon: '💧' }
        ],
        weekly: [
            { pid: 'BD-SER-AHA-BHA', stepLabel: 'Exfoliate', reason: 'Weekly deep exfoliation mechanism.', icon: '✨' }
        ]
    }
];

export const KEYWORDS = {
    general: {
        'pregnancy_safe': ['gentle', 'clean', 'mineral', 'safe', 'pregnancy', 'maternity', 'soothing'],
        'men': ['men', 'male', 'masculine', 'rugged'],
        'teen': ['teen', 'young', 'gentle', 'student']
    }
};

// Export for use in recommendation fallbacks
export const AREA_MAP: Record<FocusArea, string[]> = {
    'Face': ['skin', 'lip'],
    'Body': ['body'],
    'Hair': ['hair'],
    'Everything': ['skin', 'body', 'hair', 'lip'],
    '': []
};

export const scoreProduct = (p: Product, answers: QuizState): number => {
    let score = 0;
    const textToSearch = [
        p.name, p.description,
        ...(p.benefits || []),
        ...(p.concerns_targeted || []),
        p.sub_category || ''
    ].join(' ').toLowerCase();

    // Match Category (Primary Filter)
    if (!AREA_MAP[answers.focusArea].includes(p.category)) return -100;

    // Concern Match (+5 per match)
    answers.concerns.forEach(c => {
        const normalizedConcern = c.toLowerCase().replace(/ /g, '_');
        if (p.concerns_targeted?.includes(normalizedConcern)) score += 5;
        else if (textToSearch.includes(c.toLowerCase())) score += 3;
    });

    // Goal Match (+3)
    if (answers.goal && textToSearch.includes(answers.goal.toLowerCase())) score += 3;

    // Skin Type Match (only if skin product)
    if (p.category === 'skin' && answers.skinType) {
        if (p.skin_type_suitable?.map(s => s.toLowerCase()).includes(answers.skinType.toLowerCase())) score += 5;
        if (p.skin_type_not_suitable?.map(s => s.toLowerCase()).includes(answers.skinType.toLowerCase())) score -= 20;
    }

    // Default ensure base score is 0 if it's the right category, so it can be recommended if nothing better exists
    return Math.max(0, score);
};
