-- ─── Step 1: Insert parent countries ─────────────────────────────────────────
INSERT INTO destinations (name, city, country, country_code, location)
SELECT name, city, country, country_code, location FROM (VALUES
  ('Israel',         'Israel',         'Israel',         'IL', ST_SetSRID(ST_MakePoint(34.8516, 31.0461), 4326)),
  ('France',         'France',         'France',         'FR', ST_SetSRID(ST_MakePoint(2.3522,  48.8566), 4326)),
  ('Spain',          'Spain',          'Spain',          'ES', ST_SetSRID(ST_MakePoint(-3.7038, 40.4168), 4326)),
  ('United Kingdom', 'United Kingdom', 'United Kingdom', 'GB', ST_SetSRID(ST_MakePoint(-0.1278, 51.5074), 4326)),
  ('Ireland',        'Ireland',        'Ireland',        'IE', ST_SetSRID(ST_MakePoint(-6.2603, 53.3498), 4326)),
  ('Portugal',       'Portugal',       'Portugal',       'PT', ST_SetSRID(ST_MakePoint(-9.1393, 38.7223), 4326)),
  ('Czech Republic', 'Czech Republic', 'Czech Republic', 'CZ', ST_SetSRID(ST_MakePoint(14.4378, 50.0755), 4326)),
  ('Morocco',        'Morocco',        'Morocco',        'MA', ST_SetSRID(ST_MakePoint(-7.9811, 31.6295), 4326)),
  ('UAE',            'UAE',            'UAE',            'AE', ST_SetSRID(ST_MakePoint(55.2708, 25.2048), 4326)),
  ('Cyprus',         'Cyprus',         'Cyprus',         'CY', ST_SetSRID(ST_MakePoint(33.4299, 35.1264), 4326)),
  ('Italy',          'Italy',          'Italy',          'IT', ST_SetSRID(ST_MakePoint(12.4964, 41.9028), 4326))
) AS v(name, city, country, country_code, location)
WHERE NOT EXISTS (
  SELECT 1 FROM destinations d WHERE d.city = v.city AND d.country = v.country
);

-- ─── Step 2: Insert cities as children of their country ───────────────────────
INSERT INTO destinations (name, city, country, country_code, location, parent_id)
SELECT v.name, v.city, v.country, v.country_code, v.location,
       (SELECT id FROM destinations WHERE city = v.country AND country = v.country LIMIT 1)
