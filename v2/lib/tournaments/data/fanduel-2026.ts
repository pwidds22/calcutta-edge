/** Raw American odds from FanDuel for March Madness 2026.
 *  Data will be devigged by a separate pipeline — stored raw here.
 */

export interface FDRawBinaryOdds {
  yes: number;
  no: number | null;
}

export const FANDUEL_2026 = {
  updatedAt: '2026-03-17T18:09:00Z',

  // ── Reach Sweet 16: YES/NO binary pairs ──────────────────────────────
  s16: {
    1:  { yes: -700,   no: 570    }, // Duke
    17: { yes: -1000,  no: 760    }, // Arizona
    51: { yes: -750,   no: 590    }, // Michigan
    34: { yes: -475,   no: 390    }, // Florida
    15: { yes: -240,   no: 198    }, // Connecticut
    32: { yes: -300,   no: 240    }, // Purdue
    67: { yes: -340,   no: 280    }, // Iowa State
    49: { yes: -425,   no: 350    }, // Houston
    11: { yes: -155,   no: 128    }, // Michigan State
    28: { yes: -180,   no: 148    }, // Gonzaga
    63: { yes: -140,   no: 112    }, // Virginia
    45: { yes: -400,   no: 330    }, // Illinois
    7:  { yes: -110,   no: -115   }, // Kansas
    23: { yes: -155,   no: 128    }, // Arkansas
    58: { yes: -120,   no: -105   }, // Alabama
    41: { yes: 115,    no: -144   }, // Nebraska
    5:  { yes: 100,    no: -130   }, // St. John's
    21: { yes: 145,    no: -188   }, // Wisconsin
    56: { yes: 140,    no: -176   }, // Texas Tech
    39: { yes: -120,   no: -106   }, // Vanderbilt
    9:  { yes: 200,    no: -265   }, // Louisville
    25: { yes: 330,    no: -450   }, // BYU
    60: { yes: 155,    no: -194   }, // Tennessee
    43: { yes: 550,    no: -900   }, // North Carolina
    13: { yes: 270,    no: -375   }, // UCLA
    30: { yes: 470,    no: -700   }, // Miami (Fla.)
    65: { yes: 430,    no: -620   }, // Kentucky
    47: { yes: 550,    no: -900   }, // Saint Mary's
    3:  { yes: 900,    no: -1800  }, // Ohio State
    19: { yes: 2000,   no: -5000  }, // Villanova
    54: { yes: 1000,   no: -2200  }, // Georgia
    37: { yes: 1100,   no: -2500  }, // Clemson
    4:  { yes: 1700,   no: -4500  }, // TCU
    20: { yes: 1300,   no: -3000  }, // Utah State
    55: { yes: 1700,   no: -4500  }, // Saint Louis
    38: { yes: 650,    no: -1100  }, // Iowa
    14: { yes: 1200,   no: -3000  }, // UCF
    31: { yes: 700,    no: -1250  }, // Missouri
    66: { yes: 1100,   no: -2200  }, // Santa Clara
    48: { yes: 1200,   no: -3000  }, // Texas A&M
    10: { yes: 750,    no: -1400  }, // South Florida
    27: { yes: 950,    no: -2000  }, // NC State
    26: { yes: 950,    no: -2000  }, // Texas
    62: { yes: 10000,  no: null   }, // Miami (OH)
    61: { yes: 1100,   no: -2500  }, // SMU
    44: { yes: 1000,   no: -2000  }, // VCU
    6:  { yes: 2200,   no: -6000  }, // Northern Iowa
    22: { yes: 2700,   no: -8000  }, // High Point
    57: { yes: 1100,   no: -2500  }, // Akron
    40: { yes: 2000,   no: -6000  }, // McNeese
    8:  { yes: 4500,   no: -20000 }, // California Baptist
    24: { yes: 5000,   no: -20000 }, // Hawaii
    59: { yes: 2700,   no: -8000  }, // Hofstra
    42: { yes: 4500,   no: -20000 }, // Troy
    12: { yes: 7000,   no: null   }, // North Dakota State
    29: { yes: 15000,  no: null   }, // Kennesaw State
    64: { yes: 12500,  no: null   }, // Wright State
    46: { yes: 20000,  no: null   }, // Pennsylvania
    16: { yes: 12500,  no: null   }, // Furman
    33: { yes: 20000,  no: null   }, // Queens
    68: { yes: 20000,  no: null   }, // Tennessee State
    50: { yes: 20000,  no: null   }, // Idaho
    2:  { yes: 20000,  no: null   }, // Siena
    18: { yes: 20000,  no: null   }, // Long Island
    53: { yes: 20000,  no: null   }, // Howard
    52: { yes: 20000,  no: null   }, // UMBC
    36: { yes: 20000,  no: null   }, // Lehigh
    35: { yes: 20000,  no: null   }, // Prairie View
  } as Record<number, FDRawBinaryOdds>,

  // ── Reach Elite 8: YES/NO binary pairs ───────────────────────────────
  e8: {
    1:  { yes: -250,   no: 205    }, // Duke
    17: { yes: -270,   no: 220    }, // Arizona
    51: { yes: -300,   no: 245    }, // Michigan
    34: { yes: -170,   no: 140    }, // Florida
    15: { yes: 135,    no: -170   }, // Connecticut
    32: { yes: 110,    no: -140   }, // Purdue
    67: { yes: -110,   no: -112   }, // Iowa State
    49: { yes: -120,   no: -106   }, // Houston
    11: { yes: 200,    no: -265   }, // Michigan State
    28: { yes: 200,    no: -265   }, // Gonzaga
    63: { yes: 290,    no: -400   }, // Virginia
    45: { yes: 155,    no: -194   }, // Illinois
    7:  { yes: 600,    no: -1000  }, // Kansas
    23: { yes: 470,    no: -700   }, // Arkansas
    58: { yes: 650,    no: -1100  }, // Alabama
    41: { yes: 600,    no: -950   }, // Nebraska
    5:  { yes: 600,    no: -1000  }, // St. John's
    21: { yes: 850,    no: -1600  }, // Wisconsin
    56: { yes: 950,    no: -2000  }, // Texas Tech
    39: { yes: 420,    no: -600   }, // Vanderbilt
    9:  { yes: 550,    no: -900   }, // Louisville
    25: { yes: 950,    no: -2000  }, // BYU
    60: { yes: 500,    no: -750   }, // Tennessee
    43: { yes: 2500,   no: -8000  }, // North Carolina
    13: { yes: 700,    no: -1250  }, // UCLA
    30: { yes: 1200,   no: -3000  }, // Miami (Fla.)
    65: { yes: 1000,   no: -2200  }, // Kentucky
    47: { yes: 1500,   no: -4500  }, // Saint Mary's
    3:  { yes: 2000,   no: -6000  }, // Ohio State
    19: { yes: 5500,   no: null   }, // Villanova
    54: { yes: 2000,   no: -6000  }, // Georgia
    37: { yes: 2700,   no: -8000  }, // Clemson
    4:  { yes: 4000,   no: -20000 }, // TCU
    20: { yes: 3300,   no: -10000 }, // Utah State
    55: { yes: 3500,   no: -10000 }, // Saint Louis
    38: { yes: 1400,   no: -3500  }, // Iowa
    14: { yes: 3500,   no: -10000 }, // UCF
    31: { yes: 1900,   no: -5000  }, // Missouri
    66: { yes: 3300,   no: -10000 }, // Santa Clara
    48: { yes: 3500,   no: -10000 }, // Texas A&M
    10: { yes: 2200,   no: -8000  }, // South Florida
    27: { yes: 2500,   no: -8000  }, // NC State
    26: { yes: 2700,   no: -8000  }, // Texas
    62: { yes: 30000,  no: null   }, // Miami (OH)
    61: { yes: 4000,   no: -10000 }, // SMU
    44: { yes: 4500,   no: -20000 }, // VCU
    6:  { yes: 22500,  no: null   }, // Northern Iowa
    22: { yes: 22500,  no: null   }, // High Point
    57: { yes: 8000,   no: null   }, // Akron
    40: { yes: 17500,  no: null   }, // McNeese
    8:  { yes: 30000,  no: null   }, // California Baptist
    24: { yes: 30000,  no: null   }, // Hawaii
    59: { yes: 25000,  no: null   }, // Hofstra
    42: { yes: 30000,  no: null   }, // Troy
    12: { yes: 30000,  no: null   }, // North Dakota State
    29: { yes: 30000,  no: null   }, // Kennesaw State
    64: { yes: 30000,  no: null   }, // Wright State
    46: { yes: 30000,  no: null   }, // Pennsylvania
    16: { yes: 30000,  no: null   }, // Furman
    33: { yes: 30000,  no: null   }, // Queens
    68: { yes: 30000,  no: null   }, // Tennessee State
    50: { yes: 30000,  no: null   }, // Idaho
    2:  { yes: 30000,  no: null   }, // Siena
    18: { yes: 30000,  no: null   }, // Long Island
    53: { yes: 30000,  no: null   }, // Howard
    52: { yes: 30000,  no: null   }, // UMBC
    36: { yes: 30000,  no: null   }, // Lehigh
    35: { yes: 30000,  no: null   }, // Prairie View
  } as Record<number, FDRawBinaryOdds>,

  // ── Reach Final 4: YES/NO binary pairs ───────────────────────────────
  f4: {
    1:  { yes: -135,   no: 106    }, // Duke
    17: { yes: -135,   no: 110    }, // Arizona
    51: { yes: -130,   no: 102    }, // Michigan
    34: { yes: 170,    no: -215   }, // Florida
    15: { yes: 500,    no: -800   }, // Connecticut
    32: { yes: 460,    no: -700   }, // Purdue
    67: { yes: 320,    no: -450   }, // Iowa State
    49: { yes: 210,    no: -280   }, // Houston
    11: { yes: 800,    no: -1600  }, // Michigan State
    28: { yes: 850,    no: -1600  }, // Gonzaga
    63: { yes: 1000,   no: -2200  }, // Virginia
    45: { yes: 390,    no: -550   }, // Illinois
    7:  { yes: 1300,   no: -3000  }, // Kansas
    23: { yes: 900,    no: -1800  }, // Arkansas
    58: { yes: 1600,   no: -4500  }, // Alabama
    41: { yes: 1800,   no: -4500  }, // Nebraska
    5:  { yes: 1200,   no: -3000  }, // St. John's
    21: { yes: 1700,   no: -4500  }, // Wisconsin
    56: { yes: 2500,   no: -8000  }, // Texas Tech
    39: { yes: 1100,   no: -3000  }, // Vanderbilt
    9:  { yes: 2000,   no: -6000  }, // Louisville
    25: { yes: 3500,   no: -10000 }, // BYU
    60: { yes: 1700,   no: -4500  }, // Tennessee
    43: { yes: 8000,   no: null   }, // North Carolina
    13: { yes: 2700,   no: -10000 }, // UCLA
    30: { yes: 4500,   no: -20000 }, // Miami (Fla.)
    65: { yes: 3500,   no: -10000 }, // Kentucky
    47: { yes: 4500,   no: -20000 }, // Saint Mary's
    3:  { yes: 4000,   no: -20000 }, // Ohio State
    19: { yes: 15000,  no: null   }, // Villanova
    54: { yes: 5000,   no: -20000 }, // Georgia
    37: { yes: 8000,   no: null   }, // Clemson
    4:  { yes: 10000,  no: null   }, // TCU
    20: { yes: 8000,   no: null   }, // Utah State
    55: { yes: 10000,  no: null   }, // Saint Louis
    38: { yes: 4000,   no: -20000 }, // Iowa
    14: { yes: 20000,  no: null   }, // UCF
    31: { yes: 10000,  no: null   }, // Missouri
    66: { yes: 15000,  no: null   }, // Santa Clara
    48: { yes: 12500,  no: null   }, // Texas A&M
    10: { yes: 12500,  no: null   }, // South Florida
    27: { yes: 10000,  no: null   }, // NC State
    26: { yes: 10000,  no: null   }, // Texas
    62: { yes: 50000,  no: null   }, // Miami (OH)
    61: { yes: 15000,  no: null   }, // SMU
    44: { yes: 15000,  no: null   }, // VCU
    6:  { yes: 50000,  no: null   }, // Northern Iowa
    22: { yes: 50000,  no: null   }, // High Point
    57: { yes: 30000,  no: null   }, // Akron
    40: { yes: 50000,  no: null   }, // McNeese
    8:  { yes: 50000,  no: null   }, // California Baptist
    24: { yes: 50000,  no: null   }, // Hawaii
    59: { yes: 50000,  no: null   }, // Hofstra
    42: { yes: 50000,  no: null   }, // Troy
    12: { yes: 50000,  no: null   }, // North Dakota State
    29: { yes: 50000,  no: null   }, // Kennesaw State
    64: { yes: 50000,  no: null   }, // Wright State
    46: { yes: 50000,  no: null   }, // Pennsylvania
    16: { yes: 50000,  no: null   }, // Furman
    33: { yes: 50000,  no: null   }, // Queens
    68: { yes: 50000,  no: null   }, // Tennessee State
    50: { yes: 50000,  no: null   }, // Idaho
    2:  { yes: 50000,  no: null   }, // Siena
    18: { yes: 50000,  no: null   }, // Long Island
    53: { yes: 50000,  no: null   }, // Howard
    52: { yes: 50000,  no: null   }, // UMBC
    36: { yes: 50000,  no: null   }, // Lehigh
    35: { yes: 50000,  no: null   }, // Prairie View
  } as Record<number, FDRawBinaryOdds>,

  // ── Reach Championship (f2): YES only, American odds ─────────────────
  f2: {
    1:  175,     // Duke
    17: 180,     // Arizona
    51: 185,     // Michigan
    34: 380,     // Florida
    15: 1400,    // Connecticut
    32: 1200,    // Purdue
    67: 750,     // Iowa State
    49: 480,     // Houston
    11: 2200,    // Michigan State
    28: 2200,    // Gonzaga
    63: 2700,    // Virginia
    45: 950,     // Illinois
    7:  3300,    // Kansas
    23: 2500,    // Arkansas
    58: 4000,    // Alabama
    41: 5000,    // Nebraska
    5:  3300,    // St. John's
    21: 4500,    // Wisconsin
    56: 6500,    // Texas Tech
    39: 3000,    // Vanderbilt
    9:  5500,    // Louisville
    25: 12500,   // BYU
    60: 4500,    // Tennessee
    43: 30000,   // North Carolina
    13: 8000,    // UCLA
    30: 15000,   // Miami (Fla.)
    65: 10000,   // Kentucky
    47: 12500,   // Saint Mary's
    3:  10000,   // Ohio State
    19: 75000,   // Villanova
    54: 12500,   // Georgia
    37: 25000,   // Clemson
    4:  25000,   // TCU
    20: 22500,   // Utah State
    55: 60000,   // Saint Louis
    38: 10000,   // Iowa
    14: 75000,   // UCF
    31: 40000,   // Missouri
    66: 70000,   // Santa Clara
    48: 50000,   // Texas A&M
    10: 40000,   // South Florida
    27: 35000,   // NC State
    26: 40000,   // Texas
    62: 75000,   // Miami (OH)
    61: 50000,   // SMU
    44: 75000,   // VCU
    6:  75000,   // Northern Iowa
    22: 75000,   // High Point
    57: 75000,   // Akron
    40: 75000,   // McNeese
    8:  75000,   // California Baptist
    24: 75000,   // Hawaii
    59: 75000,   // Hofstra
    42: 75000,   // Troy
    12: 75000,   // North Dakota State
    29: 75000,   // Kennesaw State
    64: 75000,   // Wright State
    46: 75000,   // Pennsylvania
    16: 75000,   // Furman
    33: 75000,   // Queens
    68: 75000,   // Tennessee State
    50: 75000,   // Idaho
    2:  75000,   // Siena
    18: 75000,   // Long Island
    53: 75000,   // Howard
    52: 75000,   // UMBC
    36: 75000,   // Lehigh
    35: 75000,   // Prairie View
  } as Record<number, number>,

  // ── National Champion: YES only, American odds ───────────────────────
  champ: {
    1:  370,     // Duke
    17: 360,     // Arizona
    51: 360,     // Michigan
    34: 800,     // Florida
    15: 3500,    // Connecticut
    32: 2700,    // Purdue
    67: 1600,    // Iowa State
    49: 1000,    // Houston
    11: 6000,    // Michigan State
    28: 6000,    // Gonzaga
    63: 6500,    // Virginia
    45: 2200,    // Illinois
    7:  10000,   // Kansas
    23: 6500,    // Arkansas
    58: 10000,   // Alabama
    41: 15000,   // Nebraska
    5:  8000,    // St. John's
    21: 12500,   // Wisconsin
    56: 15000,   // Texas Tech
    39: 8000,    // Vanderbilt
    9:  15000,   // Louisville
    25: 40000,   // BYU
    60: 10000,   // Tennessee
    43: 100000,  // North Carolina
    13: 25000,   // UCLA
    30: 70000,   // Miami (Fla.)
    65: 30000,   // Kentucky
    47: 40000,   // Saint Mary's
    3:  40000,   // Ohio State
    19: 100000,  // Villanova
    54: 40000,   // Georgia
    37: 100000,  // Clemson
    4:  100000,  // TCU
    20: 100000,  // Utah State
    55: 100000,  // Saint Louis
    38: 35000,   // Iowa
    14: 100000,  // UCF
    31: 100000,  // Missouri
    66: 100000,  // Santa Clara
    48: 100000,  // Texas A&M
    10: 100000,  // South Florida
    27: 100000,  // NC State
    26: 100000,  // Texas
    62: 100000,  // Miami (OH)
    61: 100000,  // SMU
    44: 100000,  // VCU
    6:  100000,  // Northern Iowa
    22: 100000,  // High Point
    57: 100000,  // Akron
    40: 100000,  // McNeese
    8:  100000,  // California Baptist
    24: 100000,  // Hawaii
    59: 100000,  // Hofstra
    42: 100000,  // Troy
    12: 100000,  // North Dakota State
    29: 100000,  // Kennesaw State
    64: 100000,  // Wright State
    46: 100000,  // Pennsylvania
    16: 100000,  // Furman
    33: 100000,  // Queens
    68: 100000,  // Tennessee State
    50: 100000,  // Idaho
    2:  100000,  // Siena
    18: 100000,  // Long Island
    53: 100000,  // Howard
    52: 100000,  // UMBC
    36: 100000,  // Lehigh
    35: 100000,  // Prairie View
  } as Record<number, number>,

  // ── R64 Matchup Moneylines (for R32 probability) ────────────────────
  r32Matchups: [
    { teamAId: 4,  teamAOdds: 132,    teamBId: 3,  teamBOdds: -160   }, // TCU vs Ohio State
    { teamAId: 42, teamAOdds: 740,    teamBId: 41, teamBOdds: -1250  }, // Troy vs Nebraska
    { teamAId: 10, teamAOdds: 188,    teamBId: 9,  teamBOdds: -230   }, // South Florida vs Louisville
    { teamAId: 22, teamAOdds: 390,    teamBId: 21, teamBOdds: -530   }, // High Point vs Wisconsin
    { teamAId: 2,  teamAOdds: 6500,   teamBId: 1,  teamBOdds: -100000 }, // Siena vs Duke
    { teamAId: 40, teamAOdds: 520,    teamBId: 39, teamBOdds: -750   }, // McNeese vs Vanderbilt
    { teamAId: 12, teamAOdds: 1100,   teamBId: 11, teamBOdds: -2500  }, // North Dakota State vs Michigan State
    { teamAId: 24, teamAOdds: 890,    teamBId: 23, teamBOdds: -1700  }, // Hawaii vs Arkansas
    { teamAId: 44, teamAOdds: 116,    teamBId: 43, teamBOdds: -140   }, // VCU vs North Carolina
    { teamAId: 48, teamAOdds: 140,    teamBId: 47, teamBOdds: -170   }, // Texas A&M vs Saint Mary's
    { teamAId: 46, teamAOdds: 3000,   teamBId: 45, teamBOdds: -10000 }, // Pennsylvania vs Illinois
    { teamAId: 55, teamAOdds: 115,    teamBId: 54, teamBOdds: -138   }, // Saint Louis vs Georgia
    { teamAId: 29, teamAOdds: 1600,   teamBId: 28, teamBOdds: -4500  }, // Kennesaw State vs Gonzaga
    { teamAId: 50, teamAOdds: 3000,   teamBId: 49, teamBOdds: -10000 }, // Idaho vs Houston
    { teamAId: 66, teamAOdds: 134,    teamBId: 65, teamBOdds: -162   }, // Santa Clara vs Kentucky
    { teamAId: 57, teamAOdds: 280,    teamBId: 56, teamBOdds: -360   }, // Akron vs Texas Tech
    { teamAId: 18, teamAOdds: 8000,   teamBId: 17, teamBOdds: -100000 }, // Long Island vs Arizona
    { teamAId: 64, teamAOdds: 1400,   teamBId: 63, teamBOdds: -4000  }, // Wright State vs Virginia
    { teamAId: 68, teamAOdds: 3500,   teamBId: 67, teamBOdds: -20000 }, // Tennessee State vs Iowa State
    { teamAId: 59, teamAOdds: 580,    teamBId: 58, teamBOdds: -850   }, // Hofstra vs Alabama
    { teamAId: 20, teamAOdds: -140,   teamBId: 19, teamBOdds: 116    }, // Utah State vs Villanova
    { teamAId: 38, teamAOdds: -142,   teamBId: 37, teamBOdds: 118    }, // Iowa vs Clemson
    { teamAId: 6,  teamAOdds: 460,    teamBId: 5,  teamBOdds: -650   }, // Northern Iowa vs St. John's
    { teamAId: 14, teamAOdds: 205,    teamBId: 13, teamBOdds: -255   }, // UCF vs UCLA
    { teamAId: 33, teamAOdds: 3500,   teamBId: 32, teamBOdds: -20000 }, // Queens vs Purdue
    { teamAId: 8,  teamAOdds: 890,    teamBId: 7,  teamBOdds: -1700  }, // California Baptist vs Kansas
    { teamAId: 16, teamAOdds: 2000,   teamBId: 15, teamBOdds: -7000  }, // Furman vs Connecticut
    { teamAId: 31, teamAOdds: 110,    teamBId: 30, teamBOdds: -132   }, // Missouri vs Miami (Fla.)
    { teamAId: 52, teamAOdds: -118,   teamBId: 53, teamBOdds: -102   }, // UMBC vs Howard (play-in)
    { teamAId: 35, teamAOdds: 146,    teamBId: 36, teamBOdds: -178   }, // Prairie View vs Lehigh (play-in)
    { teamAId: 26, teamAOdds: -111,   teamBId: 27, teamBOdds: -108   }, // Texas vs NC State (play-in)
    { teamAId: 62, teamAOdds: 245,    teamBId: 61, teamBOdds: -310   }, // Miami (OH) vs SMU (play-in)
  ],
};
