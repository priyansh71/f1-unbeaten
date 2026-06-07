export interface Circuit {
  circuitId: string;
  circuitName: string;
  locality: string;
  country: string;
  wikiUrl?: string;
  imageUrl?: string | null;
  layoutUrl?: string | null;
}

export interface Race {
  season: string;
  round: string;
  raceName: string;
  date: string;
  Circuit: Circuit & {
    url?: string;
    Location: {
      locality: string;
      country: string;
    };
  };
}

export interface Driver {
  driverId: string;
  code: string;
  givenName: string;
  familyName: string;
  nationality: string;
  permanentNumber?: string;
  url?: string;
  imageUrl?: string | null;
}

export interface Constructor {
  constructorId: string;
  name: string;
  nationality: string;
  url?: string;
  imageUrl?: string | null;
}

export interface DriverStanding {
  position: string;
  points: string;
  wins: string;
  Driver: Driver;
  Constructors: Constructor[];
}

export interface ConstructorStanding {
  position: string;
  points: string;
  wins: string;
  Constructor: Constructor;
}

export interface DriverOption {
  driver: Driver;
  originSeason: number;
  careerWins: number;
  imageUrl: string | null;
}

export interface ConstructorOption {
  constructor: Constructor;
  originSeason: number;
  careerWins: number;
  imageUrl: string | null;
}

export interface FantasyPool {
  drivers: DriverOption[];
  constructors: ConstructorOption[];
}

export interface GridEntry {
  driverId: string;
  driver: Driver;
  constructorId: string;
  constructor: Constructor;
  rating: number;
  isUserDriver: boolean;
  isUserConstructor: boolean;
}

export interface RaceResult {
  position: number;
  driverId: string;
  driver: Driver;
  constructorId: string;
  constructor: Constructor;
  points: number;
  status: 'Finished' | 'DNF';
  isUserDriver: boolean;
}

export interface SimulatedRace {
  round: number;
  raceName: string;
  circuit: Circuit;
  results: RaceResult[];
}

export interface ChampionshipStanding {
  driverId?: string;
  constructorId?: string;
  name: string;
  points: number;
  wins: number;
  isUser: boolean;
}

export type GamePhase =
  | 'home'
  | 'calendar'
  | 'build'
  | 'simulate'
  | 'results'
  | 'leaderboard'
  | 'profile';

export interface UserTeam {
  constructor: Constructor;
  drivers: [Driver, Driver];
}

export interface SeasonData {
  season: number;
  races: Race[];
  fantasyPool: FantasyPool;
  actualDriverChampion?: Driver;
  actualConstructorChampion?: Constructor;
}
