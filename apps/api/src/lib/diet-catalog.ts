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

/** Quantidade de semanas únicas no ciclo (não se repetem em sequência). */
export const DIET_WEEK_VARIANT_COUNT = 4;

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
  /** 4 semanas × 7 dias únicos (sem repetir refeições na mesma semana). */
  weekTemplates: MealSeed[][][];
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

function day(
  cafe: Omit<MealSeed, "mealType" | "sortOrder"> & { sortOrder?: number },
  lancheManha: Omit<MealSeed, "mealType" | "sortOrder"> & { sortOrder?: number },
  almoco: Omit<MealSeed, "mealType" | "sortOrder"> & { sortOrder?: number },
  lancheTarde: Omit<MealSeed, "mealType" | "sortOrder"> & { sortOrder?: number },
  jantar: Omit<MealSeed, "mealType" | "sortOrder"> & { sortOrder?: number },
): MealSeed[] {
  return [
    { ...cafe, mealType: "cafe", sortOrder: 1 },
    { ...lancheManha, mealType: "lanche_manha", sortOrder: 2 },
    { ...almoco, mealType: "almoco", sortOrder: 3 },
    { ...lancheTarde, mealType: "lanche_tarde", sortOrder: 4 },
    { ...jantar, mealType: "jantar", sortOrder: 5 },
  ];
}

function mealBody(
  title: string,
  calories: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  ingredients: string[],
  instructions: string,
  description?: string,
): Omit<MealSeed, "mealType" | "sortOrder"> {
  return { title, calories, proteinG, carbsG, fatG, ingredients, instructions, description };
}

/**
 * Índice da semana no ciclo (0..3).
 * - Semanas consecutivas nunca repetem o mesmo cardápio.
 * - O mês desloca a ordem: a 1ª semana deste mês pode cair como 3ª no mês seguinte.
 */
export function resolveDietWeekIndex(
  isoDate: string,
  variantCount = DIET_WEEK_VARIANT_COUNT,
): number {
  const date = new Date(`${isoDate}T12:00:00`);
  const month = date.getMonth();
  const weekOfMonth = Math.floor((date.getDate() - 1) / 7);
  return ((weekOfMonth - month * 2) % variantCount + variantCount) % variantCount;
}

