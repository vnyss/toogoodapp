import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Line, Circle, Polyline, Rect } from 'react-native-svg';
import { F } from '../theme';
import { useTheme } from '../ThemeContext';
import { getUser, getToken } from '../auth';
import { searchFood, generalAiChat, getMe } from '../api';
import { DonutChart } from '../components/Charts';

// ─── Curated ingredient tiles by category ────────────────────────────────────

const QUICK_INGREDIENTS = [
  {
    cat: 'Grains & Staples',
    items: ['Rice', 'Atta (wheat flour)', 'Maida', 'Suji / Rava', 'Bread', 'Oats', 'Poha', 'Vermicelli', 'Noodles', 'Pasta', 'Bread crumbs'],
  },
  {
    cat: 'Dal & Legumes',
    items: ['Toor Dal', 'Moong Dal', 'Chana Dal', 'Masoor Dal', 'Urad Dal', 'Rajma', 'Chickpeas', 'Soya chunks', 'Black-eyed peas'],
  },
  {
    cat: 'Vegetables',
    items: ['Onion', 'Tomato', 'Potato', 'Garlic', 'Ginger', 'Spinach', 'Cauliflower', 'Carrot', 'Peas', 'Capsicum', 'Brinjal', 'Cabbage', 'Bottle gourd', 'Bitter gourd', 'Okra (bhindi)', 'Corn', 'Mushroom', 'Broccoli', 'Beetroot', 'Cucumber', 'Green beans'],
  },
  {
    cat: 'Proteins',
    items: ['Chicken (boneless)', 'Chicken (bone-in)', 'Eggs', 'Paneer', 'Tofu', 'Fish (any)', 'Prawns', 'Mutton', 'Tuna (canned)', 'Lamb'],
  },
  {
    cat: 'Dairy',
    items: ['Milk', 'Curd / Yogurt', 'Ghee', 'Butter', 'Cream', 'Cheese', 'Condensed milk'],
  },
  {
    cat: 'Spices (Indian)',
    items: ['Salt', 'Turmeric', 'Red chili powder', 'Cumin (jeera)', 'Coriander powder', 'Garam masala', 'Mustard seeds', 'Hing (asafoetida)', 'Cardamom', 'Cinnamon', 'Cloves', 'Bay leaves', 'Black pepper', 'Kashmiri chili', 'Chaat masala', 'Amchur', 'Kasuri methi', 'Sambar masala', 'Biryani masala', 'Pav bhaji masala', 'Chole masala', 'Meat masala', 'Kitchen king masala', 'Pepper powder', 'Star anise', 'Mace (javitri)', 'Nutmeg', 'Fennel seeds (saunf)', 'Ajwain (carom seeds)', 'Kalonji (nigella)'],
  },
  {
    cat: 'Sauces (Indian)',
    items: ['Tomato ketchup', 'Green chutney', 'Tamarind chutney', 'Mint chutney', 'Schezwan chutney', 'Garlic chutney', 'Red chili sauce', 'Imli paste', 'Coconut chutney', 'Peanut chutney', 'Tomato sauce (homemade)', 'Mango pickle (aam ka achar)', 'Lemon pickle', 'Mixed pickle'],
  },
  {
    cat: 'Sauces (Asian / Chinese)',
    items: ['Soy sauce', 'Dark soy sauce', 'Oyster sauce', 'Hoisin sauce', 'Fish sauce', 'Sesame oil', 'Chili garlic sauce', 'Schezwan sauce', 'Sriracha', 'Sweet chili sauce', 'Black bean sauce', 'Teriyaki sauce', 'Mirin', 'Rice vinegar', 'Ponzu sauce', 'Gochujang', 'Miso paste', 'Chili oil', 'XO sauce', 'Plum sauce'],
  },
  {
    cat: 'Sauces (Western)',
    items: ['Tomato pasta sauce', 'Pesto', 'Alfredo sauce', 'Béchamel (white sauce)', 'Marinara sauce', 'BBQ sauce', 'Worcestershire sauce', 'Tabasco / hot sauce', 'HP sauce', 'Buffalo sauce', 'Hollandaise sauce', 'Chimichurri', 'Salsa', 'Enchilada sauce', 'Ranch dressing', 'Caesar dressing', 'Thousand island', 'Blue cheese dressing', 'Honey mustard', 'Tartare sauce'],
  },
  {
    cat: 'Spreads & Pastes',
    items: ['Tomato puree', 'Tomato paste', 'Ginger paste', 'Garlic paste', 'Ginger-garlic paste', 'Onion paste', 'Cashew paste', 'Peanut butter', 'Almond butter', 'Tahini', 'Hummus', 'Mayonnaise', 'Mustard (yellow)', 'Dijon mustard', 'Butter (unsalted)', 'Ghee', 'Cream cheese', 'Labneh', 'Nutella', 'Jam / Marmalade'],
  },
  {
    cat: 'Oils & Fats',
    items: ['Sunflower oil', 'Groundnut oil', 'Mustard oil', 'Coconut oil', 'Olive oil', 'Rice bran oil', 'Sesame oil', 'Ghee', 'Butter', 'Vegetable oil', 'Canola oil', 'Avocado oil', 'Refined oil'],
  },
  {
    cat: 'Wet / Liquids & Stocks',
    items: ['Water', 'Coconut milk', 'Tamarind water', 'Lemon juice', 'Lime juice', 'White vinegar', 'Apple cider vinegar', 'Red wine vinegar', 'Chicken stock', 'Vegetable stock', 'Beef stock', 'Coconut water', 'Milk', 'Cream', 'Buttermilk (chaas)', 'Rose water', 'Kewra water', 'Wine (white)', 'Wine (red)', 'Beer'],
  },
  {
    cat: 'Cheese & Dairy Extras',
    items: ['Mozzarella', 'Cheddar', 'Parmesan', 'Feta', 'Ricotta', 'Gouda', 'Processed cheese', 'Amul cheese slice', 'Paneer', 'Cream cheese', 'Sour cream', 'Whipping cream', 'Condensed milk', 'Evaporated milk', 'Khoya / Mawa'],
  },
  {
    cat: 'Herbs & Fresh',
    items: ['Coriander leaves', 'Mint leaves', 'Curry leaves', 'Green chillies', 'Spring onion', 'Basil', 'Parsley', 'Thyme', 'Rosemary', 'Oregano (fresh)', 'Dill', 'Chives', 'Lemongrass', 'Kaffir lime leaves', 'Pandan leaves', 'Bay leaves (fresh)', 'Tarragon', 'Sage', 'Celery', 'Leek'],
  },
  {
    cat: 'Baking & Sweets',
    items: ['Sugar', 'Brown sugar', 'Powdered sugar', 'Jaggery', 'Honey', 'Maple syrup', 'Baking soda', 'Baking powder', 'Yeast', 'Cocoa powder', 'Dark chocolate', 'White chocolate', 'Vanilla essence', 'Vanilla extract', 'Cornflour', 'Arrowroot', 'Gelatin', 'Agar agar', 'Cashews', 'Raisins', 'Almonds', 'Pistachios', 'Walnuts', 'Desiccated coconut'],
  },
  {
    cat: 'Noodles, Pasta & Bread',
    items: ['Hakka noodles', 'Rice noodles', 'Udon noodles', 'Ramen noodles', 'Spaghetti', 'Penne', 'Fettuccine', 'Fusilli', 'Macaroni', 'Lasagne sheets', 'Bread (white)', 'Bread (brown)', 'Pita bread', 'Tortilla wraps', 'Burger buns', 'Pizza base', 'Breadcrumbs', 'Panko breadcrumbs'],
  },
  {
    cat: 'Canned & Preserved',
    items: ['Canned tomatoes', 'Canned chickpeas', 'Canned kidney beans', 'Canned corn', 'Canned tuna', 'Canned sardines', 'Canned coconut milk', 'Canned mushrooms', 'Olives', 'Sun-dried tomatoes', 'Capers', 'Artichoke hearts', 'Roasted peppers', 'Anchovies'],
  },
  {
    cat: 'Fruits',
    items: ['Banana', 'Apple', 'Mango', 'Pineapple', 'Lemon', 'Lime', 'Orange', 'Coconut', 'Pomegranate', 'Dates', 'Grapes', 'Strawberry', 'Blueberry', 'Papaya', 'Watermelon', 'Kiwi', 'Avocado', 'Tamarind', 'Amla (gooseberry)', 'Guava'],
  },
];

