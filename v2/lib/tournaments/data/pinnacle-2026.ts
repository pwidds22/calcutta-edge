/**
 * Raw American odds from Pinnacle for March Madness 2026.
 *
 * Team ID reference (matches march-madness-2026 config):
 *   17=Arizona, 1=Duke, 51=Michigan, 34=Florida, 49=Houston, 67=Iowa State,
 *   32=Purdue, 45=Illinois, 15=Connecticut, 28=Gonzaga, 5=St.John's,
 *   23=Arkansas, 39=Vanderbilt, 11=Michigan State, 21=Wisconsin, 63=Virginia,
 *   60=Tennessee, 9=Louisville, 58=Alabama, 13=UCLA, 7=Kansas, 56=Texas Tech,
 *   65=Kentucky, 3=Ohio State, 25=BYU, 41=Nebraska, 54=Georgia, 38=Iowa,
 *   47=Saint Mary's, 43=North Carolina, 4=TCU, 31=Missouri, 37=Clemson,
 *   20=Utah State, 30=Miami (Fla.), 66=Santa Clara, 10=South Florida,
 *   26=Texas, 19=Villanova, 44=VCU, 48=Texas A&M, 6=Northern Iowa,
 *   55=Saint Louis, 61=SMU, 27=NC State, 18=Long Island, 68=Tennessee State,
 *   24=Hawaii, 22=High Point, 33=Queens, 12=North Dakota State,
 *   8=California Baptist, 29=Kennesaw State, 40=McNeese, 46=Penn,
 *   64=Wright State, 2=Siena, 50=Idaho, 59=Hofstra, 16=Furman, 14=UCF,
 *   42=Troy, 57=Akron, 35=Prairie View, 52=UMBC, 53=Howard, 36=Lehigh,
 *   62=Miami (OH)
 */

export interface PinnacleS16Odds {
  yes: number;
  no: number;
}