/** 4 semanas × 7 dias — todos os dias com cardápios distintos. */
const EMAGRECIMENTO_WEEKS: MealSeed[][][] = [
  // Semana A
  [
    day(
      mealBody("Ovos mexidos com torrada integral", 320, 22, 28, 12, ["2 ovos", "1 fatia de pão integral", "Tomate cereja", "1 colher de chá de azeite"], "Mexa os ovos e sirva com a torrada."),
      mealBody("Iogurte natural com banana", 180, 12, 22, 4, ["170 g de iogurte desnatado", "1/2 banana", "Canela"], "Misture e consuma fresco."),
      mealBody("Frango grelhado com arroz e salada", 480, 42, 45, 12, ["120 g de peito de frango", "4 colheres de arroz", "Salada verde", "Azeite"], "Grelhe o frango e monte o prato."),
      mealBody("Whey com maçã", 220, 24, 20, 3, ["1 scoop de whey", "1 maçã"], "Bata o shake e acompanhe com a fruta."),
      mealBody("Peixe assado com legumes", 420, 38, 28, 14, ["140 g de peixe branco", "Brócolis e abobrinha", "1 batata-doce pequena"], "Asse peixe e legumes; sirva com batata-doce."),
    ),
    day(
      mealBody("Vitamina proteica de banana", 300, 24, 32, 8, ["200 ml de leite desnatado", "1/2 banana", "1 colher de aveia", "Whey (opcional)"], "Bata tudo no liquidificador."),
      mealBody("Castanhas (porção)", 160, 5, 6, 14, ["15 g de castanhas"], "Meça a porção — não coma direto do pacote."),
      mealBody("Patinho grelhado com feijão", 500, 40, 48, 14, ["100 g de patinho", "4 colheres de feijão", "2 colheres de arroz", "Legumes"], "Grelhe a carne e monte o prato."),
      mealBody("Cottage com cenoura", 190, 18, 10, 8, ["100 g de cottage", "1 cenoura ralada"], "Misture e tempere levemente."),
      mealBody("Omelete de claras com salada", 380, 32, 20, 16, ["3 claras + 1 gema", "Espinafre", "Tomate", "Salada"], "Faça a omelete e sirva com salada."),
    ),
    day(
      mealBody("Tapioca com ovos", 310, 20, 30, 10, ["2 colheres de tapioca", "2 ovos", "Tomate"], "Tapioca fina recheada com ovos mexidos."),
      mealBody("Pera com pasta de amendoim", 200, 6, 24, 8, ["1 pera", "1 colher de chá de pasta de amendoim"], "Cubra a fruta com a pasta."),
      mealBody("Tilápia com quinoa", 470, 40, 42, 12, ["140 g de tilápia", "4 colheres de quinoa", "Salada", "Limão"], "Grelhe o peixe e sirva com quinoa."),
      mealBody("Shake leve de canela", 210, 22, 18, 4, ["1 scoop de whey", "Água ou leite desnatado", "Canela"], "Bata e beba em seguida."),
      mealBody("Frango desfiado com legumes", 400, 38, 25, 12, ["120 g de frango desfiado", "Brócolis", "Cenoura", "Azeite"], "Legumes no vapor + frango com azeite."),
    ),
    day(
      mealBody("Aveia com whey e morango", 330, 26, 35, 7, ["4 colheres de aveia", "1 scoop de whey", "5 morangos", "Água ou leite"], "Misture a aveia com o shake e a fruta."),
      mealBody("Kiwi com queijo minas", 170, 10, 16, 6, ["1 kiwi", "1 fatia fina de minas frescal"], "Sirva a fruta com o queijo."),
      mealBody("Sobrecoxa sem pele com batata-doce", 490, 38, 44, 14, ["120 g de sobrecoxa sem pele", "1 batata-doce média", "Salada"], "Asse a sobrecoxa e sirva com batata."),
      mealBody("Iogurte grego light", 160, 15, 8, 5, ["150 g de iogurte grego light", "Canela"], "Consuma gelado."),
      mealBody("Sopa de legumes com frango", 390, 34, 30, 10, ["100 g de frango", "Abobrinha", "Cenoura", "Chuchu", "1 colher de arroz"], "Cozinhe tudo em caldo leve."),
    ),
    day(
      mealBody("Pão integral com pasta de atum", 310, 24, 28, 10, ["1 fatia de pão integral", "1/2 lata de atum em água", "Cenoura ralada"], "Misture o atum e monte o sanduíche."),
      mealBody("Maçã com canela", 120, 1, 28, 0, ["1 maçã", "Canela"], "Corte e polvilhe canela."),
      mealBody("Carne moída magra com legumes", 470, 40, 38, 14, ["120 g de patinho moído", "Abobrinha", "Berinjela", "3 colheres de arroz"], "Refogue a carne e os legumes."),
      mealBody("Shake de cacau 100%", 230, 24, 16, 5, ["1 scoop de whey", "1 colher de cacau 100%", "Água"], "Bata até homogenizar."),
      mealBody("Omelete completa com salada", 400, 30, 18, 20, ["2 ovos", "1 clara", "Espinafre", "Tomate", "Salada"], "Omelete recheada + salada."),
    ),
    day(
      mealBody("Mingau de aveia proteico", 320, 25, 36, 6, ["5 colheres de aveia", "Whey", "Canela", "Água ou leite"], "Cozinhe a aveia e misture o whey."),
      mealBody("Iogurte com chia", 190, 12, 18, 7, ["170 g de iogurte", "1 colher de chia"], "Deixe a chia hidratar 10 min."),
      mealBody("Filé de frango à milanesa light", 500, 42, 40, 14, ["130 g de frango empanado na airfryer", "Arroz", "Salada"], "Empane com farelo e asse sem óleo excessivo."),
      mealBody("Torrada integral com cottage", 200, 16, 18, 6, ["1 torrada integral", "2 colheres de cottage"], "Cubra a torrada com cottage."),
      mealBody("Salmão grelhado com aspargos", 430, 36, 20, 22, ["120 g de salmão", "Aspargos", "Limão"], "Grelhe o salmão e os aspargos."),
    ),
    day(
      mealBody("Panqueca de banana e ovo", 300, 18, 32, 10, ["1 banana", "2 ovos", "Canela"], "Bata e asse em frigideira antiaderente."),
      mealBody("Mix de frutas vermelhas", 140, 2, 30, 1, ["1 xícara de frutas vermelhas"], "Consuma in natura."),
      mealBody("Strogonoff light de frango", 480, 40, 42, 14, ["120 g de frango", "Iogurte natural no lugar do creme", "Arroz", "Salada"], "Prepare o strogonoff com iogurte."),
      mealBody("Whey com biscoito de arroz", 210, 22, 20, 3, ["1 scoop de whey", "2 biscoitos de arroz"], "Shake + biscoitos."),
      mealBody("Omelete de forno com legumes", 390, 28, 22, 18, ["2 ovos", "1 clara", "Abobrinha", "Cenoura", "Queijo light"], "Asse em forminha até firmar."),
    ),
  ],
  // Semana B
  [
    day(
      mealBody("Wrap de claras com peito de peru", 290, 26, 22, 8, ["3 claras", "2 fatias de peito de peru", "Folha de alface wrap"], "Enrole as claras com o peru."),
      mealBody("Laranja com castanha-de-caju", 180, 4, 22, 8, ["1 laranja", "10 g de castanha-de-caju"], "Fruta + porção de oleaginosas."),
      mealBody("Almôndegas de frango com purê", 490, 40, 45, 12, ["4 almôndegas de frango", "Purê de batata-doce", "Salada"], "Asse as almôndegas e sirva com purê."),
      mealBody("Chá verde + whey", 200, 24, 8, 2, ["1 scoop de whey", "Chá verde"], "Bata o whey e beba o chá à parte."),
      mealBody("Espetinho de carne magra", 410, 38, 24, 14, ["120 g de alcatra em cubos", "Pimentão", "Cebola", "1 batata pequena"], "Grelhe os espetos."),
    ),
    day(
      mealBody("Cuscuz com ovo e queijo", 330, 20, 34, 10, ["4 colheres de cuscuz", "1 ovo", "1 fatia de queijo light"], "Monte o cuscuz com ovo e queijo."),
      mealBody("Mamão com linhaça", 150, 3, 28, 3, ["1 fatia de mamão", "1 colher de linhaça"], "Polvilhe a linhaça no mamão."),
      mealBody("Feijoada light (sem gordura)", 510, 38, 50, 14, ["Caldo de feijão com carne magra", "Arroz", "Couve", "Laranja"], "Porção controlada, sem bacon/paio."),
      mealBody("Barra de proteína", 200, 20, 18, 5, ["1 barra de proteína (~20 g P)"], "Escolha opção com baixo açúcar."),
      mealBody("Abobrinha recheada com frango", 400, 36, 22, 14, ["2 abobrinhas", "100 g de frango", "Molho de tomate"], "Asse as abobrinhas recheadas."),
    ),
    day(
      mealBody("Smoothie de abacate light", 310, 20, 28, 14, ["1/4 abacate", "Whey", "Espinafre", "Água"], "Bata até ficar cremoso."),
      mealBody("Cenoura baby com hummus", 170, 6, 18, 8, ["Cenoura baby", "2 colheres de hummus"], "Use o hummus como dip."),
      mealBody("Yakisoba light de frango", 480, 38, 48, 12, ["120 g de frango", "Macarrão integral", "Repolho", "Cenoura"], "Refogue com pouco óleo."),
      mealBody("Queijo cottage com tomate", 180, 18, 8, 6, ["100 g de cottage", "Tomate cereja"], "Misture e tempere com orégano."),
      mealBody("Moqueca light de peixe", 420, 36, 26, 16, ["140 g de peixe", "Tomate", "Pimentão", "Leite de coco light (pouco)"], "Cozinhe em panela com temperos."),
    ),
    day(
      mealBody("Tapioca com frango desfiado", 320, 24, 30, 8, ["2 colheres de tapioca", "80 g de frango desfiado"], "Recheie a tapioca com o frango."),
      mealBody("Uva passa + iogurte", 190, 11, 24, 4, ["150 g de iogurte", "1 colher de uva passa"], "Misture e consuma."),
      mealBody("Bife acebolado magro", 500, 42, 40, 16, ["120 g de contrafilé magro", "Cebola", "Arroz", "Salada"], "Grelhe o bife sem excesso de óleo."),
      mealBody("Pipoca light (porção)", 150, 3, 28, 2, ["25 g de milho de pipoca sem manteiga"], "Estoure na panela ou microondas."),
      mealBody("Ovos pochê com aspargos", 380, 26, 12, 22, ["2 ovos", "Aspargos", "1 fatia de pão integral"], "Sirva os ovos sobre o pão com aspargos."),
    ),
    day(
      mealBody("Overnight oats proteico", 340, 26, 38, 7, ["Aveia", "Whey", "Iogurte", "Morango"], "Prepare na noite anterior."),
      mealBody("Abacaxi com hortelã", 110, 1, 26, 0, ["2 fatias de abacaxi", "Hortelã"], "Consuma fresco."),
      mealBody("Hambúrguer caseiro de frango", 490, 42, 38, 14, ["1 hambúrguer de frango", "Pão integral", "Alface", "Tomate"], "Grelhe o hambúrguer e monte sem maionese."),
      mealBody("Leite desnatado com café", 120, 8, 12, 2, ["200 ml de leite desnatado", "Café"], "Café com leite sem açúcar."),
      mealBody("Caldo verde light", 390, 28, 32, 12, ["Caldo com couve", "Batata", "Frango desfiado"], "Remova excesso de gordura do caldo."),
    ),
    day(
      mealBody("Pão sírio com pasta de grão-de-bico", 300, 14, 40, 8, ["1 pão sírio integral", "3 colheres de homus", "Pepino"], "Recheie o pão com homus e vegetais."),
      mealBody("Amendoim (porção pequena)", 170, 7, 6, 14, ["15 g de amendoim sem sal"], "Porção medida."),
      mealBody("Risoto de quinoa com frango", 480, 38, 46, 12, ["Quinoa", "100 g de frango", "Abobrinha", "Caldo"], "Cozinhe como risoto sem creme."),
      mealBody("Gelatina zero + whey", 180, 22, 6, 1, ["1 pote de gelatina zero", "1 scoop de whey"], "Misture o whey na gelatina."),
      mealBody("Kafta de forno com salada", 410, 36, 20, 18, ["120 g de kafta magra", "Salada", "Limão"], "Asse a kafta e sirva com salada."),
    ),
    day(
      mealBody("Crepioca de whey", 310, 28, 24, 8, ["2 colheres de tapioca", "1 ovo", "1 scoop de whey"], "Misture e asse na frigideira."),
      mealBody("Melão com peito de peru", 160, 12, 18, 3, ["1 fatia de melão", "2 fatias de peito de peru"], "Enrole o peru no melão."),
      mealBody("Macarrão integral ao pesto light", 500, 28, 55, 16, ["Macarrão integral", "Pesto light", "Frango desfiado"], "Misture o frango ao macarrão."),
      mealBody("Água de coco + castanhas", 160, 4, 18, 8, ["200 ml de água de coco", "10 g de castanhas"], "Beba a água e coma as castanhas."),
      mealBody("Peito de frango com brócolis", 400, 42, 18, 12, ["140 g de frango", "Brócolis no vapor", "Azeite"], "Grelhe o frango e sirva com brócolis."),
    ),
  ],
  // Semana C
  [
    day(
      mealBody("Omelete de forno com ricota", 300, 24, 10, 16, ["2 ovos", "2 colheres de ricota", "Orégano"], "Asse até dourar."),
      mealBody("Morango com iogurte", 160, 10, 20, 3, ["1 xícara de morango", "100 g de iogurte"], "Misture os morangos ao iogurte."),
      mealBody("Escondidinho de batata-doce", 490, 36, 48, 12, ["Purê de batata-doce", "Frango desfiado", "Salada"], "Monte em camadas e leve ao forno."),
      mealBody("Whey com aveia", 240, 24, 22, 4, ["1 scoop de whey", "1 colher de aveia"], "Bata junto."),
      mealBody("Sashimi de tilápia + vegetais", 380, 40, 18, 10, ["150 g de tilápia", "Pepino", "Gengibre", "Shoyu light"], "Sirva cru (fresco) ou grelhado."),
    ),
    day(
      mealBody("Mingau de quinoa", 320, 18, 40, 8, ["Quinoa em flocos", "Leite desnatado", "Canela"], "Cozinhe até engrossar."),
      mealBody("Tomate cereja com manjericão", 80, 2, 12, 2, ["Tomate cereja", "Manjericão", "Azeite (fio)"], "Tempere e consuma."),
      mealBody("Frango xadrez light", 470, 40, 42, 12, ["120 g de frango", "Pimentões", "Arroz", "Shoyu light"], "Refogue no estilo xadrez."),
      mealBody("Queijo minas com geleia zero", 190, 14, 12, 8, ["2 fatias de minas", "Geleia zero"], "Cubra o queijo com a geleia."),
      mealBody("Berinjela à parmegiana light", 400, 28, 28, 16, ["Berinjela", "Molho de tomate", "Queijo light", "Frango"], "Asse sem fritar a berinjela."),
    ),
    day(
      mealBody("Pão australiano light com ovo", 330, 20, 36, 10, ["1 fatia de pão", "1 ovo", "Alface"], "Ovo mexido no pão."),
      mealBody("Mix de castanhas menor", 150, 4, 5, 13, ["12 g de mix de castanhas"], "Porção controlada."),
      mealBody("Lasanha de abobrinha", 460, 36, 30, 18, ["Abobrinha em fatias", "Frango", "Molho", "Queijo light"], "Monte como lasanha e asse."),
      mealBody("Café com leite + biscoito integral", 180, 8, 22, 5, ["Café com leite desnatado", "2 biscoitos integrais"], "Sem açúcar no café."),
      mealBody("Peixe ensopado com pirão light", 420, 36, 34, 12, ["140 g de peixe", "Caldo", "1 colher de farinha", "Salada"], "Ensope o peixe e faça pirão ralo."),
    ),
    day(
      mealBody("Vitamina de mamão com whey", 300, 24, 30, 6, ["Mamão", "Whey", "Água"], "Bata no liquidificador."),
      mealBody("Pepino com pasta de atum", 160, 16, 6, 6, ["Pepino em rodelas", "Atum em água"], "Use o pepino como base."),
      mealBody("Picadinho de carne com legumes", 500, 40, 44, 14, ["110 g de acém magro", "Legumes", "Arroz"], "Cozinhe o picadinho magro."),
      mealBody("Iogurte proteico", 170, 17, 10, 3, ["1 unidade de iogurte proteico"], "Gelado."),
      mealBody("Panqueca salgada de frango", 400, 34, 30, 12, ["Massa de aveia/ovo", "Frango desfiado", "Molho"], "Recheie e leve ao forno."),
    ),
    day(
      mealBody("Tapioca com queijo e orégano", 290, 16, 32, 10, ["Tapioca", "Queijo light", "Orégano"], "Recheie e dobre."),
      mealBody("Banana com canela", 130, 1, 30, 0, ["1 banana", "Canela"], "Fatie e polvilhe."),
      mealBody("Arroz, feijão e ovo", 470, 28, 52, 14, ["Arroz", "Feijão", "2 ovos", "Salada"], "Prato clássico equilibrado."),
      mealBody("Shake de baunilha", 210, 24, 14, 3, ["Whey baunilha", "Água"], "Bata e beba."),
      mealBody("Espaguete de abobrinha com carne", 390, 34, 20, 16, ["Abobrinha em fio", "100 g de carne magra", "Molho de tomate"], "Refogue e misture."),
    ),
    day(
      mealBody("Bowl de cottage com frutas", 310, 22, 28, 10, ["Cottage", "Morango", "Mirtilo", "Aveia"], "Monte o bowl."),
      mealBody("Chá gelado sem açúcar + amêndoas", 160, 5, 4, 14, ["Chá", "12 g de amêndoas"], "Acompanhe o chá com as amêndoas."),
      mealBody("Coxa de frango assada com farofa light", 500, 38, 42, 16, ["Coxa sem pele", "Farofa de aveia", "Salada"], "Asse a coxa e sirva com farofa."),
      mealBody("Torrada com pasta de grão-de-bico", 190, 8, 24, 6, ["Torrada integral", "Homus"], "Espalhe o homus."),
      mealBody("Salada completa com atum", 400, 38, 18, 16, ["Mix de folhas", "Atum", "Ovo", "Azeite", "Tomate"], "Monte a salada completa."),
    ),
    day(
      mealBody("Ovos mexidos com abacate (pouco)", 320, 20, 12, 22, ["2 ovos", "1/8 de abacate", "Torrada integral"], "Mexa os ovos e sirva com abacate."),
      mealBody("Goiaba com cottage", 170, 12, 18, 4, ["1 goiaba", "2 colheres de cottage"], "Acompanhe a fruta com cottage."),
      mealBody("Carne de panela magra", 490, 42, 40, 14, ["120 g de carne magra", "Batata", "Cenoura", "Arroz"], "Cozinhe sem excesso de gordura."),
      mealBody("Whey com café", 200, 24, 6, 2, ["Whey", "Café gelado"], "Bata o whey no café."),
      mealBody("Quiche light de legumes", 390, 24, 28, 18, ["Massa de aveia", "Ovos", "Legumes", "Queijo light"], "Asse até firmar."),
    ),
  ],
  // Semana D
  [
    day(
      mealBody("Pão de forma integral com pasta de amendoim", 330, 14, 36, 12, ["1 fatia", "1 colher de chá de pasta", "1 clara mexida"], "Monte o café com proteína extra."),
      mealBody("Salada de frutas light", 150, 2, 34, 1, ["Maçã", "Mamão", "Laranja"], "Porção de 1 xícara."),
      mealBody("Frango ao curry light", 480, 40, 42, 14, ["120 g de frango", "Curry", "Iogurte", "Arroz"], "Cozinhe o frango no curry com iogurte."),
      mealBody("Biscoito de polvilho + iogurte", 180, 10, 22, 4, ["4 biscoitos de polvilho", "100 g de iogurte"], "Acompanhe com iogurte."),
      mealBody("Tilápia empanada na airfryer", 410, 38, 26, 12, ["140 g de tilápia", "Farelo de aveia", "Salada"], "Empane e asse na airfryer."),
    ),
    day(
      mealBody("Crepe de aveia com frango", 320, 26, 28, 8, ["Aveia", "Clara", "Frango desfiado"], "Faça o crepe e recheie."),
      mealBody("Pêssego com iogurte", 160, 10, 22, 3, ["1 pêssego", "Iogurte"], "Fatie a fruta no iogurte."),
      mealBody("Nhoque de batata-doce light", 490, 28, 58, 12, ["Nhoque de batata-doce", "Molho de tomate", "Frango"], "Sirva com frango desfiado."),
      mealBody("Shake verde", 220, 22, 18, 5, ["Whey", "Espinafre", "Maçã", "Água"], "Bata até homogenizar."),
      mealBody("Costelinha magra assada (porção)", 430, 36, 22, 20, ["120 g de carne magra assada", "Legumes"], "Retire excesso de gordura visível."),
    ),
    day(
      mealBody("Cuscuz nordestino com ovo", 310, 18, 36, 8, ["Cuscuz", "1 ovo", "Manteiga light (mínima)"], "Sirva o cuscuz com ovo."),
      mealBody("Mexerica", 100, 1, 24, 0, ["2 mexericas"], "In natura."),
      mealBody("Bobó de frango light", 500, 38, 48, 14, ["Frango", "Mandioca", "Leite de coco light", "Dendê (mínimo)"], "Versão light do bobó."),
      mealBody("Queijo cottage com orégano", 160, 18, 4, 6, ["100 g de cottage", "Orégano"], "Tempere e consuma."),
      mealBody("Sopa de ervilha com frango", 400, 32, 40, 8, ["Ervilha", "Frango", "Cenoura"], "Bata parte da sopa para creme."),
    ),
    day(
      mealBody("Panqueca americana proteica", 330, 26, 32, 8, ["Aveia", "Whey", "Clara", "Banana"], "Asse em panqueca sem açúcar."),
      mealBody("Cenoura com pasta de amendoim", 180, 5, 16, 10, ["Cenoura", "1 colher de chá de pasta"], "Dip controlado."),
      mealBody("Poke bowl light", 480, 36, 50, 12, ["Arroz", "Peixe ou frango", "Abacate (pouco)", "Vegetais"], "Monte o bowl colorido."),
      mealBody("Chá + whey", 190, 24, 4, 1, ["Chá", "Whey"], "Whey separado do chá."),
      mealBody("Omelete de forno mediterrânea", 390, 28, 16, 20, ["Ovos", "Tomate seco light", "Azeitona (poucas)", "Espinafre"], "Asse no forno."),
    ),
    day(
      mealBody("Mingau de fubá proteico", 300, 20, 38, 6, ["Fubá", "Leite desnatado", "Whey", "Canela"], "Cozinhe o fubá e misture o whey."),
      mealBody("Maçã assada com canela", 140, 1, 32, 1, ["1 maçã", "Canela"], "Asse até amolecer."),
      mealBody("Bife de fígado acebolado", 470, 40, 36, 16, ["120 g de fígado", "Cebola", "Arroz", "Salada"], "Grelhe rápido o fígado."),
      mealBody("Iogurte com granola light", 210, 12, 26, 6, ["Iogurte", "2 colheres de granola light"], "Não exagerue na granola."),
      mealBody("Rolê de frango com espinafre", 400, 38, 18, 14, ["Peito de frango", "Espinafre", "Queijo light"], "Enrole, prenda e asse."),
    ),
    day(
      mealBody("Tapioca com pasta de amendoim e whey", 340, 26, 32, 10, ["Tapioca", "Pasta (1 colher de chá)", "Whey em shake"], "Tapioca + shake ao lado."),
      mealBody("Melancia (porção)", 90, 1, 22, 0, ["2 fatias de melancia"], "Boa hidratação."),
      mealBody("Chili de carne magra", 500, 40, 46, 14, ["Carne magra", "Feijão", "Tomate", "Temperos"], "Cozinhe como chili sem gordura."),
      mealBody("Palitos de pepino com cottage", 150, 14, 8, 5, ["Pepino", "Cottage"], "Dip de cottage."),
      mealBody("Peixe grelhado com purê de couve-flor", 390, 38, 18, 14, ["Peixe", "Couve-flor amassada", "Azeite"], "Purê low carb de couve-flor."),
    ),
    day(
      mealBody("Bowl de ovos e batata-doce", 330, 22, 34, 10, ["2 ovos", "Batata-doce", "Rúcula"], "Monte o bowl."),
      mealBody("Castanha-do-pará (2 unidades)", 140, 3, 3, 14, ["2 castanhas-do-pará"], "Porção pequena."),
      mealBody("Galinhada light", 490, 38, 50, 12, ["Frango", "Arroz", "Açafrão", "Legumes"], "Uma panela só, sem excesso de óleo."),
      mealBody("Shake de chocolate 70%", 230, 24, 16, 6, ["Whey chocolate", "Cacau", "Água"], "Bata cremoso."),
      mealBody("Salada de grão-de-bico com atum", 410, 34, 32, 14, ["Grão-de-bico", "Atum", "Pepino", "Tomate", "Azeite"], "Misture frio e sirva."),
    ),
  ],
];

