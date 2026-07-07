import type { Track, Vec2 } from '@/types'
import { buildTrackFromControls } from '@/lib/track/buildTrack'

interface SampleSpec {
  id: string
  name: string
  width: number
  margin: number
  controls: Vec2[]
}

const p = (x: number, y: number): Vec2 => ({ x, y })

const SAMPLE_SPECS: SampleSpec[] = [
  {
    id: 'sample-gp',
    name: 'Grand Prix',
    width: 12,
    margin: 0.5,
    controls: [
      p(-380, -180),
      p(-100, -210),
      p(150, -200),
      p(330, -160),
      p(390, -40),
      p(330, 60),
      p(210, 90),
      p(140, 180),
      p(10, 210),
      p(-130, 160),
      p(-160, 60),
      p(-260, 20),
      p(-360, 80),
      p(-410, -30),
      p(-400, -120),
    ],
  },
  {
    id: 'sample-kart',
    name: 'Kart Sprint',
    width: 7,
    margin: 0.3,
    controls: [
      p(-140, -65),
      p(-30, -90),
      p(60, -75),
      p(110, -40),
      p(90, 10),
      p(30, 20),
      p(-5, 50),
      p(55, 100),
      p(-5, 135),
      p(-75, 100),
      p(-105, 55),
      p(-65, 10),
      p(-110, -20),
    ],
  },
  {
    id: 'sample-oval',
    name: 'Speedway',
    width: 15,
    margin: 0.5,
    controls: [
      p(-250, -90),
      p(0, -108),
      p(250, -90),
      p(315, 0),
      p(250, 90),
      p(0, 108),
      p(-250, 90),
      p(-315, 0),
    ],
  },
  {
    id: 'sample-kart2',
    name: 'Paddock Kart',
    width: 7,
    margin: 0.3,
    controls: [
      p(-150, -50),
      p(-60, -100),
      p(60, -95),
      p(150, -50),
      p(180, 40),
      p(120, 110),
      p(30, 120),
      p(-40, 180),
      p(-140, 170),
      p(-195, 100),
      p(-145, 45),
      p(-200, -20),
    ],
  },
  {
    id: 'sample-city',
    name: 'Harbor City',
    width: 11,
    margin: 0.4,
    controls: [
      p(-300, -200),
      p(-300, 120),
      p(-260, 200),
      p(-150, 220),
      p(100, 220),
      p(180, 170),
      p(190, 40),
      p(150, -60),
      p(160, -140),
      p(90, -190),
      p(-30, -160),
      p(-90, -190),
      p(-90, -240),
      p(-260, -240),
    ],
  },
  {
    id: 'sample-spa',
    name: 'Ardennes GP',
    width: 13,
    margin: 0.5,
    controls: [
      p(60, 140),
      p(-10, 40),
      p(-60, -60),
      p(-40, -140),
      p(60, -150),
      p(150, -190),
      p(230, -260),
      p(300, -380),
      p(340, -560),
      p(300, -680),
      p(200, -700),
      p(140, -660),
      p(40, -600),
      p(-60, -520),
      p(-180, -460),
      p(-320, -380),
      p(-380, -260),
      p(-340, -140),
      p(-260, -60),
      p(-300, 60),
      p(-260, 180),
      p(-140, 260),
      p(0, 320),
      p(100, 300),
      p(120, 210),
    ],
  },
]

export const SAMPLE_TRACKS: Track[] = SAMPLE_SPECS.map((spec) =>
  buildTrackFromControls(spec.controls, spec),
)
