/**
 * Centralized UI strings. Default EN; add an ES map with the same keys to
 * localize.
 */
export const strings = {
  'app.name': 'Apex',
  'app.tagline': 'Racing line optimizer',

  'editor.draw': 'Draw track',
  'editor.clear': 'Clear',
  'editor.drawMode': 'Drawing tool',
  'editor.modeFreehand': 'Freehand',
  'editor.modePen': 'Pen',
  'editor.straightMode': 'Straight segments',
  'editor.straightHint': 'hold Shift',
  'editor.penHint': 'Click to add points · drag for curves · click the first point to close',
  'editor.emptyTitle': 'Draw your circuit',
  'editor.emptyBody':
    'Click and drag to sketch a track. Finish near where you started and it closes itself. Hold Shift for straights, or load a sample below.',
  'editor.emptyBodyPen':
    'Click to place anchor points, drag to pull out curve handles — like the pen tool. Click your first point to close the loop.',
  'editor.openStroke': 'Loop not closed. Finish near your starting point.',
  'editor.samples': 'Sample tracks',

  'track.width': 'Track width',
  'track.margin': 'Safety margin',

  'car.title': 'Car setup',
  'car.preset': 'Preset',
  'car.custom': 'Custom',
  'car.mass': 'Mass',
  'car.power': 'Power',
  'car.drag': 'Drag CdA',
  'car.downforce': 'Downforce ClA',
  'car.grip': 'Tire grip',
  'car.brakes': 'Brake force',
  'car.traction': 'Traction limit',

  'results.lapTime': 'Lap time',
  'results.trackLength': 'Track',
  'results.lineLength': 'Line',
  'results.topSpeed': 'Top speed',
  'results.computing': 'Computing…',
  'results.error': 'Compute failed',
  'results.corners': 'Corners',
  'results.speedTrace': 'Speed trace',

  'corner.entry': 'Entry',
  'corner.apex': 'Apex',
  'corner.exit': 'Exit',
  'corner.brake': 'Brake',
  'corner.radius': 'Min radius',
  'corner.before': 'before apex',
  'corner.noBraking': 'flat out',

  'units.metric': 'km/h',
  'units.imperial': 'mph',

  'io.export': 'Export JSON',
  'io.import': 'Import JSON',
  'io.importError': 'Could not read that file. Expected an Apex JSON export.',

  'legend.brake': 'Braking',
  'legend.slow': 'Slow',
  'legend.fast': 'Fast',
  'legend.apex': 'Apex',

  'sim.lapTime': 'Lap time',
  'sim.lap': 'Lap',
  'sim.corner': 'Corner',
  'sim.throttle': 'Throttle',
  'sim.brake': 'Brake',
  'sim.play': 'Play',
  'sim.pause': 'Pause',
  'sim.restart': 'Restart',
  'sim.loop': 'Loop',
  'sim.playbackSpeed': 'Speed',
} as const

export type StringKey = keyof typeof strings

export const t = (key: StringKey): string => strings[key]