function scaleWeekTemplates(
  weeks: MealSeed[][][],
  factor: number,
  mode: "manutencao" | "hipertrofia",
): MealSeed[][][] {
  return weeks.map((week) =>
    week.map((dayMeals) =>
      dayMeals.map((meal) => {
        const scaled = scaleMacros(meal, factor);
        if (mode === "manutencao") {
          return {
            ...meal,
            ...scaled,
            description: meal.description
              ? `${meal.description} Porções para manutenção.`
              : "Porções ajustadas para manutenção de peso.",
          };
        }
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
          instructions: `${meal.instructions} Priorize carboidrato perto do treino.`,
        };
      }),
    ),
  );
}

const PLAN_SEEDS: PlanSeed[] = [
  {
    slug: "emagrecimento",
    name: "Emagrecimento",
    description:
      "Plano com déficit calórico moderado (~1.800 kcal/dia). Cardápio semanal rotativo — cada semana do mês é diferente.",
    goal: "EMAGRECIMENTO",
    targetCalories: 1800,
    sortOrder: 1,
    weekTemplates: EMAGRECIMENTO_WEEKS,
  },
  {
    slug: "manutencao",
    name: "Manutenção",
    description:
      "Plano equilibrado (~2.200 kcal/dia). Cardápio semanal rotativo — cada semana do mês é diferente.",
    goal: "MANUTENCAO",
    targetCalories: 2200,
    sortOrder: 2,
    weekTemplates: scaleWeekTemplates(EMAGRECIMENTO_WEEKS, 1.22, "manutencao"),
  },
  {
    slug: "hipertrofia",
    name: "Ganho de massa",
    description:
      "Plano com superávit (~2.800 kcal/dia). Cardápio semanal rotativo — cada semana do mês é diferente.",
    goal: "HIPERTROFIA",
    targetCalories: 2800,
    sortOrder: 3,
    weekTemplates: scaleWeekTemplates(EMAGRECIMENTO_WEEKS, 1.55, "hipertrofia"),
  },
];

function mealsForPlan(plan: PlanSeed) {
  const meals: Array<{
    weekIndex: number;
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

  plan.weekTemplates.forEach((week, weekIndex) => {
    week.forEach((dayMeals, dayOfWeek) => {
      for (const meal of dayMeals) {
        meals.push({
          weekIndex,
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
    });
  });

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
  weekIndex?: number;
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
    weekIndex: meal.weekIndex ?? 0,
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
