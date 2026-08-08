// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_even_spot.sql';
import m0001 from './0001_nosy_wind_dancer.sql';
import m0002 from './0002_huge_komodo.sql';
import m0003 from './0003_chubby_leopardon.sql';
import m0004 from './0004_messy_morgan_stark.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004
    }
  }
  