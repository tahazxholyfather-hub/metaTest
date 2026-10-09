/** Paths for replaceable artwork. Swap the files — no code changes required. */

export const ASSETS = {
  studioLogo: 'assets/game/studio-logo-placeholder.png',
  cover: 'assets/game/cover-placeholder.png',
  seasons: {
    'season-1': 'assets/seasons/season-1-cover.png',
    'season-2': 'assets/seasons/season-2-cover.png',
    'season-3': 'assets/seasons/season-3-cover.png',
    'season-4': 'assets/seasons/season-4-cover.png',
  } as Record<string, string>,
  backgrounds: {
    'season-1': 'assets/seasons/season-1/bg-far.png',
    'season-2': 'assets/seasons/season-2/bg-far.png',
    'season-3': 'assets/seasons/season-3/bg-far.png',
    'season-4': 'assets/seasons/season-4/bg-far.png',
  } as Record<string, string>,
}

export async function preloadImages(urls: string[], onProgress: (t: number) => void): Promise<void> {
  let done = 0
  const unique = [...new Set(urls)]
  await Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          const finish = () => {
            done += 1
            onProgress(done / unique.length)
            resolve()
          }
          img.onload = finish
          img.onerror = finish
          img.src = url
        }),
    ),
  )
}
