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
    width: 8,
    margin: 0.3,
    controls: [
      p(-120, -70),
      p(-30, -85),
      p(60, -75),
      p(110, -40),
      p(90, 10),
      p(30, 20),
      p(10, 60),
      p(60, 90),
      p(10, 115),
      p(-70, 100),
      p(-100, 55),
      p(-60, 15),
      p(-95, -20),
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
]

export const SAMPLE_TRACKS: Track[] = SAMPLE_SPECS.map((spec) =>
  buildTrackFromControls(spec.controls, spec),
)