const MOODS = [
  { key: 'spicy',      label: 'Spicy',        desc: 'Bold, fiery, lots of heat' },
  { key: 'sweet',      label: 'Sweet',         desc: 'Desserts or sweet-ish dishes' },
  { key: 'tangy',      label: 'Tangy / Sour',  desc: 'Tamarind, lemon, chaat vibes' },
  { key: 'light',      label: 'Light',          desc: 'Low-cal, easy to digest' },
  { key: 'hearty',     label: 'Hearty',         desc: 'Filling, comforting, wholesome' },
  { key: 'highprotein',label: 'High Protein',   desc: 'Muscle-friendly macros' },
  { key: 'quick',      label: 'Quick <20 min',  desc: 'Minimal prep and cooking' },
  { key: 'comfort',    label: 'Comfort Food',   desc: 'Classic home-style favourites' },
];

const CUISINES = [
  { key: 'Indian',           label: 'Indian' },
  { key: 'North Indian',     label: 'North Indian' },
  { key: 'South Indian',     label: 'South Indian' },
  { key: 'Chinese',          label: 'Indo-Chinese' },
  { key: 'Mediterranean',    label: 'Mediterranean' },
  { key: 'Mexican',          label: 'Mexican' },
  { key: 'Italian',          label: 'Italian' },
  { key: 'Continental',      label: 'Continental' },
];

const DIET_PREFS = [
  { key: 'any',       label: 'No Restriction' },
  { key: 'veg',       label: 'Vegetarian' },
  { key: 'vegan',     label: 'Vegan' },
  { key: 'eggetarian',label: 'Eggetarian' },
  { key: 'jain',      label: 'Jain' },
  { key: 'gluten_free',label: 'Gluten-free' },
  { key: 'dairy_free', label: 'Dairy-free' },
];

