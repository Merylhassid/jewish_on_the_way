/**
 * Seed script — populates destinations + kosher restaurants
 *
 * Usage:
 *   npm run seed                         # seed data only
 *   npm run seed -- admin you@email.com  # also set a user as admin
 */
import 'reflect-metadata';
import { config } from 'dotenv';
config({ path: __dirname + '/../.env' });

import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Destination } from './destination.entity';
import { Restaurant } from './restaurant.entity';
import { User } from './users/user.entity';
import { Minyan } from './minyan.entity';
import { MinyanRegistration } from './minyan-registration.entity';
import { Synagogue } from './synagogue.entity';
import { HostingOffer } from './hosting/entities/hosting-offer.entity';
import { HostingRequest } from './hosting/entities/hosting-request.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [Destination, Restaurant, User, Minyan, MinyanRegistration, Synagogue, HostingOffer, HostingRequest],
  synchronize: true,
  logging: false,
});

// ─── Seed data ────────────────────────────────────────────────────────────────

const DESTINATIONS = [
  {
    name: 'Tel Aviv',
    city: 'Tel Aviv',
    country: 'Israel',
    countryCode: 'IL',
    description: 'The White City — Israel\'s vibrant cultural capital on the Mediterranean.',
    lat: 32.0853,
    lng: 34.7818,
    restaurants: [
      { name: 'HaBasta', type: 'meat', kashrut: 'mehadrin', address: 'Hacarmel Market, Tel Aviv', hours: 'Sun-Thu 12:00-23:00, Fri 10:00-14:00' },
      { name: 'Miznon', type: 'meat', kashrut: 'rabbinate', address: '23 Ibn Gavirol St, Tel Aviv', hours: 'Sun-Thu 11:00-22:00' },
      { name: 'Meshek Barzilay', type: 'parve', kashrut: 'mehadrin', address: '6 Ahad Ha\'am St, Tel Aviv', hours: 'Daily 8:00-22:00' },
      { name: 'Port Said', type: 'dairy', kashrut: 'rabbinate', address: 'Bet Lessin Theatre, Tel Aviv', hours: 'Daily 12:00-00:00' },
    ],
  },
  {
    name: 'Paris',
    city: 'Paris',
    country: 'France',
    countryCode: 'FR',
    description: 'The City of Light, home to one of Europe\'s oldest and most vibrant Jewish communities.',
    lat: 48.8566,
    lng: 2.3522,
    restaurants: [
      { name: 'L\'As du Fallafel', type: 'parve', kashrut: 'mehadrin', address: '34 Rue des Rosiers, Paris 4e', hours: 'Sun-Thu 12:00-23:00, Fri 12:00-17:00' },
      { name: 'Florence Kahn', type: 'dairy', kashrut: 'mehadrin', address: '24 Rue des Écouffes, Paris 4e', hours: 'Mon-Thu 10:00-19:00, Fri 10:00-14:00' },
      { name: 'Chez Marianne', type: 'meat', kashrut: 'mehadrin', address: '2 Rue des Hospitalières Saint-Gervais, Paris 4e', hours: 'Daily 11:00-23:00' },
      { name: 'Café des Psaumes', type: 'meat', kashrut: 'badatz', address: '14-17 Rue des Rosiers, Paris 4e', hours: 'Sun-Thu 11:30-22:30, Fri 11:30-14:00' },
    ],
  },
  {
    name: 'New York',
    city: 'New York',
    country: 'United States',
    countryCode: 'US',
    description: 'Home to the largest Jewish population outside Israel, with endless kosher dining options.',
    lat: 40.7128,
    lng: -74.0060,
    restaurants: [
      { name: 'Katz\'s Delicatessen', type: 'meat', kashrut: 'rabbinate', address: '205 E Houston St, Manhattan', hours: 'Mon-Wed 8:00-22:30, Thu 8:00-02:30, Fri-Sun 24h' },
      { name: 'Taam Tov', type: 'meat', kashrut: 'mehadrin', address: '41 W 47th St, Manhattan', hours: 'Sun-Thu 11:00-20:00, Fri 11:00-13:00' },
      { name: 'Prime Grill', type: 'meat', kashrut: 'mehadrin', address: '60 E 49th St, Manhattan', hours: 'Sun-Thu 12:00-22:00, Fri 12:00-14:00' },
      { name: 'Pardes', type: 'meat', kashrut: 'mehadrin', address: '15 Lafayette Ave, Brooklyn', hours: 'Sun-Thu 17:30-22:00' },
    ],
  },
  {
    name: 'London',
    city: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    description: 'A thriving Jewish community with excellent kosher options in Golders Green and Stamford Hill.',
    lat: 51.5074,
    lng: -0.1278,
    restaurants: [
      { name: 'Reubens', type: 'meat', kashrut: 'mehadrin', address: '79 Baker St, London W1U 6RG', hours: 'Sun-Thu 12:00-21:30, Fri 12:00-14:00' },
      { name: 'Moshikis', type: 'meat', kashrut: 'mehadrin', address: '46 Golders Green Rd, London NW11', hours: 'Sun-Thu 12:00-22:00' },
      { name: 'Blooms', type: 'meat', kashrut: 'rabbinate', address: '130 Golders Green Rd, London NW11', hours: 'Mon-Thu 12:00-22:00, Fri 12:00-14:00, Sat night-Sun 12:00-22:00' },
      { name: 'La Fiesta', type: 'meat', kashrut: 'mehadrin', address: '236 Golders Green Rd, London NW11', hours: 'Sun-Thu 12:00-22:30' },
    ],
  },
  {
    name: 'Buenos Aires',
    city: 'Buenos Aires',
    country: 'Argentina',
    countryCode: 'AR',
    description: 'Latin America\'s largest Jewish community with a rich Ashkenazi heritage.',
    lat: -34.6037,
    lng: -58.3816,
    restaurants: [
      { name: 'El Galpon', type: 'meat', kashrut: 'mehadrin', address: 'Av. Corrientes 2900, Buenos Aires', hours: 'Sun-Thu 12:00-23:00' },
      { name: 'La Berenjena', type: 'dairy', kashrut: 'rabbinate', address: 'Araoz 2260, Palermo', hours: 'Daily 12:00-23:00' },
      { name: 'Mishná', type: 'meat', kashrut: 'badatz', address: 'Scalabrini Ortiz 2555, Palermo', hours: 'Sun-Thu 12:00-15:00, 20:00-23:00' },
    ],
  },
  {
    name: 'Montreal',
    city: 'Montreal',
    country: 'Canada',
    countryCode: 'CA',
    description: 'A historic Jewish community known for its legendary smoked meat and bagels.',
    lat: 45.5017,
    lng: -73.5673,
    restaurants: [
      { name: 'Schwartz\'s Deli', type: 'meat', kashrut: 'rabbinate', address: '3895 Boul Saint-Laurent, Montreal', hours: 'Sun-Thu 8:00-00:30, Fri 8:00-01:30, Sat 8:00-01:30' },
      { name: 'Beauty\'s Luncheonette', type: 'dairy', kashrut: 'rabbinate', address: '93 Mont-Royal Ave W, Montreal', hours: 'Mon-Fri 7:00-17:00, Sat-Sun 8:00-17:00' },
      { name: 'Snowdon Deli', type: 'meat', kashrut: 'mehadrin', address: '5265 Décarie Blvd, Montreal', hours: 'Sun-Thu 7:00-21:00, Fri 7:00-14:00' },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

// Build future dates relative to today
function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

async function main() {
  await AppDataSource.initialize();
  console.log('✅  Connected to DB');

  const destRepo    = AppDataSource.getRepository(Destination);
  const restRepo    = AppDataSource.getRepository(Restaurant);
  const userRepo    = AppDataSource.getRepository(User);
  const minyanRepo  = AppDataSource.getRepository(Minyan);

  // ── Optional: set a user as admin ──
  const args = process.argv.slice(2);
  if (args[0] === 'admin' && args[1]) {
    const email = args[1].toLowerCase();
    const user = await userRepo.findOne({ where: { email } });
    if (!user) {
      console.error(`❌  No user found with email: ${email}`);
    } else {
      user.role = 'admin';
      await userRepo.save(user);
      console.log(`✅  ${email} is now an admin`);
    }
  }

  // ── Seed destinations + restaurants ──
  let newDest = 0;
  let newRest = 0;

  for (const data of DESTINATIONS) {
    let dest = await destRepo.findOne({ where: { city: data.city, country: data.country } });

    if (!dest) {
      dest = destRepo.create({
        name: data.name,
        city: data.city,
        country: data.country,
        countryCode: data.countryCode,
        description: data.description,
        location: { type: 'Point', coordinates: [data.lng, data.lat] },
      });
      dest = await destRepo.save(dest);
      console.log(`  ➕  Destination: ${data.city}`);
      newDest++;
    } else {
      console.log(`  ⏭️   Destination already exists: ${data.city}`);
    }

    for (const r of data.restaurants) {
      const exists = await restRepo.findOne({ where: { name: r.name, destination: { id: dest.id } } });
      if (!exists) {
        const rest = restRepo.create({
          name: r.name,
          restaurantType: r.type,
          kashrutLevel: r.kashrut,
          address: r.address,
          openingHours: r.hours,
          location: { type: 'Point', coordinates: [data.lng, data.lat] },
          destination: dest,
        });
        await restRepo.save(rest);
        console.log(`      ➕  Restaurant: ${r.name}`);
        newRest++;
      } else {
        console.log(`      ⏭️   Restaurant already exists: ${r.name}`);
      }
    }
  }

  // ── Seed sample minyans (first 3 destinations only) ──
  const MINYAN_SAMPLES = [
    { prayerType: 'shacharit', dayOffset: 1, time: '08:00', locationText: 'Main synagogue, ground floor' },
    { prayerType: 'mincha',    dayOffset: 1, time: '18:30', locationText: 'Hotel lobby minyan' },
    { prayerType: 'maariv',    dayOffset: 2, time: '20:00', locationText: 'Chabad house' },
    { prayerType: 'shacharit', dayOffset: 3, time: '07:30', locationText: 'Community centre, room 2', notes: 'Nusach Ashkenaz' },
    { prayerType: 'musaf',     dayOffset: 5, time: '09:30', locationText: 'Great Synagogue', notes: 'Shabbat minyan — Nusach Sfarad' },
  ];

  let newMinyan = 0;
  const destNames = ['Tel Aviv', 'Paris', 'New York'];
  for (const cityName of destNames) {
    const dest = await destRepo.findOne({ where: { city: cityName } });
    if (!dest) continue;
    for (const m of MINYAN_SAMPLES) {
      const date = futureDate(m.dayOffset);
      const exists = await minyanRepo.findOne({
        where: { prayerType: m.prayerType, date, destination: { id: dest.id } },
      });
      if (!exists) {
        const minyan = minyanRepo.create({
          prayerType: m.prayerType,
          date,
          time: m.time,
          locationText: m.locationText,
          notes: m.notes,
          participantsCount: 1,
          destination: dest,
        });
        await minyanRepo.save(minyan);
        console.log(`      ➕  Minyan: ${m.prayerType} @ ${cityName} on ${date}`);
        newMinyan++;
      }
    }
  }

  // ── Seed 1000 demo users (req 10.2) ──────────────────────────────────────────
  const existingCount = await userRepo.count();
  const TARGET_USERS = 1000;

  if (existingCount < TARGET_USERS) {
    const toCreate = TARGET_USERS - existingCount;
    console.log(`\n👤  Creating ${toCreate} demo users (current: ${existingCount})…`);

    const FIRST_NAMES = ['Aaron', 'Avraham', 'Benjamin', 'Daniel', 'David', 'Eliyahu', 'Ezra',
      'Gideon', 'Hannah', 'Isaac', 'Jacob', 'Joshua', 'Leah', 'Levi', 'Miriam',
      'Moshe', 'Naomi', 'Noah', 'Rachel', 'Rebecca', 'Ruth', 'Samuel', 'Sarah',
      'Shimon', 'Shlomo', 'Tamar', 'Yosef', 'Yitzhak', 'Zahava', 'Ziva'];
    const LAST_NAMES = ['Cohen', 'Levi', 'Katz', 'Shapiro', 'Goldstein', 'Friedman',
      'Silverstein', 'Rosenberg', 'Blum', 'Klein', 'Weiss', 'Schwartz',
      'Horowitz', 'Greenberg', 'Berkowitz', 'Stern', 'Feldman', 'Rubin',
      'Kaufman', 'Adler', 'Bernstein', 'Marcus', 'Jacobs', 'Rosen', 'Gluck'];

    const passwordHash = await bcrypt.hash('Demo1234!', 10);
    const BATCH = 50;
    let created = 0;

    for (let i = 0; i < toCreate; i += BATCH) {
      const batch: User[] = [];
      for (let j = 0; j < BATCH && i + j < toCreate; j++) {
        const idx = existingCount + i + j + 1;
        const fn = FIRST_NAMES[(i + j) % FIRST_NAMES.length];
        const ln = LAST_NAMES[(i + j) % LAST_NAMES.length];
        batch.push(
          userRepo.create({
            email: `demo.user${idx}@jewishontheway.test`,
            passwordHash,
            firstName: fn,
            lastName: ln,
          }),
        );
      }
      await userRepo.save(batch);
      created += batch.length;
      process.stdout.write(`\r  Created ${created}/${toCreate} users…`);
    }
    console.log(`\n✅  ${created} demo users created`);
  } else {
    console.log(`\n⏭️   Already have ${existingCount} users — skipping user seed`);
  }

  console.log(`\n✅  Done — ${newDest} destinations, ${newRest} restaurants, ${newMinyan} minyans added`);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
