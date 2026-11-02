import type { ReactNode } from 'react';
import type { VehicleType } from '../episode/types';
import { ink } from '../character/parts/common';
import { shade } from '../lib/color';
import { DISPLAY } from '../scenes/backgrounds';

/*
 * Cars and buses that drive on and off with people inside. Drawn side-on facing right with the
 * ground at y = 0, in three layers: the glass, the passengers (clipped to the cabin), then the
 * body with its windows cut out, so heads show through the windows.
 */

export interface VehicleDef {
  id: VehicleType;
  name: string;
  /** One line for the LLM. */
  desc: string;
  defaultColor: string;
  /** Length, for driving on from off stage. */
  w: number;
  wheels: number[];
  wheelR: number;
  /** Passenger head positions, front seat (the driver) first. */
  slots: number[];
  /** Height of the passengers' heads. */
  headY: number;
  /** Where people get in and out. */
  door: number;
  /** The cabin, inside which passengers show. */
  cabin: string;
  glass: string;
  body(color: string, opts: { flip: boolean; lights: boolean }): ReactNode;
}

const f = (color: string) => ({ fill: color, ...ink });

/** Text that still reads when the vehicle is mirrored to face left. */
const label = (x: number, flip: boolean, children: ReactNode) => <g transform={flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined}>{children}</g>;

const CAR_CABIN = 'M -300 -196 L -222 -326 Q -214 -334 -200 -334 L 130 -334 Q 146 -334 154 -322 L 262 -196 Z';
const CAR_WINDOWS = 'M -268 -206 L -206 -318 L -42 -318 L -42 -206 Z M -14 -206 L -14 -318 L 126 -318 L 226 -206 Z';

function carBody(color: string, flip: boolean, police: boolean, lights: boolean): ReactNode {
  const panel = police ? '#f4f4f4' : color;
  return (
    <g>
      <path d={`${CAR_CABIN} ${CAR_WINDOWS}`} fillRule="evenodd" {...f(color)} />
      <path d="M -206 -318 L -180 -318 L -236 -214 L -258 -214 Z M 26 -318 L 52 -318 L 8 -232 L -10 -232 Z" fill="#fff" opacity={0.55} />
      <rect x={-386} y={-204} width={772} height={158} rx={44} {...f(color)} />
      {police && <rect x={-250} y={-196} width={460} height={142} {...f(panel)} />}
      <path d="M -28 -196 L -28 -56 M -250 -196 L -250 -60 M 210 -196 L 210 -60" stroke={shade(color, -0.35)} strokeWidth={4} />
      <rect x={-6} y={-176} width={34} height={10} rx={4} fill={shade(police ? '#1f1f22' : color, -0.4)} />
      <rect x={-226} y={-176} width={34} height={10} rx={4} fill={shade(police ? '#1f1f22' : color, -0.4)} />
      <rect x={354} y={-178} width={30} height={30} rx={6} {...f('#fff6a8')} strokeWidth={2} />
      <rect x={-386} y={-176} width={20} height={30} rx={4} {...f('#d33b2c')} strokeWidth={2} />
      <rect x={-396} y={-86} width={70} height={22} rx={8} {...f('#9aa3ad')} strokeWidth={2} />
      <rect x={326} y={-86} width={70} height={22} rx={8} {...f('#9aa3ad')} strokeWidth={2} />
      {police &&
        label(
          -20,
          flip,
          <text x={-20} y={-112} textAnchor="middle" fontFamily={DISPLAY} fontSize={50} fill="#1f1f22">
            POLICE
          </text>,
        )}
      {police && (
        <g>
          <rect x={-74} y={-366} width={148} height={34} rx={8} {...f('#3d3d44')} strokeWidth={2} />
          <rect x={-66} y={-360} width={62} height={22} rx={5} fill={lights ? '#ff4b3a' : '#a3241a'} />
          <rect x={4} y={-360} width={62} height={22} rx={5} fill={lights ? '#2f6bff' : '#1d3a8a'} />
        </g>
      )}
    </g>
  );
}

const BUS_CABIN = 'M -660 -440 Q -660 -470 -630 -470 L 420 -470 Q 450 -470 452 -440 L 452 -280 L -660 -280 Z';
const BUS_WINDOW_X = [-620, -470, -320, -170, -20, 130, 280];
const BUS_WINDOWS = BUS_WINDOW_X.map((x) => `M ${x} -300 L ${x} -430 L ${x + 130} -430 L ${x + 130} -300 Z`).join(' ');

