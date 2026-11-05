/**
 * Emoji stand-ins for products and categories that have no photo yet. Matched on words in the
 * name, first match wins, so put specific words before general ones ("milk powder" before
 * "milk"). Real photos always replace them.
 */

const PRODUCT_EMOJI: [RegExp, string][] = [
  [/tomato/i, "🍅"],
  [/onion/i, "🧅"],
  [/potato/i, "🥔"],
  [/garlic/i, "🧄"],
  [/ginger/i, "🫚"],
  [/carrot/i, "🥕"],
  [/chilli|chili|mirchi/i, "🌶️"],
  [/cucumber/i, "🥒"],
  [/brinjal|eggplant|baingan/i, "🍆"],
  [/spinach|palak|leafy|methi|coriander|dhaniya/i, "🥬"],
  [/cabbage|cauliflower|broccoli|gobi/i, "🥦"],
  [/\bcorn\b|bhutta/i, "🌽"],
  [/lemon|nimbu/i, "🍋"],
  [/banana|kela/i, "🍌"],
  [/apple|\bseb\b/i, "🍎"],
  [/mango|\baam\b/i, "🥭"],
  [/grape/i, "🍇"],
  [/orange|santra/i, "🍊"],
  [/watermelon/i, "🍉"],
  [/papaya|pineapple/i, "🍍"],
  [/coconut|nariyal/i, "🥥"],
  [/\begg|\banda\b/i, "🥚"],
  [/paneer|cheese/i, "🧀"],
  [/butter|ghee/i, "🧈"],
  [/curd|dahi|yogurt|lassi|buttermilk|chaas/i, "🥛"],
  [/milk|doodh/i, "🥛"],
  [/bread|\bpav\b|\bbuns?\b/i, "🍞"],
  [/atta|flour|maida|sooji|rava|besan/i, "🌾"],
  [/\brice\b|chawal|poha/i, "🍚"],
  [/\bdal\b|lentil|chana|rajma|moong/i, "🫘"],
  [/hair oil|shampoo|lotion|face cream/i, "🧴"],
  [/\boil\b|\btel\b/i, "🫗"],
  // Snacks before spices: "Salted Chips" is chips, not salt
  [/chips|wafer|namkeen|bhujia/i, "🍟"],
  [/salt|namak|masala|spice|haldi|jeera/i, "🧂"],
  [/sugar|cheeni|jaggery|\bgud\b/i, "🍬"],
  [/honey/i, "🍯"],
  [/\btea\b|\bchai\b/i, "🍵"],
  [/coffee/i, "☕"],
  [/juice/i, "🧃"],
  [/\bwater\b/i, "💧"],
  [/cola|soda|soft drink|cold drink/i, "🥤"],
  [/biscuit|cookie/i, "🍪"],
  [/chocolate/i, "🍫"],
  [/candy|toffee|sweet/i, "🍬"],
  [/ice cream/i, "🍨"],
  [/noodle|maggi|pasta/i, "🍜"],
  [/soup/i, "🥣"],
  [/ketchup|sauce|jam|pickle|achaar/i, "🫙"],
  [/soap/i, "🧼"],
  [/toothpaste|toothbrush/i, "🪥"],
  [/detergent|washing|surf/i, "🫧"],
  [/broom|mop|cleaner|scrub/i, "🧽"],
  [/tissue|toilet/i, "🧻"],
  [/notebook|\bcopy\b|register/i, "📓"],
  [/\bpens?\b|pencil/i, "✏️"],
  [/battery/i, "🔋"],
];

const CATEGORY_EMOJI: [RegExp, string][] = [
  [/fruit|vegetable|sabzi/i, "🥦"],
  [/dairy|egg|milk/i, "🥛"],
  [/atta|rice|dal|grain/i, "🌾"],
  [/snack|biscuit|namkeen/i, "🍪"],
  [/beverage|drink|juice/i, "🥤"],
  [/instant|noodle|ready/i, "🍜"],
  [/bakery|bread/i, "🍞"],
  [/masala|spice|oil/i, "🧂"],
  [/sweet|chocolate/i, "🍫"],
  [/personal|beauty|care/i, "🧴"],
  [/household|cleaning|home/i, "🧽"],
  [/stationery|school|office/i, "✏️"],
  [/baby/i, "🍼"],
  [/pet/i, "🐾"],
];

const match = (table: [RegExp, string][], name: string, fallback: string) =>
  table.find(([pattern]) => pattern.test(name))?.[1] ?? fallback;

export const productEmoji = (name: string) => match(PRODUCT_EMOJI, name, "🛒");

export const categoryEmoji = (name: string) =>
  match(CATEGORY_EMOJI, name, "🛍️");
