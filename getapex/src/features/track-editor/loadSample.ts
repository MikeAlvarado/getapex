import type { Track } from '@/types'
import { useStore } from '@/state/store'

export function loadSample(track: Track): void {
  useStore.setState({
    track,
    trackWidth: track.width,
    margin: track.margin,
    selectedCorner: null,
    hoverIndex: null,
  })
}
