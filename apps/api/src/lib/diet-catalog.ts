import type { DietGoal, Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export const MEAL_TYPE_LABELS: Record<string, string> = {
  cafe: "Café da manhã",
  lanche_manha: "Lanche da manhã",
  almoco: "Almoço",
  lanche_tarde: "Lanche da tarde",
  jantar: "Jantar",
};

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

type MealSeed = {
  mealType: keyof typeof MEAL_TYPE_LABELS;
  title: string;
  description?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: string[];
  instructions: string;
  sortOrder: number;
};

type PlanSeed = {
  slug: string;
  name: string;
  description: string;
  goal: DietGoal;
  targetCalories: number;
  sortOrder: number;
  /** Base day templates; rotated across the week with light variation. */
  dayTemplates: MealSeed[][];
};

function scaleMacros(
  meal: MealSeed,
  factor: number,
): Pick<MealSeed, "calories" | "proteinG" | "carbsG" | "fatG"> {
  return {
    calories: Math.round(meal.calories * factor),
    proteinG: Math.round(meal.proteinG * factor * 10) / 10,
    carbsG: Math.round(meal.carbsG * factor * 10) / 10,
    fatG: Math.round(meal.fatG * factor * 10) / 10,
  };
}

const EMAGRECIMENTO_DAYS: MealSeed[][] = [
  [
    {
      mealType: "cafe",
      title: "Ovos mexidos com torrada integral",
      description: "Café leve e rico em proteína.",
      calories: 320,
      proteinG: 22,
      carbsG: 28,
      fatG: 12,
      ingredients: [
        "2 ovos",
        "1 fatia de pão integral",
        "1 colher de chá de azeite",
        "Tomate cereja a gosto",
        "Sal e pimenta a gosto",
      ],
      instructions:
        "Aqueça o azeite, mexa os ovos até ficarem cremosos. Sirva com a torrada e o tomate.",
      sortOrder: 1,
    },
    {
      mealType: "lanche_manha",
      title: "Iogurte natural com frutas",
      calories: 180,
      proteinG: 12,
      carbsG: 22,
      fatG: 4,
      ingredients: ["170 g de iogurte natural desnatado", "1/2 banana", "Canela a gosto"],
      instructions: "Misture o iogurte com a banana fatiada e finalize com canela.",
      sortOrder: 2,
    },
    {
      mealType: "almoco",
      title: "Frango grelhado com arroz e salada",
      calories: 480,
      proteinG: 42,
      carbsG: 45,
      fatG: 12,
      ingredients: [
        "120 g de peito de frango",
        "4 colheres de sopa de arroz cozido",
        "Salada verde à vontade",
        "1 colher de chá de azeite",
      ],
      instructions:
        "Grelhe o frango temperado. Monte o prato com arroz, salada e um fio de azeite.",
      sortOrder: 3,
    },
    {
      mealType: "lanche_tarde",
      title: "Whey com maçã",
      calories: 220,
      proteinG: 24,
      carbsG: 20,
      fatG: 3,
      ingredients: ["1 scoop de whey (ou 200 ml de leite desnatado)", "1 maçã média"],
      instructions: "Prepare o shake e acompanhe com a maçã.",
      sortOrder: 4,
    },
    {
      mealType: "jantar",
      title: "Peixe assado com legumes",
      calories: 420,
      proteinG: 38,
      carbsG: 28,
      fatG: 14,
      ingredients: [
        "140 g de peixe branco",
        "Abobrinha e brócolis à vontade",
        "1 batata-doce pequena",
        "Temperos naturais",
      ],
      instructions: "Asse o peixe e os legumes. Sirva com a batata-doce cozida.",
      sortOrder: 5,
    },
  ],
  [
    {
      mealType: "cafe",
      title: "Vitamina proteica",
      calories: 300,
      proteinG: 24,
      carbsG: 32,
      fatG: 8,
      ingredients: [
        "200 ml de leite desnatado",
        "1 scoop de whey (opcional)",
        "1/2 banana",
        "1 colher de aveia",
      ],
      instructions: "Bata tudo no liquidificador até ficar homogêneo.",
      sortOrder: 1,
    },
    {
      mealType: "lanche_manha",
      title: "Castanhas porção controlada",
      calories: 160,
      proteinG: 5,
      carbsG: 6,
      fatG: 14,
      ingredients: ["15 g de castanha-do-pará ou amêndoas"],
      instructions: "Consuma a porção medida — evite comer direto do pacote.",
      sortOrder: 2,
    },
    {
      mealType: "almoco",
      title: "Carne magra com feijão e legumes",
      calories: 500,
      proteinG: 40,
      carbsG: 48,
      fatG: 14,
      ingredients: [
        "100 g de patinho ou alcatra magra",
        "4 colheres de feijão",
        "2 colheres de arroz",
        "Legumes refogados",
      ],
      instructions: "Grelhe a carne, monte o prato com feijão, arroz e legumes.",
      sortOrder: 3,
    },
    {
      mealType: "lanche_tarde",
      title: "Cottage com cenoura",
      calories: 190,
      proteinG: 18,
      carbsG: 10,
      fatG: 8,
      ingredients: ["100 g de cottage", "1 cenoura crua ralada"],
      instructions: "Misture o cottage com a cenoura e tempere levemente.",
      sortOrder: 4,
    },
    {
      mealType: "jantar",
      title: "Omelete de claras com salada",
      calories: 380,
      proteinG: 32,
      carbsG: 20,
      fatG: 16,
      ingredients: [
        "3 claras + 1 gema",
        "Espinafre e tomate",
        "1 colher de queijo cottage",
        "Salada verde",
      ],
      instructions: "Prepare a omelete recheada e sirva com salada.",
      sortOrder: 5,
    },
  ],
  [
    {
      mealType: "cafe",
      title: "Tapioca com ovos",
      calories: 310,
      proteinG: 20,
      carbsG: 30,
      fatG: 10,
      ingredients: ["2 colheres de goma de tapioca", "2 ovos", "Tomate e orégano"],
      instructions: "Faça a tapioca fina e recheie com ovos mexidos e tomate.",
      sortOrder: 1,
    },
    {
      mealType: "lanche_manha",
      title: "Fruta com pasta de amendoim",
      calories: 200,
      proteinG: 6,
      carbsG: 24,
      fatG: 8,
      ingredients: ["1 pera ou maçã", "1 colher de chá de pasta de amendoim"],
      instructions: "Corte a fruta e use a pasta como cobertura.",
      sortOrder: 2,
    },
    {
      mealType: "almoco",
      title: "Tilápia com quinoa e salada",
      calories: 470,
      proteinG: 40,
      carbsG: 42,
      fatG: 12,
      ingredients: [
        "140 g de tilápia",
        "4 colheres de quinoa cozida",
        "Salada colorida",
        "Limão e ervas",
      ],
      instructions: "Grelhe o peixe com limão. Sirva com quinoa e salada.",
      sortOrder: 3,
    },
    {
      mealType: "lanche_tarde",
      title: "Shake leve",
      calories: 210,
      proteinG: 22,
      carbsG: 18,
      fatG: 4,
      ingredients: ["1 scoop de whey", "Água ou leite desnatado", "Canela"],
      instructions: "Bata e consuma logo após o preparo.",
      sortOrder: 4,
    },
    {
      mealType: "jantar",
      title: "Frango desfiado com legumes no vapor",
      calories: 400,
      proteinG: 38,
      carbsG: 25,
      fatG: 12,
      ingredients: [
        "120 g de frango desfiado",
        "Brócolis, cenoura e abobrinha",
        "1 colher de chá de azeite",
      ],
      instructions: "Cozinhe os legumes no vapor e misture ao frango com azeite.",
      sortOrder: 5,
    },
  ],
];

const MANUTENCAO_DAYS: MealSeed[][] = EMAGRECIMENTO_DAYS.map((day) =>
  day.map((meal) => ({
    ...meal,
    ...scaleMacros(meal, 1.22),
    title: meal.title,
    description: meal.description
      ? `${meal.description} Porções ajustadas para manutenção.`
      : "Porções ajustadas para manutenção de peso.",
  })),
);

const HIPERTROFIA_DAYS: MealSeed[][] = EMAGRECIMENTO_DAYS.map((day) =>
  day.map((meal) => {
    const scaled = scaleMacros(meal, 1.55);
    const extraCarb =
      meal.mealType === "almoco" || meal.mealType === "jantar"
        ? ["+ 2 colheres extras de arroz ou batata"]
        : meal.mealType === "cafe"
          ? ["+ 1 fatia de pão integral ou aveia extra"]
          : [];
    return {
      ...meal,
      ...scaled,
      ingredients: [...meal.ingredients, ...extraCarb],
      description: "Porções aumentadas para ganho de massa.",
      instructions: `${meal.instructions} Priorize as porções extras de carboidrato ao redor do treino.`,
    };
  }),
);

const PLAN_SEEDS: PlanSeed[] = [
  {
    slug: "emagrecimento",
    name: "Emagrecimento",
    description:
      "Plano com déficit calórico moderado (~1.800 kcal/dia), focado em proteína e satiedade.",
    goal: "EMAGRECIMENTO",
    targetCalories: 1800,
    sortOrder: 1,
    dayTemplates: EMAGRECIMENTO_DAYS,
  },
  {
    slug: "manutencao",
    name: "Manutenção",
    description:
      "Plano equilibrado (~2.200 kcal/dia) para manter peso com boa recuperação.",
    goal: "MANUTENCAO",
    targetCalories: 2200,
    sortOrder: 2,
    dayTemplates: MANUTENCAO_DAYS,
  },
  {
    slug: "hipertrofia",
    name: "Ganho de massa",
    description:
      "Plano com superávit (~2.800 kcal/dia), mais carboidrato e proteína para hipertrofia.",
    goal: "HIPERTROFIA",
    targetCalories: 2800,
    sortOrder: 3,
    dayTemplates: HIPERTROFIA_DAYS,
  },
];

function mealsForPlan(plan: PlanSeed) {
  const meals: Array<{
    dayOfWeek: number;
    mealType: string;
    title: string;
    description: string | null;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    ingredients: Prisma.InputJsonValue;
    instructions: string;
    sortOrder: number;
  }> = [];

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    const template = plan.dayTemplates[dayOfWeek % plan.dayTemplates.length]!;
    for (const meal of template) {
      meals.push({
        dayOfWeek,
        mealType: meal.mealType,
        title: meal.title,
        description: meal.description ?? null,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        ingredients: meal.ingredients,
        instructions: meal.instructions,
        sortOrder: meal.sortOrder,
      });
    }
  }

  return meals;
}

