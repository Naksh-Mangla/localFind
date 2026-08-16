/**
 * Hindi & Hinglish colloquial term mapping dictionary
 * Maps common spoken Hindi/Hinglish terms to product keywords and categories
 */
export const HINDI_HINGLISH_MAP = {
  // Groceries & Food
  'cheeni': 'sugar cheeni',
  'chini': 'sugar cheeni',
  'shakkar': 'sugar jaggery shakkar',
  'doodh': 'milk doodh dairy',
  'dudh': 'milk doodh dairy',
  'dahi': 'curd yogurt dahi',
  'paneer': 'paneer cheese dairy',
  'makhan': 'butter makhan dairy',
  'ghee': 'ghee oil dairy',
  'tel': 'oil cooking mustard refined tel',
  'atta': 'flour wheat atta',
  'aata': 'flour wheat atta',
  'maida': 'flour maida',
  'besan': 'gram flour besan',
  'sooji': 'suji semolina sooji',
  'suji': 'suji semolina sooji',
  'chawal': 'rice basmati chawal',
  'dal': 'pulses dal toor moong chana lentils',
  'daal': 'pulses dal toor moong chana lentils',
  'namak': 'salt namak',
  'mirch': 'chilli pepper mirch spices',
  'masala': 'spices masala garam',
  'haldi': 'turmeric haldi spices',
  'dhaniya': 'coriander dhaniya spices',
  'jeera': 'cumin jeera spices',
  'chai': 'tea chai patti',
  'patti': 'tea leaves chai patti',
  'biscuit': 'biscuit cookies snacks',
  'mithai': 'sweets mithai bakery',
  'mitha': 'sweet dessert mithai',
  'fal': 'fruits fal seb kela aam',
  'sabji': 'vegetables sabzi aloo pyaz tamatar',
  'sabzi': 'vegetables sabzi aloo pyaz tamatar',
  'aloo': 'potato aloo vegetables',
  'pyaz': 'onion pyaz vegetables',
  'tamatar': 'tomato tamatar vegetables',
  'nimbu': 'lemon nimbu',
  'paani': 'water bottle mineral beverage',
  'pani': 'water bottle mineral beverage',

  // Electronics & Mobile
  'charger': 'charger adapter cable fast charging',
  'kabl': 'cable wire usb type c lightning',
  'taar': 'cable wire cord',
  'screen guard': 'tempered glass screen protector guard',
  'cover': 'case phone cover mobile cover',
  'earphone': 'earphones headphones earbuds bluetooth buds',
  'headphone': 'headphones headset audio',
  'battri': 'battery powerbank cell',
  'battery': 'battery powerbank cell',
  'mobile': 'phone smartphone mobile',
  'phone': 'mobile phone smartphone',

  // Fashion & Clothing
  'kapde': 'clothes clothing shirt tshirt kurta dress pants fashion',
  'kapda': 'fabric cloth clothing dress fashion',
  'kurta': 'kurta ethnic wear traditional fashion',
  'kurti': 'kurti ladies dress ethnic fashion',
  'suit': 'suit salwar ethnic blazer fashion',
  'saree': 'sari saree ethnic traditional wear',
  'sari': 'saree ethnic silk cotton',
  'chappal': 'slippers sandals footwear chappal',
  'joota': 'shoes sneakers boots footwear',
  'jute': 'shoes footwear sneakers',
  'jurab': 'socks hosiery',
  'rumal': 'handkerchief scarf bandana',
  'chunni': 'dupatta scarf chunni',
  'topi': 'cap hat beanie topi',

  // Household & Stationery
  'jhadu': 'broom cleaning jhadu wiper',
  'pochha': 'mop floor cleaner pochha',
  'sabun': 'soap detergent handwash bath',
  'dawai': 'medicine pharma medical health',
  'kitab': 'books study notebook register',
  'copy': 'notebook register copy diary stationery',
  'kalam': 'pen pencil stationery',
  'toy': 'toys kids games khilona',
  'khilona': 'toys gifts kids games'
}

/**
 * Normalizes voice query and checks for Hindi/Hinglish synonym expansions
 */
export function normalizeVoiceQuery(query = '') {
  if (!query || typeof query !== 'string') return ''

  let clean = query.trim().toLowerCase()

  // Remove common filler spoken phrases in Hindi / Hinglish
  const fillers = [
    /kahan milega/gi,
    /kahan milegi/gi,
    /chahiye/gi,
    /dikhao/gi,
    /dikhaye/gi,
    /ki dukan/gi,
    /ki dukaan/gi,
    /wala/gi,
    /wali/gi,
    /wale/gi,
    /as pas/gi,
    /aas paas/gi,
    /nearby/gi,
    /near me/gi,
    /find me/gi,
    /show me/gi,
    /where to get/gi,
    /i want/gi,
    /please give/gi
  ]

  let processed = clean
  for (const pattern of fillers) {
    processed = processed.replace(pattern, ' ')
  }
  processed = processed.replace(/\s+/g, ' ').trim()

  return processed || clean
}

/**
 * Smart search matcher that supports English, Hindi, and Hinglish keywords
 */
export function matchesQueryWithHinglish(product, query) {
  if (!query || !query.trim()) return true

  const rawQuery = query.trim().toLowerCase()
  const normalizedQuery = normalizeVoiceQuery(rawQuery)

  const words = normalizedQuery.split(' ').filter(Boolean)

  const searchTarget = [
    product.name || '',
    product.category || '',
    product.shop_name || '',
    product.description || ''
  ].join(' ').toLowerCase()

  // Direct match on combined words
  if (searchTarget.includes(rawQuery) || searchTarget.includes(normalizedQuery)) {
    return true
  }

  // Check if any search word or its Hinglish mapping matches the target
  return words.every((word) => {
    if (searchTarget.includes(word)) return true

    // Check Hinglish mapping dictionary
    const expansion = HINDI_HINGLISH_MAP[word]
    if (expansion) {
      const expWords = expansion.split(' ')
      return expWords.some((w) => searchTarget.includes(w))
    }

    return false
  })
}
