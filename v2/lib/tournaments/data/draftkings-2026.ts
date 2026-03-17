/**
 * DraftKings March Madness 2026 American Odds (as of 2026-03-17)
 *
 * Raw futures odds for all 68 teams across 6 rounds.
 * These are American odds (e.g., +350 means bet $100 to win $350,
 * -165 means bet $165 to win $100).
 *
 * Teams with r32 = 0 have TBD moneylines (play-in games not yet set).
 * The devigging pipeline will fill those from Evan Miya probabilities.
 */

export interface DKTeamOdds {
  champ: number; // American odds to win championship
  f2: number;    // American odds to reach Finals
  f4: number;    // American odds to reach Final Four
  e8: number;    // American odds to reach Elite Eight
  s16: number;   // American odds to reach Sweet 16
  r32: number;   // Next Game (R64 moneyline), 0 = TBD
}

export const DRAFTKINGS_2026: {
  updatedAt: string;
  teams: Record<number, DKTeamOdds>;
} = {
  updatedAt: '2026-03-17T00:00:00Z',
  teams: {
    // (1) seeds
    1:  { champ: 350,    f2: 140,    f4: -165,   e8: -255,   s16: -600,   r32: -20000  }, // Duke
    51: { champ: 370,    f2: 155,    f4: -130,   e8: -380,   s16: -900,   r32: 0       }, // Michigan (r32 TBD)
    17: { champ: 380,    f2: 175,    f4: -120,   e8: -275,   s16: -700,   r32: -100000 }, // Arizona
    34: { champ: 750,    f2: 350,    f4: 165,    e8: -160,   s16: -450,   r32: 0       }, // Florida (r32 TBD)

    // (2) seeds
    49: { champ: 1300,   f2: 475,    f4: 250,    e8: 110,    s16: -280,   r32: -8000   }, // Houston
    67: { champ: 1800,   f2: 750,    f4: 245,    e8: -130,   s16: -400,   r32: -8000   }, // Iowa State
    32: { champ: 2500,   f2: 900,    f4: 360,    e8: 105,    s16: -330,   r32: -8000   }, // Purdue
    15: { champ: 3000,   f2: 1300,   f4: 550,    e8: 170,    s16: -200,   r32: -4500   }, // UConn

    // (3) seeds
    45: { champ: 2200,   f2: 800,    f4: 310,    e8: 120,    s16: -400,   r32: -6500   }, // Illinois
    11: { champ: 5500,   f2: 1700,   f4: 650,    e8: 200,    s16: -130,   r32: -1800   }, // Michigan State
    28: { champ: 6000,   f2: 1800,   f4: 500,    e8: 145,    s16: -250,   r32: -3200   }, // Gonzaga
    63: { champ: 7500,   f2: 3000,   f4: 1100,   e8: 310,    s16: -125,   r32: -2800   }, // Virginia

    // (4) seeds
    23: { champ: 6000,   f2: 3000,   f4: 1100,   e8: 450,    s16: -120,   r32: -1350   }, // Arkansas
    7:  { champ: 6000,   f2: 3000,   f4: 1300,   e8: 650,    s16: 125,    r32: -1200   }, // Kansas
    41: { champ: 11000,  f2: 4000,   f4: 1100,   e8: 400,    s16: -105,   r32: -1000   }, // Nebraska
    58: { champ: 18000,  f2: 6000,   f4: 2200,   e8: 750,    s16: -120,   r32: -850    }, // Alabama

    // (5) seeds
    5:  { champ: 7500,   f2: 2000,   f4: 900,    e8: 475,    s16: -105,   r32: -600    }, // St. John's
    39: { champ: 7500,   f2: 3000,   f4: 1100,   e8: 350,    s16: -110,   r32: -625    }, // Vanderbilt
    21: { champ: 10000,  f2: 3500,   f4: 1500,   e8: 550,    s16: 120,    r32: -485    }, // Wisconsin
    56: { champ: 13000,  f2: 3500,   f4: 1700,   e8: 600,    s16: 105,    r32: -325    }, // Texas Tech

    // (6) seeds
    60: { champ: 13000,  f2: 4000,   f4: 1300,   e8: 400,    s16: 130,    r32: 0       }, // Tennessee (r32 TBD)
    9:  { champ: 15000,  f2: 3000,   f4: 1200,   e8: 360,    s16: 150,    r32: -225    }, // Louisville
    43: { champ: 25000,  f2: 18000,  f4: 6000,   e8: 2000,   s16: 600,    r32: -135    }, // North Carolina
    25: { champ: 35000,  f2: 13000,  f4: 6000,   e8: 1400,   s16: 425,    r32: 0       }, // BYU (r32 TBD)

    // (7) seeds
    13: { champ: 18000,  f2: 5500,   f4: 1900,   e8: 550,    s16: 200,    r32: -250    }, // UCLA
    65: { champ: 25000,  f2: 9000,   f4: 4500,   e8: 1300,   s16: 550,    r32: -166    }, // Kentucky
    47: { champ: 30000,  f2: 7500,   f4: 3500,   e8: 1100,   s16: 360,    r32: -162    }, // Saint Mary's
    30: { champ: 50000,  f2: 12000,  f4: 5000,   e8: 1100,   s16: 400,    r32: -130    }, // Miami (Fla.)

    // (8) seeds
    3:  { champ: 25000,  f2: 6000,   f4: 2200,   e8: 1100,   s16: 550,    r32: -142    }, // Ohio State
    37: { champ: 50000,  f2: 11000,  f4: 6500,   e8: 1900,   s16: 750,    r32: 114     }, // Clemson
    19: { champ: 50000,  f2: 18000,  f4: 7500,   e8: 2500,   s16: 950,    r32: 114     }, // Villanova
    54: { champ: 50000,  f2: 20000,  f4: 6500,   e8: 2000,   s16: 900,    r32: -162    }, // Georgia

    // (9) seeds
    38: { champ: 30000,  f2: 14000,  f4: 4500,   e8: 1600,   s16: 700,    r32: -135    }, // Iowa
    4:  { champ: 50000,  f2: 35000,  f4: 12000,  e8: 4500,   s16: 1600,   r32: 120     }, // TCU
    55: { champ: 80000,  f2: 30000,  f4: 17000,  e8: 4500,   s16: 1500,   r32: 136     }, // Saint Louis
    20: { champ: 50000,  f2: 20000,  f4: 9000,   e8: 2500,   s16: 1000,   r32: -135    }, // Utah State

    // (10) seeds
    66: { champ: 50000,  f2: 20000,  f4: 7500,   e8: 1900,   s16: 800,    r32: 140     }, // Santa Clara
    26: { champ: 50000,  f2: 20000,  f4: 13000,  e8: 3500,   s16: 1200,   r32: -110    }, // Texas
    31: { champ: 50000,  f2: 25000,  f4: 13000,  e8: 3000,   s16: 950,    r32: 110     }, // Missouri
    48: { champ: 50000,  f2: 40000,  f4: 14000,  e8: 3000,   s16: 900,    r32: 136     }, // Texas A&M

    // (11) seeds
    27: { champ: 50000,  f2: 25000,  f4: 12000,  e8: 3000,   s16: 1200,   r32: -110    }, // NC State
    61: { champ: 50000,  f2: 25000,  f4: 18000,  e8: 4500,   s16: 1000,   r32: -310    }, // SMU
    44: { champ: 50000,  f2: 30000,  f4: 15000,  e8: 3500,   s16: 750,    r32: 114     }, // VCU
    10: { champ: 100000, f2: 40000,  f4: 19000,  e8: 4000,   s16: 1200,   r32: 185     }, // South Florida
    62: { champ: 150000, f2: 100000, f4: 70000,  e8: 20000,  s16: 10000,  r32: 250     }, // Miami (OH)

    // (12) seeds
    6:  { champ: 200000, f2: 35000,  f4: 25000,  e8: 6500,   s16: 1200,   r32: 440     }, // Northern Iowa
    22: { champ: 200000, f2: 60000,  f4: 40000,  e8: 15000,  s16: 3000,   r32: 370     }, // High Point
    40: { champ: 100000, f2: 40000,  f4: 30000,  e8: 7500,   s16: 2000,   r32: 455     }, // McNeese
    57: { champ: 100000, f2: 70000,  f4: 50000,  e8: 14000,  s16: 2000,   r32: 260     }, // Akron

    // (13) seeds
    24: { champ: 200000, f2: 80000,  f4: 50000,  e8: 35000,  s16: 6000,   r32: 800     }, // Hawaii
    8:  { champ: 200000, f2: 100000, f4: 80000,  e8: 25000,  s16: 2200,   r32: 750     }, // California Baptist
    59: { champ: 200000, f2: 60000,  f4: 40000,  e8: 10000,  s16: 2500,   r32: 575     }, // Hofstra
    42: { champ: 200000, f2: 80000,  f4: 50000,  e8: 30000,  s16: 5500,   r32: 650     }, // Troy

    // (14) seeds
    46: { champ: 150000, f2: 100000, f4: 70000,  e8: 40000,  s16: 11000,  r32: 2000    }, // Penn (Pennsylvania)
    12: { champ: 200000, f2: 40000,  f4: 50000,  e8: 25000,  s16: 5000,   r32: 1000    }, // North Dakota State
    29: { champ: 200000, f2: 100000, f4: 60000,  e8: 40000,  s16: 12000,  r32: 1400    }, // Kennesaw State
    14: { champ: 80000,  f2: 60000,  f4: 45000,  e8: 5000,   s16: 1400,   r32: 205     }, // UCF
    64: { champ: 200000, f2: 100000, f4: 80000,  e8: 35000,  s16: 10000,  r32: 1300    }, // Wright State

    // (15) seeds
    50: { champ: 200000, f2: 100000, f4: 60000,  e8: 40000,  s16: 9000,   r32: 2200    }, // Idaho
    33: { champ: 200000, f2: 100000, f4: 60000,  e8: 40000,  s16: 20000,  r32: 2200    }, // Queens
    16: { champ: 200000, f2: 100000, f4: 80000,  e8: 25000,  s16: 12000,  r32: 1700    }, // Furman
    68: { champ: 200000, f2: 100000, f4: 80000,  e8: 40000,  s16: 30000,  r32: 2200    }, // Tennessee State

    // (16) seeds
    18: { champ: 200000, f2: 100000, f4: 60000,  e8: 35000,  s16: 40000,  r32: 5000    }, // Long Island
    2:  { champ: 200000, f2: 100000, f4: 80000,  e8: 30000,  s16: 20000,  r32: 3500    }, // Siena
    36: { champ: 200000, f2: 100000, f4: 60000,  e8: 40000,  s16: 50000,  r32: -166    }, // Lehigh (play-in favorite)
    53: { champ: 200000, f2: 100000, f4: 80000,  e8: 35000,  s16: 20000,  r32: 102     }, // Howard (play-in vs UMBC)
    52: { champ: 200000, f2: 100000, f4: 80000,  e8: 35000,  s16: 30000,  r32: -122    }, // UMBC (play-in vs Howard)
    35: { champ: 200000, f2: 100000, f4: 80000,  e8: 40000,  s16: 50000,  r32: 140     }, // Prairie View
  },
};
