import type { Track } from '@/types'
import { useStore } from '@/state/store'
import { clampTrackWidth } from '@/lib/track/buildTrack'

export function loadSample(sample: Track): void {
  const track = clampTrackWidth(sample)
  useStore.setState({
    track,
    trackWidth: track.width,
    margin: track.margin,
    selectedCorner: null,
    hoverIndex: null,
  })
}
