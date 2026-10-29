import { Composition, staticFile } from 'remotion'
import { Demo, type DemoProps, framesOf } from './Demo'
import { FPS, H, W } from './theme'

export function Root() {
  return (
    <Composition
      id="Demo"
      component={Demo}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={FPS * 10}
      defaultProps={{ final: false, scenes: [] } as DemoProps}
      // длины сцен — из manifest.json (npm run draft сначала запускает scripts/prepare.mjs)
      calculateMetadata={async ({ props }) => {
        const manifest = (await (await fetch(staticFile('manifest.json'))).json()) as DemoProps
        const scenes = manifest.scenes
        return { props: { ...props, final: manifest.final, scenes }, durationInFrames: scenes.reduce((sum, s) => sum + framesOf(s, FPS), 0) }
      }}
    />
  )
}