const MACRO_COLORS = { protein: '#5B9DD9', carbs: '#C9A84C', fat: '#E08A4D' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRecipeSections(text) {
  // Returns { title, meta, ingredients, steps, nutrition, tip, raw }
  const lines = text.split('\n');
  let title = '', meta = '', ingredients = [], steps = [], nutrition = [], tip = '', section = '';

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (/^##\s/.test(l)) { title = l.replace(/^##\s*/, '').replace(/\*+/g, '').trim(); continue; }
    if (/^###\s*ingredient/i.test(l)) { section = 'ing'; continue; }
    if (/^###\s*method|^###\s*step|^###\s*instruction|^###\s*direction/i.test(l)) { section = 'steps'; continue; }
    if (/^###\s*nutrition/i.test(l)) { section = 'nutrition'; continue; }
    if (/^###\s*chef|^###\s*tip|^###\s*note/i.test(l)) { section = 'tip'; continue; }
    if (/^###\s/.test(l)) { section = 'other'; continue; }
    if (/^\*[^*]/.test(l) && !section) { meta = l.replace(/\*/g, '').trim(); continue; }

    if (section === 'ing') {
      const clean = l.replace(/^[-•*]\s*/, '');
      if (clean) ingredients.push(clean);
    } else if (section === 'steps') {
      const clean = l.replace(/^\d+\.\s*/, '');
      if (clean) steps.push(clean);
    } else if (section === 'nutrition') {
      const clean = l.replace(/^[-•*]\s*/, '');
      if (clean) nutrition.push(clean);
    } else if (section === 'tip') {
      tip += (tip ? ' ' : '') + l.replace(/^[-•*]\s*/, '');
    }
  }

  if (!title) title = 'Generated Recipe';
  return { title, meta, ingredients, steps, nutrition, tip, raw: text };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({ label, selected, onPress, mc, accentColor, small }) {
  return (
    <TouchableOpacity onPress={onPress} style={{
      paddingVertical: small ? 5 : 8,
      paddingHorizontal: small ? 8 : 12,
      borderWidth: 1,
      borderColor: selected ? accentColor : mc.border,
      backgroundColor: selected ? accentColor + '18' : 'transparent',
      marginRight: 6, marginBottom: 6,
    }}>
      <Text style={{ fontFamily: F.mono, fontSize: small ? 10 : 12, color: selected ? accentColor : mc.text2 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function IngredientTag({ label, onRemove, mc, accentColor }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: accentColor + '14', borderWidth: 1, borderColor: accentColor + '40', paddingVertical: 4, paddingHorizontal: 8, marginRight: 6, marginBottom: 6 }}>
      <Text style={{ fontFamily: F.mono, fontSize: 11, color: accentColor, marginRight: 8 }}>{label}</Text>
      <TouchableOpacity onPress={onRemove}>
        <Svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke={mc.text3} strokeWidth={2.5} strokeLinecap="round">
          <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}

function RecipeResult({ recipe, onSave, onBack, mc, accentColor, st }) {
  const { title, meta, ingredients, steps, nutrition, tip } = recipe;

  const nutritionValues = {};
  for (const line of nutrition) {
    const m = line.match(/(calorie|kcal)[^\d]*(\d+)/i); if (m) nutritionValues.calories = parseInt(m[2]);
    const p = line.match(/protein[^\d]*(\d+)/i);         if (p) nutritionValues.protein = parseInt(p[1]);
    const c = line.match(/carb[^\d]*(\d+)/i);            if (c) nutritionValues.carbs = parseInt(c[1]);
    const f = line.match(/fat[^\d]*(\d+)/i);             if (f) nutritionValues.fat = parseInt(f[1]);
  }
  const hasMacros = nutritionValues.protein && nutritionValues.carbs && nutritionValues.fat;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: mc.bg }}>
      <View style={st.content}>
        <TouchableOpacity style={st.backBtn} onPress={onBack}>
          <Text style={st.backTxt}>← Try again</Text>
        </TouchableOpacity>

        {/* Title */}
        <Text style={[st.title, { marginBottom: 4 }]}>{title}</Text>
        {meta ? <Text style={st.sub}>{meta}</Text> : null}

        {/* Macro card */}
        {hasMacros && (
          <View style={[st.card, { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }]}>
            <DonutChart
              segments={[
                { value: nutritionValues.protein || 0, color: MACRO_COLORS.protein, label: 'Protein' },
                { value: nutritionValues.carbs   || 0, color: MACRO_COLORS.carbs,   label: 'Carbs' },
                { value: nutritionValues.fat     || 0, color: MACRO_COLORS.fat,     label: 'Fat' },
              ]}
              mc={mc} size={90} strokeWidth={14}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.display, fontSize: 26, color: accentColor }}>{nutritionValues.calories || '~'}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3, letterSpacing: 2 }}>KCAL PER SERVING</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                {[['P', nutritionValues.protein, MACRO_COLORS.protein], ['C', nutritionValues.carbs, MACRO_COLORS.carbs], ['F', nutritionValues.fat, MACRO_COLORS.fat]].map(([l, v, col]) => (
                  <View key={l}>
                    <Text style={{ fontFamily: F.mono, fontSize: 13, color: col, fontWeight: '700' }}>{v}g</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 8, color: mc.text3 }}>{l}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <View style={[st.card, { marginBottom: 14 }]}>
            <Text style={[st.label, { marginBottom: 10 }]}>INGREDIENTS</Text>
            {ingredients.map((ing, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, paddingVertical: 5, borderBottomWidth: i < ingredients.length - 1 ? 1 : 0, borderBottomColor: mc.border }}>
                <Text style={{ color: accentColor, fontFamily: F.mono, fontSize: 12 }}>•</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, flex: 1 }}>{ing}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Steps */}
        {steps.length > 0 && (
          <View style={[st.card, { marginBottom: 14 }]}>
            <Text style={[st.label, { marginBottom: 10 }]}>METHOD</Text>
            {steps.map((step, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: i < steps.length - 1 ? 1 : 0, borderBottomColor: mc.border }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: accentColor + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor, fontWeight: '700' }}>{i + 1}</Text>
                </View>
                <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text, flex: 1, lineHeight: 20 }}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Chef tip */}
        {tip ? (
          <View style={{ borderWidth: 1, borderColor: accentColor + '40', backgroundColor: accentColor + '08', padding: 14, marginBottom: 14 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor, letterSpacing: 2, marginBottom: 6 }}>CHEF'S TIP</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2, lineHeight: 20 }}>{tip}</Text>
          </View>
        ) : null}

        {/* Save */}
        <TouchableOpacity style={st.saveBtn} onPress={onSave}>
          <Text style={st.saveTxt}>SAVE TO MY RECIPES</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RecipeScreen({ navigation }) {
  const { mc, accentColor } = useTheme();

  // Core state
  const [storageKey, setStorageKey] = useState(null);
  const [username,   setUsername]   = useState('');
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [view, setView] = useState('home'); // 'home' | 'ai' | 'manual' | 'detail' | 'result'
  const [detail, setDetail] = useState(null);

  // AI generation state
  const [aiStep,       setAiStep]       = useState(1); // 1=ingredients, 2=preferences, 3=extra
  const [ingredients,  setIngredients]  = useState([]);
  const [ingSearch,    setIngSearch]    = useState('');
  const [ingResults,   setIngResults]   = useState([]);
  const [ingSearching, setIngSearching] = useState(false);
  const [openCat,      setOpenCat]      = useState(null);
  const [mood,         setMood]         = useState(null);
  const [cuisine,      setCuisine]      = useState('Indian');
  const [dietPref,     setDietPref]     = useState('any');
  const [extraNotes,   setExtraNotes]   = useState('');
  const [generating,   setGenerating]   = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState(null);
  const [genError,     setGenError]     = useState('');

  // Manual builder state
  const [mName,       setMName]       = useState('');
  const [mServings,   setMServings]   = useState('1');
  const [mIngs,       setMIngs]       = useState([]);
  const [mSearch,     setMSearch]     = useState('');
  const [mResults,    setMResults]    = useState([]);
  const [mSearching,  setMSearching]  = useState(false);

  const ingTimerRef = useRef(null);
  const mTimerRef   = useRef(null);

  useEffect(() => {
    getUser().then(async u => {
      if (!u) return;
      setUsername(u);
      const key = `tg_recipes_${u}`;
      setStorageKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw) setSavedRecipes(JSON.parse(raw));
      // Detect cuisine from locale
      const lang = navigator?.language || '';
      if (/hi|ta|te|ml|kn|gu|mr|pa|bn|or|ur/.test(lang)) setCuisine('Indian');
    });
  }, []);

  async function persist(list) {
    if (!storageKey) return;
    await AsyncStorage.setItem(storageKey, JSON.stringify(list));
  }

  // ── Ingredient search (Open Food Facts, 100k+ products) ───────────────────

  function searchIngredient(q) {
    setIngSearch(q);
    clearTimeout(ingTimerRef.current);
    if (!q.trim()) { setIngResults([]); return; }
    // First: filter curated list client-side (instant)
    const lower = q.toLowerCase();
    const curated = QUICK_INGREDIENTS.flatMap(c => c.items)
      .filter(item => item.toLowerCase().includes(lower))
      .slice(0, 5)
      .map(name => ({ name, curated: true }));
    setIngResults(curated);
    // Then: hit Open Food Facts for more (100k+ items)
    ingTimerRef.current = setTimeout(async () => {
      setIngSearching(true);
      try {
        const api = await searchFood(q);
        const names = new Set(curated.map(c => c.name.toLowerCase()));
        const extra = api.filter(r => !names.has(r.name.toLowerCase())).slice(0, 8);
        setIngResults([...curated, ...extra]);
      } catch {}
      setIngSearching(false);
    }, 450);
  }

  function addIngredient(nameOrObj) {
    const name = typeof nameOrObj === 'string' ? nameOrObj : nameOrObj.name;
    if (!name?.trim() || ingredients.includes(name)) return;
    setIngredients(prev => [...prev, name]);
    setIngSearch('');
    setIngResults([]);
  }

  function addIngredientFromSearch() {
    const q = ingSearch.trim();
    if (q) addIngredient(q); // allow free-typing any ingredient (supports Hindi)
  }

  function removeIngredient(name) {
    setIngredients(prev => prev.filter(i => i !== name));
  }

  // ── AI recipe generation ──────────────────────────────────────────────────

  async function generateRecipe() {
    if (!ingredients.length) return;
    setGenerating(true);
    setGenError('');

    const moodLabel = MOODS.find(m => m.key === mood)?.label || 'Any';
    const dietLabel = DIET_PREFS.find(d => d.key === dietPref)?.label || 'No restriction';

    const prompt = `You are a professional chef and nutritionist. Generate a single, complete, delicious recipe.

Available ingredients: ${ingredients.join(', ')}
Mood / taste: ${moodLabel}
Cuisine style: ${cuisine}
Dietary requirement: ${dietLabel}
${extraNotes ? `Additional request: ${extraNotes}` : ''}

IMPORTANT: You MUST use primarily the listed ingredients. You can add basic pantry items (oil, salt, water, common spices) if absolutely needed but the recipe must be built around what's available.

Format your response EXACTLY like this (use these exact markdown headers):

## [Creative Recipe Name]
*Serves [X] · Prep [X] min · Cook [X] min*

### Ingredients
- [precise quantity] [ingredient]
(list every ingredient with exact quantities)

### Method
1. [clear step]
2. [clear step]
(write detailed, numbered steps — at least 6 steps)

### Nutrition (per serving, estimated)
- Calories: ~[X] kcal
- Protein: ~[X]g
- Carbs: ~[X]g
- Fat: ~[X]g

### Chef's Tip
[One genuinely useful tip for this specific recipe]

Write in English. Be specific, practical, and delicious. Do not refuse — always generate a real recipe.`;

    try {
      const d = await generalAiChat([{ role: 'user', content: prompt }]);
      if (d?.reply) {
        const parsed = parseRecipeSections(d.reply);
        setGeneratedRecipe(parsed);
        setView('result');
      } else {
        setGenError('Could not reach the AI. Please try again.');
      }
    } catch {
      setGenError('Something went wrong. Check your connection and try again.');
    }
    setGenerating(false);
  }

  function saveGeneratedRecipe() {
    if (!generatedRecipe) return;
    const r = {
      id: Date.now(),
      name: generatedRecipe.title,
      servings: 1,
      ingredients: generatedRecipe.ingredients.map(i => ({ name: i, qty: 100, calories: 0, protein: 0, carbs: 0, fat: 0 })),
      calories: 0, protein: 0, carbs: 0, fat: 0,
      calPerSv: 0, protPerSv: 0, carbsPerSv: 0, fatPerSv: 0,
      steps: generatedRecipe.steps,
      tip: generatedRecipe.tip,
      meta: generatedRecipe.meta,
      isAI: true,
      raw: generatedRecipe.raw,
    };
    const updated = [r, ...savedRecipes];
    setSavedRecipes(updated);
    persist(updated);
    setView('home');
    setGeneratedRecipe(null);
    resetAI();
  }

  function resetAI() {
    setAiStep(1);
    setIngredients([]);
    setIngSearch('');
    setIngResults([]);
    setMood(null);
    setExtraNotes('');
    setGenError('');
  }

  // ── Manual builder ────────────────────────────────────────────────────────

  function onMSearch(q) {
    setMSearch(q);
    clearTimeout(mTimerRef.current);
    if (!q.trim()) { setMResults([]); return; }
    mTimerRef.current = setTimeout(async () => {
      setMSearching(true);
      try { setMResults(await searchFood(q)); } catch {}
      setMSearching(false);
    }, 400);
  }

  function addManualIng(item) {
    setMIngs(prev => [...prev, { ...item, qty: 100 }]);
    setMSearch(''); setMResults([]);
  }

  function updateMQty(i, qty) {
    setMIngs(prev => prev.map((ing, j) => j !== i ? ing : { ...ing, qty: parseFloat(qty) || 0 }));
  }

  function mTotalPer(field) {
    return Math.round(mIngs.reduce((s, ing) => s + (ing[field] || 0) * (ing.qty / 100), 0));
  }

  function mPerSv(field) {
    return Math.round(mTotalPer(field) / (parseInt(mServings) || 1));
  }

  function saveManualRecipe() {
    if (!mName.trim() || !mIngs.length) return;
    const r = {
      id: Date.now(), name: mName.trim(), servings: parseInt(mServings) || 1,
      ingredients: mIngs, isAI: false,
      calories: mTotalPer('calories'), protein: mTotalPer('protein'),
      carbs: mTotalPer('carbs'), fat: mTotalPer('fat'),
      calPerSv: mPerSv('calories'), protPerSv: mPerSv('protein'),
      carbsPerSv: mPerSv('carbs'), fatPerSv: mPerSv('fat'),
    };
    const updated = [r, ...savedRecipes];
    setSavedRecipes(updated);
    persist(updated);
    setView('home');
    setMName(''); setMServings('1'); setMIngs([]); setMSearch(''); setMResults([]);
  }

  function deleteRecipe(id) {
    const updated = savedRecipes.filter(r => r.id !== id);
    setSavedRecipes(updated);
    persist(updated);
    setDetail(null);
    setView('home');
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const st = StyleSheet.create({
    root:    { flex: 1, backgroundColor: mc.bg },
    content: { padding: 20, maxWidth: 680, alignSelf: 'center', width: '100%', paddingBottom: 60 },
    title:   { fontFamily: F.serif, fontSize: 26, color: mc.text, marginBottom: 4 },
    sub:     { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 2, marginBottom: 20 },
    label:   { fontFamily: F.mono, fontSize: 10, color: mc.text3, letterSpacing: 1, marginBottom: 6 },
    input:   { borderWidth: 1, borderColor: mc.border, padding: 11, fontFamily: F.mono, fontSize: 13, color: mc.text, marginBottom: 10, outlineWidth: 0 },
    card:    { borderWidth: 1, borderColor: mc.border, padding: 14, marginBottom: 12 },
    backBtn: { paddingVertical: 10, marginBottom: 16 },
    backTxt: { fontFamily: F.mono, fontSize: 12, color: accentColor },
    saveBtn: { backgroundColor: accentColor, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
    saveTxt: { fontFamily: F.mono, fontSize: 12, color: '#0A0A0A', fontWeight: '700', letterSpacing: 1.5 },
    stepBar: { flexDirection: 'row', gap: 4, marginBottom: 24 },
    stepDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: mc.border },
    moodGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  });

  // ══════════════════════════════════════════════════════════
  // RESULT VIEW
  // ══════════════════════════════════════════════════════════

  if (view === 'result' && generatedRecipe) {
    return (
      <RecipeResult
        recipe={generatedRecipe}
        onSave={saveGeneratedRecipe}
        onBack={() => { setView('ai'); setAiStep(2); }}
        mc={mc} accentColor={accentColor} st={st}
      />
    );
  }

  // ══════════════════════════════════════════════════════════
  // DETAIL VIEW (saved recipe)
  // ══════════════════════════════════════════════════════════

  if (view === 'detail' && detail) {
    return (
      <ScrollView style={st.root}>
        <View style={st.content}>
          <TouchableOpacity style={st.backBtn} onPress={() => { setDetail(null); setView('home'); }}>
            <Text style={st.backTxt}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
            <Text style={[st.title, { flex: 1 }]}>{detail.name}</Text>
            {detail.isAI && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: accentColor + '18', borderWidth: 1, borderColor: accentColor + '40', marginTop: 6 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 9, color: accentColor, letterSpacing: 2 }}>AI GENERATED</Text>
              </View>
            )}
          </View>
          {detail.meta && <Text style={st.sub}>{detail.meta}</Text>}

          {/* Macros */}
          {(detail.calPerSv || detail.protPerSv) ? (
            <View style={[st.card, { flexDirection: 'row', gap: 0, marginBottom: 16 }]}>
              {[['calories','KCAL/SV', detail.calPerSv || detail.calories], ['protein','PROT/SV', detail.protPerSv], ['carbs','CARBS/SV', detail.carbsPerSv], ['fat','FAT/SV', detail.fatPerSv]].map(([f,l,v]) => (
                <View key={f} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRightWidth: 1, borderRightColor: mc.border }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 18, color: accentColor, fontWeight: '700' }}>{v || '—'}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 8, color: mc.text3, letterSpacing: 1, marginTop: 2 }}>{l}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* AI recipe: show steps */}
          {detail.isAI && detail.steps?.length > 0 && (
            <View style={[st.card, { marginBottom: 14 }]}>
              <Text style={[st.label, { marginBottom: 10 }]}>INGREDIENTS</Text>
              {(detail.ingredients || []).map((ing, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, paddingVertical: 5, borderBottomWidth: i < detail.ingredients.length - 1 ? 1 : 0, borderBottomColor: mc.border }}>
                  <Text style={{ color: accentColor, fontFamily: F.mono, fontSize: 12 }}>•</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, flex: 1 }}>{typeof ing === 'string' ? ing : ing.name}</Text>
                </View>
              ))}
            </View>
          )}

          {detail.isAI && detail.steps?.length > 0 && (
            <View style={[st.card, { marginBottom: 14 }]}>
              <Text style={[st.label, { marginBottom: 10 }]}>METHOD</Text>
              {detail.steps.map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: i < detail.steps.length - 1 ? 1 : 0, borderBottomColor: mc.border }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: accentColor + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor, fontWeight: '700' }}>{i + 1}</Text>
                  </View>
                  <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text, flex: 1, lineHeight: 20 }}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Manual recipe: ingredients with qty */}
          {!detail.isAI && (
            <View style={[st.card, { marginBottom: 14 }]}>
              <Text style={[st.label, { marginBottom: 10 }]}>INGREDIENTS</Text>
              {(detail.ingredients || []).map((ing, i) => (
                <View key={i} style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: i < detail.ingredients.length - 1 ? 1 : 0, borderBottomColor: mc.border }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, flex: 1 }}>{ing.name}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>{ing.qty}g · {Math.round((ing.calories || 0) * ing.qty / 100)} kcal</Text>
                </View>
              ))}
            </View>
          )}

          {detail.tip && (
            <View style={{ borderWidth: 1, borderColor: accentColor + '40', backgroundColor: accentColor + '08', padding: 14, marginBottom: 14 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: accentColor, letterSpacing: 2, marginBottom: 6 }}>CHEF'S TIP</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2, lineHeight: 20 }}>{detail.tip}</Text>
            </View>
          )}

          <TouchableOpacity style={[st.saveBtn, { backgroundColor: '#E57373' }]} onPress={() => deleteRecipe(detail.id)}>
            <Text style={[st.saveTxt, { color: '#fff' }]}>DELETE RECIPE</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ══════════════════════════════════════════════════════════
  // AI GENERATION WIZARD
  // ══════════════════════════════════════════════════════════

  if (view === 'ai') {
    return (
      <ScrollView style={st.root} keyboardShouldPersistTaps="handled">
        <View style={st.content}>
          <TouchableOpacity style={st.backBtn} onPress={() => { setView('home'); resetAI(); }}>
            <Text style={st.backTxt}>← Back</Text>
          </TouchableOpacity>
          <Text style={st.title}>AI Recipe Generator</Text>

          {/* Step progress */}
          <View style={st.stepBar}>
            {[1, 2, 3].map(n => (
              <View key={n} style={[st.stepDot, aiStep >= n && { backgroundColor: accentColor }]} />
            ))}
          </View>

          {/* ── STEP 1: Ingredients ── */}
          {aiStep === 1 && (
            <View>
              <Text style={{ fontFamily: F.display, fontSize: 18, color: mc.text, marginBottom: 4 }}>
                What ingredients do you have?
              </Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 16, lineHeight: 18 }}>
                Search, tap quick tiles, or just type anything — Hindi works too (e.g. "anda, doodh, pyaaz")
              </Text>

              {/* Search box */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[st.input, { flex: 1, marginBottom: 0 }]}
                  value={ingSearch}
                  onChangeText={searchIngredient}
                  placeholder="Search or type any ingredient…"
                  placeholderTextColor={mc.text3}
                  onSubmitEditing={addIngredientFromSearch}
                />
                <TouchableOpacity
                  style={{ backgroundColor: accentColor, paddingHorizontal: 14, justifyContent: 'center' }}
                  onPress={addIngredientFromSearch}
                >
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#000', fontWeight: '700' }}>Add</Text>
                </TouchableOpacity>
              </View>

              {/* Search results dropdown */}
              {(ingResults.length > 0 || ingSearching) && (
                <View style={{ borderWidth: 1, borderColor: mc.border, marginBottom: 10, maxHeight: 200 }}>
                  {ingSearching && <ActivityIndicator color={accentColor} style={{ padding: 8 }} />}
                  {ingResults.map((item, i) => (
                    <TouchableOpacity key={i} onPress={() => addIngredient(item)}
                      style={{ paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: i < ingResults.length - 1 ? 1 : 0, borderBottomColor: mc.border, flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, flex: 1 }}>{item.name || item}</Text>
                      {item.curated
                        ? <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>common</Text>
                        : item.calories > 0
                        ? <Text style={{ fontFamily: F.mono, fontSize: 9, color: mc.text3 }}>{item.calories} kcal/100g</Text>
                        : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Selected ingredients */}
              {ingredients.length > 0 && (
                <View>
                  <Text style={[st.label, { marginBottom: 8 }]}>ADDED ({ingredients.length})</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
                    {ingredients.map(name => (
                      <IngredientTag key={name} label={name} onRemove={() => removeIngredient(name)} mc={mc} accentColor={accentColor} />
                    ))}
                  </View>
                </View>
              )}

              {/* Quick tiles by category */}
              <Text style={[st.label, { marginBottom: 10 }]}>QUICK ADD BY CATEGORY</Text>
              {QUICK_INGREDIENTS.map(cat => (
                <View key={cat.cat} style={{ marginBottom: 8 }}>
                  <TouchableOpacity
                    onPress={() => setOpenCat(openCat === cat.cat ? null : cat.cat)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: mc.border, backgroundColor: openCat === cat.cat ? accentColor + '10' : 'transparent' }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, flex: 1 }}>{cat.cat}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{openCat === cat.cat ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {openCat === cat.cat && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 10, borderWidth: 1, borderTopWidth: 0, borderColor: mc.border, gap: 6 }}>
                      {cat.items.map(item => {
                        const selected = ingredients.includes(item);
                        return (
                          <TouchableOpacity key={item} onPress={() => selected ? removeIngredient(item) : addIngredient(item)}
                            style={{ paddingVertical: 5, paddingHorizontal: 9, borderWidth: 1, borderColor: selected ? accentColor : mc.border, backgroundColor: selected ? accentColor + '18' : 'transparent' }}>
                            <Text style={{ fontFamily: F.mono, fontSize: 11, color: selected ? accentColor : mc.text2 }}>{item}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={[st.saveBtn, { marginTop: 20, opacity: ingredients.length === 0 ? 0.4 : 1 }]}
                onPress={() => ingredients.length > 0 && setAiStep(2)}
                disabled={ingredients.length === 0}
              >
                <Text style={st.saveTxt}>NEXT — Choose your mood →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 2: Mood + Cuisine + Diet ── */}
          {aiStep === 2 && (
            <View>
              <Text style={{ fontFamily: F.display, fontSize: 18, color: mc.text, marginBottom: 4 }}>
                What are you in the mood for?
              </Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 16 }}>
                Using: {ingredients.slice(0, 4).join(', ')}{ingredients.length > 4 ? ` + ${ingredients.length - 4} more` : ''}
              </Text>

              <Text style={st.label}>MOOD / TASTE</Text>
              <View style={st.moodGrid}>
                {MOODS.map(m => (
                  <TouchableOpacity key={m.key} onPress={() => setMood(m.key === mood ? null : m.key)}
                    style={{ paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1.5, borderColor: mood === m.key ? accentColor : mc.border, backgroundColor: mood === m.key ? accentColor + '14' : 'transparent', minWidth: 140, flex: 1 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 13, color: mood === m.key ? accentColor : mc.text, marginBottom: 3 }}>{m.label}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{m.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[st.label, { marginTop: 8 }]}>CUISINE STYLE</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
                {CUISINES.map(c => (
                  <Chip key={c.key} label={c.label} selected={cuisine === c.key} onPress={() => setCuisine(c.key)} mc={mc} accentColor={accentColor} />
                ))}
              </View>

              <Text style={st.label}>DIETARY PREFERENCE</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
                {DIET_PREFS.map(d => (
                  <Chip key={d.key} label={d.label} selected={dietPref === d.key} onPress={() => setDietPref(d.key)} mc={mc} accentColor={accentColor} />
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity onPress={() => setAiStep(1)} style={{ flex: 1, paddingVertical: 13, borderWidth: 1, borderColor: mc.border, alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2 }}>← Edit ingredients</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.saveBtn, { flex: 1, marginTop: 0 }]}
                  onPress={() => setAiStep(3)}
                >
                  <Text style={st.saveTxt}>NEXT →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── STEP 3: Extra notes + Generate ── */}
          {aiStep === 3 && (
            <View>
              <Text style={{ fontFamily: F.display, fontSize: 18, color: mc.text, marginBottom: 4 }}>
                Anything else to tell the chef?
              </Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, marginBottom: 16, lineHeight: 18 }}>
                Optional — type in English or Hindi. E.g. "jyada spicy mat banana" or "quick breakfast idea" or "for 2 people".
              </Text>

              {/* Summary card */}
              <View style={[st.card, { marginBottom: 16 }]}>
                <Text style={[st.label, { marginBottom: 8 }]}>YOUR ORDER</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, marginBottom: 4 }}>
                  Ingredients: <Text style={{ color: accentColor }}>{ingredients.join(', ')}</Text>
                </Text>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, marginBottom: 4 }}>
                  Mood: <Text style={{ color: accentColor }}>{MOODS.find(m => m.key === mood)?.label || 'Any'}</Text>
                </Text>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text, marginBottom: 4 }}>
                  Cuisine: <Text style={{ color: accentColor }}>{cuisine}</Text>
                </Text>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>
                  Diet: <Text style={{ color: accentColor }}>{DIET_PREFS.find(d => d.key === dietPref)?.label || 'Any'}</Text>
                </Text>
              </View>

              <Text style={st.label}>EXTRA NOTES (optional)</Text>
              <TextInput
                style={[st.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={extraNotes}
                onChangeText={setExtraNotes}
                placeholder={'Any special request or instruction…'}
                placeholderTextColor={mc.text3}
                multiline
              />

              {genError ? (
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#E57373', marginBottom: 10 }}>{genError}</Text>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity onPress={() => setAiStep(2)} style={{ flex: 1, paddingVertical: 13, borderWidth: 1, borderColor: mc.border, alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2 }}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.saveBtn, { flex: 2, marginTop: 0, opacity: generating ? 0.7 : 1 }]}
                  onPress={generateRecipe}
                  disabled={generating}
                >
                  {generating
                    ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <ActivityIndicator color="#000" size="small" />
                        <Text style={st.saveTxt}>Cooking up your recipe…</Text>
                      </View>
                    : <Text style={st.saveTxt}>GENERATE RECIPE</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  // ══════════════════════════════════════════════════════════
  // MANUAL BUILDER
  // ══════════════════════════════════════════════════════════

  if (view === 'manual') {
    return (
      <ScrollView style={st.root} keyboardShouldPersistTaps="handled">
        <View style={st.content}>
          <TouchableOpacity style={st.backBtn} onPress={() => setView('home')}>
            <Text style={st.backTxt}>← Back</Text>
          </TouchableOpacity>
          <Text style={st.title}>Build Recipe Manually</Text>

          <Text style={st.label}>RECIPE NAME</Text>
          <TextInput style={st.input} value={mName} onChangeText={setMName} placeholder="e.g. Dal Tadka, Chicken Salad" placeholderTextColor={mc.text3} />

          <Text style={st.label}>SERVINGS</Text>
          <TextInput style={[st.input, { width: 100 }]} value={mServings} onChangeText={setMServings} keyboardType="number-pad" placeholderTextColor={mc.text3} />

          <Text style={st.label}>SEARCH INGREDIENTS (100k+ database)</Text>
          <TextInput style={st.input} value={mSearch} onChangeText={onMSearch} placeholder="Search Open Food Facts database…" placeholderTextColor={mc.text3} />

          {mSearching && <ActivityIndicator color={accentColor} style={{ marginBottom: 8 }} />}
          {mResults.map((item, i) => (
            <TouchableOpacity key={i} onPress={() => addManualIng(item)}
              style={{ paddingVertical: 9, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: mc.border }}>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }}>{item.name}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{item.calories} kcal · {item.protein}g P · {item.carbs}g C · per 100g</Text>
            </TouchableOpacity>
          ))}

          {mIngs.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={[st.label, { marginBottom: 10 }]}>INGREDIENTS ({mIngs.length})</Text>
              {mIngs.map((ing, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: mc.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text }} numberOfLines={1}>{ing.name}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{Math.round((ing.calories || 0) * ing.qty / 100)} kcal</Text>
                  </View>
                  <TextInput
                    style={{ width: 62, borderWidth: 1, borderColor: mc.border, padding: 6, fontFamily: F.mono, fontSize: 12, color: mc.text, textAlign: 'center', marginRight: 4, outlineWidth: 0 }}
                    value={String(ing.qty)} onChangeText={v => updateMQty(i, v)} keyboardType="decimal-pad"
                  />
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginRight: 10 }}>g</Text>
                  <TouchableOpacity onPress={() => setMIngs(prev => prev.filter((_, j) => j !== i))} style={{ padding: 4 }}>
                    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#C85A6E" strokeWidth={2.2} strokeLinecap="round">
                      <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
                    </Svg>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={{ flexDirection: 'row', gap: 0, marginTop: 14, borderWidth: 1, borderColor: mc.border }}>
                {[['calories', 'KCAL/SV'], ['protein', 'PROT'], ['carbs', 'CARBS'], ['fat', 'FAT']].map(([f, l]) => (
                  <View key={f} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRightWidth: 1, borderRightColor: mc.border }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 18, color: accentColor, fontWeight: '700' }}>{mPerSv(f)}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 8, color: mc.text3, letterSpacing: 1, marginTop: 2 }}>{l}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={[st.saveBtn, { marginTop: 14 }]} onPress={saveManualRecipe}>
                <Text style={st.saveTxt}>SAVE RECIPE</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  // ══════════════════════════════════════════════════════════
  // HOME — recipe list
  // ══════════════════════════════════════════════════════════

  return (
    <ScrollView style={st.root}>
      <View style={st.content}>
        <Text style={st.title}>Recipe Builder</Text>
        <Text style={st.sub}>AI-POWERED · 100K+ INGREDIENT DATABASE</Text>

        {/* Primary CTA */}
        <TouchableOpacity
          style={[st.saveBtn, { marginBottom: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }]}
          onPress={() => { resetAI(); setView('ai'); }}
        >
          <Text style={st.saveTxt}>GENERATE WITH AI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ paddingVertical: 12, borderWidth: 1, borderColor: mc.border, alignItems: 'center', marginBottom: 24 }}
          onPress={() => setView('manual')}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: mc.text2, letterSpacing: 1 }}>Build manually (search & calc macros)</Text>
        </TouchableOpacity>

        {/* AI feature highlights */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            'Mood-aware',
            'Cuisine-smart',
            'Hindi support',
            'Macro-estimated',
            '100k+ ingredients',
          ].map(tag => (
            <View key={tag} style={{ paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: mc.border }}>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3 }}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* Saved recipes */}
        {savedRecipes.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🍳</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 13, color: mc.text2, textAlign: 'center', marginBottom: 6 }}>No saved recipes yet</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3, textAlign: 'center' }}>Hit "Generate with AI" — tell it what's in your fridge{'\n'}and it'll cook up something great.</Text>
          </View>
        ) : (
          <View>
            <Text style={[st.label, { marginBottom: 12 }]}>SAVED RECIPES ({savedRecipes.length})</Text>
            {savedRecipes.map(r => (
              <TouchableOpacity key={r.id} onPress={() => { setDetail(r); setView('detail'); }}
                style={[st.card, { flexDirection: 'row', alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 14, color: mc.text }}>{r.name}</Text>
                    {r.isAI && <View style={{ paddingHorizontal: 5, paddingVertical: 1, backgroundColor: accentColor + '18', borderWidth: 1, borderColor: accentColor + '40' }}>
                      <Text style={{ fontFamily: F.mono, fontSize: 8, color: accentColor, letterSpacing: 1 }}>AI</Text>
                    </View>}
                  </View>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: mc.text3 }}>
                    {r.calPerSv ? `${r.calPerSv} kcal/sv · ` : ''}{r.ingredients?.length || 0} ingredients
                  </Text>
                  {(r.protPerSv || r.carbsPerSv) ? (
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: mc.text3, marginTop: 2 }}>
                      P: {r.protPerSv}g · C: {r.carbsPerSv}g · F: {r.fatPerSv}g
                    </Text>
                  ) : null}
                </View>
                <Text style={{ fontFamily: F.mono, fontSize: 16, color: mc.text3 }}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