export const PINNACLE_2026 = {
  updatedAt: '2026-03-18T12:00:00Z',

  // ── Tournament Winner — outright futures (American odds) ──────────────
  champ: {
    1: +399,      // Duke
    17: +429,     // Arizona
    51: +432,     // Michigan
    34: +764,     // Florida
    49: +1008,    // Houston
    67: +2054,    // Iowa State
    45: +2419,    // Illinois
    32: +2392,    // Purdue
    15: +2981,    // Connecticut
    11: +5537,    // Michigan State
    28: +4939,    // Gonzaga
    63: +6729,    // Virginia
    7: +8242,     // Kansas
    23: +3765,    // Arkansas
    41: +12803,   // Nebraska
    58: +12803,   // Alabama
    5: +5159,     // St. John's
    21: +10042,   // Wisconsin
    39: +6470,    // Vanderbilt
    56: +15948,   // Texas Tech
    9: +14812,    // Louisville
    25: +19095,   // BYU
    43: +19095,   // North Carolina
    60: +12803,   // Tennessee
    13: +19095,   // UCLA
    30: +25343,   // Miami (Fla.)
    47: +37777,   // Saint Mary's
    65: +17475,   // Kentucky
    3: +25343,    // Ohio State
    19: +43963,   // Villanova
    37: +43963,   // Clemson
    54: +50136,   // Georgia
    4: +50136,    // TCU
    20: +36707,   // Utah State
    38: +25343,   // Iowa
    55: +43963,   // Saint Louis
    14: +50136,   // UCF
    31: +25343,   // Missouri
    48: +25343,   // Texas A&M
    66: +50136,   // Santa Clara
    10: +62419,   // South Florida
    26: +62419,   // Texas
    27: +43963,   // NC State
    44: +37777,   // VCU
    62: +37777,   // Miami (OH)
    61: +37777,   // SMU
    6: +62419,    // Northern Iowa
    22: +62419,   // High Point
    40: +62419,   // McNeese
    57: +62419,   // Akron
    8: +62419,    // California Baptist
    24: +62419,   // Hawaii
    42: +98934,   // Troy
    59: +123005,  // Hofstra
    12: +123005,  // North Dakota State
    29: +123005,  // Kennesaw State
    46: +123005,  // Pennsylvania
    64: +123005,  // Wright State
    16: +182320,  // Furman
    33: +182320,  // Queens
    50: +182320,  // Idaho
    68: +182320,  // Tennessee State
    2: +240380,   // Siena
    18: +240380,  // Long Island
    35: +240380,  // Prairie View
    36: +240380,  // Lehigh
    52: +240380,  // UMBC
    53: +240380,  // Howard
  } as Record<number, number>,

  // ── Region Winner = Final Four probability — devig per-region ─────────
  f4Regions: {
    East: {
      1: -121,      // Duke
      15: +624,     // Connecticut
      11: +778,     // Michigan State
      7: +1347,     // Kansas
      5: +1002,     // St. John's
      9: +1450,     // Louisville
      13: +2585,    // UCLA
      3: +3616,     // Ohio State
      4: +8252,     // TCU
      14: +9944,    // UCF
      10: +10096,   // South Florida
      6: +20593,    // Northern Iowa
      8: +30865,    // California Baptist
      12: +30865,   // North Dakota State
      16: +30865,   // Furman
      2: +51382,    // Siena
    } as Record<number, number>,

    Midwest: {
      51: -106,     // Michigan
      67: +311,     // Iowa State
      63: +851,     // Virginia
      58: +1275,    // Alabama
      56: +2091,    // Texas Tech
      60: +1710,    // Tennessee
      65: +3693,    // Kentucky
      54: +4745,    // Georgia
      55: +10514,   // Saint Louis
      66: +15752,   // Santa Clara
      62: +31431,   // Miami (OH)
      61: +13134,   // SMU
      57: +20983,   // Akron
      59: +31431,   // Hofstra
      64: +31431,   // Wright State
      68: +52286,   // Tennessee State
      53: +52286,   // Howard
      52: +52286,   // UMBC
    } as Record<number, number>,

    South: {
      34: +190,     // Florida
      49: +228,     // Houston
      45: +340,     // Illinois
      41: +1400,    // Nebraska
      39: +900,     // Vanderbilt
      43: +5034,    // North Carolina
      47: +5494,    // Saint Mary's
      37: +8053,    // Clemson
      38: +3000,    // Iowa
      48: +7550,    // Texas A&M
      44: +12581,   // VCU
      40: +30183,   // McNeese
      42: +30183,   // Troy
      46: +30183,   // Penn
      50: +50293,   // Idaho
      35: +50293,   // Prairie View
      36: +50293,   // Lehigh
    } as Record<number, number>,

    West: {
      17: -150,     // Arizona
      32: +407,     // Purdue
      28: +584,     // Gonzaga
      23: +1063,    // Arkansas
      21: +1722,    // Wisconsin
      25: +5665,    // BYU
      30: +4279,    // Miami (Fla.)
      19: +8471,    // Villanova
      20: +6790,    // Utah State
      31: +11269,   // Missouri
      26: +11269,   // Texas
      27: +11269,   // NC State
      22: +27974,   // High Point
      24: +33520,   // Hawaii
      29: +33520,   // Kennesaw State
      33: +44584,   // Queens
      18: +44584,   // Long Island
    } as Record<number, number>,
  },

  // ── Reach Sweet 16 — YES/NO binary pairs ──────────────────────────────
  s16: {
    17: { yes: -1107, no: +667 },   // Arizona
    23: { yes: -141, no: +116 },     // Arkansas
    25: { yes: +301, no: -395 },     // BYU
    15: { yes: -219, no: +177 },     // Connecticut
    1: { yes: -650, no: +534 },      // Duke
    34: { yes: -475, no: +351 },     // Florida
    28: { yes: -175, no: +143 },     // Gonzaga
    49: { yes: -384, no: +293 },     // Houston
    45: { yes: -390, no: +297 },     // Illinois
    67: { yes: -385, no: +294 },     // Iowa State
    7: { yes: -104, no: -117 },      // Kansas
    65: { yes: +408, no: -570 },     // Kentucky
    9: { yes: +204, no: -255 },      // Louisville
    30: { yes: +431, no: -610 },     // Miami (Fla.)
    11: { yes: -145, no: +119 },     // Michigan State
    51: { yes: -807, no: +533 },     // Michigan
    41: { yes: +117, no: -142 },     // Nebraska
    43: { yes: +554, no: -850 },     // North Carolina
    32: { yes: -310, no: +243 },     // Purdue
    47: { yes: +491, no: -722 },     // Saint Mary's
    5: { yes: +106, no: -129 },      // St. John's
    60: { yes: +154, no: -189 },     // Tennessee
    56: { yes: +170, no: -210 },     // Texas Tech
    13: { yes: +266, no: -343 },     // UCLA
    39: { yes: -126, no: +104 },     // Vanderbilt
    63: { yes: -134, no: +111 },     // Virginia
    21: { yes: +158, no: -194 },     // Wisconsin
  } as Record<number, PinnacleS16Odds>,

  // ── R64 Matchup Moneylines (for R32 probability) ─────────────────────
  r32Matchups: [
    { teamAId: 4, teamAOdds: +126, teamBId: 3, teamBOdds: -142 },     // TCU vs Ohio State
    { teamAId: 42, teamAOdds: +674, teamBId: 41, teamBOdds: -899 },   // Troy vs Nebraska
    { teamAId: 10, teamAOdds: +186, teamBId: 9, teamBOdds: -212 },    // South Florida vs Louisville
    { teamAId: 22, teamAOdds: +374, teamBId: 21, teamBOdds: -450 },   // High Point vs Wisconsin
    { teamAId: 2, teamAOdds: +3332, teamBId: 1, teamBOdds: -10390 },  // Siena vs Duke
    { teamAId: 40, teamAOdds: +526, teamBId: 39, teamBOdds: -666 },   // McNeese vs Vanderbilt
    { teamAId: 12, teamAOdds: +968, teamBId: 11, teamBOdds: -1450 },  // North Dakota State vs Michigan State
    { teamAId: 24, teamAOdds: +841, teamBId: 23, teamBOdds: -1195 },  // Hawaii vs Arkansas
    { teamAId: 44, teamAOdds: +126, teamBId: 43, teamBOdds: -142 },   // VCU vs North Carolina
    { teamAId: 48, teamAOdds: +139, teamBId: 47, teamBOdds: -157 },   // Texas A&M vs Saint Mary's
    { teamAId: 46, teamAOdds: +1895, teamBId: 45, teamBOdds: -4664 }, // Penn vs Illinois
    { teamAId: 55, teamAOdds: +121, teamBId: 54, teamBOdds: -136 },   // Saint Louis vs Georgia
    { teamAId: 29, teamAOdds: +1459, teamBId: 28, teamBOdds: -2757 }, // Kennesaw State vs Gonzaga
    { teamAId: 50, teamAOdds: +1868, teamBId: 49, teamBOdds: -7999 }, // Idaho vs Houston
    { teamAId: 66, teamAOdds: +137, teamBId: 65, teamBOdds: -155 },   // Santa Clara vs Kentucky
    { teamAId: 57, teamAOdds: +270, teamBId: 56, teamBOdds: -315 },   // Akron vs Texas Tech
    { teamAId: 18, teamAOdds: +3632, teamBId: 17, teamBOdds: -13806 }, // Long Island vs Arizona
    { teamAId: 64, teamAOdds: +1249, teamBId: 63, teamBOdds: -2123 }, // Wright State vs Virginia
    { teamAId: 68, teamAOdds: +1915, teamBId: 67, teamBOdds: -4776 }, // Tennessee State vs Iowa State
    { teamAId: 59, teamAOdds: +568, teamBId: 58, teamBOdds: -799 },   // Hofstra vs Alabama
    { teamAId: 20, teamAOdds: -124, teamBId: 19, teamBOdds: +110 },   // Utah State vs Villanova
    { teamAId: 38, teamAOdds: -128, teamBId: 37, teamBOdds: +114 },   // Iowa vs Clemson
    { teamAId: 6, teamAOdds: +455, teamBId: 5, teamBOdds: -561 },     // Northern Iowa vs St. John's
    { teamAId: 14, teamAOdds: +208, teamBId: 13, teamBOdds: -238 },   // UCF vs UCLA
    { teamAId: 33, teamAOdds: +2437, teamBId: 32, teamBOdds: -9614 }, // Queens vs Purdue
    { teamAId: 8, teamAOdds: +767, teamBId: 7, teamBOdds: -1061 },    // California Baptist vs Kansas
    { teamAId: 16, teamAOdds: +1504, teamBId: 15, teamBOdds: -4084 }, // Furman vs Connecticut
    { teamAId: 31, teamAOdds: +110, teamBId: 30, teamBOdds: -124 },   // Missouri vs Miami (Fla.)
  ] as Array<{ teamAId: number; teamAOdds: number; teamBId: number; teamBOdds: number }>,
};