function busBody(color: string, flip: boolean): ReactNode {
  return (
    <g>
      <path d={`M -660 -60 L -660 -440 Q -660 -470 -630 -470 L 420 -470 Q 450 -470 452 -440 L 460 -256 L 620 -246 Q 660 -242 660 -206 L 660 -74 Q 660 -54 640 -54 L -640 -54 Q -660 -54 -660 -60 Z ${BUS_WINDOWS}`} fillRule="evenodd" {...f(color)} />
      {BUS_WINDOW_X.map((x) => (
        <path key={x} d={`M ${x + 12} -420 L ${x + 34} -420 L ${x + 14} -380 L ${x + 6} -380 Z`} fill="#fff" opacity={0.55} />
      ))}
      <path d="M -660 -266 L 456 -266 M -660 -200 L 660 -200 M -660 -150 L 660 -150" stroke="#1d1d1d" strokeWidth={8} />
      {label(
        -170,
        flip,
        <text x={-170} y={-214} textAnchor="middle" fontFamily={DISPLAY} fontSize={50} fill="#1d1d1d">
          SCHOOL BUS
        </text>,
      )}
      <rect x={290} y={-262} width={110} height={196} rx={6} fill="none" stroke={shade(color, -0.35)} strokeWidth={5} />
      <path d="M 345 -262 L 345 -66" stroke={shade(color, -0.35)} strokeWidth={4} />
      <rect x={634} y={-232} width={26} height={30} rx={6} {...f('#fff6a8')} strokeWidth={2} />
      <circle cx={-640} cy={-450} r={10} {...f('#d33b2c')} strokeWidth={2} />
      <circle cx={430} cy={-450} r={10} {...f('#d33b2c')} strokeWidth={2} />
      <rect x={-672} y={-90} width={60} height={24} rx={6} {...f('#3d3d44')} strokeWidth={2} />
      <rect x={612} y={-90} width={60} height={24} rx={6} {...f('#3d3d44')} strokeWidth={2} />
    </g>
  );
}

export const VEHICLES: VehicleDef[] = [
  {
    id: 'car',
    name: 'Car',
    desc: 'family car with two windows: a driver and one passenger show through them (up to 4 ride).',
    defaultColor: '#3b6fd8',
    w: 780,
    wheels: [-230, 230],
    wheelR: 52,
    slots: [100, -150, -76, 24],
    headY: -262,
    door: 40,
    cabin: CAR_CABIN,
    glass: '#bfe6ff',
    body: (color, { flip }) => carBody(color, flip, false, false),
  },
  {
    id: 'police',
    name: 'Police Car',
    desc: 'black-and-white police car with a light bar that flashes while it drives.',
    defaultColor: '#1f1f22',
    w: 780,
    wheels: [-230, 230],
    wheelR: 52,
    slots: [100, -150, -76, 24],
    headY: -262,
    door: 40,
    cabin: CAR_CABIN,
    glass: '#bfe6ff',
    body: (color, { flip, lights }) => carBody(color, flip, true, lights),
  },
  {
    id: 'bus',
    name: 'School Bus',
    desc: 'long yellow school bus with a row of windows; the driver plus up to 6 kids show.',
    defaultColor: '#f2b705',
    w: 1320,
    wheels: [-400, 380],
    wheelR: 62,
    slots: [345, 195, 45, -105, -255, -405, -555],
    headY: -362,
    door: 420,
    cabin: BUS_CABIN,
    glass: '#bfe6ff',
    body: (color, { flip }) => busBody(color, flip),
  },
];

const BY_TYPE = new Map(VEHICLES.map((v) => [v.id, v]));

export function getVehicleDef(type: string): VehicleDef {
  return BY_TYPE.get(type as VehicleType) ?? VEHICLES[0];
}

/** A wheel; `spin` (degrees) turns the hub marks as it rolls. */
export function wheel(x: number, r: number, spin: number): ReactNode {
  return (
    <g key={x} transform={`rotate(${spin.toFixed(1)} ${x} ${-r})`}>
      <circle cx={x} cy={-r} r={r} {...f('#2b2b2f')} />
      <circle cx={x} cy={-r} r={r * 0.44} {...f('#c9c9c9')} strokeWidth={2} />
      <path d={`M ${x} ${-r} L ${x} ${-r - r * 0.4} M ${x} ${-r} L ${x + r * 0.35} ${-r + r * 0.2} M ${x} ${-r} L ${x - r * 0.35} ${-r + r * 0.2}`} stroke="#7a7a80" strokeWidth={4} />
    </g>
  );
}

export function vehicleCatalogForPrompt(): string {
  return VEHICLES.map((v) => `  ${v.id}: ${v.desc}`).join('\n');
}
