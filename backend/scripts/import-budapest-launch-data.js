'use strict';

/**
 * Idempotent import for the Budapest launch batch supplied on 2026-07-20.
 * Default is a read-only preview; use --apply and optionally --with-photos.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { v2: cloudinary } = require('cloudinary');
const { GooglePlaces } = require('./lib/google-places');

const APPLY = process.argv.includes('--apply');
const WITH_PHOTOS = process.argv.includes('--with-photos');
const VERIFIED_AT = '2026-07-20T00:00:00.000Z';

const restaurants = [
  {
    googlePlaceId: 'ChIJo0cCE7XdQUcRqguYOfQ8yKk',
    name: 'Cafe Tamar Budapest — קפה תמר',
    googleDisplayName: 'Cafe Tamar Budapest',
    googleDisplayNameHe: 'קפה תמר בודפשט',
    restaurantType: 'dairy', restaurantTypeConfidence: 0.99, kashrutLevel: 'mehadrin',
    address: 'Budapest, Nagy Diófa u. 3, 1072 Hungary', lat: 47.4967347, lng: 19.0658575,
    rating: 4.7, googleRatingCount: 2337, phone: null, googlePhone: null,
    openingHours: 'Sunday-Thursday 08:00-22:00; Friday 08:00-16:00; Saturday closed',
    category: 'Mehadrin kosher Italian dairy restaurant and café',
    websiteUrl: 'https://www.facebook.com/profile.php?id=100087668251148',
    websiteText: 'מסעדה חלבית כשרה בבודפשט, בסגנון איטלקי ועם נגיעות ים־תיכוניות, באזור היהודי. במקום מוגשות גם ארוחות בוקר.',
    kosherReason: 'המקור שסיפק המשתמש מציין כשרות מהדרין בהשגחת הרב ברוך אוברלנדר, חב״ד בודפשט.',
    tags: ['kosher', 'mehadrin', 'dairy', 'italian', 'mediterranean', 'breakfast', 'cafe'],
    googleMapsUri: 'https://maps.google.com/?cid=12234095407387904938&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'restaurant', googleTypes: 'restaurant,food,point_of_interest,establishment',
  },
  {
    googlePlaceId: 'ChIJfT41N2jcQUcRiBeoviRnh8w',
    name: 'Tel Aviv Cafe — קפה תל אביב', googleDisplayName: 'Tel Aviv Cafe', googleDisplayNameHe: 'קפה תל אביב',
    restaurantType: 'dairy', restaurantTypeConfidence: 0.99, kashrutLevel: 'mehadrin',
    address: 'Budapest, Kazinczy u. 28, 1074 Hungary', lat: 47.4981346, lng: 19.0626144,
    rating: 4.0, googleRatingCount: 2134, phone: '+36 30 572 1684', googlePhone: '+36 30 572 1684',
    openingHours: 'Sunday-Thursday 08:30-21:00; Friday 08:30-14:00; Saturday closed',
    category: 'Mehadrin kosher dairy café and restaurant', websiteUrl: 'https://www.telavivcafe.hu/hu',
    websiteText: 'בית קפה ומסעדה חלבית במרכז הרובע היהודי, עם פיצות, פסטות, דגים וסלטים. המחירים נחשבים סבירים. קבוצות בתיאום מראש. טיפ: במקום יש שירותי טייק־אוויי ואפשר להזמין ארוחות בוקר; ניתן גם להזמין מנות שבת מראש ולאסוף לפני שבת.',
    kosherReason: 'המקור שסיפק המשתמש מציין כשרות מהדרין בהשגחת הרב ברוך אוברלנדר, חב״ד בודפשט.',
    tags: ['kosher', 'mehadrin', 'dairy', 'cafe', 'pizza', 'pasta', 'fish', 'breakfast', 'takeaway', 'shabbat'],
    googleMapsUri: 'https://maps.google.com/?cid=14737861713108408200&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'restaurant', googleTypes: 'breakfast_restaurant,coffee_shop,cafe,middle_eastern_restaurant,food_store,store,restaurant,point_of_interest,food,establishment',
  },
  {
    googlePlaceId: 'ChIJQZ6KOJXdQUcRcv6zbLiM3SY',
    name: 'Brooklyn Bagel — ברוקלין בייגל', googleDisplayName: 'Brooklyn Bagel', googleDisplayNameHe: 'ברוקלין בייגל בודפשט',
    restaurantType: 'dairy', restaurantTypeConfidence: 0.98, kashrutLevel: 'mehadrin',
    address: 'Budapest, Újpesti rkp. 1, 1137 Hungary', lat: 47.5144076, lng: 19.0477402,
    rating: 4.4, googleRatingCount: 565, phone: '+36 30 319 4356', googlePhone: '+36 30 319 4356',
    openingHours: 'Monday-Thursday 09:00-21:00; Friday 09:00-14:00; Saturday closed; Sunday 09:00-18:00',
    category: 'Mehadrin kosher dairy bagel shop and café', websiteUrl: 'https://www.brooklynbagel.hu/',
    websiteText: 'מסעדה חלבית כשרה ליד האי מרגיט, סמוך לבית הכנסת של שליח חב״ד הרב שמואל גליצנשטיין ברובע 13. זו המסעדה הכשרה היחידה בקבוצה שאינה נמצאת ברובע היהודי של בודפשט.',
    kosherReason: 'המקור שסיפק המשתמש מציין כשרות מהדרין בהשגחת הרב ברוך אוברלנדר, חב״ד בודפשט.',
    tags: ['kosher', 'mehadrin', 'dairy', 'bagel', 'bakery', 'cafe', 'breakfast'],
    googleMapsUri: 'https://maps.google.com/?cid=2800549267019923058&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'bagel_shop', googleTypes: 'bagel_shop,brunch_restaurant,coffee_shop,cafe,bakery,bar,food_store,store,restaurant,food,point_of_interest,establishment',
  },
  {
    googlePlaceId: 'ChIJ923IhATdQUcRZeXGi-zmeww',
    name: 'Marrakesh Kosher Restaurant — מסעדת מרקש', googleDisplayName: 'Marrakesh kosher restaurant', googleDisplayNameHe: 'מסעדת מרקש בודפשט',
    restaurantType: 'meat', restaurantTypeConfidence: 0.95, kashrutLevel: 'mehadrin',
    address: 'Budapest, Wesselényi utca 30, 1077 Hungary', lat: 47.4984306, lng: 19.0650945,
    rating: 4.3, googleRatingCount: 185, phone: '+36 70 300 0075', googlePhone: '+36 70 300 0075',
    openingHours: 'Sunday-Thursday 12:00-24:00; Friday-Saturday closed',
    category: 'Mehadrin kosher Moroccan meat restaurant',
    websiteUrl: 'https://www.facebook.com/people/Marrakesh-Budapest-%D7%9E%D7%A8%D7%A7%D7%A9-%D7%91%D7%95%D7%93%D7%A4%D7%A9%D7%98/61584791705375/',
    websiteText: 'מסעדה מרוקאית אותנטית ברובע היהודי של בודפשט.',
    kosherReason: 'המקור שסיפק המשתמש מציין כשרות מהדרין בהשגחת הרב ברוך אוברלנדר, חב״ד בודפשט.',
    tags: ['kosher', 'mehadrin', 'meat', 'moroccan'],
    googleMapsUri: 'https://maps.google.com/?cid=899566454222284133&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'restaurant', googleTypes: 'restaurant,food,point_of_interest,establishment',
  },
  {
    googlePlaceId: 'ChIJd1EvLADdQUcRLnBd8QC9ecU',
    name: 'Shuk HaCarmel — שוק הכרמל', googleDisplayName: 'שוק הכרמל - Shuk HaCarmel', googleDisplayNameHe: 'שוק הכרמל',
    restaurantType: 'meat', restaurantTypeConfidence: 0.98, kashrutLevel: 'mehadrin',
    address: 'Budapest, Kazinczy u. 32, 1075 Hungary', lat: 47.4982291, lng: 19.0623151,
    rating: 4.6, googleRatingCount: 41, phone: '+36 30 115 0242', googlePhone: '+36 30 115 0242',
    openingHours: 'Sunday-Thursday 12:00-24:00; Friday-Saturday closed',
    category: 'Mehadrin kosher Israeli meat and street-food restaurant', websiteUrl: 'http://www.koser.hu/',
    websiteText: 'מסעדת מזון מהיר מבית היוצר של מסעדת כרמל. בתפריט שווארמה, שניצל, חומוס, פלאפל ומנות נוספות.',
    kosherReason: 'המקור שסיפק המשתמש מציין כשרות מהדרין בהשגחת הרב ברוך אוברלנדר, חב״ד בודפשט.',
    tags: ['kosher', 'mehadrin', 'meat', 'israeli', 'street-food', 'shawarma', 'schnitzel', 'hummus', 'falafel'],
    googleMapsUri: 'https://maps.google.com/?cid=14229612309400875054&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'restaurant', googleTypes: 'restaurant,food,point_of_interest,establishment',
  },
  {
    googlePlaceId: 'ChIJRfzjg0LcQUcRbybdgOIV-wE',
    name: 'Hummusbar Kosher — חומוס בר כשר', googleDisplayName: 'hummusbar kosher', googleDisplayNameHe: 'חומוס בר הסניף הכשר',
    restaurantType: 'pareve', restaurantTypeConfidence: 0.94, kashrutLevel: 'badatz',
    address: 'Budapest, Wesselényi utca 14, 1075 Hungary', lat: 47.4971016, lng: 19.0616984,
    rating: 4.2, googleRatingCount: 2383, phone: '+36 70 466 2496', googlePhone: '+36 70 466 2496',
    openingHours: 'Sunday-Thursday 12:00-23:00; Friday 11:00-16:00; Saturday closed',
    category: 'Badatz kosher Israeli and Middle Eastern restaurant', websiteUrl: 'https://www.hummusbar.eu/',
    websiteText: 'הסניף הכשר של רשת החומוסיות הישראלית בבודפשט, בלב הרובע היהודי. מוגשות מנות כגון חומוס, מסבחה, פלאפל ושקשוקה.',
    kosherReason: 'המקור שסיפק המשתמש מציין כשרות בד״ץ חוג חתם סופר פתח תקווה.',
    tags: ['kosher', 'badatz', 'pareve', 'israeli', 'middle-eastern', 'hummus', 'falafel', 'shakshuka'],
    googleMapsUri: 'https://maps.google.com/?cid=142731875761071727&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'restaurant', googleTypes: 'israeli_restaurant,middle_eastern_restaurant,restaurant,food,point_of_interest,establishment',
  },
  {
    googlePlaceId: 'ChIJs0eEYQDdQUcRLOtXTBtSLPU',
    name: 'Nitavalo Kosher Restaurant — מסעדת ניטאוולו', googleDisplayName: 'Nitavalo', googleDisplayNameHe: 'מסעדת ניטאוולו',
    restaurantType: 'meat', restaurantTypeConfidence: 0.99, kashrutLevel: 'badatz',
    address: 'Budapest, Dob u. 32, 1072 Hungary', lat: 47.4991062, lng: 19.0621004,
    rating: 4.9, googleRatingCount: 1430, phone: '+36 20 439 5546', googlePhone: null,
    openingHours: 'Sunday-Thursday 12:00-22:00; Friday 12:00-16:00; Saturday closed',
    category: 'Badatz kosher meat chef restaurant', websiteUrl: 'https://www.instagram.com/nitavalo_budapest',
    websiteText: 'מסעדת שף בשרית כשרה למהדרין של השף אהרון פייגין.',
    kosherReason: 'המקור שסיפק המשתמש מציין כשרות בד״ץ התאחדות ישראל, בראשות הרב הראל אשר ידעי.',
    tags: ['kosher', 'badatz', 'meat', 'chef', 'israeli', 'barbecue'],
    googleMapsUri: 'https://maps.google.com/?cid=17666585715466038060&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'restaurant', googleTypes: 'barbecue_restaurant,israeli_restaurant,restaurant,food,point_of_interest,establishment',
  },
  {
    googlePlaceId: 'ChIJ_5KJrWncQUcRXswA76gD_pE',
    name: 'Hanna Orthodox Kosher Restaurant — מסעדת חנה', googleDisplayName: 'Hanna Orthodox Kosher Restaurant', googleDisplayNameHe: 'מסעדת חנה',
    restaurantType: 'meat', restaurantTypeConfidence: 1, kashrutLevel: 'badatz',
    address: 'Budapest, Kazinczy u. 29, 1074 Hungary', lat: 47.4985264, lng: 19.0623639,
    rating: 4.0, googleRatingCount: 1690, phone: '+36 1 342 1072', googlePhone: '+36 20 395 1746',
    openingHours: 'Sunday-Thursday 13:00-23:30; Friday 10:00-16:00; Saturday closed',
    category: 'Badatz kosher traditional Jewish meat restaurant', websiteUrl: 'http://hannabudapest.com/',
    websiteText: 'מסעדה מסורתית של אוכל יהודי בשרי כשר למהדרין ברובע היהודי. לאחר שיפוץ המקום נפתח מחדש. במקום מתקיימות סעודות שבת בהזמנה מראש. בערב חמישי מוגש תפריט ליל שישי הכולל מנות ממיטב מאכלי השבת כגון צ׳ולנט וקוגל; ביום שישי בצהריים ניתן לקנות אוכל מוכן לשבת.',
    kosherReason: 'המקור שסיפק המשתמש מציין השגחה של מערכת הכשרות CRC שע״י התאחדות הרבנים דארה״ב וקנדה.',
    tags: ['kosher', 'badatz', 'glatt', 'meat', 'traditional-jewish', 'shabbat-meals', 'cholent', 'kugel', 'takeaway'],
    googleMapsUri: 'https://maps.google.com/?cid=10519849803683253342&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'restaurant', googleTypes: 'restaurant,point_of_interest,food,establishment',
  },
  {
    googlePlaceId: 'ChIJPVJEtWncQUcR2QeT3fK4chU',
    name: 'Carmel Kosher Restaurant — מסעדת כרמל', googleDisplayName: 'Carmel Kóser Étterem', googleDisplayNameHe: 'מסעדת כרמל',
    restaurantType: 'meat', restaurantTypeConfidence: 1, kashrutLevel: 'mehadrin',
    address: 'Budapest, Kazinczy u. 31, 1075 Hungary', lat: 47.498608, lng: 19.0620729,
    rating: 4.1, googleRatingCount: 2806, phone: '+36 1 322 1834', googlePhone: '+36 30 259 7022',
    openingHours: 'Sunday-Thursday 12:00-22:30; Friday 12:00-15:00; Saturday closed',
    category: 'Mehadrin kosher Hungarian and Jewish meat restaurant', websiteUrl: 'http://www.carmelrestaurant.hu/',
    websiteText: 'מסעדה בשרית כשרה המגישה מטבח יהודי והונגרי קלאסי. היא נמצאת ברובע היהודי ליד בית הכנסת קזינצי, במפלס התחתון מתחת לקומת הקרקע. האווירה כוללת לעיתים כליזמרים ושירים יהודיים קלאסיים. מומלץ לא לפספס את פלטת הבשרים. קבוצות בתיאום מראש. בשבת ניתן לסעוד סעודות שבת בהזמנה מראש, ויש גם אפשרות לקחת אוכל מוכן לשבת בטייק־אוויי ולהדליק נרות במקום.',
    kosherReason: 'המקור שסיפק המשתמש מציין כשרות מהדרין בהשגחת הרב ברוך אוברלנדר, חב״ד בודפשט.',
    tags: ['kosher', 'mehadrin', 'meat', 'hungarian', 'jewish', 'shabbat-meals', 'takeaway', 'groups'],
    googleMapsUri: 'https://maps.google.com/?cid=1545500975380498393&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'restaurant', googleTypes: 'hungarian_restaurant,european_restaurant,restaurant,food,point_of_interest,establishment',
  },
  {
    googlePlaceId: 'ChIJ1ek1d2jcQUcR1wtOR6mhePU',
    name: 'Falafel Bar — פלאפל בר', googleDisplayName: 'Falafel Bar', googleDisplayNameHe: 'פלאפל בר',
    restaurantType: 'meat', restaurantTypeConfidence: 0.85, kashrutLevel: 'mehadrin',
    address: 'Budapest, Wesselényi utca 30, 1077 Hungary', lat: 47.4985339, lng: 19.0653285,
    rating: 4.4, googleRatingCount: 1656, phone: null, googlePhone: null,
    openingHours: 'Sunday-Thursday 12:00-24:00; Friday closed; Saturday 22:00-02:00',
    category: 'Mehadrin kosher Israeli fast-food restaurant', websiteUrl: 'https://www.facebook.com/falafelbarbudapest/',
    websiteText: 'חנות פלאפל ומסעדת מזון מהיר מבית קפה תמר. לצד פלאפל מוגשות גם מנות ים־תיכוניות כגון שקשוקה ושווארמה כשרה.',
    kosherReason: 'המקור שסיפק המשתמש מציין כשרות מהדרין בהשגחת הרב ברוך אוברלנדר, חב״ד בודפשט.',
    tags: ['kosher', 'mehadrin', 'meat', 'falafel', 'shawarma', 'shakshuka', 'israeli', 'fast-food'],
    googleMapsUri: 'https://maps.google.com/?cid=17688065284915465175&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'falafel_restaurant', googleTypes: 'falafel_restaurant,restaurant,food,point_of_interest,establishment',
  },
  {
    googlePlaceId: 'ChIJxyLK-ubdQUcRmMyAfIqZBkA',
    name: "Ashis' Israeli Street Food — אשיז׳", googleDisplayName: "Ashis' Israeli street food", googleDisplayNameHe: 'אשיז׳ אוכל רחוב ישראלי',
    restaurantType: 'meat', restaurantTypeConfidence: 0.96, kashrutLevel: 'mehadrin',
    address: 'Budapest, Dob u. 5, 1074 Hungary', lat: 47.4967773, lng: 19.0597715,
    rating: 4.6, googleRatingCount: 1212, phone: '+36 20 298 3763', googlePhone: '+36 70 329 1244',
    openingHours: 'Sunday-Monday-Tuesday-Thursday 12:00-02:00; Wednesday 12:00-20:30; Friday 12:00-18:00; Saturday 22:30-02:00',
    category: 'Mehadrin kosher Israeli street-food restaurant', websiteUrl: null,
    websiteText: 'מסעדת סטריט־פוד בסגנון ישראלי המגישה פלאפל, חומוס, שניצל, המבורגר ומנות נוספות.',
    kosherReason: 'המקור שסיפק המשתמש מציין כשרות מהדרין בהשגחת הרב נחמיה רוטנברג.',
    tags: ['kosher', 'mehadrin', 'meat', 'israeli', 'street-food', 'falafel', 'hummus', 'schnitzel', 'burger'],
    googleMapsUri: 'https://maps.google.com/?cid=4613543688361004184&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'restaurant', googleTypes: 'fast_food_restaurant,restaurant,food,point_of_interest,establishment',
  },
  {
    googlePlaceId: 'ChIJWc7UFj3dQUcRAuK3NgtE54w',
    name: 'UpTown Kosher Bakery — מאפיית אפטאון', googleDisplayName: 'UpTown Kosher bakery - מאפייה כשרה', googleDisplayNameHe: 'מאפיית אפטאון הכשרה',
    restaurantType: null, restaurantTypeConfidence: null, kashrutLevel: 'mehadrin',
    address: 'Budapest, Nagy Diófa u. 4, 1072 Hungary', lat: 47.4965753, lng: 19.0657391,
    rating: 4.4, googleRatingCount: 171, phone: '+36 30 485 8873', googlePhone: '+36 30 485 8873',
    openingHours: 'Sunday-Thursday 08:00-18:00; Friday 08:00-15:00; Saturday closed',
    category: 'Mehadrin kosher bakery and food shop', websiteUrl: null,
    websiteText: 'מאפייה כשרה למהדרין באזור היהודי של בודפשט, עם מאפים, לחמים, חלות ועוגות הונגריות. במקום יש גם קפה ומוצרים לקידוש. כתובת Google העדכנית היא Nagy Diófa u. 4; בתמונה שסופקה הופיעה כתובת קודמת, Nagy Diófa u. 19.',
    kosherReason: 'המקור שסיפק המשתמש מציין כשרות מהדרין בהשגחת הרב ברוך אוברלנדר, חב״ד בודפשט.',
    tags: ['kosher', 'mehadrin', 'bakery', 'bread', 'challah', 'cakes', 'pastries', 'coffee', 'kiddush'],
    googleMapsUri: 'https://maps.google.com/?cid=10153158699883422210&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'bakery', googleTypes: 'bakery,food_store,store,food,point_of_interest,establishment',
  },
  {
    googlePlaceId: 'ChIJ5aK0TQDdQUcRudNIOVcTz2Y',
    name: "Slow Moe's Kosher Bakery — מאפיית סלואו מואז", googleDisplayName: "Slow Moe's Kosher Bakery", googleDisplayNameHe: 'מאפייה כשרה סלואו מואז',
    restaurantType: null, restaurantTypeConfidence: null, kashrutLevel: 'mehadrin',
    address: 'Budapest, Király u. 10, 1061 Hungary', lat: 47.4984629, lng: 19.0567591,
    rating: 4.0, googleRatingCount: 29, phone: '+36 70 628 3001', googlePhone: '+36 70 628 3001',
    openingHours: 'Monday-Thursday 08:00-17:00; Friday 08:00-15:00; Saturday-Sunday closed',
    category: 'Mehadrin kosher bakery and takeaway', websiteUrl: null,
    websiteText: 'עגלת מאפים כשרים מבית מאפיית שמש, ליד מלון 7Seasons בבודפשט.',
    kosherReason: 'המקור שסיפק המשתמש מציין כשרות מהדרין בהשגחת הרב ברוך אוברלנדר, חב״ד בודפשט.',
    tags: ['kosher', 'mehadrin', 'bakery', 'pastries', 'takeaway'],
    googleMapsUri: 'https://maps.google.com/?cid=7408161177391911865&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'bakery', googleTypes: 'bakery,grocery_store,meal_takeaway,food_store,store,restaurant,food,point_of_interest,establishment',
  },
  {
    googlePlaceId: 'ChIJj4FRWl3cQUcR2shfCpiV5Pg',
    name: 'Kosher Market Budapest — חנות כשרה', googleDisplayName: 'kosher market', googleDisplayNameHe: 'חנות מכולת כשרה',
    restaurantType: null, restaurantTypeConfidence: null, kashrutLevel: 'rabbinate',
    address: 'Budapest, Dohány u. 36, 1074 Hungary', lat: 47.4963559, lng: 19.0655685,
    rating: 4.3, googleRatingCount: 471, phone: '+36 30 572 2165', googlePhone: '+36 30 572 2165',
    openingHours: 'Sunday 10:00-18:00; Monday-Thursday 08:00-19:00; Friday 08:00-17:00; Saturday closed',
    category: 'Kosher grocery and food store', websiteUrl: 'https://www.facebook.com/koshermarketbudapest',
    websiteText: 'חנות למוצרים כשרים באזור היהודי של בודפשט, כולל מגוון מוצרים מיובאים ומוצרים איטלקיים.',
    kosherReason: 'נשמר הסיווג הקיים במערכת (רבנות). המקור החדש שסיפק המשתמש והשם העסקי מזהים את המקום כחנות כשרה, אך לא ציין רמת השגחה — לכן לא בוצע שינוי מהסיווג הקיים.',
    tags: ['kosher', 'grocery', 'market', 'food-store', 'italian-products'],
    googleMapsUri: 'https://maps.google.com/?cid=17934624096337774810&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googlePrimaryType: 'grocery_store', googleTypes: 'grocery_store,food_store,food,store,point_of_interest,establishment',
  },
].map((r) => ({
  ...r,
  googleFormattedAddress: r.address,
  googleRating: r.rating,
  googleOpeningHours: r.openingHours,
  googleBusinessStatus: 'OPERATIONAL',
  sourceSummary: 'User-provided numbered screenshot and Google share link; verified with Google Places on 2026-07-20; official website or social profile included when listed by Google.',
}));

function client() {
  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
}

async function state(db) {
  const destinations = await db.query(
    `SELECT id,name,name_he,parent_id FROM destinations
      WHERE country_code='HU' OR lower(name) IN ('hungary','budapest')
      ORDER BY parent_id NULLS FIRST,id`,
  );
  const places = await db.query(
    `SELECT id,name,restaurant_type,kashrut_level,address,phone,opening_hours,
            website_url,website_text,rating,google_rating,google_rating_count,google_maps_uri,
            lat,lng,photo_url,verification_status,"destinationId"
       FROM restaurants WHERE google_place_id=ANY($1::text[]) ORDER BY id`,
    [restaurants.map((x) => x.googlePlaceId)],
  );
  return { destinations: destinations.rows, restaurants: places.rows };
}

async function ensureDestination(db, data, parentId) {
  const found = await db.query(
    `SELECT id FROM destinations WHERE country_code=$1
      AND parent_id IS NOT DISTINCT FROM $2 AND lower(name)=lower($3)
      ORDER BY id LIMIT 1`,
    [data.code, parentId ?? null, data.name],
  );
  if (found.rowCount) {
    const id = found.rows[0].id;
    await db.query(
      `UPDATE destinations SET name_he=$1,country=$2,city=$3,
       location=ST_SetSRID(ST_MakePoint($4,$5),4326)::geography WHERE id=$6`,
      [data.nameHe, data.country, data.city, data.lng, data.lat, id],
    );
    return { id, action: 'updated' };
  }
  const inserted = await db.query(
    `INSERT INTO destinations(name,name_he,country,country_code,city,location,parent_id)
     VALUES($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6,$7),4326)::geography,$8) RETURNING id`,
    [data.name, data.nameHe, data.country, data.code, data.city, data.lng, data.lat, parentId ?? null],
  );
  return { id: inserted.rows[0].id, action: 'inserted' };
}

async function upsertRestaurant(db, destinationId, r) {
  const found = await db.query('SELECT id FROM restaurants WHERE google_place_id=$1 LIMIT 1', [r.googlePlaceId]);
  let id;
  let action;
  if (found.rowCount) {
    id = found.rows[0].id;
    action = 'updated';
  } else {
    const inserted = await db.query(
      'INSERT INTO restaurants(name,kashrut_level) VALUES($1,$2) RETURNING id',
      [r.name, r.kashrutLevel],
    );
    id = inserted.rows[0].id;
    action = 'inserted';
  }
  const values = [
    r.googlePlaceId, r.name, r.restaurantType, r.restaurantTypeConfidence,
    r.kashrutLevel, r.address, r.openingHours, r.lng, r.lat, r.rating,
    r.websiteUrl, r.websiteText, r.sourceSummary, r.kosherReason, destinationId,
    r.phone, r.category, r.lat, r.lng, r.tags, r.googleDisplayName,
    r.googleFormattedAddress, r.googleMapsUri, r.googleRatingCount, r.googleRating,
    r.googlePhone, r.googleOpeningHours, r.googlePrimaryType, r.googleTypes,
    r.googleDisplayNameHe, r.googleFormattedAddress, r.googleDisplayName,
    r.googleFormattedAddress, id,
  ];
  await db.query(
    `UPDATE restaurants SET
      google_place_id=$1::varchar,name=$2,restaurant_type=$3,restaurant_type_confidence=$4,
      kashrut_level=$5,address=$6,opening_hours=$7,
      location=ST_SetSRID(ST_MakePoint($8,$9),4326)::geography,rating=$10,is_kosher=true,
      website_url=$11::varchar,website_text=$12,website_opening_hours=$7,
      website_last_fetched_at=CASE WHEN $11::varchar IS NULL THEN NULL ELSE '${VERIFIED_AT}'::timestamptz END,
      website_fetch_status=CASE WHEN $11::varchar IS NULL THEN NULL ELSE 'ok' END,
      enrichment_source_summary=$13,kosher_validation_status='verified',
      kosher_validation_confidence=0.999,kosher_validation_reason=$14,
      kosher_validated_at='${VERIFIED_AT}'::timestamptz,"destinationId"=$15,
      phone=$16,category=$17,city='Budapest',country='Hungary',lat=$18,lng=$19,
      geocoded_at='${VERIFIED_AT}'::timestamptz,tags=$20,
      google_display_name=$21,google_formatted_address=$22,
      google_lat=$18,google_lng=$19,google_business_status='OPERATIONAL',
      google_maps_uri=$23,google_rating_count=$24,
      google_synced_at='${VERIFIED_AT}'::timestamptz,
      google_rating=$25,google_phone=$26,google_opening_hours=$27,
      google_primary_type=$28,google_types=$29,
      verification_status='verified',verification_confidence=0.999,
      verification_reason=$13,google_display_name_he=$30,google_formatted_address_he=$31,
      google_display_name_en=$32,google_formatted_address_en=$33 WHERE id=$34`,
    values,
  );
  return { id, action, name: r.name, googlePlaceId: r.googlePlaceId };
}

function uploadPhoto(buffer, id) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'restaurants/google', public_id: `restaurant_${id}_google_800`, overwrite: true,
        resource_type: 'image', context: { source: 'google_places' } },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
}

async function syncPhotos(db, results) {
  if (!WITH_PHOTOS) return [];
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
  const google = new GooglePlaces(process.env.GOOGLE_PLACES_API_KEY, { rateMs: 180 });
  const out = [];
  for (const result of results) {
    try {
      const details = await google.getDetails(result.googlePlaceId, { mask: 'photos' });
      const source = details.photos?.[0];
      if (!source?.name) {
        out.push({ id: result.id, name: result.name, status: 'no-photo' });
        continue;
      }
      const attribution = source.authorAttributions?.[0]?.displayName || result.name;
      const photo = await google.getPhotoBytes(source.name, { maxWidthPx: 800 });
      const uploaded = await uploadPhoto(photo.buffer, result.id);
      await db.query(
        `UPDATE restaurants SET google_photo_name=$1,google_photo_attribution=$2,
         photo_url=$3,photo_attribution=$2,photo_source='google_places',photo_fetched_at=now()
         WHERE id=$4`,
        [source.name, attribution, uploaded.secure_url, result.id],
      );
      out.push({ id: result.id, name: result.name, status: 'ok', photoUrl: uploaded.secure_url });
    } catch (error) {
      out.push({ id: result.id, name: result.name, status: 'error', error: error.message });
    }
  }
  return out;
}

(async () => {
  const db = client();
  await db.connect();
  console.log('=== BUDAPEST LAUNCH IMPORT ===');
  console.log(`mode: ${APPLY ? 'APPLY' : 'DRY RUN (read-only)'}`);
  console.log(`photos: ${WITH_PHOTOS ? 'Google Places -> Cloudinary' : 'metadata only'}`);
  console.log('existing:', JSON.stringify(await state(db), null, 2));
  console.log('planned: Hungary -> Budapest; 14 food entries; user notes stored as About; current Google operational fields take priority');
  if (!APPLY) {
    await db.end();
    console.log('No writes. Re-run with --apply after reviewing.');
    return;
  }
  await db.query('BEGIN');
  let results;
  try {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('import-budapest-launch-data'))");
    const hungary = await ensureDestination(db,
      { name: 'Hungary', nameHe: 'הונגריה', country: 'Hungary', code: 'HU', city: 'Hungary', lat: 47.1625, lng: 19.5033 });
    const budapest = await ensureDestination(db,
      { name: 'Budapest', nameHe: 'בודפשט', country: 'Hungary', code: 'HU', city: 'Budapest', lat: 47.4979, lng: 19.0402 }, hungary.id);
    results = [];
    for (const restaurant of restaurants) results.push(await upsertRestaurant(db, budapest.id, restaurant));
    await db.query('COMMIT');
    console.log('destination actions:', { hungary, budapest });
    console.log('restaurant actions:', results);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
  console.log('photo actions:', await syncPhotos(db, results));
  console.log('verified state:', JSON.stringify(await state(db), null, 2));
  await db.end();
})().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
