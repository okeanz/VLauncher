/** The layout is drawn for an 800×600 window (neutralino.config.json). */
export const design = { width: 800, height: 600 };

/** CSS zoom that fits the 800×600 layout into the viewport; 1 when it already fits. */
export const fitZoom = (width: number, height: number) =>
  width <= 0 || height <= 0
    ? 1
    : Math.min(1, Math.floor(Math.min(width / design.width, height / design.height) * 1000) / 1000);

type SizeApi = {
  setSize: (options: {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
    resizable: boolean;
  }) => Promise<void>;
};
type View = Pick<Window, 'innerWidth' | 'innerHeight' | 'devicePixelRatio' | 'addEventListener'> & {
  screen: { availWidth: number; availHeight: number };
  document: { documentElement: { style: { zoom: string } } };
};

/**
 * With Windows display scaling above 100% Neutralino keeps the window at 800×600 physical pixels while the page
 * lays out at the display scale, so a player at 150% saw a third of the launcher cut off. Grow the window by the
 * scale, as far as the screen allows; whatever still does not fit is zoomed down to the window.
 */
export async function fitWindow(view: View = window, api?: SizeApi) {
  const applyZoom = () => {
    const zoom = fitZoom(view.innerWidth, view.innerHeight);
    view.document.documentElement.style.zoom = zoom < 1 ? String(zoom) : '';
  };
  view.addEventListener('resize', applyZoom);
  const scale = view.devicePixelRatio || 1;
  if (api && scale > 1 && fitZoom(view.innerWidth, view.innerHeight) < 1) {
    // Screen sizes are in layout pixels too; leave room for the taskbar.
    const factor = Math.min(
      scale,
      (view.screen.availWidth * scale) / design.width,
      (view.screen.availHeight * scale) / design.height,
    );
    const width = Math.round(design.width * factor);
    const height = Math.round(design.height * factor);
    await api
      .setSize({
        width,
        height,
        minWidth: width,
        minHeight: height,
        maxWidth: width,
        maxHeight: height,
        resizable: false,
      })
      .catch(() => {});
  }
  applyZoom();
}