export async function ensureDietPlans(): Promise<number> {
  for (const plan of PLAN_SEEDS) {
    const existing = await prisma.dietPlan.findUnique({
      where: { slug: plan.slug },
      select: { id: true },
    });

    const dietPlan = existing
      ? await prisma.dietPlan.update({
          where: { slug: plan.slug },
          data: {
            name: plan.name,
            description: plan.description,
            goal: plan.goal,
            targetCalories: plan.targetCalories,
            active: true,
            sortOrder: plan.sortOrder,
          },
        })
      : await prisma.dietPlan.create({
          data: {
            slug: plan.slug,
            name: plan.name,
            description: plan.description,
            goal: plan.goal,
            targetCalories: plan.targetCalories,
            active: true,
            sortOrder: plan.sortOrder,
          },
        });

    await prisma.dietMeal.deleteMany({ where: { dietPlanId: dietPlan.id } });
    await prisma.dietMeal.createMany({
      data: mealsForPlan(plan).map((meal) => ({
        ...meal,
        dietPlanId: dietPlan.id,
      })),
    });
  }

  return prisma.dietPlan.count({ where: { active: true } });
}

export function serializeDietMeal(meal: {
  id: string;
  dayOfWeek: number;
  mealType: string;
  title: string;
  description: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  ingredients: Prisma.JsonValue;
  instructions: string | null;
  imageUrl: string | null;
  sortOrder: number;
}) {
  const ingredients = Array.isArray(meal.ingredients)
    ? meal.ingredients.filter((item): item is string => typeof item === "string")
    : [];

  return {
    id: meal.id,
    dayOfWeek: meal.dayOfWeek,
    dayLabel: WEEKDAY_LABELS[meal.dayOfWeek] ?? `Dia ${meal.dayOfWeek}`,
    mealType: meal.mealType,
    mealTypeLabel: MEAL_TYPE_LABELS[meal.mealType] ?? meal.mealType,
    title: meal.title,
    description: meal.description,
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
    ingredients,
    instructions: meal.instructions,
    imageUrl: meal.imageUrl,
    sortOrder: meal.sortOrder,
  };
}