FROM (VALUES
  -- Israel
  ('Ashdod',           'Ashdod',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.6552, 31.8040), 4326)),
  ('Gan Yavne',        'Gan Yavne',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7167, 31.7833), 4326)),
  ('Amonim',           'Amonim',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9500, 32.1500), 4326)),
  ('Kannot',           'Kannot',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7500, 31.8000), 4326)),
  ('Yavne',            'Yavne',            'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7444, 31.8761), 4326)),
  ('Gedera',           'Gedera',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7770, 31.8110), 4326)),
  ('Be''er Tuvia',     'Be''er Tuvia',     'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7167, 31.7500), 4326)),
  ('Ganei Tal',        'Ganei Tal',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.6167, 31.6667), 4326)),
  ('Givat Brenner',    'Givat Brenner',    'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7833, 31.8500), 4326)),
  ('Ashkelon',         'Ashkelon',         'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.5743, 31.6688), 4326)),
  ('Ness Ziona',       'Ness Ziona',       'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8000, 31.9299), 4326)),
  ('Rehovot',          'Rehovot',          'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8117, 31.8948), 4326)),
  ('Beit Oved',        'Beit Oved',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8000, 31.9167), 4326)),
  ('Mazkeret Batya',   'Mazkeret Batya',   'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8333, 31.8500), 4326)),
  ('Nir Banim',        'Nir Banim',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7500, 31.7833), 4326)),
  ('Sde Yoav',         'Sde Yoav',         'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7167, 31.7167), 4326)),
  ('Rishon LeZion',    'Rishon LeZion',    'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7925, 31.9730), 4326)),
  ('Kiryat Gat',       'Kiryat Gat',       'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7717, 31.6100), 4326)),
  ('Be''er Yaakov',    'Be''er Yaakov',    'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8333, 31.9333), 4326)),
  ('Bat Yam',          'Bat Yam',          'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7505, 32.0160), 4326)),
  ('Ramla',            'Ramla',            'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8700, 31.9200), 4326)),
  ('Holon',            'Holon',            'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7750, 32.0167), 4326)),
  ('Lod',              'Lod',              'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8833, 31.9500), 4326)),
  ('Kfar Ben Nun',     'Kfar Ben Nun',     'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9167, 31.8833), 4326)),
  ('Tel Aviv',         'Tel Aviv',         'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7818, 32.0853), 4326)),
  ('Modiin',           'Modiin',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.0100, 31.8980), 4326)),
  ('Or Yehuda',        'Or Yehuda',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8667, 32.0333), 4326)),
  ('Sderot',           'Sderot',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.5965, 31.5241), 4326)),
  ('Beit Shemesh',     'Beit Shemesh',     'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9896, 31.7479), 4326)),
  ('Ramat Gan',        'Ramat Gan',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8243, 32.0678), 4326)),
  ('Givatayim',        'Givatayim',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8100, 32.0700), 4326)),
  ('Bnei Brak',        'Bnei Brak',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8333, 32.0833), 4326)),
  ('Yehud',            'Yehud',            'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8833, 32.0333), 4326)),
  ('Shoham',           'Shoham',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9500, 31.9833), 4326)),
  ('Savion',           'Savion',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9167, 32.0500), 4326)),
  ('Givat Shmuel',     'Givat Shmuel',     'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8500, 32.0833), 4326)),
  ('Petah Tikva',      'Petah Tikva',      'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8878, 32.0841), 4326)),
  ('Shilat',           'Shilat',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.0000, 31.9500), 4326)),
  ('Modiin Illit',     'Modiin Illit',     'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.0167, 31.9333), 4326)),
  ('Ramat HaSharon',   'Ramat HaSharon',   'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8400, 32.1500), 4326)),
  ('Herzliya',         'Herzliya',         'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8435, 32.1653), 4326)),
  ('Hod HaSharon',     'Hod HaSharon',     'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8878, 32.1510), 4326)),
  ('Netivot',          'Netivot',          'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.5833, 31.4167), 4326)),
  ('Rosh HaAyin',      'Rosh HaAyin',      'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9577, 32.0953), 4326)),
  ('Kiryat Anavim',    'Kiryat Anavim',    'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.1000, 31.8000), 4326)),
  ('Beit Nekofa',      'Beit Nekofa',      'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.0667, 31.8167), 4326)),
  ('Ein Hemed',        'Ein Hemed',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.0500, 31.8000), 4326)),
  ('Beitar Illit',     'Beitar Illit',     'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.1233, 31.6903), 4326)),
  ('Mevaseret Zion',   'Mevaseret Zion',   'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.1500, 31.8000), 4326)),
  ('Rahat',            'Rahat',            'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7542, 31.3933), 4326)),
  ('Ra''anana',        'Ra''anana',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8710, 32.1840), 4326)),
  ('Kfar Saba',        'Kfar Saba',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9070, 32.1784), 4326)),
  ('Beit Zayit',       'Beit Zayit',       'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.1333, 31.8167), 4326)),
  ('Jerusalem',        'Jerusalem',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.2137, 31.7683), 4326)),
  ('Givat Ze''ev',     'Givat Ze''ev',     'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.1667, 31.8667), 4326)),
  ('Efrat',            'Efrat',            'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.1583, 31.6583), 4326)),
  ('Batzra',           'Batzra',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8800, 32.0500), 4326)),
  ('Ga''ash',          'Ga''ash',          'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8333, 32.1833), 4326)),
  ('Netanya',          'Netanya',          'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8528, 32.3226), 4326)),
  ('Ariel',            'Ariel',            'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.1669, 32.1061), 4326)),
  ('Ofra',             'Ofra',             'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.2500, 31.9500), 4326)),
  ('Ma''ale Adumim',   'Ma''ale Adumim',   'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.2978, 31.7769), 4326)),
  ('Tzoran',           'Tzoran',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9167, 32.1667), 4326)),
  ('Kfar Yona',        'Kfar Yona',        'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9333, 32.3167), 4326)),
  ('Be''er Sheva',     'Be''er Sheva',     'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.7915, 31.2528), 4326)),
  ('Tnuvot',           'Tnuvot',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9167, 32.2500), 4326)),
  ('Beit Yitzhak',     'Beit Yitzhak',     'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.8833, 32.2833), 4326)),
  ('Kfar Adumim',      'Kfar Adumim',      'Israel', 'IL', ST_SetSRID(ST_MakePoint(35.2833, 31.8167), 4326)),
  ('Mishmar HaSharon', 'Mishmar HaSharon', 'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9000, 32.3167), 4326)),
  ('Kfar HaRo''eh',   'Kfar HaRo''eh',   'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9167, 32.3167), 4326)),
  ('Hadera',           'Hadera',           'Israel', 'IL', ST_SetSRID(ST_MakePoint(34.9190, 32.4341), 4326)),
  -- France
  ('Paris',            'Paris',            'France',         'FR', ST_SetSRID(ST_MakePoint(2.3522,   48.8566), 4326)),
  ('Marseille',        'Marseille',        'France',         'FR', ST_SetSRID(ST_MakePoint(5.3698,   43.2965), 4326)),
  ('Lyon',             'Lyon',             'France',         'FR', ST_SetSRID(ST_MakePoint(4.8357,   45.7640), 4326)),
  ('Deauville',        'Deauville',        'France',         'FR', ST_SetSRID(ST_MakePoint(0.0716,   49.3556), 4326)),
  ('Juan-les-Pins',    'Juan-les-Pins',    'France',         'FR', ST_SetSRID(ST_MakePoint(7.1167,   43.5700), 4326)),
  ('Cannes',           'Cannes',           'France',         'FR', ST_SetSRID(ST_MakePoint(7.0174,   43.5528), 4326)),
  ('Nice',             'Nice',             'France',         'FR', ST_SetSRID(ST_MakePoint(7.2620,   43.7102), 4326)),
  ('Charenton',        'Charenton',        'France',         'FR', ST_SetSRID(ST_MakePoint(2.4139,   48.8197), 4326)),
  ('Levallois',        'Levallois',        'France',         'FR', ST_SetSRID(ST_MakePoint(2.2870,   48.8950), 4326)),
  ('Strasbourg',       'Strasbourg',       'France',         'FR', ST_SetSRID(ST_MakePoint(7.7521,   48.5734), 4326)),
  ('Perpignan',        'Perpignan',        'France',         'FR', ST_SetSRID(ST_MakePoint(2.8956,   42.6986), 4326)),
  -- Spain
  ('Marbella',         'Marbella',         'Spain',          'ES', ST_SetSRID(ST_MakePoint(-4.8825,  36.5100), 4326)),
  -- United Kingdom
  ('London',           'London',           'United Kingdom', 'GB', ST_SetSRID(ST_MakePoint(-0.1278,  51.5074), 4326)),
  -- Ireland
  ('Dublin',           'Dublin',           'Ireland',        'IE', ST_SetSRID(ST_MakePoint(-6.2603,  53.3498), 4326)),
  -- Portugal
  ('Porto',            'Porto',            'Portugal',       'PT', ST_SetSRID(ST_MakePoint(-8.6291,  41.1579), 4326)),
  -- Czech Republic
  ('Prague',           'Prague',           'Czech Republic', 'CZ', ST_SetSRID(ST_MakePoint(14.4378,  50.0755), 4326)),
  -- Morocco
  ('Marrakech',        'Marrakech',        'Morocco',        'MA', ST_SetSRID(ST_MakePoint(-7.9811,  31.6295), 4326)),
  -- UAE
  ('Dubai',            'Dubai',            'UAE',            'AE', ST_SetSRID(ST_MakePoint(55.2708,  25.2048), 4326)),
  -- Cyprus
  ('Limassol',         'Limassol',         'Cyprus',         'CY', ST_SetSRID(ST_MakePoint(33.0413,  34.6786), 4326)),
  ('Larnaca',          'Larnaca',          'Cyprus',         'CY', ST_SetSRID(ST_MakePoint(33.6233,  34.9229), 4326)),
  ('Paphos',           'Paphos',           'Cyprus',         'CY', ST_SetSRID(ST_MakePoint(32.4243,  34.7754), 4326)),
  -- Italy
  ('Casciana Alta',    'Casciana Alta',    'Italy',          'IT', ST_SetSRID(ST_MakePoint(10.6167,  43.5500), 4326))
) AS v(name, city, country, country_code, location)
WHERE NOT EXISTS (
  SELECT 1 FROM destinations d WHERE d.city = v.city AND d.country = v.country
);
